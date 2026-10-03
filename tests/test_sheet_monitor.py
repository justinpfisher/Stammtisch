import importlib.util
import pathlib
import unittest

MODULE = pathlib.Path(__file__).parents[1] / "scripts" / "monitor-celebration-sheet.py"
SPEC = importlib.util.spec_from_file_location("sheet_monitor", MODULE)
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


def workbook(cell=None, title="LEADERBOARD", note=None, style=None):
    value = {"userEnteredValue": cell} if cell is not None else {}
    if note is not None:
        value["note"] = note
    if style is not None:
        value["userEnteredFormat"] = style
    return {"spreadsheetId": "sheet", "sheets": [{"properties": {"sheetId": 7, "title": title}, "data": [{"rowData": [{"values": [value]}]}]}]}


class SheetMonitorTests(unittest.TestCase):
    def snapshot(self, **kwargs):
        return monitor.semantic_snapshot(workbook(**kwargs))

    def test_ignores_effective_formula_recalculation(self):
        raw = workbook(cell={"formulaValue": "=TODAY()"})
        raw["sheets"][0]["data"][0]["rowData"][0]["values"][0]["effectiveValue"] = {"numberValue": 10}
        before = monitor.semantic_snapshot(raw)
        raw["sheets"][0]["data"][0]["rowData"][0]["values"][0]["effectiveValue"] = {"numberValue": 11}
        raw["sheets"][0]["data"][0]["rowData"][0]["values"][0]["formattedValue"] = "tomorrow"
        self.assertEqual([], monitor.changes_between(before, monitor.semantic_snapshot(raw)))

    def test_detects_entered_formula_and_input_changes(self):
        before = self.snapshot(cell={"formulaValue": "=A1"})
        after = self.snapshot(cell={"formulaValue": "=A2"})
        self.assertTrue(monitor.changes_between(before, after))
        self.assertTrue(monitor.changes_between(self.snapshot(cell={"stringValue": "one"}), self.snapshot(cell={"stringValue": "two"})))

    def test_cell_alert_metadata_uses_a1_without_cell_content(self):
        before = self.snapshot(cell={"stringValue": "private old value"})
        after = self.snapshot(cell={"stringValue": "private new value"})
        change = next(item for item in monitor.changes_between(before, after) if item["kind"] == "cells")
        self.assertEqual(["A1"], change["cells"])
        self.assertNotIn("private", str(change))

    def test_detects_note_style_and_tab_rename(self):
        before = self.snapshot(cell={"stringValue": "x"}, note="old", style={"textFormat": {"bold": True}})
        after = self.snapshot(cell={"stringValue": "x"}, title="RENAMED", note="new", style={"textFormat": {"italic": True}})
        kinds = {item["kind"] for item in monitor.changes_between(before, after)}
        self.assertTrue({"tab_renamed", "cells"}.issubset(kinds))

    def test_rejects_missing_or_wrong_sheet_baseline(self):
        current = self.snapshot(cell={"stringValue": "x"})
        with self.assertRaises(ValueError):
            monitor.semantic_snapshot({"spreadsheetId": "sheet"})
        with self.assertRaises(ValueError):
            monitor.changes_between({"version": 1, "spreadsheetId": "sheet", "sheets": {}}, current)
        with self.assertRaises(ValueError):
            monitor.changes_between({"version": 1, "spreadsheetId": "other", "sheets": current["sheets"]}, current)


if __name__ == "__main__":
    unittest.main()
