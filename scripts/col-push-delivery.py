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
import math
import unicodedata
from zoneinfo import ZoneInfo
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


def identity(pick):
    name = unicodedata.normalize("NFD", pick["name"])
    name = "".join(c for c in name if not unicodedata.combining(c)).lower()
    name = name.replace("’", "'").replace("‘", "'").strip()
    return name + ":" + pick["born"]


def anchor(pick):
    name = identity(pick).rsplit(":", 1)[0]
    return "commemoration-" + re.sub(r"[^a-z0-9]+", "-", name).strip("-") + "-" + pick["born"]


def groups(data):
    result = {}
    for member in data["members"]:
        for pick in member["picks"]:
            result.setdefault(identity(pick), []).append((member, pick))
    return result


def reported(pick):
    return bool(pick.get("dateOfPassing") or pick.get("actualDeathDate")
                or (pick.get("dateSource") or {}).get("dateOfPassing") or pick.get("counted"))


def known_passings(data):
    return sorted(key for key, entries in groups(data).items()
                  if any(reported(p) for _, p in entries))


def event_notifications(before, after, seen, not_before):
    """One packet per newly recorded person, never score deltas or estimated values.

    Counted source rows are the Sheet's actual allocations, already reconciled
    by the publisher. Repeat that reconciliation and arithmetic check here.
    Unknown, disputed, partial allocations remain unsent for review.
    """
    if not before or before.get("year") != after.get("year"):
        raise RuntimeError("Missing baseline or changed season; review required")
    prior = groups(before)
    events = []
    for key, entries in groups(after).items():
        if key in seen or key not in prior:
            continue  # new list insertions are not proof of a new passing
        # An independently confirmed passing already present in the baseline
        # is historical, even if somebody adds its points or discovery date now.
        if any(reported(p) for _, p in prior[key]):
            continue
        dates = {p.get("dateOfPassing") for _, p in entries if p.get("dateOfPassing")}
        if not dates:
            continue
        if len(dates) != 1:
            continue
        discovered = next(iter(dates))
        if discovered < not_before or discovered > after["asOf"]:
            continue
        evidence = [sync.verified_evidence(p) for _, p in entries]
        evidence = [e for e in evidence if e]
        deaths = {e["actualDeathDate"] for e in evidence}
        if len(deaths) != 1:
            continue
        death = next(iter(deaths))
        # Backfilled historical deaths and inconsistent discovery dates do not
        # generate news. A verified passing must be within the active window.
        if death < not_before or death > discovered:
            continue
        recipients, valid = {}, True
        for member, pick in entries:
            if (pick.get("needsReview") or pick.get("disputed") or
                    pick.get("pointsConfirmed") is False or not pick.get("dateOfPassing")):
                valid = False
                break
            points = pick.get("points")
            if isinstance(points, bool) or not isinstance(points, (int, float)) or not math.isfinite(points):
                valid = False
                break
            if not pick.get("counted"):
                # An unawarded list entry may indicate unfinished Birthday
                # Buffet allocation. Require a reviewed explicit allocation.
                if not pick.get("allocationDecision"):
                    valid = False
                    break
                continue
            if sum(p["points"] for p in member["picks"] if p.get("counted")) != member["score"]:
                valid = False
                break
            born, died = dt.date.fromisoformat(pick["born"]), dt.date.fromisoformat(death)
            age = died.year - born.year - ((died.month, died.day) < (born.month, born.day))
            base = 10 if age == 100 else 100 - age
            expected = base * (2 if pick["pick"] in (1, 50) or pick.get("marker") in ("diamond", "orange") else 1)
            if points != expected and not pick.get("allocationDecision"):
                valid = False
                break
            recipients.setdefault(member["id"], {"name": member["name"], "points": 0})["points"] += points
        if not valid or not recipients:
            continue
        person = entries[0][1]
        allocations = sorted(recipients.values(), key=lambda r: r["name"])
        signed = lambda value: format(value, "+g")
        if len(allocations) == 1:
            r = allocations[0]
            message = f"{r['name']} receives {signed(r['points'])} points."
        else:
            message = "; ".join(f"{r['name']} {signed(r['points'])}" for r in allocations) + " points."
        # Never truncate away a recipient or their signed points.
        if len(message) > 240:
            continue
        events.append({"event_id": key, "title": "Celebration of Life: " + person["name"],
                       "message": message, "url": LINK + "#" + anchor(person)})
    return events


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
    if state.get("version") not in (1, 2) or state.get("mode") != "live" or not re.fullmatch(
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


def payload(app_id, text, key, recipients="public", title="Stammtisch CoL pilot test", url=LINK):
    data = {"app_id": app_id, "target_channel": "push", "idempotency_key": key,
            "name": "Stammtisch CoL published update",
            "headings": {"en": title},
            "contents": {"en": text}, "url": url, "ttl": 86400}
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
    # OneSignal may return HTTP 200 with an empty id. Only its documented
    # zero-recipient response is a benign no-send; never acknowledge arbitrary
    # provider errors as though there were simply no subscribers.
    if result.get("id"):
        return "accepted_partial" if result.get("errors") else "accepted"
    if (result.get("id") == "" and result.get("recipients") == 0
            and result.get("errors") == ["All included players are not subscribed"]):
        return "no_recipients"
    raise RuntimeError("Unexpected OneSignal response; review required")


def historical(commit):
    if not re.fullmatch(r"[0-9a-f]{40}", commit or ""):
        return None
    p = subprocess.run(["git", "show", commit + ":data/celebration.json"], cwd=ROOT,
                       text=True, capture_output=True, check=False)
    return json.loads(p.stdout) if p.returncode == 0 else None


def seed_state(current, commit):
    return {"version": 2, "mode": "live", "last_digest": digest(current),
            "last_commit": commit, "pending": None, "seen_events": known_passings(current),
            "not_before": dt.datetime.now(ZoneInfo("America/Toronto")).date().isoformat(),
            "last_result": "seeded"}


def live(current, commit, app_id, api_key, ledger):
    current_hash = digest(current)
    issue = ledger.find()
    state = parse(issue["body"]) if issue else None
    if state and state["version"] == 1 and state.get("pending"):
        raise RuntimeError("Legacy pending notification requires review; no broadcast")
    if state is None or state["version"] == 1:
        if not verify.same_public_register(current, commit, attempts=2, pause=4):
            raise RuntimeError("Cannot seed push checkpoint until public CoL data matches")
        seeded = seed_state(current, commit)
        ledger.update(issue, seeded) if issue else ledger.create(seeded)
        return "seeded_without_sending"
    if not isinstance(state.get("seen_events"), list) or not state.get("not_before"):
        raise RuntimeError("Invalid event checkpoint")
    if state["last_digest"] == current_hash and state.get("pending") is None:
        return "no_change"
    if not verify.same_public_register(current, commit, attempts=2, pause=4):
        raise RuntimeError("Public CoL register has not caught up to the commit")
    pending = state.get("pending")
    if pending and pending["digest"] != current_hash:
        raise RuntimeError("New publication superseded an unacknowledged push; review before retry")
    if pending is None:
        previous = historical(state.get("last_commit"))
        events = event_notifications(previous, current, set(state["seen_events"]), state["not_before"])
        if not events:
            # Keep undecided new events eligible when their allocations become
            # confirmed. Do not advance the baseline past an unfinished event.
            # Ordinary corrections of already-known deaths remain suppressed by
            # the permanent seen set and the previous baseline.
            return "no_confirmed_new_events"
        pending = {"digest": current_hash, "commit": commit,
                   "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                   "events": [{**event, "idempotency_key": str(uuid.uuid4()), "result": None}
                              for event in events]}
        state["pending"] = pending
        ledger.update(issue, state)  # stable UUID per event BEFORE any send
    if not key_is_fresh(pending["created_at"]):
        raise RuntimeError("Pending push older than safe idempotency retry window")
    results = []
    for event in pending["events"]:
        if not event.get("result"):
            result = send(api_key, payload(app_id, event["message"], event["idempotency_key"],
                                           title=event["title"], url=event["url"]))
            if result == "accepted_partial":
                raise RuntimeError("Partial event delivery requires review")
            event["result"] = result
            ledger.update(issue, state)
        results.append(event["result"])
        state["seen_events"] = sorted(set(state["seen_events"]) | {event["event_id"]})
    # Keep the original baseline: multiple outstanding deaths can be confirmed
    # in separate imports without losing the event whose points are still pending.
    state.update({"last_digest": current_hash, "pending": None, "last_result": results[-1]})
    ledger.update(issue, state)
    return results[-1]


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
        result = send(secret, test)
        # An HTTP 200 no-send or partial recipient failure is not a passed pilot.
        # Physical reception and click-through still require device confirmation.
        if result != "accepted":
            raise RuntimeError("Pilot was not accepted for all test devices")
        print("Pilot send status: " + result)
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

