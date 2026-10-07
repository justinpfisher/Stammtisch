import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

sync = load("celebration_sync", "sync-celebration-sheet.py")
verifier = load("celebration_verify", "verify-celebration-death.py")

def api_workbook():
    titles = ["LEADERBOARD", "buttons", *sync.importer.MEMBERS]
    return {"spreadsheetId":sync.EXPECTED_SHEET_ID,
            "sheets":[{"properties":{"title":title, "sheetId":n},
                       "data":[{"startRow":0,"rowData":[{"values":[
                           {"effectiveValue":{"numberValue":2026},
                            "userEnteredValue":{"formulaValue":"=YEAR(TODAY())"}}]}]}]}
                      for n,title in enumerate(titles)]}

def sample(dead=False, confirmed=False):
    pick = {"id":"matt-3","name":"Sample Person","born":"1940-01-01",
            "dateOfPassing":"2026-10-06" if dead else None,
            "counted":dead, "pick":1,"points":4, "ageText":None}
    if confirmed:
        pick.update(actualDeathDate="2026-10-05", actualDeathSource={
            "sourceUrl":"https://apnews.com/story/example",
            "sourceLabel":"Reviewed announcement", "verifiedOn":"2026-10-07"})
    return {"year":2026, "asOf":"2026-10-07", "capturedAt":"2026-10-07T22:00:00Z",
            "members":[{"id":"matt","score":4 if dead else 0,"picks":[pick]}],
            "distinctions":[]}

