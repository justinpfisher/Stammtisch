"""Offline-only tests: none of these call the OneSignal or GitHub network."""
import copy
import datetime as dt
import importlib.util
import json
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("col_push_sender", ROOT / "scripts/col-push-delivery.py")
sender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sender)
DATA = json.loads((ROOT / "data/celebration.json").read_text(encoding="utf-8"))
APP = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
COMMIT = "a" * 40


class FakeLedger:
    def __init__(self, state=None, fail_after_send=False):
        self.record = {"number": 1, "body": sender.body(state)} if state else None
        self.updates = []
        self.fail_after_send = fail_after_send

    def find(self):
        return self.record

    def create(self, state):
        self.record = {"number": 1, "body": sender.body(state)}
        return self.record

    def update(self, issue, state):
        self.updates.append(copy.deepcopy(state))
        if self.fail_after_send and len(self.updates) == 2:
            raise RuntimeError("simulate lost ledger acknowledgement")
        self.record["body"] = sender.body(state)


class CoLPushTests(unittest.TestCase):
    def test_material_digest_ignores_only_the_publishers_timestamp_noise(self):
        copy_data = copy.deepcopy(DATA)
        copy_data["capturedAt"] = "tomorrow"
        copy_data["asOf"] = "2026-10-08"
        self.assertEqual(sender.digest(copy_data), sender.digest(DATA))
        copy_data["members"][0]["score"] += 1
        self.assertNotEqual(sender.digest(copy_data), sender.digest(DATA))

    def event_data(self, points=54, born="1980-01-01", position=2):
        old = copy.deepcopy(DATA)
        pick = old["members"][0]["picks"][1]
        pick.update(name="Pilot Example", born=born, pick=position, marker=None,
                    counted=False, dateOfPassing=None, needsReview=False)
        for field in ("actualDeathDate", "actualDeathSource", "dateSource", "allocationDecision"):
            pick.pop(field, None)
        newer = copy.deepcopy(old)
        pick = newer["members"][0]["picks"][1]
        pick.update(points=points, counted=True, dateOfPassing="2026-10-08",
                    actualDeathDate="2026-10-08", actualDeathSource={
                        "sourceUrl": "https://example.com/confirmed", "sourceLabel": "Family",
                        "verifiedOn": "2026-10-08"})
        newer["members"][0]["score"] += points
        newer["asOf"] = "2026-10-08"
        return old, newer

    def state(self, old):
        return {"version": 2, "mode": "live", "last_digest": sender.digest(old),
                "last_commit": COMMIT, "pending": None,
                "seen_events": sender.known_passings(old), "not_before": "2026-10-08"}

    def events(self, old, new):
        return sender.event_notifications(old, new, set(sender.known_passings(old)), "2026-10-08")

    def test_new_event_has_actual_signed_points_and_person_link(self):
        old, new = self.event_data()
        event, = self.events(old, new)
        self.assertEqual(event["title"], "Celebration of Life: Pilot Example")
        self.assertEqual(event["message"], "Matt receives +54 points.")
        self.assertEqual(event["url"], sender.LINK + "#commemoration-pilot-example-1980-01-01")

    def test_negative_double_and_centennial_awards(self):
        for points, born, position in [(-2, "1924-01-01", 2), (-4, "1924-01-01", 1),
                                       (20, "1926-01-01", 50), (108, "1980-01-01", 1)]:
            old, new = self.event_data(points, born, position)
            event, = self.events(old, new)
            self.assertIn(format(points, "+g") + " points", event["message"])

    def test_shared_allocations_report_every_actual_recipient(self):
        old, new = self.event_data(12)
        template = old["members"][0]["picks"][1]
        old["members"][3]["picks"][1].update(name=template["name"], born=template["born"])
        new["members"][3]["picks"][1].update(copy.deepcopy(new["members"][0]["picks"][1]))
        new["members"][3]["picks"][1].update(id="ken-4", pick="BB", points=13)
        new["members"][3]["score"] += 13
        for m in (new["members"][0], new["members"][3]):
            m["picks"][1]["allocationDecision"] = "Group approved split: Matt 12, Ken 13."
        event, = self.events(old, new)
        self.assertEqual(event["message"], "Ken +13; Matt +12 points.")

    def test_missing_disputed_unawarded_or_inconsistent_points_do_not_send(self):
        changes = [{"points": None}, {"points": True}, {"points": float('nan')},
                   {"points": 55}, {"counted": False}, {"needsReview": True},
                   {"disputed": True}, {"pointsConfirmed": False}, {"actualDeathSource": None},
                   {"dateOfPassing": None}]
        for change in changes:
            old, new = self.event_data()
            new["members"][0]["picks"][1].update(change)
            with self.subTest(change=change):
                self.assertEqual(self.events(old, new), [])

    def test_ordinary_score_corrections_and_historical_records_do_not_send(self):
        corrected = copy.deepcopy(DATA)
        corrected["members"][0]["score"] += 1
        self.assertEqual(self.events(DATA, corrected), [])
        old, new = self.event_data()
        new["members"][0]["picks"][1]["actualDeathDate"] = "2026-09-01"
        self.assertEqual(self.events(old, new), [])
        old, new = self.event_data()
        old["members"][0]["picks"][1]["actualDeathDate"] = "2026-10-08"
        self.assertEqual(self.events(old, new), [])
        old, new = self.event_data()
        seen = {sender.identity(new["members"][0]["picks"][1])}
        self.assertEqual(sender.event_notifications(old, new, seen, "2026-10-08"), [])

    def test_disabled_site_and_unauthorized_modes_rejected(self):
        disabled = {"schemaVersion": 1, "mode": "off", "oneSignalAppId": "",
                    "audience": "any_visitor_who_opts_in", "source": "celebration_of_life_only"}
        with self.assertRaises(ValueError):
            sender.configuration(disabled, "public")
        pilot = {**disabled, "mode": "pilot", "oneSignalAppId": APP}
        self.assertEqual(sender.configuration(pilot, "pilot"), APP)
        with self.assertRaises(ValueError):
            sender.configuration(pilot, "public")

    def test_public_push_targets_subscribed_users_not_a_private_members_list(self):
        result = sender.payload(APP, "CoL standings updated", "test-id")
        self.assertEqual(result["included_segments"], ["Subscribed Users"])
        self.assertNotIn("include_subscription_ids", result)
        self.assertEqual(result["url"], sender.LINK)
        self.assertEqual(result["target_channel"], "push")

    def test_pilot_rejects_missing_or_invalid_device_allowlist(self):
        for invalid in ([], ["not-a-uuid"], [APP] * 11):
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    sender.payload(APP, "test", "key", invalid)
        result = sender.payload(APP, "test", "key", [APP])
        self.assertEqual(result["include_subscription_ids"], [APP])
        self.assertNotIn("included_segments", result)

    def test_public_mode_first_seeds_and_never_broadcasts_old_updates(self):
        ledger = FakeLedger()
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            status = sender.live(DATA, COMMIT, APP, "placeholder", ledger)
        self.assertEqual(status, "seeded_without_sending")
        state = sender.parse(ledger.record["body"])
        self.assertEqual(state["last_digest"], sender.digest(DATA))
        self.assertEqual(state["last_result"], "seeded")
        self.assertIsNone(state["pending"])

    def test_initial_checkpoint_does_not_seed_from_unpublished_site(self):
        ledger = FakeLedger()
        with mock.patch.object(sender.verify, "same_public_register", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "Cannot seed"):
                sender.live(DATA, COMMIT, APP, "unused", ledger)
        self.assertIsNone(ledger.record)

    def test_no_change_does_not_attempt_a_send(self):
        state = self.state(DATA)
        with mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            self.assertEqual(sender.live(DATA, COMMIT, APP, "unused", FakeLedger(state)), "no_change")

    def test_post_publish_gate_prevents_premature_notification(self):
        old, current = self.event_data()
        state = self.state(old)
        with mock.patch.object(sender.verify, "same_public_register", return_value=False), \
             mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            with self.assertRaisesRegex(RuntimeError, "has not caught up"):
                sender.live(current, COMMIT, APP, "unused", FakeLedger(state))

    def test_retry_reuses_uuid_after_unknown_send_acknowledgement(self):
        old, current = self.event_data()
        state = self.state(old)
        ledger = FakeLedger(state, fail_after_send=True)
        keys = []
        def fake_send(api_key, packet):
            keys.append(packet["idempotency_key"])
            return "accepted"
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "historical", return_value=old), \
             mock.patch.object(sender, "send", side_effect=fake_send):
            with self.assertRaisesRegex(RuntimeError, "lost ledger"):
                sender.live(current, COMMIT, APP, "test", ledger)
            self.assertEqual(sender.live(current, COMMIT, APP, "test", ledger), "accepted")
        self.assertEqual(len(keys), 2)
        self.assertEqual(keys[0], keys[1])
        self.assertEqual(str(__import__("uuid").UUID(keys[0], version=4)), keys[0])
        self.assertEqual(sender.parse(ledger.record["body"])["last_digest"], sender.digest(current))

    def test_expired_pending_retry_stops_to_avoid_duplicate_send(self):
        old = copy.deepcopy(DATA)
        old["members"][2]["score"] += 2
        old_date = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=26)).isoformat()
        state = self.state(old)
        state["pending"] = {"digest": sender.digest(DATA), "commit": COMMIT,
                            "created_at": old_date, "events": []}
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            with self.assertRaisesRegex(RuntimeError, "idempotency retry window"):
                sender.live(DATA, COMMIT, APP, "test", FakeLedger(state))


    def test_legacy_checkpoint_migrates_without_historical_send(self):
        state = {"version": 1, "mode": "live", "last_digest": sender.digest(DATA),
                 "last_commit": COMMIT, "pending": None}
        ledger = FakeLedger(state)
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            self.assertEqual(sender.live(DATA, COMMIT, APP, "unused", ledger), "seeded_without_sending")
        self.assertEqual(sender.parse(ledger.record["body"])["version"], 2)

    def test_points_can_be_confirmed_later_without_losing_or_repeating_event(self):
        old, current = self.event_data()
        incomplete = copy.deepcopy(current)
        incomplete["members"][0]["picks"][1]["pointsConfirmed"] = False
        ledger = FakeLedger(self.state(old))
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "historical", return_value=old), \
             mock.patch.object(sender, "send", return_value="accepted") as send:
            self.assertEqual(sender.live(incomplete, COMMIT, APP, "unused", ledger), "no_confirmed_new_events")
            send.assert_not_called()
            self.assertEqual(sender.live(current, COMMIT, APP, "unused", ledger), "accepted")
            self.assertEqual(sender.live(current, COMMIT, APP, "unused", ledger), "no_change")
            corrected = copy.deepcopy(current)
            corrected["members"][0]["score"] += 1
            self.assertEqual(sender.live(corrected, COMMIT, APP, "unused", ledger), "no_confirmed_new_events")
            self.assertEqual(send.call_count, 1)

    def test_onesignal_acknowledgements_fail_closed_on_unexpected_errors(self):
        import io
        key = "test-only-key"
        packet = sender.payload(APP, "test-only message", "test-id", [APP])
        cases = [
            ({"id": APP}, "accepted"),
            ({"id": APP, "errors": {"invalid_player_ids": [APP]}}, "accepted_partial"),
            ({"id": "", "recipients": 0,
              "errors": ["All included players are not subscribed"]}, "no_recipients"),
        ]
        for response, expected in cases:
            with self.subTest(response=response), mock.patch.object(
                    sender, "urlopen", return_value=io.BytesIO(
                        json.dumps(response).encode("utf-8"))):
                self.assertEqual(sender.send(key, packet), expected)
        for response in [
            {"id": "", "recipients": 0, "errors": ["Invalid targeting"]},
            {"id": "", "recipients": 3,
             "errors": ["All included players are not subscribed"]},
            {"id": "", "errors": ["All included players are not subscribed"]},
            {"errors": ["Other provider failure"]},
            {"id": None},
            {},
        ]:
            with self.subTest(response=response), mock.patch.object(
                    sender, "urlopen", return_value=io.BytesIO(
                        json.dumps(response).encode("utf-8"))):
                with self.assertRaisesRegex(RuntimeError, "Unexpected OneSignal response"):
                    sender.send(key, packet)

    def test_pilot_does_not_report_success_without_subscribed_devices(self):
        import os
        import sys
        with mock.patch.dict(os.environ, {
                "COL_PUSH_DELIVERY_MODE": "pilot",
                "COL_PUSH_ONESIGNAL_API_KEY": "test-only-key",
                "COL_PUSH_TEST_SUBSCRIPTION_IDS": json.dumps([APP]),
                }, clear=True), mock.patch.object(
                sender, "configuration", return_value=APP), mock.patch.object(
                sender, "send", return_value="no_recipients"), mock.patch.object(
                sys, "argv", ["col-push-delivery.py", "--action", "pilot-test"]):
            with self.assertRaisesRegex(RuntimeError, "not accepted for all test devices"):
                sender.main()

    def test_pilot_does_not_report_success_on_partial_acceptance(self):
        import os
        import sys
        with mock.patch.dict(os.environ, {
                "COL_PUSH_DELIVERY_MODE": "pilot",
                "COL_PUSH_ONESIGNAL_API_KEY": "test-only-key",
                "COL_PUSH_TEST_SUBSCRIPTION_IDS": json.dumps([APP]),
                }, clear=True), mock.patch.object(
                sender, "configuration", return_value=APP), mock.patch.object(
                sender, "send", return_value="accepted_partial"), mock.patch.object(
                sys, "argv", ["col-push-delivery.py", "--action", "pilot-test"]):
            with self.assertRaisesRegex(RuntimeError, "not accepted for all test devices"):
                sender.main()



if __name__ == "__main__":
    unittest.main()

