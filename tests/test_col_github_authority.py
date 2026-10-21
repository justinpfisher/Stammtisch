import copy
import datetime as dt
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).parents[1]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

authority = load("col_authority", "col-github-authority.py")
sync = load("col_sync_authority", "sync-celebration-sheet.py")

def awarded():
    pick = {"id":"matt-3","pick":1,"name":"Sample Person","born":"1928-10-05",
            "dateOfPassing":"2026-10-06", "actualDeathDate":"2026-10-05",
            "actualDeathSource":{"sourceUrl":"https://example.com/independent",
                                 "sourceLabel":"Reviewed record","verifiedOn":"2026-10-07"},
            "counted":True,"points":4}
    return {"year":2026,"asOf":"2026-10-07","capturedAt":"2026-10-07T22:00:00Z",
            "members":[{"id":"matt","name":"Matt","score":4,"picks":[pick]}],
            "distinctions":[]}

def ledger(points=7):
    return {"schemaVersion":1,"corrections":[{
        "id":"fictional-score-correction-20261021",
        "seasonYear":2026,"memberId":"matt","pickId":"matt-3",
        "sourceName":"Sample Person","sourceBorn":"1928-10-05",
        "points":points,"decidedBy":"fish","decidedAt":"2026-10-21T22:00:00Z",
        "reason":"Fictional authorised historical score correction"
    }]}

class GitHubAuthorityTests(unittest.TestCase):
    def test_initial_register_empty_and_strict(self):
        self.assertEqual(authority.validated_corrections({"schemaVersion":1,"corrections":[]}),[])
        with self.assertRaisesRegex(ValueError, "register"):
            authority.validated_corrections({"schemaVersion":1,"corrections":[],"injection":True})

    def test_correction_overrides_imported_points_and_recalculates_standings(self):
        source = awarded()
        corrected = authority.apply_awarded_points(source,ledger())
        self.assertEqual(source["members"][0]["score"],4)
        self.assertEqual(source["members"][0]["picks"][0]["points"],4)
        self.assertEqual(corrected["members"][0]["score"],7)
        self.assertEqual(corrected["members"][0]["picks"][0]["points"],7)
        self.assertEqual(authority.apply_awarded_points(source,ledger()),corrected)
        self.assertEqual(authority.apply_awarded_points(corrected,ledger()),corrected)

    def test_repeat_sheet_import_cannot_reverse_git_authorised_award(self):
        previous = awarded()
        sheet = copy.deepcopy(previous)
        original, original_cells = sync.importer.import_data, sync.sheets_api_cells
        try:
            sync.sheets_api_cells = lambda _: {"LEADERBOARD":{"A1":{"value":2026}}}
            sync.importer.import_data = lambda *args, **kwargs: copy.deepcopy(sheet)
            status, result, confirmed = sync.prepare(
                {},previous,[],"2026-10-21T22:00:00Z",
                allow_research=False, corrections=ledger())
            self.assertTrue(status["publish"])
            self.assertEqual(result["members"][0]["score"],7)
            self.assertIsNone(confirmed)

            # A later Sheet import still shows the old four points.
            status, result2, confirmed2 = sync.prepare(
                {},result,[],"2026-10-21T22:00:30Z",
                allow_research=False, corrections=ledger())
            self.assertFalse(status["publish"])
            self.assertIsNone(result2)
            self.assertIsNone(confirmed2)
        finally:
            sync.importer.import_data, sync.sheets_api_cells = original, original_cells

    def test_january_source_hold_does_not_reject_a_github_only_award_correction(self):
        previous, sheet = awarded(), awarded()
        sheet["asOf"]="2027-01-16"
        original, original_cells, original_clock = sync.importer.import_data, sync.sheets_api_cells, sync.datetime
        class FrozenJanuaryClock(dt.datetime):
            @classmethod
            def now(cls, tz=None):
                return dt.datetime(2027, 1, 17, tzinfo=tz)
        try:
            sync.datetime = FrozenJanuaryClock
            sync.sheets_api_cells = lambda _: {"LEADERBOARD":{"A1":{"value":2026}}}
            sync.importer.import_data = lambda *args, **kwargs: copy.deepcopy(sheet)
            status, published, _ = sync.prepare({},previous,[],"2027-01-16T22:00:00Z",
                                                allow_research=False,corrections=ledger())
            self.assertTrue(status["publish"])
            self.assertEqual(published["members"][0]["score"],7)
            sheet["members"][0]["picks"][0]["name"]="Unauthorised Sheet identity change"
            with self.assertRaisesRegex(ValueError, "identity changed"):
                sync.prepare({},previous,[],"2027-01-16T22:00:00Z",
                             allow_research=False,corrections=ledger())
        finally:
            sync.importer.import_data, sync.sheets_api_cells, sync.datetime = original, original_cells, original_clock

    def test_newly_reported_passing_cannot_be_created_by_score_only_correction(self):
        source = awarded()
        changed = authority.apply_awarded_points(source,ledger())
        self.assertEqual(list(sync.newly_reported_deaths(source,changed)),[])
        self.assertEqual(changed["members"][0]["picks"][0]["actualDeathDate"],"2026-10-05")

    def test_wrong_source_identity_and_unauthorised_picks_fail_closed(self):
        for field,value in [("sourceName","Different celebrity"),
                            ("sourceBorn","1940-01-01"),
                            ("pickId","matt-10")]:
            broken=ledger()
            broken["corrections"][0][field]=value
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError,"identity changed|not in published season"):
                    authority.apply_awarded_points(awarded(),broken)
        unawarded=awarded()
        unawarded["members"][0]["picks"][0]["counted"]=False
        with self.assertRaisesRegex(ValueError,"existing awarded"):
            authority.apply_awarded_points(unawarded,ledger())

    def test_correction_attribution_schema_and_order_guard(self):
        template=ledger()
        for field,value in [("decidedBy","seventh-member"),("points",True),
                            ("points",10000),("decidedAt","2026-10-21"),
                            ("sourceBorn","2026-02-31"),("seasonYear",True)]:
            bad=copy.deepcopy(template)
            bad["corrections"][0][field]=value
            with self.subTest(field=field):
                with self.assertRaises(ValueError): authority.validated_corrections(bad)
        bad=copy.deepcopy(template)
        duplicate=copy.deepcopy(bad["corrections"][0])
        duplicate["id"]="another-score-correction-20261021"
        bad["corrections"].append(duplicate)
        with self.assertRaisesRegex(ValueError,"ordered"):
            authority.validated_corrections(bad)
        duplicate["decidedAt"]="2026-10-21T23:00:00Z"
        duplicate["points"]=8
        updated=authority.apply_awarded_points(awarded(),bad)
        self.assertEqual(updated["members"][0]["score"],8)

    def test_other_season_entries_do_not_leak_into_new_picks(self):
        new=awarded()
        new["year"]=2027
        self.assertEqual(authority.apply_awarded_points(new,ledger()),new)

if __name__ == "__main__":
    unittest.main()
