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
import re
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

# These are the established six public member identities. B1 is an independent
# check when a tab has been renamed; the tab title alone must not determine who
# receives a score. Never infer a seventh member or a new season automatically.
MEMBER_LABELS = {
    "matt": "Matt", "fish": "Justin", "jerome": "Jerome",
    "ken": "Ken", "marc": "Marc", "jamie": "Jamie",
}
KNOWN_BUTTONS = {
    "rainmaker", "droughtmaker", "cavalcade of calamity",
    "copycat", "hand of providence", "summit in purgatory",
}
# Google Sheets may quote/escape tab titles and may use absolute cell references.
MEMBER_SCORE_REF = re.compile(
    r"(?P<sheet>'(?:[^']|'')+'|[A-Za-z_][\w]*)!\$?E\$?1\b", re.I
)


def normalized_label(value):
    return " ".join(str(value or "").split()).casefold()


def looks_like_member_tab(cells):
    def value(address):
        return cells.get(address, {}).get("value")
    return (
        isinstance(value("A1"), (int, float))
        and isinstance(value("B1"), str)
        and isinstance(value("E1"), (int, float))
        and bool(cells.get("E1", {}).get("formula"))
        and isinstance(value("B3"), str)
    )


def looks_like_leaderboard(cells):
    return (
        isinstance(cells.get("A1", {}).get("value"), (int, float))
        and all(isinstance(cells.get(f"{col}2", {}).get("value"), (int, float))
                and bool(MEMBER_SCORE_REF.search(cells.get(f"{col}2", {}).get("formula") or ""))
                for col in "BCDEFG")
    )


def looks_like_buttons(cells):
    names = {
        normalized_label(cell.get("value"))
        for ref, cell in cells.items()
        if re.fullmatch(r"A(?:[2-9]|[1-9]\d+)", ref)
        and isinstance(cell.get("value"), str)
    }
    return len(KNOWN_BUTTONS & names) >= 3


def canonical_sheet_mapping(tabs):
    """Resolve verified identities despite simple renames; reject ambiguity.

    This is **not** a best-effort fuzzy matcher. Required tabs must map uniquely,
    and unfamiliar additional tabs are never discarded from the site import.
    """
    expected = ["LEADERBOARD", "buttons", *importer.MEMBERS]
    mapped, assigned = {}, set()

    # Exact case/whitespace variants are safe for established logical tabs.
    for target in expected:
        choices = [title for title in tabs if normalized_label(title) == normalized_label(target)]
        if len(choices) > 1:
            raise ValueError("Ambiguous tab identity in live workbook")
        if choices:
            mapped[target] = choices[0]
            assigned.add(choices[0])

    for member_id, label in MEMBER_LABELS.items():
        if member_id in mapped:
            continue
        options = [
            title for title, cells in tabs.items()
            if title not in assigned
            and looks_like_member_tab(cells)
            and normalized_label(cells["B1"]["value"]) == normalized_label(label)
        ]
        if len(options) > 1:
            raise ValueError("Ambiguous member tab identity in live workbook")
        if len(options) == 1:
            mapped[member_id] = options[0]
            assigned.add(options[0])

    for role, predicate in (
        ("LEADERBOARD", looks_like_leaderboard),
        ("buttons", looks_like_buttons),
    ):
        if role in mapped:
            continue
        options = [
            title for title, cells in tabs.items()
            if title not in assigned and predicate(cells)
        ]
        if len(options) > 1:
            raise ValueError("Ambiguous supporting tab identity in live workbook")
        if len(options) == 1:
            mapped[role] = options[0]
            assigned.add(options[0])

    missing = set(expected) - set(mapped)
    extra = set(tabs) - assigned
    if missing and extra:
        raise ValueError("Expected tabs missing and additional unmapped tabs present")
    if missing:
        raise ValueError("Expected tabs missing from live workbook")
    if extra:
        raise ValueError("Additional unmapped tabs present in live workbook")
    # An exact tab name is not sufficient authority to assign its contents to a
    # member. A worksheet accidentally swapped or repurposed under the same
    # title must not silently reassign people or scores.
    for member_id, expected_label in MEMBER_LABELS.items():
        member_cells = tabs[mapped[member_id]]
        if (not looks_like_member_tab(member_cells)
                or normalized_label(member_cells["B1"]["value"]) != normalized_label(expected_label)):
            raise ValueError("Member tab content does not match its verified club identity")
    if not looks_like_leaderboard(tabs[mapped["LEADERBOARD"]]):
        raise ValueError("Leaderboard structure changed; manual mapping review required")
    if not looks_like_buttons(tabs[mapped["buttons"]]):
        raise ValueError("Button tab structure changed; manual mapping review required")
    return mapped


def original_sheet_reference(ref):
    if ref.startswith("'") and ref.endswith("'"):
        return ref[1:-1].replace("''", "'")
    return ref


