import importlib.util
import json
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("publication_health", ROOT / "scripts/verify-celebration-publication.py")
health = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(health)


class FakeResponse:
    status = 200
    def __init__(self, data):
        self.data = json.dumps(data).encode("utf-8")
    def read(self, size):
        return self.data[:size]
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False


class PublicationHealthTests(unittest.TestCase):
    def test_matching_public_json_is_confirmed(self):
        expected = {"year": 2026, "members": [{"score": 107}]}
        with mock.patch.object(health, "urlopen", return_value=FakeResponse(expected)) as open_request:
            self.assertTrue(health.same_public_register(expected, "commit", attempts=1, pause=0))
            req = open_request.call_args.args[0]
            self.assertIn("publication=commit", req.full_url)
            self.assertEqual(req.get_header("Cache-control"), "no-cache")

    def test_stale_public_site_never_confirms_publishing(self):
        expected = {"year": 2026, "members": [{"score": 107}]}
        older = {"year": 2026, "members": [{"score": 109}]}
        with mock.patch.object(health, "urlopen", return_value=FakeResponse(older)):
            self.assertFalse(health.same_public_register(expected, "commit", attempts=2, pause=0))

    def test_publication_waits_for_correct_data_without_logging_values(self):
        expected = {"year": 2026, "members": [{"score": 107}]}
        older = {"year": 2026, "members": [{"score": 109}]}
        with mock.patch.object(health, "urlopen",
                               side_effect=[FakeResponse(older), FakeResponse(expected)]):
            self.assertTrue(health.same_public_register(expected, "commit", attempts=2, pause=0))

    def test_rejects_invalid_or_redirected_public_endpoints(self):
        for url in (
            "http://stammtischbrewery.com/data/celebration.json",
            "https://stammtischbrewery.com.evil.example/data/celebration.json",
            "https://stammtischbrewery.com/secret.json",
        ):
            with self.assertRaises(ValueError):
                health.public_url(url, "abc", 1)

    def test_network_error_fails_closed(self):
        with mock.patch.object(health, "urlopen", side_effect=OSError("network unavailable")):
            self.assertFalse(health.same_public_register({"members": []}, "abc", attempts=1, pause=0))


if __name__ == "__main__":
    unittest.main()
