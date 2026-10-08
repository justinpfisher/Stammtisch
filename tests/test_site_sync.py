import importlib.util
import copy
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
    """Tiny but structurally representative eight-tab Sheets API fixture."""
    def cell(value=None, formula=None):
        result = {}
        if value is not None:
            kind = "stringValue" if isinstance(value, str) else "numberValue"
            result["effectiveValue"] = {kind: value}
            if not formula:
                result["userEnteredValue"] = {kind: value}
        if formula:
            result["userEnteredValue"] = {"formulaValue": formula}
        return result

    tabs = []
    board_members = list(sync.importer.MEMBERS)
    board = {
        "properties": {"title": "LEADERBOARD", "sheetId": 10},
        "data": [{"startRow": 0, "rowData": [
            {"values": [cell(2026, "=YEAR(TODAY())")]},
            {"values": [cell()] + [cell(0, f"={member}!E1") for member in board_members]},
        ]}],
    }
    tabs.append(board)
    tabs.append({
        "properties": {"title": "buttons", "sheetId": 11},
        "data": [{"startRow": 1, "rowData": [
            {"values": [cell("Rainmaker")]},
            {"values": [cell("Droughtmaker")]},
            {"values": [cell("Copycat")]},
        ]}],
    })
    for index, member in enumerate(board_members, 20):
        head = [cell(46301), cell(sync.MEMBER_LABELS[member]), cell(), cell(), cell(0, "=SUM(E3)")]
        tabs.append({
            "properties": {"title": member, "sheetId": index},
            "data": [{"startRow": 0, "rowData": [
                {"values": head}, {"values": []},
                {"values": [cell(1), cell("Sample Person"), cell(40000), cell(), cell(0)]},
            ]}],
        })
    return {"spreadsheetId": sync.EXPECTED_SHEET_ID, "sheets": tabs}


