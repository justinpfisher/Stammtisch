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
    "RulesCore.js", "RulesProduction.gs", "JpegCodec.js", "PhotoDerivative.js",
)


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def build_package(ref, destination):
    destination = Path(destination).resolve()
    if destination.is_relative_to(ROOT):
        raise ValueError("Save installation artifacts outside the public checkout")
    commit = git("rev-parse", "--verify", ref + "^{commit}").decode().strip()
    records, payloads = [], {}
    for name in FILES:
        source = "scripts/annals/" + name
        data = git("show", commit + ":" + source)
        target = "appsscript.json" if name == "production-appsscript.json" else (
            name[:-3] + ".gs" if name.endswith(".js") else name)
        payloads["install/" + target] = data
        records.append({"source": source, "install": "install/" + target,
                        "sha256": hashlib.sha256(data).hexdigest()})
    manifest = json.loads(payloads["install/appsscript.json"])
    if manifest.get("runtimeVersion") != "V8" or manifest.get("exceptionLogging") != "NONE":
        raise ValueError("Qualified runtime and private exception policy required")
    metadata = {"schemaVersion": 1, "sourceCommit": commit,
                "installed": False, "credentialsIncluded": False,
                "publicationActivated": False, "files": records}
    payloads["source-manifest.json"] = (json.dumps(metadata, indent=2) + "\n").encode()
    payloads["README.txt"] = ("""STAMMTISCH ANNALS: IN-PLACE INSTALLATION SOURCE ONLY

Exact public source revision: """ + commit + """

This package does not install, authenticate, activate, rotate or sign anything.
It contains no private originals, contacts, configuration values or evidence.
Use only the existing authenticated owner-controlled Production project.
Keep its existing deployment URL and owner-only access; record the previous
version for rollback. Do not create a new project, run legacy setup, reset a
cursor/boundary, remove triggers, clear attempts or replay dispatches.

Install the files under install/ into the matching existing Apps Script files.
Public .js module names are mapped to native .gs files without content changes.
Add JpegCodec and PhotoDerivative, then PhotoContracts, PhotoProduction,
RulesCore, RulesProduction, PublicDisplay,
HistoryCore, GovernanceCore and HistoryProduction before
updating callers. Preserve the existing manifest/scopes and all Script
Properties. Never open or export credential values to complete this update.
If needed, use only a controlled ordinary-publication pause, preserving its
previous state. Do not use emergency stop merely to install: it removes a
trigger. Restore only the previously authorised ordinary service state.

Advance the EXISTING owner-only web-app deployment version after source
validation. Source saving alone does not update that deployed version.
Check safe boolean preflight and privately reconcile installed modules,
consent registry, trigger, cursor, activation and budget without logging
private values. Do not run paid diagnostics or unknown earlier dispatches.
Record actual deployment version and verification; never infer them from ZIP.

Keep History, automatic media, photographic v2 and rule v2 publication disabled.
Do not change ANNALS_PHOTOS_V2_ENABLED, ANNALS_RULES_V2_ENABLED, their hosted
acceptance markers or the separate new-rules boundary merely to install source. Do not change signing
keys or set signing-remediation markers. Credential rotation remains a final,
separate owner-controlled action; no remediation is certified by this package.
After that stage, qualify legitimate future signing and any new authority.
Keep the 2026-11-08 UTC AI stop, 2026-11-09 dispatch expiry and US$5 ceiling.

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
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", default="HEAD")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    print(json.dumps(build_package(args.ref, args.output)))
