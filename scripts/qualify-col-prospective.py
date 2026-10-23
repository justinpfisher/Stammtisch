"""Read-only exact-commit calculation qualification, not a signed activation.

The original workbook stays in memory. Only counts, hashes and test outcomes
leave this process. A calculation regression does not authenticate a member,
finalize a draft, verify a new death or authorize a release.
"""
import hashlib
import importlib.util
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def allocations(data):
    """Exclude moving live-age estimates; preserve exact historical awards."""
    return {"year": data["year"], "members": [
        {"id": m["id"], "score": m["score"], "picks": [
            {**{k: p.get(k) for k in (
                "id", "pick", "name", "born", "counted", "dateOfPassing",
                "actualDeathDate", "actualDeathAt", "discoveryDate", "pointsFormula")},
             "awardedPoints": p["points"] if p["counted"] else None}
            for p in m["picks"]]} for m in data["members"]]}


def main():
    observer = load("observe-col-source.py", "prospective_source_observer")
    sync = load("sync-celebration-sheet.py", "prospective_source_importer")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if commit != os.environ.get("GITHUB_SHA"):
        raise ValueError("Exact hosted implementation required")
    if subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT, text=True).strip():
        raise ValueError("Tracked implementation changed")
    captured = []

    def fetch(sheet, credentials):
        workbook = observer.monitor.fetch_workbook(sheet, credentials)
        captured.append(workbook)
        return workbook

    source = observer.observe(os.environ.get("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"),
                              commit, os.environ.get("GITHUB_RUN_ID"), fetcher=fetch)
    confirmations = json.loads((ROOT / "data/celebration-confirmations.json").read_text(encoding="utf8"))
    current = json.loads((ROOT / "data/celebration.json").read_text(encoding="utf8"))
    imported = sync.importer.import_data(None, source["observedAt"], confirmations,
                                        sheets=sync.sheets_api_cells(captured[0]))
    if allocations(imported) != allocations(current):
        raise ValueError("Authoritative source changed; preserve baseline")
    # All source cells remain in memory; no raw workbook, event, email or
    # credentials are serialized, logged or made into an artifact.
    tests = ["tests/col-prospective.test.mjs", "tests/col-club-state.test.mjs",
             "tests/col-centenary-policy.test.mjs", "tests/col-award-policy.test.mjs",
             "tests/annals-col-staged.test.mjs"]
    run = subprocess.run(["node", "--test", *tests], cwd=ROOT, capture_output=True, timeout=120)
    if run.returncode:
        raise ValueError("Calculation or release regression failed")
    protected = ["col-prospective.mjs", "col-club-state.mjs", "celebration-rules.mjs",
                 "scripts/qualify-col-prospective.py", "scripts/import-celebration.py",
                 "scripts/sync-celebration-sheet.py", ".github/workflows/col-source-observe.yml", *tests]
    hashes = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in protected}
    result = {"kind": "col-prospective-calculation-qualification-v1",
              "implementationCommit": commit, "workflowRunId": os.environ["GITHUB_RUN_ID"],
              "sourceObservation": source, "sourceAllocationMatch": True,
              "entries": sum(len(m["picks"]) for m in current["members"]),
              "countedAwards": sum(p["counted"] for m in current["members"] for p in m["picks"]),
              "memberTotalsMatched": len(current["members"]), "regressionPassed": True,
              "implementationFiles": hashes, "signedRelease": False,
              "qualification": "source-matched-candidate-calculation-only"}
    print(json.dumps(result, sort_keys=True, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never print provider, importer or subprocess exception details.
        sys.stderr.write("Prospective CoL qualification failed; no release or source cells published.\n")
        sys.exit(1)
