"""Require the public GitHub Pages data to match the validated committed register.

A successful Pages build can precede public CDN propagation. This read-only
verification checks the actual visitor-facing JSON before the monitor advances
its encrypted baseline or reports successful publishing. No secrets used.
"""
import argparse
import json
import pathlib
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

DEFAULT_URL = "https://stammtischbrewery.com/data/celebration.json"


def public_url(base_url, commit, attempt):
    parsed = urlsplit(base_url)
    if (parsed.scheme != "https" or parsed.hostname != "stammtischbrewery.com"
            or parsed.path != "/data/celebration.json" or parsed.username
            or parsed.password or parsed.port not in (None, 443)):
        raise ValueError("Public verification URL must be the known static register endpoint")
    query = urlencode({"publication": commit, "attempt": attempt})
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))


def same_public_register(expected, commit, url=DEFAULT_URL, attempts=18, pause=10):
    """Return True only on exact semantic JSON equality to the published data."""
    if not isinstance(expected, dict) or not isinstance(expected.get("members"), list):
        raise ValueError("Expected committed register is invalid")
    for attempt in range(1, attempts + 1):
        try:
            req = Request(public_url(url, commit, attempt), headers={
                "Accept": "application/json", "Cache-Control": "no-cache",
                "User-Agent": "StammtischCoLSiteVerification/1.0",
            })
            with urlopen(req, timeout=15) as response:
                if response.status != 200:
                    raise ValueError("Public data returned a non-success status")
                payload = response.read(4000000)
                actual = json.loads(payload)
                if actual == expected:
                    return True
        except (HTTPError, URLError, OSError, TimeoutError, ValueError, json.JSONDecodeError):
            pass  # temporary Pages/CDN delay; never expose the response contents
        if attempt < attempts:
            time.sleep(pause)
    return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", type=pathlib.Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--attempts", type=int, default=18)
    parser.add_argument("--pause", type=int, default=10)
    args = parser.parse_args()
    if not (1 <= args.attempts <= 36) or not (0 <= args.pause <= 30):
        raise ValueError("Unsafe publication verification retry settings")
    expected = json.loads(args.expected.read_text(encoding="utf-8"))
    if not same_public_register(expected, args.commit, attempts=args.attempts, pause=args.pause):
        print("Public website verification failed: committed register is not yet live.",
              file=sys.stderr)
        return 1
    print("Public website register matches the validated committed data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
