"""Read-only semantic monitor for the Celebration Google Sheet.

The encrypted state intentionally records workbook structure, not a plaintext
copy in this public repository.  It never calls a Sheets write endpoint.
"""
import argparse
import copy
import hashlib
import json
import os
import pathlib
import sys
from datetime import datetime, timezone

DEFAULT_SHEET_ID = "1B8tZFjIa5FsyBaex42Atg7pJ5Y86Lj1vHeJMRhrqrCY"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
STATE_VERSION = 1


def prune(value):
    """Drop empty API fields while retaining false, zero, and empty strings."""
    if isinstance(value, dict):
        return {key: prune(item) for key, item in sorted(value.items())
                if item is not None and item != {} and item != []}
    if isinstance(value, list):
        return [prune(item) for item in value]
    return value


def semantic_snapshot(workbook):
    """Keep entered content and meaningful structure; intentionally omit recalc output."""
    if not isinstance(workbook.get("spreadsheetId"), str) or not isinstance(workbook.get("sheets"), list):
        raise ValueError("Sheets response does not have the expected workbook schema")
    sheets = {}
    for sheet in workbook.get("sheets", []):
        properties = copy.deepcopy(sheet.get("properties", {}))
        if not isinstance(properties.get("sheetId"), int) or not isinstance(properties.get("title"), str):
            raise ValueError("Sheets response has invalid tab properties")
        sheet_id = str(properties["sheetId"])
        cells, row_properties, column_properties = {}, {}, {}
        grid_data = sheet.get("data", [])
        if not isinstance(grid_data, list):
            raise ValueError("Sheets response has invalid grid data")
        for grid in grid_data:
            if not isinstance(grid, dict):
                raise ValueError("Sheets response has invalid grid data")
            start_row, start_column = grid.get("startRow", 0), grid.get("startColumn", 0)
            for offset, row in enumerate(grid.get("rowData", grid.get("rowData", []))):
                for col_offset, cell in enumerate(row.get("values", [])):
                    relevant = {key: copy.deepcopy(cell[key]) for key in (
                        "userEnteredValue", "note", "userEnteredFormat", "effectiveFormat",
                        "dataValidation", "textFormatRuns") if key in cell}
                    if relevant:
                        cells[f"{start_row + offset}:{start_column + col_offset}"] = prune(relevant)
            for offset, metadata in enumerate(grid.get("rowMetadata", [])):
                if metadata:
                    row_properties[str(start_row + offset)] = prune(copy.deepcopy(metadata))
            for offset, metadata in enumerate(grid.get("columnMetadata", [])):
                if metadata:
                    column_properties[str(start_column + offset)] = prune(copy.deepcopy(metadata))
        sheets[sheet_id] = prune({
            "properties": properties,
            "cells": cells,
            "rowProperties": row_properties,
            "columnProperties": column_properties,
            "merges": copy.deepcopy(sheet.get("merges", [])),
            "conditionalFormats": copy.deepcopy(sheet.get("conditionalFormats", [])),
            "bandedRanges": copy.deepcopy(sheet.get("bandedRanges", [])),
            "charts": copy.deepcopy(sheet.get("charts", [])),
            "filterViews": copy.deepcopy(sheet.get("filterViews", [])),
            "protectedRanges": copy.deepcopy(sheet.get("protectedRanges", [])),
            "slicers": copy.deepcopy(sheet.get("slicers", [])),
            "tables": copy.deepcopy(sheet.get("tables", [])),
            "developerMetadata": copy.deepcopy(sheet.get("developerMetadata", [])),
        })
    if not sheets:
        raise ValueError("Sheets response contains no tabs")
    return prune({"version": STATE_VERSION, "spreadsheetId": workbook["spreadsheetId"],
                  "properties": copy.deepcopy(workbook.get("properties", {})),
                  "namedRanges": copy.deepcopy(workbook.get("namedRanges", [])),
                  "developerMetadata": copy.deepcopy(workbook.get("developerMetadata", [])),
                  "dataSources": copy.deepcopy(workbook.get("dataSources", [])), "sheets": sheets})


def a1(key):
    row, column = map(int, key.split(":"))
    column += 1
    letters = ""
    while column:
        column, remainder = divmod(column - 1, 26)
        letters = chr(65 + remainder) + letters
    return f"{letters}{row + 1}"


