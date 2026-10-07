"""Mapping contract, reconstructed from the already-public verified register.

The private Google Sheet must never be committed as a fixture. These tests
reconstruct the documented eight-tab cell layout from the published public
register, and exercise the real Google API mapper plus the XLSX importer.
"""
import copy
import datetime as dt
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("celebration_sync_contract", ROOT / "scripts/sync-celebration-sheet.py")
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)
PUBLIC = json.loads((ROOT / "data/celebration.json").read_text(encoding="utf-8"))
CONFIRMATIONS = json.loads((ROOT / "data/celebration-confirmations.json").read_text(encoding="utf-8"))
REF = dt.date(1899, 12, 30)


def serial(value):
    return (dt.date.fromisoformat(value) - REF).days if value else None


def cell(value=None, formula=None):
    return {"value": value, "formula": formula}


def public_as_sheet_cells():
    """Create a complete and repeatable 301-entry sheet mapping fixture."""
    board = {"A1": cell(PUBLIC["year"])}
    sheets = {"LEADERBOARD": board, "buttons": {}}
    for i, member in enumerate(PUBLIC["members"]):
        source = {
            "A1": cell(serial(PUBLIC["asOf"])),
            "B1": cell(member["name"]),
            "E1": cell(member["score"], "SUM(" + ",".join(
                "E" + str(p["sourceRow"]) for p in member["picks"] if p["counted"]
            ) + ")"),
        }
        for pick in member["picks"]:
            row = pick["sourceRow"]
            source[f"A{row}"] = cell(pick["pick"])
            source[f"B{row}"] = cell(pick["sourceName"])
            source[f"C{row}"] = cell(serial(pick["born"]))
            source[f"D{row}"] = cell(
                serial(pick["dateOfPassing"]) if pick["dateOfPassing"] else pick["ageText"]
            )
            source[f"E{row}"] = cell(pick["points"], pick["pointsFormula"])
            if isinstance(pick["pick"], int):
                board[f"{'BCDEFG'[i]}{pick['pick']+2}"] = cell(pick["sourceName"])
        board[f"{'BCDEFG'[i]}2"] = cell(member["score"], f"{member['id']}!E1")
        sheets[member["id"]] = source
    for row, distinction in enumerate(PUBLIC["distinctions"], 2):
        sheets["buttons"][f"A{row}"] = cell(distinction["name"])
        sheets["buttons"][f"B{row}"] = cell(distinction["reason"])
        sheets["buttons"][f"C{row}"] = cell(distinction["imageIdea"])
    return sheets


def to_api(sheets):
    """Google's grid shape with effective values and entered formula cells."""
    result = {"spreadsheetId": sync.EXPECTED_SHEET_ID, "sheets": []}
    for sheet_id, (title, cells) in enumerate(sheets.items(), 10):
        rows = {}
        for address, record in cells.items():
            match = __import__("re").fullmatch(r"([A-Z]+)(\d+)", address)
            if not match:
                raise AssertionError(address)
            col = 0
            for letter in match.group(1):
                col = col * 26 + ord(letter) - 64
            col -= 1
            row = int(match.group(2)) - 1
            while len(rows.setdefault(row, [])) <= col:
                rows[row].append({})
            data = {}
            value = record["value"]
            if value is not None:
                kind = "stringValue" if isinstance(value, str) else "numberValue"
                data["effectiveValue"] = {kind: value}
                if not record["formula"]:
                    data["userEnteredValue"] = {kind: value}
            if record["formula"]:
                data["userEnteredValue"] = {"formulaValue": "=" + record["formula"]}
            rows[row][col] = data
        n = max(rows) + 1
        grid_rows = [{"values": rows.get(row, [])} for row in range(n)]
        result["sheets"].append({
            "properties": {"sheetId": sheet_id, "title": title},
            "data": [{"startRow": 0, "rowData": grid_rows}],
        })
    return result


