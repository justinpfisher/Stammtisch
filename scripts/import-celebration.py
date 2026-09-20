"""Import a Google Sheets XLSX export into the site's read-only celebration data.

Uses only Python's standard library. Never edits the source workbook or publishes.
Usage: python scripts/import-celebration.py source.xlsx --captured-at ISO_TIMESTAMP
"""
import argparse
import datetime as dt
import json
import pathlib
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
MEMBERS = ["matt", "fish", "jerome", "ken", "marc", "jamie"]
SOURCE = "https://docs.google.com/spreadsheets/d/1B8tZFjIa5FsyBaex42Atg7pJ5Y86Lj1vHeJMRhrqrCY/edit"


def serial_date(value):
    if not isinstance(value, (int, float)):
        return None
    return (dt.datetime(1899, 12, 30) + dt.timedelta(days=value)).date().isoformat()


def read_workbook(path):
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            shared = ["".join(si.itertext()) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rels = {r.get("Id"): posixpath.normpath(posixpath.join("xl", r.get("Target")))
                for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        result = {}
        for sheet in ET.fromstring(z.read("xl/workbook.xml")).find("s:sheets", NS):
            target = rels[sheet.get("{" + NS["r"] + "}id")].lstrip("/")
            cells = {}
            for cell in ET.fromstring(z.read(target)).iter("{" + NS["s"] + "}c"):
                raw = cell.find("s:v", NS)
                value = raw.text if raw is not None else None
                kind = cell.get("t")
                if kind == "s" and value is not None:
                    value = shared[int(value)]
                elif kind == "inlineStr":
                    value = "".join(cell.find("s:is", NS).itertext())
                elif value is not None and kind not in ("str", "e"):
                    value = float(value)
                    if value.is_integer():
                        value = int(value)
                formula = cell.find("s:f", NS)
                if value is not None or formula is not None:
                    cells[cell.get("r")] = {"value": value, "formula": formula.text if formula is not None else None}
            result[sheet.get("name")] = cells
        return result


def score_rows(formula):
    # Fail closed if the source moves beyond its current explicit SUM/cell formula.
    expression = re.sub(r"\s+", "", formula or "").upper().lstrip("=")
    if expression.startswith("SUM(") and expression.endswith(")"):
        expression = expression[4:-1]
    if not re.fullmatch(r"E\d+(?:,E\d+)*", expression):
        raise ValueError(f"Unrecognized total formula: {formula!r}. Review it before importing.")
    return {int(ref[1:]) for ref in expression.split(",")}


def apply_confirmations(result, confirmations):
    for confirmation in confirmations:
        member = next(m for m in result["members"] if m["id"] == confirmation["memberId"])
        matches = [p for p in member["picks"] if p["name"] == confirmation["name"] and p["born"] == confirmation["born"]]
        if len(matches) != 1:
            raise ValueError("A confirmed record no longer matches the sheet. Review before importing.")
        pick = matches[0]
        if "actualDeathDate" in confirmation:
            dt.date.fromisoformat(confirmation["actualDeathDate"])
            existing = pick.get("actualDeathDate") or (pick.get("dateSource") or {}).get("dateOfPassing")
            if existing not in (None, confirmation["actualDeathDate"]):
                raise ValueError("The record conflicts with a verified actual death date. Review before importing.")
            pick["actualDeathDate"] = confirmation["actualDeathDate"]
            pick["actualDeathSource"] = {key: confirmation[key] for key in ("sourceUrl", "sourceLabel", "verifiedOn")}
        if "dateOfPassing" in confirmation:
            if pick["dateOfPassing"] not in (None, confirmation["dateOfPassing"]):
                raise ValueError("The sheet conflicts with a verified date of passing. Review before importing.")
            pick["dateOfPassing"] = confirmation["dateOfPassing"]
            pick["dateSource"] = confirmation
            pick["needsReview"] = False
        if "actualDeathAt" in confirmation:
            stamp = confirmation["actualDeathAt"]
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})", stamp):
                raise ValueError("An actual death time requires an ISO date, time and timezone offset.")
            instant = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            death_date = pick.get("actualDeathDate") or (pick.get("dateSource") or {}).get("dateOfPassing")
            if instant.date().isoformat() != death_date:
                raise ValueError("The actual death time must match the confirmed actual death date.")
            existing = pick.get("actualDeathAt")
            if existing and dt.datetime.fromisoformat(existing.replace("Z", "+00:00")) != instant:
                raise ValueError("Conflicting actual death times require review before importing.")
            pick["actualDeathAt"] = stamp
            pick["actualDeathTimeSource"] = {key: confirmation[key] for key in ("sourceUrl", "sourceLabel", "verifiedOn")}
        if "discoveryDate" in confirmation:
            dt.date.fromisoformat(confirmation["discoveryDate"])
            pick["discoveryDate"] = confirmation["discoveryDate"]
        if "allocationDecision" in confirmation:
            pick["allocationDecision"] = confirmation["allocationDecision"]
    return result


