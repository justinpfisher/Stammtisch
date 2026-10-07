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

    def test_web_verifier_only_accepts_known_https_publishers(self):
        self.assertEqual(verifier.source_publisher("https://www.apnews.com/a"), "Associated Press")
        self.assertIsNone(verifier.source_publisher("http://apnews.com/a"))
        self.assertIsNone(verifier.source_publisher("https://apnews.com.evil.example/a"))

if __name__ == "__main__":
    unittest.main()