class FullMappingContractTests(unittest.TestCase):
    def test_all_public_tabs_members_scores_dates_buttons_roundtrip(self):
        mapped = sync.sheets_api_cells(to_api(public_as_sheet_cells()))
        result = sync.importer.import_data(None, PUBLIC["capturedAt"], CONFIRMATIONS, sheets=mapped)
        self.assertEqual(result["asOf"], PUBLIC["asOf"])
        self.assertEqual(result["year"], PUBLIC["year"])
        self.assertEqual(set(mapped), {"LEADERBOARD", "buttons", *sync.importer.MEMBERS})
        self.assertEqual([x["name"] for x in result["distinctions"]],
                         [x["name"] for x in PUBLIC["distinctions"]])
        self.assertEqual(len(result["members"]), 6)
        self.assertEqual(sum(len(m["picks"]) for m in result["members"]), 301)
        for expected, actual in zip(PUBLIC["members"], result["members"]):
            self.assertEqual((actual["id"], actual["score"], actual["name"]),
                             (expected["id"], expected["score"], expected["name"]))
            self.assertEqual(len([p for p in actual["picks"] if isinstance(p["pick"], int)]), 50)
            self.assertEqual(len(set(p["pick"] for p in actual["picks"] if isinstance(p["pick"], int))), 50)
            for old, pick in zip(expected["picks"], actual["picks"]):
                for key in ("id", "pick", "name", "born", "dateOfPassing",
                            "points", "counted", "sourceRow"):
                    self.assertEqual(pick[key], old[key], f"{expected['id']} {pick['id']} {key}")
            self.assertEqual(actual["score"],
                             sum(p["points"] for p in actual["picks"] if p["counted"]))

    def test_duplicate_position_fails_closed_even_with_fifty_rows(self):
        sheets = public_as_sheet_cells()
        sheets["jerome"]["A4"]["value"] = sheets["jerome"]["A3"]["value"]
        with self.assertRaisesRegex(ValueError, "position from 1 to 50 exactly once"):
            sync.importer.import_data(None, PUBLIC["capturedAt"], CONFIRMATIONS, sheets=sheets)

    def test_missing_counted_selection_reference_fails_closed(self):
        sheets = public_as_sheet_cells()
        score_formula = sheets["jerome"]["E1"]["formula"]
        sheets["jerome"]["E1"]["formula"] = score_formula[:-1] + ",E999)"
        with self.assertRaisesRegex(ValueError, "missing selection row"):
            sync.importer.import_data(None, PUBLIC["capturedAt"], CONFIRMATIONS, sheets=sheets)

    def test_repeated_counted_reference_fails_closed(self):
        sheets = public_as_sheet_cells()
        counted = next(p for p in PUBLIC["members"][2]["picks"] if p["counted"])
        score_formula = sheets["jerome"]["E1"]["formula"]
        sheets["jerome"]["E1"]["formula"] = score_formula[:-1] + f",E{counted['sourceRow']})"
        with self.assertRaisesRegex(ValueError, "repeats a source row"):
            sync.importer.import_data(None, PUBLIC["capturedAt"], CONFIRMATIONS, sheets=sheets)

    def test_existing_confirmed_date_backfills_undated_scored_source_row(self):
        # Historically, the source scored Dolly Parton before entering a date
        # in its D column. The reviewed confirmation supplies the verified date.
        # Do not re-award the 20 points or reject this legitimate old workbook.
        sheets = public_as_sheet_cells()
        dolly = next(p for p in PUBLIC["members"][-1]["picks"] if p["name"] == "Dolly Parton")
        sheets["jamie"][f"D{dolly['sourceRow']}"]["value"] = None
        imported = sync.importer.import_data(
            None, PUBLIC["capturedAt"], CONFIRMATIONS, sheets=sheets
        )
        jamie = next(m for m in imported["members"] if m["id"] == "jamie")
        pick = next(p for p in jamie["picks"] if p["name"] == "Dolly Parton")
        self.assertTrue(pick["counted"])
        self.assertEqual(pick["dateOfPassing"], "2026-08-25")
        self.assertEqual(pick["points"], 20)
        self.assertEqual(jamie["score"], PUBLIC["members"][-1]["score"])

        without_confirmation = [
            c for c in CONFIRMATIONS if not (
                c["memberId"] == "jamie" and c["name"] == "Dolly Parton"
            )
        ]
        with self.assertRaisesRegex(ValueError, "counted passing lacks"):
            sync.importer.import_data(
                None, PUBLIC["capturedAt"], without_confirmation, sheets=sheets
            )

    def test_pasted_text_death_date_cannot_disappear_from_import(self):
        sheets = public_as_sheet_cells()
        eva = next(p for p in PUBLIC["members"][2]["picks"] if p["name"] == "Eva Marie Saint")
        sheets["jerome"][f"D{eva['sourceRow']}"]["value"] = "2026-10-06"
        with self.assertRaisesRegex(ValueError, "unparsed text"):
            sync.importer.import_data(None, PUBLIC["capturedAt"], CONFIRMATIONS, sheets=sheets)

    def test_removing_previously_published_passing_requires_review(self):
        sheets = public_as_sheet_cells()
        eva = next(p for p in PUBLIC["members"][2]["picks"] if p["name"] == "Eva Marie Saint")
        sheets["jerome"][f"D{eva['sourceRow']}"]["value"] = None
        sheets["jerome"]["E1"]["formula"] = "SUM(" + ",".join(
            "E" + str(p["sourceRow"]) for p in PUBLIC["members"][2]["picks"]
            if p["counted"] and p["id"] != eva["id"]
        ) + ")"
        sheets["jerome"]["E1"]["value"] = PUBLIC["members"][2]["score"] - eva["points"]
        sheets["LEADERBOARD"]["D2"]["value"] = sheets["jerome"]["E1"]["value"]
        with self.assertRaisesRegex(ValueError, "Previously published club passing"):
            sync.prepare(to_api(sheets), PUBLIC, CONFIRMATIONS, PUBLIC["capturedAt"],
                         allow_research=False)

    def test_actual_death_cannot_be_later_than_club_record(self):
        sheets = public_as_sheet_cells()
        eva = next(p for p in PUBLIC["members"][2]["picks"] if p["name"] == "Eva Marie Saint")
        sheets["jerome"][f"D{eva['sourceRow']}"]["value"] = serial("2026-10-05")
        with self.assertRaisesRegex(ValueError, "discovery date precedes"):
            sync.prepare(to_api(sheets), PUBLIC, CONFIRMATIONS, PUBLIC["capturedAt"],
                         allow_research=False)

    def test_exact_named_tab_cannot_silently_become_other_member(self):
        sheets = public_as_sheet_cells()
        sheets["matt"]["B1"]["value"] = "Jerome"
        with self.assertRaisesRegex(ValueError, "verified club identity"):
            sync.sheets_api_cells(to_api(sheets))


if __name__ == "__main__":
    unittest.main()