class SyncTests(unittest.TestCase):
    def test_google_api_number_and_formula(self):
        cells = sync.sheets_api_cells(api_workbook())
        self.assertEqual(cells["LEADERBOARD"]["A1"]["value"], 2026)
        self.assertEqual(cells["LEADERBOARD"]["A1"]["formula"], "YEAR(TODAY())")

    def test_rejects_other_sheet(self):
        book = api_workbook()
        book["spreadsheetId"] = "other"
        with self.assertRaises(ValueError):
            sync.sheets_api_cells(book)

    def test_derived_ageing_does_not_trigger_publish(self):
        before = sample()
        after = sample()
        after["capturedAt"] = "later"
        after["asOf"] = "2026-10-08"
        after["members"][0]["picks"][0]["points"] = 5
        after["members"][0]["picks"][0]["ageText"] = "86y"
        self.assertEqual(sync.public_material(before), sync.public_material(after))

    def test_failure_codes_disclose_no_private_sheet_details(self):
        examples = {
            "Unrecognized total formula: =SUM(secret-name-sheet!E1)": "unsupported_score_formula",
            "The imported entries do not reconcile with private-member's total.": "member_score_mismatch",
            "The number of picks changed for private-member. Review before importing.": "selection_count_mismatch",
            "A confirmed record no longer matches the sheet. Review before importing.": "confirmed_record_identity",
            "Spreadsheet tab mapping changed; review required": "unsupported_tabs",
        }
        for secret_message, expected_code in examples.items():
            with self.subTest(expected=expected_code):
                result = sync.failure_code(ValueError(secret_message))
                self.assertEqual(result, expected_code)
                self.assertNotIn("private", result)
                self.assertNotIn("secret", result)
        self.assertEqual(sync.failure_code(ValueError("Some private value")), "unclassified_validation_error")

    def test_new_death_requires_verified_source(self):
        previous, proposed = sample(), sample(dead=True)
        original = sync.importer.import_data
        try:
            sync.importer.import_data = lambda *a, **kw: proposed
            status, data, confirmations = sync.prepare(api_workbook(), previous, [], "2026-10-07T22:00:00Z", allow_research=False)
            self.assertEqual(status["status"], "review_required")
            self.assertEqual(status["pending"], 1)
            self.assertIsNone(data)
            self.assertIsNone(confirmations)
        finally:
            sync.importer.import_data = original

    def test_previously_counted_undated_record_gains_date_and_requires_verification(self):
        previous = sample(dead=True)
        previous["members"][0]["picks"][0]["dateOfPassing"] = None
        proposed = sample(dead=True)
        self.assertEqual([("matt", proposed["members"][0]["picks"][0])],
                         list(sync.newly_reported_deaths(previous, proposed)))
        unchanged = sample(dead=True)
        unchanged["members"][0]["picks"][0]["dateOfPassing"] = None
        self.assertEqual([], list(sync.newly_reported_deaths(previous, unchanged)))

    def test_existing_source_allows_safe_new_death(self):
        previous, proposed = sample(), sample(dead=True, confirmed=True)
        original = sync.importer.import_data
        try:
            sync.importer.import_data = lambda *a, **kw: proposed
            status, data, confirmations = sync.prepare(api_workbook(), previous, [], "2026-10-07T22:00:00Z", allow_research=False)
            self.assertEqual(status["status"], "ready")
            self.assertTrue(status["publish"])
            self.assertEqual(data["members"][0]["picks"][0]["dateOfPassing"], "2026-10-06")
            self.assertIsNone(confirmations)
        finally:
            sync.importer.import_data = original

    def test_unchanged_monitor_baseline_still_reconciles_stale_public_register(self):
        monitor = load("site_monitor", "monitor-celebration-sheet.py")
        workbook = api_workbook()
        baseline = monitor.semantic_snapshot(workbook)
        self.assertFalse(monitor.publication_inputs_changed(baseline, baseline))
        before, current_sheet = sample(), sample(dead=True, confirmed=True)
        previous_importer = sync.importer.import_data
        try:
            sync.importer.import_data = lambda *args, **kwargs: current_sheet
            result, updated, _ = sync.prepare(
                workbook, before, [], "2026-10-07T22:00:00Z",
                allow_research=False,
            )
            self.assertEqual(result["status"], "ready")
            self.assertTrue(result["publish"], "A previously monitored edit must still reach the website")
            self.assertEqual(updated["members"][0]["score"], 4)
        finally:
            sync.importer.import_data = previous_importer

        # Regression guard: the workflow must actually run the reconciliation
        # even when the latest monitor comparison is unchanged.
        workflow = (ROOT / ".github/workflows/celebration-sheet-monitor.yml").read_text(encoding="utf-8")
        step = workflow.split("      - name: Reconcile current Sheet with published website data", 1)[1].split(
            "      - name: Verify generated site data and award calculations", 1
        )[0]
        self.assertIn("inputs.initialize != true", step)
        self.assertNotIn("steps.compare.outputs.publication_inputs_changed", step)

    def test_reconciling_already_published_data_is_idempotent(self):
        workbook = api_workbook()
        identical = sample(dead=True, confirmed=True)
        previous_importer = sync.importer.import_data
        try:
            sync.importer.import_data = lambda *args, **kwargs: identical
            result, updated, confirmations = sync.prepare(
                workbook, identical, [], "2026-10-07T22:00:00Z",
                allow_research=False,
            )
            self.assertEqual(result["status"], "ready")
            self.assertFalse(result["publish"])
            self.assertIsNone(updated)
            self.assertIsNone(confirmations)
        finally:
            sync.importer.import_data = previous_importer

    def test_web_research_writes_provenance_not_group_discovery_date(self):
        previous, proposed = sample(), sample(dead=True)
        old_import, old_verify = sync.importer.import_data, sync.verifier.research
        try:
            sync.importer.import_data = lambda *a, **kw: proposed
            sync.verifier.research = lambda *a, **kw: {
                "actualDeathDate":"2026-10-05", "sourceUrl":"https://apnews.com/story/example",
                "sourceLabel":"Two checked reports", "verifiedOn":"2026-10-07"}
            status, data, confirmations = sync.prepare(api_workbook(), previous, [], "2026-10-07T22:00:00Z")
            self.assertEqual(status["confirmationsAdded"], 1)
            self.assertEqual(confirmations[0]["memberId"], "matt")
            self.assertEqual(confirmations[0]["actualDeathDate"], "2026-10-05")
            self.assertNotIn("discoveryDate", confirmations[0])
            self.assertEqual(data["members"][0]["picks"][0]["dateOfPassing"], "2026-10-06")
        finally:
            sync.importer.import_data, sync.verifier.research = old_import, old_verify

    def test_article_verification_requires_death_and_date_near_identity(self):
        class DummyPage:
            status = 200
            headers = {"Content-Type": "text/html"}
            def __init__(self, page): self.page = page
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, limit): return self.page.encode("utf-8")[:limit]
        class DummyOpener:
            def __init__(self, page): self.page = page
            def open(self, request, timeout): return DummyPage(self.page)
        original = verifier.build_opener
        try:
            verifier.build_opener = lambda *_: DummyOpener("<html><body>Famous Sample died on October 7, 2026.</body></html>")
            self.assertTrue(verifier.article_supports("https://www.cbc.ca/arts/story", "Famous Sample", "2026-10-07"))
            verifier.build_opener = lambda *_: DummyOpener("Famous Sample won an award. " + "Other coverage. " * 100 + "Different Person died on October 7, 2026.")
            self.assertFalse(verifier.article_supports("https://www.cbc.ca/arts/story", "Famous Sample", "2026-10-07"))
        finally:
            verifier.build_opener = original

    def test_web_verifier_only_accepts_known_https_publishers(self):
        self.assertEqual(verifier.source_publisher("https://www.apnews.com/a"), "Associated Press")
        self.assertIsNone(verifier.source_publisher("http://apnews.com/a"))
        self.assertIsNone(verifier.source_publisher("https://apnews.com.evil.example/a"))

if __name__ == "__main__":
    unittest.main()
