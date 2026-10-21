"""GitHub-authoritative, attributable adjustments to already awarded CoL points.

The Sheet remains an *input*, never the last writer of a member-authorised
score correction. This narrowly scoped overlay does not alter death evidence,
historic signed releases, selections or the spreadsheet itself. Commit history
holds the ordered decision trail; no private mail or consent proof belongs here.
"""
import copy
import datetime as dt
import re

MEMBERS = frozenset(("fish", "marc", "matt", "ken", "jamie", "jerome"))
CORRECTION_ID = re.compile(r"^[a-z0-9][a-z0-9-]{7,95}$")
PICK_ID = re.compile(r"^(fish|marc|matt|ken|jamie|jerome)-[3-9][0-9]{0,3}$")
STAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

def validated_corrections(raw):
    """Fail closed on malformed or conflicting public decision records."""
    if not isinstance(raw, dict) or set(raw) != {"schemaVersion", "corrections"} or raw["schemaVersion"] != 1:
        raise ValueError("Invalid GitHub score correction register")
    entries = raw["corrections"]
    if not isinstance(entries, list) or len(entries) > 500:
        raise ValueError("Invalid GitHub score correction list")
    seen, latest = set(), {}
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {
            "id", "seasonYear", "memberId", "pickId", "sourceName", "sourceBorn",
            "points", "decidedBy", "decidedAt", "reason"
        }:
            raise ValueError("Invalid GitHub score correction entry")
        if not isinstance(entry["id"], str) or not CORRECTION_ID.fullmatch(entry["id"]) or entry["id"] in seen:
            raise ValueError("Duplicate or invalid GitHub correction ID")
        seen.add(entry["id"])
        if (type(entry["seasonYear"]) is not int or not 2026 <= entry["seasonYear"] <= 9999
            or entry["memberId"] not in MEMBERS or entry["decidedBy"] not in MEMBERS
            or not isinstance(entry["pickId"], str) or not PICK_ID.fullmatch(entry["pickId"])
            or not entry["pickId"].startswith(entry["memberId"] + "-")):
            raise ValueError("Invalid GitHub correction identity")
        if (not isinstance(entry["sourceName"], str) or not 1 <= len(entry["sourceName"].strip()) <= 160
            or entry["sourceName"] != entry["sourceName"].strip()
            or not isinstance(entry["sourceBorn"], str)
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["sourceBorn"])):
            raise ValueError("Invalid GitHub correction source")
        try:
            dt.date.fromisoformat(entry["sourceBorn"])
        except ValueError as exc:
            raise ValueError("Invalid GitHub correction birth date") from exc
        if type(entry["points"]) is not int or not -500 <= entry["points"] <= 500:
            raise ValueError("Invalid GitHub corrected points")
        if not isinstance(entry["reason"], str) or not 3 <= len(entry["reason"].strip()) <= 180:
            raise ValueError("Invalid GitHub correction rationale")
        stamp = entry["decidedAt"]
        if not isinstance(stamp, str) or not STAMP.fullmatch(stamp):
            raise ValueError("Invalid GitHub correction time")
        try:
            instant = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Invalid GitHub correction time") from exc
        key = (entry["seasonYear"], entry["memberId"], entry["pickId"])
        if key in latest and instant <= latest[key]:
            raise ValueError("GitHub corrections must be ordered without replay")
        latest[key] = instant
    return entries

def overridden_pick(corrections, season_year, member_id, pick):
    return any(e["seasonYear"] == season_year and e["memberId"] == member_id
        and e["pickId"] == pick["id"] and e["sourceName"] == pick["name"]
        and e["sourceBorn"] == pick["born"] for e in corrections)

def apply_awarded_points(data, raw):
    """Apply only a matching, already-counted member decision to site data.

    Source identity and original Sheet validation remain separate; no claimed
    member attribution in a JSON file itself authenticates a decision. The
    authorised writer must authenticate the decision before committing it.
    """
    entries = validated_corrections(raw)
    result = copy.deepcopy(data)
    season = result["year"]
    members = {m["id"]:m for m in result["members"]}
    touched = set()
    for entry in entries:
        if entry["seasonYear"] != season:
            continue
        member = members.get(entry["memberId"])
        if member is None:
            raise ValueError("GitHub correction member not in published season")
        matches = [p for p in member["picks"] if p["id"] == entry["pickId"]]
        if len(matches) != 1:
            raise ValueError("GitHub correction selection not in published season")
        pick = matches[0]
        if (pick["name"] != entry["sourceName"] or pick["born"] != entry["sourceBorn"]):
            raise ValueError("GitHub correction source identity changed")
        if pick.get("counted") is not True:
            raise ValueError("GitHub score correction requires an existing awarded selection")
        pick["points"] = entry["points"]
        touched.add(member["id"])
    for member in result["members"]:
        if member["id"] in touched:
            member["score"] = sum(p["points"] for p in member["picks"] if p["counted"])
    return result
