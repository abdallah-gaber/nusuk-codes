import unittest

from admin.model import safe_source
from admin.publishing import checked_pair
from admin.model import canonical, digest

SOURCE = (
    "https://script.google.com/macros/s/"
    "AKfycbwd2Z5B2k9Q-l4jFtPUQ84yOoj_uP9HWLdqt5hW3O220XYCNN6c_6CNdNmXnCgARn0N/exec"
)

class GoogleSourceTests(unittest.TestCase):
    def test_google_apps_script_source_allowed(self):
        self.assertEqual(safe_source(SOURCE), SOURCE)

    def test_unsafe_sources_rejected(self):
        for url in (
            "http://script.google.com/macros/s/example/exec",
            "https://script.google.com.evil.example/app",
            "https://evil.example/app",
        ):
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    safe_source(url)

    def test_google_source_allowed_in_public_snapshot(self):
        data = {
            "schemaVersion": 1,
            "season": "nov-2026",
            "codes": [{
                "code": "NG-TEST0001",
                "status": "community_submitted_unverified",
                "source": "script.google.com",
                "observedAt": "2026-11-02",
            }],
        }
        raw = canonical(data).encode()
        sha = digest(raw)
        manifest = {
            "schemaVersion": 1,
            "season": "nov-2026",
            "codeCount": 1,
            "generatedAt": "2026-11-02T12:00:00Z",
            "snapshotUrl": f"/data/codes.{sha[:16]}.json",
            "snapshotSha256": sha,
            "readOnly": True,
            "submissionsEnabled": False,
            "candidatePreview": True,
            "maintenance": False,
        }
        self.assertEqual(checked_pair(manifest, raw), data)

if __name__ == "__main__":
    unittest.main()
