#!/usr/bin/env python3
"""Package only an exact public git revision; no account access or installation."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
FILES = (
    "PilotCore.js", "ProductionCore.js", "AutoCore.js", "MediaCore.js",
    "MediaPolicy.js", "Production.gs", "ReviewUi.html", "HistoryCore.js",
    "GovernanceCore.js", "HistoryProduction.gs", "PublicDisplay.js",
    "production-appsscript.json", "PhotoContracts.js", "PhotoProduction.gs",
    "RulesCore.js", "RulesProduction.gs", "JpegCodec.js", "PhotoDerivative.js", "GuardedRelease.gs",
)


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def build_package(ref, destination, only=None):
    destination = Path(destination).resolve()
    if destination.is_relative_to(ROOT):
        raise ValueError("Save installation artifacts outside the public checkout")
    # Default package stays reproducible and complete. An ordinary narrow
    # owner-only patch must not re-ship the old appsscript.json or unrelated
    # trusted modules merely because the full package includes them.
    if only is None:
        selected = FILES
    else:
        requested = tuple(only)
        if not requested or len(requested) != len(set(requested)) or not set(requested).issubset(FILES):
            raise ValueError("Select unique modules from the published source allowlist")
        if "production-appsscript.json" in requested:
            raise ValueError("Narrow updates must preserve the installed private manifest")
        selected = tuple(name for name in FILES if name in requested)
    commit = git("rev-parse", "--verify", ref + "^{commit}").decode().strip()
    records, payloads = [], {}
    for name in selected:
        source = "scripts/annals/" + name
        data = git("show", commit + ":" + source)
        target = "appsscript.json" if name == "production-appsscript.json" else (
            name[:-3] + ".gs" if name.endswith(".js") else name)
        payloads["install/" + target] = data
        records.append({"source": source, "install": "install/" + target,
                        "sha256": hashlib.sha256(data).hexdigest()})
    if only is None:
        manifest = json.loads(payloads["install/appsscript.json"])
        if manifest.get("runtimeVersion") != "V8" or manifest.get("exceptionLogging") != "NONE":
            raise ValueError("Qualified runtime and private exception policy required")
    metadata = {"schemaVersion": 1, "sourceCommit": commit,
                "installed": False, "credentialsIncluded": False,
                "publicationActivated": False, "files": records}
    payloads["source-manifest.json"] = (json.dumps(metadata, indent=2) + "\n").encode()
    mode = ("Selected public module update (preserve every other installed file)."
            if only is not None else "Complete public source reference (compare before use).")
    selected_names = ", ".join(record["install"].removeprefix("install/") for record in records)
    payloads["README.txt"] = ("""STAMMTISCH ANNALS: IN-PLACE INSTALLATION SOURCE ONLY

Exact public source revision: """ + commit + """
Package scope: """ + mode + """
Included modules in source order: """ + selected_names + """

This package does not install, authenticate, activate, rotate or sign anything.
It contains no private originals, contacts, configuration values or evidence.
Use only the existing authenticated owner-controlled Production project.
Keep its existing deployment URL and owner-only access; record the previous
version for rollback. Do not create a new project, run legacy setup, reset a
cursor/boundary, remove triggers, clear attempts or replay dispatches.

Read AGENTS.md, docs/current-state.md and docs/annals-production-runbook.md
at the reviewed revision. This is an update kit, not a first-launch checklist.
Compare changed modules with the recorded installed baseline. Apply only changed
files and required dependencies, add dependencies before callers, and independently
read back their hashes. Preserve trusted unchanged files and private-only diagnostics.
A first unmanaged install, unexplained drift or a relevant incident requires full
source reconciliation; an unrelated website update does not use this kit.

Public .js module names map to native .gs files without content changes.
Preserve the existing owner-only manifest/scopes, Script Properties, state and
single HEAD trigger. HEAD changes scheduled execution immediately: use a controlled
pause only if needed for incompatible saves, then restore the previously authorised
state. Never invoke emergency stop merely to install; it removes the trigger.
Advance the EXISTING owner-only web-app version after source validation and verify
the affected behaviour. Source saving alone does not update that deployed version.

Do not reset or broadly disable established live capabilities, re-register consents,
rotate credentials, replay attempts or stamp acceptance merely to install source.
Use non-secret gate readers and the existing rollback; preserve all journals,
activation boundaries, cursors and budget. Installation does not authorise new
History, photo-format or CoL capabilities. Reuse completed qualifications until a
material relevant change invalidates them; never fabricate genuine acceptance.
There is no calendar AI cutoff after this private update is installed. Preserve the US$5 Toronto-month AI reservation ceiling and all revocable AI/publication gates.
Preserve the existing authenticated publisher credential and effective dispatch cutoff.
The latest independently verified expiry/cutoff is recorded in docs/current-state.md,
not frozen in this installation kit. Do not reinstate an old token or reset its
expiry property merely for an unrelated module update. Never invent or auto-extend
a credential expiry.

source-manifest.json records the exact source and each unchanged file digest.
Historical Code.gs, SyntheticPilot.gs and private QA files are excluded.
""").encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(payloads.items()):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    return {"sourceCommit": commit, "files": len(records), "installed": False,
            "selectedOnly": only is not None,
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", default="HEAD")
    parser.add_argument("--output", required=True)
    parser.add_argument("--only", nargs="+", metavar="MODULE",
                        help="Package only the named existing public modules (omit private manifest)")
    args = parser.parse_args()
    print(json.dumps(build_package(args.ref, args.output, only=args.only)))
