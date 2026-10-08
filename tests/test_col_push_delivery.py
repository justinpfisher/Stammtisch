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

    def test_summary_is_bounded_and_names_real_score_changes(self):
        newer = copy.deepcopy(DATA)
        member = next(m for m in newer["members"] if m["id"] == "jerome")
        member["score"] -= 2
        self.assertIn("Jerome: 107 to 105", sender.summary(DATA, newer))
        self.assertEqual(sender.summary(DATA, DATA), "CoL register updated. View updated standings.")

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
        state = {"version": 1, "mode": "live", "last_digest": sender.digest(DATA),
                 "last_commit": COMMIT, "pending": None}
        with mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            self.assertEqual(sender.live(DATA, COMMIT, APP, "unused", FakeLedger(state)), "no_change")

    def test_post_publish_gate_prevents_premature_notification(self):
        old = copy.deepcopy(DATA)
        old["members"][2]["score"] += 2
        state = {"version": 1, "mode": "live", "last_digest": sender.digest(old),
                 "last_commit": COMMIT, "pending": None}
        with mock.patch.object(sender.verify, "same_public_register", return_value=False), \
             mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            with self.assertRaisesRegex(RuntimeError, "has not caught up"):
                sender.live(DATA, COMMIT, APP, "unused", FakeLedger(state))

    def test_retry_reuses_uuid_after_unknown_send_acknowledgement(self):
        old = copy.deepcopy(DATA)
        old["members"][2]["score"] += 2
        state = {"version": 1, "mode": "live", "last_digest": sender.digest(old),
                 "last_commit": COMMIT, "pending": None}
        ledger = FakeLedger(state, fail_after_send=True)
        keys = []
        def fake_send(api_key, packet):
            keys.append(packet["idempotency_key"])
            return "accepted"
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "historical", return_value=old), \
             mock.patch.object(sender, "send", side_effect=fake_send):
            with self.assertRaisesRegex(RuntimeError, "lost ledger"):
                sender.live(DATA, COMMIT, APP, "test", ledger)
            self.assertEqual(sender.live(DATA, COMMIT, APP, "test", ledger), "accepted")
        self.assertEqual(len(keys), 2)
        self.assertEqual(keys[0], keys[1])
        self.assertEqual(str(__import__("uuid").UUID(keys[0], version=4)), keys[0])
        self.assertEqual(sender.parse(ledger.record["body"])["last_digest"], sender.digest(DATA))

    def test_expired_pending_retry_stops_to_avoid_duplicate_send(self):
        old = copy.deepcopy(DATA)
        old["members"][2]["score"] += 2
        old_date = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=26)).isoformat()
        state = {"version": 1, "mode": "live", "last_digest": sender.digest(old),
                 "last_commit": COMMIT,
                 "pending": {"digest": sender.digest(DATA), "commit": COMMIT,
                             "idempotency_key": "11111111-2222-4333-8444-555555555555",
                             "created_at": old_date, "message": "old"}}
        with mock.patch.object(sender.verify, "same_public_register", return_value=True), \
             mock.patch.object(sender, "send", side_effect=AssertionError("sent")):
            with self.assertRaisesRegex(RuntimeError, "idempotency retry window"):
                sender.live(DATA, COMMIT, APP, "test", FakeLedger(state))


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
