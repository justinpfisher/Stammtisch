import copy
import importlib.util
import json
import pathlib
import unittest
from datetime import datetime, timezone, timedelta

ROOT = pathlib.Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("source_witness", ROOT / "scripts/observe-col-source.py")
witness = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(witness)


class SourceWitnessTests(unittest.TestCase):
    def setUp(self):
        self.book = {"spreadsheetId": witness.monitor.DEFAULT_SHEET_ID, "sheets": [{
            "properties": {"sheetId": 0, "title": "Private fixture"},
            "data": [{"rowData": [{"values": [{"userEnteredValue": {"formulaValue": "=A2+1"},
                                                 "effectiveValue": {"numberValue": 9}}]}]}]}]}
        self.now = datetime(2026, 10, 15, tzinfo=timezone.utc)

    def observe(self, book=None, **kwargs):
        return witness.observe("fictional-test-credential", "a" * 40, "123",
                               fetcher=lambda sheet, credential: copy.deepcopy(book or self.book),
                               clock=kwargs.get("clock", lambda: self.now))

    def test_public_output_contains_no_source_cells_or_credentials(self):
        result = self.observe()
        self.assertEqual(64, len(result["sourceDigest"]))
        for private in ("=A2+1", "Private fixture", "fictional-test-credential", "numberValue"):
            self.assertNotIn(private, json.dumps(result))
        self.assertEqual("snapshot-only-not-formula-or-allocation-approval", result["qualification"])

    def test_digest_changes_for_formulas_and_ignores_recalculation(self):
        before = self.observe()["sourceDigest"]
        self.book["sheets"][0]["data"][0]["rowData"][0]["values"][0]["effectiveValue"]["numberValue"] = 99
        self.assertEqual(before, self.observe()["sourceDigest"])
        self.book["sheets"][0]["data"][0]["rowData"][0]["values"][0]["userEnteredValue"]["formulaValue"] = "=A3+1"
        self.assertNotEqual(before, self.observe()["sourceDigest"])

    def test_wrong_empty_or_unavailable_source_fails(self):
        for book in ({"spreadsheetId": "other", "sheets": self.book["sheets"]},
                     {"spreadsheetId": witness.monitor.DEFAULT_SHEET_ID, "sheets": []}):
            with self.assertRaises(ValueError):
                self.observe(book)
        with self.assertRaises(RuntimeError):
            witness.observe("fixture", "a" * 40, "123", fetcher=lambda *_: (_ for _ in ()).throw(RuntimeError("private")))

    def test_invalid_identity_or_clock_fails(self):
        for commit, run in (("main", "123"), ("a" * 40, "untrusted-request")):
            with self.assertRaises(ValueError):
                witness.observe("fixture", commit, run)
        for end in (self.now - timedelta(seconds=1), self.now + timedelta(seconds=121), self.now.replace(tzinfo=None)):
            ticks = iter((self.now, end))
            with self.assertRaises((ValueError, TypeError)):
                self.observe(clock=lambda: next(ticks))

    def test_workflow_has_no_mutation_notification_or_permission_expansion(self):
        workflow = (ROOT / ".github/workflows/col-source-observe.yml").read_text(encoding="utf-8")
        self.assertIn("contents: read", workflow)
        self.assertNotIn("contents: write", workflow)
        for forbidden in ("MONITOR_STATE_KEY", "git push", "schedule:", "initialize", "createComment"):
            self.assertNotIn(forbidden, workflow)
        self.assertEqual(["https://www.googleapis.com/auth/spreadsheets.readonly"], witness.monitor.SCOPES)


if __name__ == "__main__":
    unittest.main()
