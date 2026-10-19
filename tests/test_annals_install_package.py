import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "annals_install_package", ROOT / "scripts/annals/build-install-package.py")
PACKAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


class AnnalsInstallPackageTests(unittest.TestCase):
    def test_exact_source_whitelist_hashes_and_reproducibility(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / "one.zip", Path(directory) / "two.zip"
            result = PACKAGE.build_package("HEAD", first)
            PACKAGE.build_package("HEAD", second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(result["files"], len(PACKAGE.FILES))
            self.assertFalse(result["installed"])
            with zipfile.ZipFile(first) as archive:
                manifest = json.loads(archive.read("source-manifest.json"))
                self.assertEqual(len(archive.namelist()), len(PACKAGE.FILES) + 2)
                self.assertFalse(any("private" in n or n.endswith("/Code.gs") or "SyntheticPilot" in n for n in archive.namelist()))
                for item in manifest["files"]:
                    expected = PACKAGE.git("show", manifest["sourceCommit"] + ":" + item["source"])
                    self.assertEqual(archive.read(item["install"]), expected)
                    self.assertEqual(item["sha256"], hashlib.sha256(expected).hexdigest())
                installed = json.loads(archive.read("install/appsscript.json"))
                original = json.loads(PACKAGE.git("show", manifest["sourceCommit"] + ":scripts/annals/production-appsscript.json"))
                self.assertEqual(installed, original)

    def test_narrow_four_module_package_preserves_private_manifest(self):
        modules = ("Production.gs", "PhotoProduction.gs", "RulesProduction.gs",
                   "GuardedRelease.gs")
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / "narrow.zip", Path(directory) / "reordered.zip"
            result = PACKAGE.build_package("HEAD", first, only=modules[::-1])
            PACKAGE.build_package("HEAD", second, only=modules)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(result["files"], 4)
            self.assertTrue(result["selectedOnly"])
            self.assertFalse(result["installed"])
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(set(archive.namelist()), {
                    "install/" + module for module in modules
                } | {"source-manifest.json", "README.txt"})
                manifest = json.loads(archive.read("source-manifest.json"))
                self.assertEqual(
                    [record["install"] for record in manifest["files"]],
                    ["install/" + module for module in modules]
                )
                for record in manifest["files"]:
                    original = PACKAGE.git(
                        "show", manifest["sourceCommit"] + ":" + record["source"]
                    )
                    self.assertEqual(archive.read(record["install"]), original)
                    self.assertEqual(record["sha256"], hashlib.sha256(original).hexdigest())
                self.assertNotIn("install/appsscript.json", archive.namelist())
                instructions = archive.read("README.txt").decode("utf8")
                self.assertIn("Selected public module update", instructions)
                self.assertIn("docs/current-state.md", instructions)
                self.assertNotIn("2026-11-09", instructions)
                self.assertIn("Do not reset or broadly disable", instructions)

    def test_narrow_package_refuses_unknown_duplicate_or_private_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "untrusted.zip"
            for selection in (
                (),
                ("ExtraCode.gs",),
                ("Production.gs", "Production.gs"),
                ("production-appsscript.json",),
            ):
                with self.subTest(selection=selection):
                    with self.assertRaises(ValueError):
                        PACKAGE.build_package("HEAD", out, only=selection)
                    self.assertFalse(out.exists())

    def test_complete_package_reads_expiry_from_live_record_not_stale_date(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "complete.zip"
            result = PACKAGE.build_package("HEAD", out)
            self.assertFalse(result["selectedOnly"])
            with zipfile.ZipFile(out) as archive:
                instructions = archive.read("README.txt").decode("utf8")
                self.assertNotIn("2026-11-09", instructions)
                self.assertIn("effective dispatch cutoff", instructions)

    def test_artifacts_cannot_be_written_into_public_checkout(self):
        with self.assertRaises(ValueError):
            PACKAGE.build_package("HEAD", ROOT / "accidental-public-install.zip")


if __name__ == "__main__":
    unittest.main()
