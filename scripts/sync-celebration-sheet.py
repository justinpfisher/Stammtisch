"""Prepare a verified, atomic Celebration website data refresh from Google Sheets API.

Read-only toward Google. The script writes only two allowlisted public-site data
files, and only after all input/research checks succeed. It never commits or
deploys; the workflow is responsible for tests, git, Pages and state promotion.
"""
import argparse
import copy
import importlib.util
import json
import pathlib
import sys
from datetime import date, datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED_SHEET_ID = "1B8tZFjIa5FsyBaex42Atg7pJ5Y86Lj1vHeJMRhrqrCY"

def load_module(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

importer = load_module("import-celebration.py", "celebration_importer")
verifier = load_module("verify-celebration-death.py", "celebration_verifier")

def column_name(index):
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters

def sheets_api_cells(workbook):
    """Map effective Sheets API grid values to the existing strict XLSX importer."""
    if workbook.get("spreadsheetId") != EXPECTED_SHEET_ID:
        raise ValueError("Unexpected spreadsheet identity")
    result = {}
    for sheet in workbook.get("sheets", []):
        title = sheet.get("properties", {}).get("title")
        if not title or title in result:
            raise ValueError("Missing or duplicate tab")
        cells = {}
        for grid in sheet.get("data", []):
            start_row, start_col = grid.get("startRow", 0), grid.get("startColumn", 0)
            for row_offset, row in enumerate(grid.get("rowData", [])):
                for col_offset, cell in enumerate(row.get("values", [])):
                    effective = cell.get("effectiveValue", cell.get("userEnteredValue", {}))
                    if "errorValue" in effective:
                        raise ValueError("Spreadsheet has a calculated cell error")
                    value = next((effective[k] for k in ("numberValue", "stringValue", "boolValue") if k in effective), None)
                    formula = cell.get("userEnteredValue", {}).get("formulaValue")
                    if value is None and formula is None:
                        continue
                    address = f"{column_name(start_col + col_offset)}{start_row + row_offset + 1}"
                    if address in cells:
                        raise ValueError("Overlapping Sheet data regions")
                    cells[address] = {"value":value, "formula":formula.lstrip("=") if formula else None}
        result[title] = cells
    if set(result) != {"LEADERBOARD", "buttons", *importer.MEMBERS}:
        raise ValueError("Spreadsheet tab mapping changed; review required")
    return result

def public_material(data):
    """Discard only derived ageing and timestamp noise when deciding to publish."""
    result = copy.deepcopy(data)
    result.pop("capturedAt", None)
    result.pop("asOf", None)
    for member in result["members"]:
        for pick in member["picks"]:
            if not pick["counted"] and not pick["dateOfPassing"]:
                pick.pop("ageText", None)
                pick.pop("points", None)
    return result

def verified_evidence(pick):
    source = pick.get("actualDeathSource") or pick.get("dateSource") or {}
    confirmed_date = pick.get("actualDeathDate") or (pick.get("dateSource") or {}).get("dateOfPassing")
    if (confirmed_date and source.get("sourceUrl", "").startswith("https://")
            and source.get("sourceLabel") and source.get("verifiedOn")):
        return {"actualDeathDate":confirmed_date, "sourceUrl":source["sourceUrl"],
                "sourceLabel":source["sourceLabel"], "verifiedOn":source["verifiedOn"]}
    return None

def newly_reported_deaths(existing, proposed):
    previous = {p["id"]:p for m in existing["members"] for p in m["picks"]}
    for member in proposed["members"]:
        for pick in member["picks"]:
            old = previous.get(pick["id"])
            same_person = old and (old["name"], old["born"]) == (pick["name"], pick["born"])
            now_reported = pick["dateOfPassing"] is not None or pick["counted"]
            # A previously scored but undated record is not proof of death:
            # verify when its first date is added, without rechecking unchanged
            # existing incomplete records on unrelated spreadsheet edits.
            new_identity = not same_person
            newly_dated = same_person and old["dateOfPassing"] is None and pick["dateOfPassing"] is not None
            newly_counted = same_person and not old["counted"] and pick["counted"]
            if now_reported and (new_identity or newly_dated or newly_counted):
                yield member["id"], pick

def prepare(workbook, existing, confirmations, checked_at, allow_research=True):
    sheets = sheets_api_cells(workbook)
    candidate = importer.import_data(None, checked_at, confirmations, sheets=sheets)
    if candidate["year"] != existing["year"]:
        raise ValueError("New pool season requires review of draft and award rules")
    if not candidate["asOf"] or candidate["asOf"] < existing["asOf"]:
        raise ValueError("Spreadsheet snapshot date regressed or is missing")
    if candidate["asOf"] > datetime.now(timezone.utc).date().isoformat():
        # Sheets may use Eastern Time. A future date, however, is never acceptable.
        raise ValueError("Spreadsheet snapshot date is in the future")
    known_sources = {}
    for member in candidate["members"]:
        for pick in member["picks"]:
            evidence = verified_evidence(pick)
            if evidence:
                known_sources[(pick["name"], pick["born"])] = evidence
    to_append, missing, researched = [], 0, {}
    for member_id, pick in newly_reported_deaths(existing, candidate):
        if not pick["dateOfPassing"]:
            missing += 1  # Do not invent when the club learned of a passing.
            continue
        identity = (pick["name"], pick["born"])
        evidence = known_sources.get(identity)
        if not evidence and allow_research:
            if identity not in researched:
                researched[identity] = verifier.research(pick["name"], pick["born"], pick["dateOfPassing"])
            evidence = researched[identity]
        if not evidence:
            missing += 1
            continue
        if evidence["actualDeathDate"] > pick["dateOfPassing"]:
            missing += 1
            continue
        if not verified_evidence(pick):
            to_append.append({"memberId":member_id, "name":pick["name"],
                              "born":pick["born"], **evidence})
            known_sources[identity] = evidence
    if missing:
        return {"status":"review_required", "pending":missing, "publish":False,
                "confirmationsAdded":0}, None, None
    combined = confirmations + to_append
    if to_append:
        candidate = importer.import_data(None, checked_at, combined, sheets=sheets)
    changed = public_material(candidate) != public_material(existing)
    return {"status":"ready", "pending":0, "publish":changed,
            "confirmationsAdded":len(to_append)}, (candidate if changed else None), (combined if to_append else None)

def failure_code(exc):
    """Return a metadata-only diagnostic label; never publish Sheet content."""
    message = str(exc)
    codes = (
        ("Unexpected spreadsheet identity", "spreadsheet_identity"),
        ("Missing or duplicate tab", "tab_identity"),
        ("Spreadsheet has a calculated cell error", "cell_calculation"),
        ("Overlapping Sheet data regions", "overlapping_regions"),
        ("Spreadsheet tab mapping changed", "unsupported_tabs"),
        ("Sheet names changed", "unsupported_tabs"),
        ("Unrecognized total formula", "unsupported_score_formula"),
        ("Invalid points in", "invalid_point_value"),
        ("Member sheets have inconsistent snapshot dates", "inconsistent_snapshot_dates"),
        ("The imported entries do not reconcile", "member_score_mismatch"),
        ("The number of picks changed", "selection_count_mismatch"),
        ("Cannot match leaderboard column", "leaderboard_column_formula"),
        ("Leaderboard total differs", "leaderboard_score_mismatch"),
        ("Leaderboard/name mismatch", "leaderboard_selection_mismatch"),
        ("A confirmed record no longer matches", "confirmed_record_identity"),
        ("The record conflicts with a verified actual death date", "verified_date_conflict"),
        ("The sheet conflicts with a verified date of passing", "confirmed_sheet_date_conflict"),
        ("New pool season requires review", "season_review"),
        ("Spreadsheet snapshot date regressed or is missing", "snapshot_date_regressed"),
        ("Spreadsheet snapshot date is in the future", "future_snapshot_date"),
    )
    for prefix, code in codes:
        if message.startswith(prefix):
            return code
    return "unclassified_validation_error" if isinstance(exc, ValueError) else "internal_processing_error"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", type=pathlib.Path, required=True)
    parser.add_argument("--existing", type=pathlib.Path, default=ROOT / "data/celebration.json")
    parser.add_argument("--confirmations", type=pathlib.Path, default=ROOT / "data/celebration-confirmations.json")
    parser.add_argument("--status", type=pathlib.Path, required=True)
    parser.add_argument("--checked-at", required=True)
    parser.add_argument("--disable-research", action="store_true")
    args = parser.parse_args()
    workbook = json.loads(args.workbook.read_text(encoding="utf-8"))
    existing = json.loads(args.existing.read_text(encoding="utf-8"))
    confirmations = json.loads(args.confirmations.read_text(encoding="utf-8"))
    datetime.fromisoformat(args.checked_at.replace("Z", "+00:00"))
    try:
        result, data, combined = prepare(workbook, existing, confirmations, args.checked_at,
                                         allow_research=not args.disable_research)
    except Exception as exc:
        # No private names, values, formulas, dates, or source snippets in public
        # GitHub logs/issues. The failure label is a fixed, allowlisted code.
        args.status.parent.mkdir(parents=True, exist_ok=True)
        args.status.write_text(json.dumps({"status": "failed", "errorCode": failure_code(exc)}),
                               encoding="utf-8")
        raise
    args.status.parent.mkdir(parents=True, exist_ok=True)
    args.status.write_text(json.dumps(result), encoding="utf-8")
    if result["status"] != "ready":
        raise ValueError("One or more newly reported deaths require independent verification")
    if data is not None:
        args.existing.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if combined is not None:
        args.confirmations.write_text(json.dumps(combined, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Site data " + ("prepared" if data else "already current") +
          f"; corroborated new records: {result['confirmationsAdded']}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Celebration site sync stopped safely: " + type(exc).__name__, file=sys.stderr)
        raise SystemExit(1)