def normalise_board_member_links(board, mapping):
    """Rewrite references solely in the ephemeral import copy, never Google.

    The legacy importer understands canonical names such as 'matt!E1'.
    Resolve Google formulas against the verified actual tab names instead of
    trusting a substring match when tab titles change.
    """
    lookup = {normalized_label(raw_title): member_id
              for member_id, raw_title in mapping.items() if member_id in importer.MEMBERS}
    # Accept canonical aliases where Google preserves old spelling.
    lookup.update({normalized_label(member_id): member_id for member_id in importer.MEMBERS})
    mapped_members = []
    for col in "BCDEFG":
        entry = board.get(f"{col}2")
        formula = entry.get("formula") if entry else None
        hits = list(MEMBER_SCORE_REF.finditer(formula or ""))
        if len(hits) != 1:
            raise ValueError("Cannot resolve leaderboard member formula safely")
        hit = hits[0]
        sheet_label = original_sheet_reference(hit.group("sheet"))
        member_id = lookup.get(normalized_label(sheet_label))
        if member_id is None:
            raise ValueError("Leaderboard references an unmapped member tab")
        mapped_members.append(member_id)
        entry["formula"] = (
            formula[:hit.start()] + f"{member_id}!E1" + formula[hit.end():]
        )
    if set(mapped_members) != set(importer.MEMBERS):
        raise ValueError("Leaderboard does not reference each member exactly once")


def sheets_api_cells(workbook):
    """Convert the live authorised Sheets response into a verified canonical map.

    Never send the private workbook into public logs or GitHub Issues.
    """
    if workbook.get("spreadsheetId") != EXPECTED_SHEET_ID:
        raise ValueError("Unexpected spreadsheet identity")
    tabs = {}
    for sheet in workbook.get("sheets", []):
        title = sheet.get("properties", {}).get("title")
        if not isinstance(title, str) or not title or title in tabs:
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
                    cells[address] = {"value": value, "formula": formula.lstrip("=") if formula else None}
        tabs[title] = cells
    mapping = canonical_sheet_mapping(tabs)
    canonical = {name: copy.deepcopy(tabs[title]) for name, title in mapping.items()}
    # The existing XLSX importer remains the final score/selection authority.
    # Only the transient leaderboard formulas are normalized to its expected ids.
    normalise_board_member_links(canonical["LEADERBOARD"], mapping)
    return canonical


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
    # Previously verified death dates remain authoritative after a later Sheet
    # correction. Otherwise an old group discovery date can be accidentally
    # moved to *before* the independently established death without triggering
    # the "newly reported" gate.
    for member in candidate["members"]:
        for pick in member["picks"]:
            recorded = pick.get("dateOfPassing")
            actual = pick.get("actualDeathDate") or (pick.get("dateSource") or {}).get("dateOfPassing")
            if recorded and actual and recorded < actual:
                raise ValueError("Club discovery date precedes the verified actual death date")
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
        ("Ambiguous tab identity", "ambiguous_tab_identity"),
        ("Ambiguous member tab identity", "ambiguous_member_identity"),
        ("Ambiguous supporting tab identity", "ambiguous_supporting_tab"),
        ("Cannot resolve leaderboard member formula safely", "leaderboard_formula_unresolved"),
        ("Leaderboard references an unmapped member tab", "leaderboard_unmapped_reference"),
        ("Leaderboard does not reference each member exactly once", "leaderboard_duplicate_reference"),
        ("Expected tabs missing and additional unmapped tabs present", "missing_and_extra_tabs"),
        ("Expected tabs missing from live workbook", "required_tabs_missing"),
        ("Additional unmapped tabs present in live workbook", "extra_tabs_present"),
        ("Sheet names changed", "unsupported_tabs"),
        ("Member tab content does not match its verified club identity", "member_identity_conflict"),
        ("Leaderboard structure changed", "leaderboard_structure_changed"),
        ("Button tab structure changed", "button_tab_structure_changed"),
        ("Club discovery date precedes", "discovery_precedes_death"),
        ("Selection number or extra entry label is invalid", "invalid_selection_number"),
        ("The numbered selections must contain every position", "duplicate_or_missing_selection"),
        ("A member has duplicate celebrity selections", "duplicate_member_selection"),
        ("Counted score formula references a missing", "missing_counted_selection"),
        ("The member total formula repeats a source row", "duplicate_score_reference"),
        ("Selection birth date is missing", "invalid_birth_date"),
        ("Recorded passing date is outside", "invalid_recorded_death_date"),
        ("A counted passing lacks a valid recorded date", "counted_passing_date_missing"),
        ("Selection points must be numeric", "invalid_points_type"),
        ("A numbered selection name is blank", "blank_selection_name"),
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