def import_data(path, captured_at, confirmations=()):
    sheets = read_workbook(path)
    if set(sheets) != {"LEADERBOARD", "buttons", *MEMBERS}:
        raise ValueError("Sheet names changed. Review the import mapping before continuing.")
    result = {"year": sheets["LEADERBOARD"]["A1"]["value"], "sourceUrl": SOURCE,
              "capturedAt": captured_at, "asOf": None, "members": [], "distinctions": []}
    for member_id in MEMBERS:
        cells = sheets[member_id]
        val = lambda address: cells.get(address, {}).get("value")
        as_of = serial_date(val("A1"))
        if result["asOf"] not in (None, as_of):
            raise ValueError("Member sheets have inconsistent snapshot dates.")
        result["asOf"] = as_of
        counted = score_rows(cells["E1"]["formula"])
        member = {"id": member_id, "name": str(val("B1")).title(),
                  "score": val("E1"), "avatar": f"assets/members/{member_id}.webp", "picks": []}
        rows = sorted({int(ref[1:]) for ref in cells if re.fullmatch(r"B\d+", ref) and int(ref[1:]) >= 3})
        for row in rows:
            original = str(val(f"B{row}"))
            date_of_passing = serial_date(val(f"D{row}"))
            points = val(f"E{row}")
            if not isinstance(points, (int, float)):
                raise ValueError(f"Invalid points in {member_id}!E{row}: {points}")
            entry = {"id": f"{member_id}-{row}", "pick": val(f"A{row}"),
                     "name": original.replace("💎", "").replace("🔶", "").strip(),
                     "sourceName": original, "born": serial_date(val(f"C{row}")),
                     "ageText": val(f"D{row}") if not date_of_passing else None,
                     "dateOfPassing": date_of_passing, "points": points,
                     "counted": row in counted, "sourceRow": row,
                     "pointsFormula": cells.get(f"E{row}", {}).get("formula"),
                     "marker": "diamond" if "💎" in original else "orange" if "🔶" in original else None}
            entry["needsReview"] = bool(entry["counted"] and not date_of_passing)
            member["picks"].append(entry)
        if sum(p["points"] for p in member["picks"] if p["counted"]) != member["score"]:
            raise ValueError(f"The imported entries do not reconcile with {member_id}'s total.")
        if len([p for p in member["picks"] if isinstance(p["pick"], int)]) != 50:
            raise ValueError(f"The number of picks changed for {member_id}. Review before importing.")
        result["members"].append(member)
    board = sheets["LEADERBOARD"]
    for col in "BCDEFG":
        formula = board[f"{col}2"]["formula"] or ""
        matched = re.search(r"(matt|fish|jerome|ken|marc|jamie)!E1", formula, re.I)
        if not matched:
            raise ValueError(f"Cannot match leaderboard column {col} to a member.")
        member = next(m for m in result["members"] if m["id"] == matched[1].lower())
        if board[f"{col}2"]["value"] != member["score"]:
            raise ValueError(f"Leaderboard total differs from {member['name']}'s sheet.")
        for pick in member["picks"]:
            if isinstance(pick["pick"], int):
                expected = board.get(f"{col}{pick['pick'] + 2}", {}).get("value")
                if expected and expected != pick["sourceName"]:
                    # A missing marker on the member tab is preserved from the leaderboard.
                    normalized = lambda name: re.sub(r"[^\w]", "", name, flags=re.UNICODE).casefold()
                    if normalized(expected) != normalized(pick["name"]):
                        raise ValueError(f"Leaderboard/name mismatch: {member['id']} pick {pick['pick']}")
                    pick["leaderboardName"] = expected
                    pick["marker"] = "diamond" if "💎" in expected else "orange" if "🔶" in expected else None
    cells = sheets["buttons"]
    for row in sorted({int(ref[1:]) for ref in cells if re.fullmatch(r"A\d+", ref) and int(ref[1:]) > 1}):
        result["distinctions"].append({"name": cells[f"A{row}"]["value"].strip(),
            "reason": cells.get(f"B{row}", {}).get("value"), "imageIdea": cells.get(f"C{row}", {}).get("value")})
    return apply_confirmations(result, confirmations)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=pathlib.Path)
    parser.add_argument("--captured-at", required=True)
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("data/celebration.json"))
    parser.add_argument("--confirmations", type=pathlib.Path, default=pathlib.Path("data/celebration-confirmations.json"))
    args = parser.parse_args()
    dt.datetime.fromisoformat(args.captured_at.replace("Z", "+00:00"))
    confirmations = json.loads(args.confirmations.read_text(encoding="utf-8")) if args.confirmations.exists() else []
    data = import_data(args.source, args.captured_at, confirmations)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {sum(len(m['picks']) for m in data['members'])} entries across {len(data['members'])} members.")
    print("Scores reconcile with all six member sheets and the leaderboard.")
