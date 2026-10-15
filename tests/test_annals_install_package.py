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

    def test_artifacts_cannot_be_written_into_public_checkout(self):
        with self.assertRaises(ValueError):
            PACKAGE.build_package("HEAD", ROOT / "accidental-public-install.zip")


if __name__ == "__main__":
    unittest.main()