def sample(dead=False, confirmed=False):
    # Born Oct 5, 1928: age 98 at the confirmed Oct 5, 2026 death,
    # worth 2 base points; selection #1 doubles this to 4 points.
    pick = {"id":"matt-3","name":"Sample Person","born":"1928-10-05",
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

    def test_distinguish_extra_missing_and_renamed_tabs_without_exposing_titles(self):
        baseline = api_workbook()
        extra = {"properties": {"title": "confidential new tab", "sheetId": 999}, "data": []}
        extra_book = dict(baseline, sheets=baseline["sheets"] + [extra])
        with self.assertRaisesRegex(ValueError, "^Additional unmapped tabs present in live workbook$"):
            sync.sheets_api_cells(extra_book)
        missing_book = dict(baseline, sheets=baseline["sheets"][:-1])
        with self.assertRaisesRegex(ValueError, "^Expected tabs missing from live workbook$"):
            sync.sheets_api_cells(missing_book)
        renamed_book = dict(baseline, sheets=baseline["sheets"][:-1] + [extra])
        with self.assertRaisesRegex(ValueError, "^Expected tabs missing and additional unmapped tabs present$"):
            sync.sheets_api_cells(renamed_book)
        self.assertEqual(sync.failure_code(ValueError("Additional unmapped tabs present in live workbook")),
                         "extra_tabs_present")
        self.assertEqual(sync.failure_code(ValueError("Expected tabs missing from live workbook")),
                         "required_tabs_missing")
        self.assertEqual(sync.failure_code(ValueError("Expected tabs missing and additional unmapped tabs present")),
                         "missing_and_extra_tabs")

    def test_safe_case_and_whitespace_tab_renames(self):
        workbook = api_workbook()
        workbook["sheets"][0]["properties"]["title"] = " Leaderboard "
        workbook["sheets"][1]["properties"]["title"] = "Buttons"
        workbook["sheets"][2]["properties"]["title"] = " MATT "
        cells = sync.sheets_api_cells(workbook)
        self.assertEqual(set(cells), {"LEADERBOARD", "buttons", *sync.importer.MEMBERS})
        self.assertEqual(cells["matt"]["B1"]["value"], "Matt")
        self.assertEqual(cells["LEADERBOARD"]["B2"]["formula"], "matt!E1")

    def test_member_tab_rename_uses_public_B1_identity_and_score_link(self):
        workbook = api_workbook()
        # Fish is the legacy tab id for Justin; Google updates references when
        # the live tab title is renamed. No fuzzy name guessing is allowed.
        workbook["sheets"][3]["properties"]["title"] = "Justin - 2026"
        board_second = workbook["sheets"][0]["data"][0]["rowData"][1]["values"][2]
        board_second["userEnteredValue"]["formulaValue"] = "='Justin - 2026'!E1"
        cells = sync.sheets_api_cells(workbook)
        self.assertEqual(cells["fish"]["B1"]["value"], "Justin")
        self.assertEqual(cells["LEADERBOARD"]["C2"]["formula"], "fish!E1")

    def test_renamed_supporting_tabs_require_unambiguous_structure(self):
        workbook = api_workbook()
        workbook["sheets"][0]["properties"]["title"] = "2026 Summary"
        workbook["sheets"][1]["properties"]["title"] = "Badge Awards"
        cells = sync.sheets_api_cells(workbook)
        self.assertIn("LEADERBOARD", cells)
        self.assertIn("buttons", cells)

    def test_identical_member_labels_are_rejected_if_tab_names_missing(self):
        workbook = api_workbook()
        # Two renamed Matt sheets would be ambiguous, even if the original
        # canonical title is absent. Do not publish against an arbitrary one.
        workbook["sheets"][2]["properties"]["title"] = "First Matt"
        duplicate = copy.deepcopy(workbook["sheets"][2])
        duplicate["properties"]["title"] = "Second Matt"
        duplicate["properties"]["sheetId"] = 999
        workbook["sheets"].append(duplicate)
        with self.assertRaisesRegex(ValueError, "^Ambiguous member tab identity"):
            sync.sheets_api_cells(workbook)

    def test_unrecognised_new_member_tab_still_blocks_publication(self):
        workbook = api_workbook()
        extra = copy.deepcopy(workbook["sheets"][2])
        extra["properties"]["title"] = "New Member"
        extra["properties"]["sheetId"] = 999
        extra["data"][0]["rowData"][0]["values"][1]["effectiveValue"]["stringValue"] = "New Member"
        workbook["sheets"].append(extra)
        with self.assertRaisesRegex(ValueError, "^Additional unmapped tabs present"):
            sync.sheets_api_cells(workbook)

    def test_leaderboard_must_reference_each_member_exactly_once(self):
        workbook = api_workbook()
        board_third = workbook["sheets"][0]["data"][0]["rowData"][1]["values"][3]
        board_third["userEnteredValue"]["formulaValue"] = "=matt!E1"
        with self.assertRaisesRegex(ValueError, "^Leaderboard does not reference each member exactly once"):
            sync.sheets_api_cells(workbook)

    def test_derived_ageing_does_not_trigger_publish(self):
        before = sample()
        after = sample()
        before["members"][0]["picks"][0]["pointsFormula"] = "ROUNDUP(100-DATEDIF(...))"
        after["members"][0]["picks"][0]["pointsFormula"] = "ROUNDUP(100-DATEDIF(...))"
        after["capturedAt"] = "later"
        after["asOf"] = "2026-10-08"
        after["members"][0]["picks"][0]["points"] = 5
        after["members"][0]["picks"][0]["ageText"] = "86y"
        self.assertEqual(sync.public_material(before), sync.public_material(after))

    def test_manual_unawarded_point_edit_triggers_public_update(self):
        before, after = sample(), sample()
        after["members"][0]["picks"][0]["points"] = 5
        self.assertNotEqual(sync.public_material(before), sync.public_material(after))


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
