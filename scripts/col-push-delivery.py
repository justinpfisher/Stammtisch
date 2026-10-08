"""Fail-closed CoL push: pilot only until an explicit, separately gated go-live."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import sys
import uuid
from urllib.request import Request, urlopen

ROOT = pathlib.Path(__file__).resolve().parents[1]
TITLE = "[Automation] Celebration push delivery checkpoint"
MARKER = "<!-- stammtisch-col-push-ledger-v1 -->"
BASE = "https://api.onesignal.com/notifications"
LINK = "https://stammtischbrewery.com/celebration.html"
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sync = load("col_push_sync", "sync-celebration-sheet.py")
verify = load("col_push_verify", "verify-celebration-publication.py")


def digest(data):
    raw = json.dumps(sync.public_material(data), sort_keys=True, ensure_ascii=False,
                     separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def summary(before, after):
    previous = {m["id"]: m for m in before.get("members", [])} if before else {}
    scored, newly_dated = [], []
    for member in after["members"]:
        old = previous.get(member["id"])
        if not old:
            continue
        if member["score"] != old["score"]:
            scored.append(f"{member['name']}: {old['score']} to {member['score']}")
        old_picks = {p["id"]: p for p in old["picks"]}
        for pick in member["picks"]:
            if pick.get("dateOfPassing") and not old_picks.get(pick["id"], {}).get("dateOfPassing"):
                newly_dated.append(pick["name"])
    parts = []
    if newly_dated:
        names = list(dict.fromkeys(newly_dated))
        parts.append(", ".join(names[:2]) + (" and others" if len(names) > 2 else "") + " recorded")
    if scored:
        parts.append("; ".join(scored[:3]) + (" and more" if len(scored) > 3 else ""))
    return (". ".join(parts) if parts else "CoL register updated")[:210] + ". View updated standings."


def key_is_fresh(date_text, now=None):
    created = dt.datetime.fromisoformat(date_text.replace("Z", "+00:00"))
    now = now or dt.datetime.now(dt.timezone.utc)
    return dt.timedelta(0) <= now - created < dt.timedelta(days=25)


def body(state):
    return (MARKER + "\nAutomated checkpoint for public CoL data. "
            "No subscriber IDs, telephone numbers or credentials are stored here.\n"
            + json.dumps(state, sort_keys=True, indent=2) + "\n")


def parse(text):
    if MARKER not in (text or ""):
        raise ValueError("Missing checkpoint marker")
    state = json.loads(text.split(MARKER, 1)[1].split("\n", 2)[2])
    if state.get("version") != 1 or state.get("mode") != "live" or not re.fullmatch(
            r"[0-9a-f]{64}", state.get("last_digest", "")):
        raise ValueError("Invalid checkpoint")
    return state


def api(url, token, payload=None, method="GET"):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "Stammtisch-CoL-Push/1.0",
               "Authorization": "Bearer " + token}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, headers=headers, method=method,
                  data=json.dumps(payload).encode() if payload is not None else None)
    with urlopen(req, timeout=20) as result:
        return json.loads(result.read(1000000))


class Ledger:
    def __init__(self, repository, token):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository) or not token:
            raise ValueError("Invalid GitHub checkpoint authorization")
        self.url = "https://api.github.com/repos/" + repository
        self.token = token

    def find(self):
        for page in range(1, 22):
            values = api(self.url + f"/issues?state=open&per_page=100&page={page}", self.token)
            for issue in values:
                if issue.get("title") == TITLE and "pull_request" not in issue:
                    return issue
            if len(values) < 100:
                break
        return None

    def create(self, state):
        return api(self.url + "/issues", self.token,
                   {"title": TITLE, "body": body(state)}, "POST")

    def update(self, issue, state):
        return api(self.url + "/issues/" + str(issue["number"]), self.token,
                   {"body": body(state)}, "PATCH")


def configuration(cfg, mode):
    if (cfg.get("schemaVersion") != 1 or cfg.get("mode") != mode or
            cfg.get("audience") != "any_visitor_who_opts_in" or
            cfg.get("source") != "celebration_of_life_only" or
            not UUID.fullmatch(cfg.get("oneSignalAppId", ""))):
        raise ValueError("Website notification configuration is not authorised")
    return cfg["oneSignalAppId"]


def payload(app_id, text, key, recipients="public"):
    data = {"app_id": app_id, "target_channel": "push", "idempotency_key": key,
            "name": "Stammtisch CoL published update",
            "headings": {"en": "Stammtisch CoL updated"},
            "contents": {"en": text}, "url": LINK, "ttl": 86400}
    if recipients == "public":
        data["included_segments"] = ["Subscribed Users"]
    else:
        if not isinstance(recipients, list) or not 1 <= len(recipients) <= 10 or any(
                not isinstance(x, str) or not UUID.fullmatch(x) for x in recipients):
            raise ValueError("Pilot device list is missing or invalid")
        data["include_subscription_ids"] = recipients
    return data


def send(key, data):
    if not key:
        raise ValueError("OneSignal REST key is not configured")
    req = Request(BASE, method="POST", data=json.dumps(data).encode(), headers={
        "Authorization": "Key " + key, "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json", "User-Agent": "Stammtisch-CoL-Push/1.0"})
    with urlopen(req, timeout=25) as response:
        result = json.loads(response.read(1000000))
    if result.get("id"):
        return "accepted"
    if result.get("errors"):
        return "no_recipients"
    raise RuntimeError("No OneSignal message acknowledgement")


def historical(commit):
    if not re.fullmatch(r"[0-9a-f]{40}", commit or ""):
        return None
    p = subprocess.run(["git", "show", commit + ":data/celebration.json"], cwd=ROOT,
                       text=True, capture_output=True, check=False)
    return json.loads(p.stdout) if p.returncode == 0 else None


def live(current, commit, app_id, api_key, ledger):
    current_hash = digest(current)
    issue = ledger.find()
    if issue is None:
        # First live run seeds the current register, never sends historic news.
        ledger.create({"version": 1, "mode": "live", "last_digest": current_hash,
                       "last_commit": commit, "pending": None, "last_result": "seeded"})
        return "seeded_without_sending"
    state = parse(issue["body"])
    if state["last_digest"] == current_hash and state.get("pending") is None:
        return "no_change"
    if not verify.same_public_register(current, commit, attempts=2, pause=4):
        raise RuntimeError("Public CoL register has not caught up to the commit")
    pending = state.get("pending")
    if pending and pending["digest"] != current_hash:
        raise RuntimeError("New publication superseded an unacknowledged push; review before retry")
    if pending is None:
        pending = {"digest": current_hash, "commit": commit, "idempotency_key": str(uuid.uuid4()),
                   "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                   "message": summary(historical(state.get("last_commit")), current)}
        state["pending"] = pending
        ledger.update(issue, state)  # persist stable UUIDv4 BEFORE sending
    if not key_is_fresh(pending["created_at"]):
        raise RuntimeError("Pending push older than safe idempotency retry window")
    result = send(api_key, payload(app_id, pending["message"], pending["idempotency_key"]))
    state.update({"last_digest": current_hash, "last_commit": commit, "pending": None,
                  "last_result": result})
    ledger.update(issue, state)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=["check", "pilot-test"], default="check")
    args = parser.parse_args()
    mode = os.getenv("COL_PUSH_DELIVERY_MODE", "off")
    if mode not in ("pilot", "live"):
        print("Web push inactive; no messages sent.")
        return 0
    cfg = json.loads((ROOT / "data/col-push-config.json").read_text(encoding="utf-8"))
    app_id = configuration(cfg, "pilot" if mode == "pilot" else "public")
    secret = os.getenv("COL_PUSH_ONESIGNAL_API_KEY")
    if mode == "pilot":
        if args.action != "pilot-test":
            print("Pilot mode accepts only an explicit manual test; no messages sent.")
            return 0
        recipients = json.loads(os.getenv("COL_PUSH_TEST_SUBSCRIPTION_IDS") or "[]")
        test = payload(app_id, "Stammtisch CoL pilot test. Public notifications are still off.",
                       str(uuid.uuid4()), recipients)
        print("Pilot send status: " + send(secret, test))
        return 0
    if os.getenv("COL_PUSH_LIVE_APPROVED") != "true" or args.action == "pilot-test":
        raise ValueError("Public CoL push has not been separately approved")
    current = json.loads((ROOT / "data/celebration.json").read_text(encoding="utf-8"))
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    state = Ledger(os.getenv("GITHUB_REPOSITORY", ""), os.getenv("GH_TOKEN", ""))
    print("CoL push result: " + live(current, commit, app_id, secret, state))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("CoL push stopped safely: " + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
