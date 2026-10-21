"""Reconcile GitHub Club-state awarded-point decisions against Sheet inputs.

One public source of truth: data/col-club-state.json. This adapter reads the
same pointsCorrections records as the browser and makes the already validated
GitHub result the *published* site data, even after future spreadsheet imports.
No extra ledger, credential, notification or database is created.
"""
import copy
import datetime as dt
import re
import unicodedata

MEMBERS = frozenset(("fish", "marc", "matt", "ken", "jamie", "jerome"))
PICK_ID = re.compile(r"^(fish|marc|matt|ken|jamie|jerome)-(?:[3-9]|[1-9][0-9]{1,3})$")

def _key(name, born):
    normalized = unicodedata.normalize("NFD", name)
    return ("".join(c for c in normalized if not unicodedata.combining(c)).lower().strip(), born)

def validated_corrections(club):
    """Validate only the correction field of an otherwise qualified Club file."""
    if not isinstance(club,dict) or club.get("schemaVersion") != 1:
        raise ValueError("Invalid GitHub Club register")
    entries = club.get("pointsCorrections", [])
    if not isinstance(entries,list) or len(entries)>200:
        raise ValueError("Invalid GitHub score correction list")
    seen = set()
    for c in entries:
        if not isinstance(c,dict) or set(c) != {
            "seasonYear","memberId","pickId","name","born","points"
        }:
            raise ValueError("Invalid GitHub score correction entry")
        if (type(c["seasonYear"]) is not int or c["seasonYear"]<2026
            or c["memberId"] not in MEMBERS or not isinstance(c["pickId"],str)
            or not PICK_ID.fullmatch(c["pickId"])
            or not c["pickId"].startswith(c["memberId"]+"-")
            or not isinstance(c["name"],str) or not 1<=len(c["name"].strip())<=160
            or not isinstance(c["born"],str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",c["born"])
            or type(c["points"]) is not int or not 0<=c["points"]<=1000):
            raise ValueError("Invalid GitHub score correction identity")
        try:
            dt.date.fromisoformat(c["born"])
        except ValueError as exc:
            raise ValueError("Invalid GitHub score correction birth date") from exc
        k = (c["seasonYear"],c["pickId"])
        if k in seen:
            raise ValueError("Duplicate GitHub score correction")
        seen.add(k)
    return entries

def overridden_pick(entries,year,member_id,pick):
    return any(c["seasonYear"]==year and c["memberId"]==member_id
        and c["pickId"]==pick["id"] and _key(c["name"],c["born"])==_key(pick["name"],pick["born"])
        for c in entries)

def apply_awarded_points(data,club):
    """GitHub overrides points only; original confirmed death evidence is untouched."""
    entries=validated_corrections(club)
    out=copy.deepcopy(data)
    year=out["year"]
    touched=set()
    members={m["id"]:m for m in out["members"]}
    for c in entries:
        if c["seasonYear"]!=year:
            continue
        member=members.get(c["memberId"])
        if member is None:
            raise ValueError("GitHub correction member not in published season")
        matches=[p for p in member["picks"] if p["id"]==c["pickId"]]
        if len(matches)!=1:
            raise ValueError("GitHub correction selection not in published season")
        pick=matches[0]
        if not pick.get("counted") or _key(pick["name"],pick["born"])!=_key(c["name"],c["born"]):
            raise ValueError("GitHub correction source identity changed or award unrecorded")
        pick["points"]=c["points"]
        touched.add(c["memberId"])
    for member in out["members"]:
        if member["id"] in touched:
            member["score"]=sum(p["points"] for p in member["picks"] if p["counted"])
    return out
