"""Independent, read-only source witness using the existing monitor identity.

Only a digest leaves memory. This proves an observed source snapshot, not the
meaning or correctness of a proposed formula/allocation. Never accepts an email
supplied spreadsheet ID, URL, range, command or credentials file.
"""
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import sys
from datetime import datetime, timezone

MODULE = pathlib.Path(__file__).with_name("monitor-celebration-sheet.py")
SPEC = importlib.util.spec_from_file_location("col_source_monitor", MODULE)
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


def observe(credentials_json, commit, run_id, *, fetcher=None, clock=None):
    if not credentials_json or not re.fullmatch(r"[a-f0-9]{40}", commit or ""):
        raise ValueError("Existing Viewer credentials and exact implementation commit required")
    if not re.fullmatch(r"[0-9]{1,24}", run_id or ""):
        raise ValueError("Hosted workflow identity required")
    fetcher = fetcher or monitor.fetch_workbook
    clock = clock or (lambda: datetime.now(timezone.utc))
    started = clock()
    workbook = fetcher(monitor.DEFAULT_SHEET_ID, credentials_json)
    if workbook.get("spreadsheetId") != monitor.DEFAULT_SHEET_ID or not workbook.get("sheets"):
        raise ValueError("Complete expected source workbook required")
    snapshot = monitor.semantic_snapshot(workbook)
    encoded = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    completed = clock()
    if (started.tzinfo is None or completed.tzinfo is None or completed < started
            or (completed - started).total_seconds() > 120):
        raise ValueError("Bounded independent observation clock required")
    return {
        "kind": "col-source-readonly-observation-v1",
        "sourceDigest": hashlib.sha256(encoded).hexdigest(),
        "digestFormat": "monitor-semantic-v1-json-sorted-compact-ascii",
        "startedAt": started.isoformat().replace("+00:00", "Z"),
        "observedAt": completed.isoformat().replace("+00:00", "Z"),
        "implementationCommit": commit,
        "workflowRunId": run_id,
        "scope": "spreadsheets.readonly",
        "qualification": "snapshot-only-not-formula-or-allocation-approval",
    }


def main():
    result = observe(os.environ.get("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"),
                     os.environ.get("GITHUB_SHA"), os.environ.get("GITHUB_RUN_ID"))
    sys.stdout.write(json.dumps(result, sort_keys=True, indent=2) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Provider exceptions can contain URLs, identifiers or source response
        # fragments. Never send them into public Actions logs.
        sys.stderr.write("CoL source witness failed; no source qualification established.\n")
        sys.exit(1)