def changes_between(before, after):
    if before.get("version") != STATE_VERSION:
        raise ValueError("Unsupported monitor state version")
    if before.get("spreadsheetId") != after.get("spreadsheetId"):
        raise ValueError("Baseline belongs to a different spreadsheet")
    old, new = before["sheets"], after["sheets"]
    if not old or not new:
        raise ValueError("Baseline or current response has no tabs")
    changes = []
    for key, kind in (("properties", "spreadsheet_properties"), ("namedRanges", "named_ranges"),
                      ("developerMetadata", "developer_metadata"), ("dataSources", "data_sources")):
        if before.get(key) != after.get(key):
            changes.append({"kind": kind, "sheetId": None})
    for sheet_id in sorted(set(old) | set(new), key=int):
        if sheet_id not in old:
            changes.append({"kind": "tab_added", "sheetId": sheet_id})
        elif sheet_id not in new:
            changes.append({"kind": "tab_deleted", "sheetId": sheet_id})
        else:
            left, right = old[sheet_id], new[sheet_id]
            old_title, new_title = left["properties"].get("title"), right["properties"].get("title")
            if old_title != new_title:
                changes.append({"kind": "tab_renamed", "sheetId": sheet_id})
            for key, kind in (("properties", "tab_properties"), ("cells", "cells"),
                              ("rowProperties", "row_properties"), ("columnProperties", "column_properties"),
                              ("merges", "merges"), ("conditionalFormats", "conditional_formats"),
                              ("bandedRanges", "banded_ranges"), ("charts", "charts"), ("filterViews", "filter_views"),
                              ("protectedRanges", "protected_ranges"), ("slicers", "slicers"), ("tables", "tables"),
                              ("developerMetadata", "developer_metadata")):
                if left.get(key) != right.get(key):
                    change = {"kind": kind, "sheetId": sheet_id}
                    if key == "cells":
                        changed = sorted(set(left.get(key, {})) ^ set(right.get(key, {})) |
                                         {cell for cell in set(left.get(key, {})) & set(right.get(key, {}))
                                          if left[key][cell] != right[key][cell]})
                        change["cells"] = [a1(cell) for cell in changed[:50]]
                        change["cellCount"] = len(changed)
                    changes.append(change)
    return changes


def encrypt_state(snapshot, key):
    from cryptography.fernet import Fernet
    raw = json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return Fernet(key.encode("ascii")).encrypt(raw)


def decrypt_state(path, key):
    from cryptography.fernet import Fernet, InvalidToken
    try:
        raw = Fernet(key.encode("ascii")).decrypt(path.read_bytes())
        return json.loads(raw)
    except (InvalidToken, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Cannot decrypt monitor baseline; check MONITOR_STATE_KEY and artifact integrity") from exc


def fetch_workbook(spreadsheet_id, credentials_json):
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account
    try:
        info = json.loads(credentials_json)
    except json.JSONDecodeError as exc:
        raise ValueError("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON is not valid JSON") from exc
    credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    response = AuthorizedSession(credentials).get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}",
        params={"includeGridData": "true"}, timeout=60)
    if response.status_code != 200:
        raise RuntimeError(f"Sheets API request failed: HTTP {response.status_code}")
    workbook = response.json()
    if workbook.get("spreadsheetId") != spreadsheet_id:
        raise ValueError("Sheets API returned an unexpected spreadsheet")
    return workbook


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=pathlib.Path, required=True)
    parser.add_argument("--previous-baseline", type=pathlib.Path)
    parser.add_argument("--report", type=pathlib.Path, help="encrypted detailed comparison report")
    parser.add_argument("--initialize", action="store_true")
    parser.add_argument("--spreadsheet-id", default=os.environ.get("SPREADSHEET_ID", DEFAULT_SHEET_ID))
    parser.add_argument("--credentials-json", default=os.environ.get("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"))
    parser.add_argument("--state-key", default=os.environ.get("MONITOR_STATE_KEY"))
    args = parser.parse_args()
    if not args.credentials_json or not args.state_key:
        raise ValueError("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON and MONITOR_STATE_KEY are required")
    # Fetch before touching a baseline. Failed authentication/network calls preserve it.
    current = semantic_snapshot(fetch_workbook(args.spreadsheet_id, args.credentials_json))
    previous_path = args.previous_baseline or args.baseline
    if args.initialize:
        if previous_path.exists():
            raise FileExistsError("A baseline already exists; initialization will not overwrite it")
        result = {"status": "initialized", "changed": False, "changes": []}
    elif not previous_path.exists():
        raise FileNotFoundError("No baseline is available. Run workflow_dispatch with initialize=true.")
    else:
        previous = decrypt_state(previous_path, args.state_key)
        changes = changes_between(previous, current)
        result = {"status": "changed" if changes else "unchanged", "changed": bool(changes), "changes": changes}
        result["alertKey"] = hashlib.sha256(json.dumps(
            {"before": previous, "after": current, "changes": changes}, sort_keys=True).encode()).hexdigest()
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            # This can contain entered values and therefore must always be encrypted.
            args.report.write_bytes(encrypt_state({"before": previous, "after": current, "changes": changes}, args.state_key))
    args.baseline.parent.mkdir(parents=True, exist_ok=True)
    args.baseline.write_bytes(encrypt_state(current, args.state_key))
    result["checkedAt"] = datetime.now(timezone.utc).isoformat()
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"sheet-monitor error: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1)
