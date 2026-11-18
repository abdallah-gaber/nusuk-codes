import tempfile
import unittest
from pathlib import Path

from admin.model import SEASON, VERIFICATION, read_csv, safe_source
from admin.publishing import read_pair, stage
from admin.tests.test_pipeline import DATE, record

SOURCE = "https://www.instagram.com/p/DfXT6fmNOND/"


class InstagramSourceTests(unittest.TestCase):
    def test_canonical_public_post_url_is_preserved_exactly(self):
        for source in (SOURCE, "https://www.instagram.com/p/Ab_c-123/"):
            with self.subTest(source=source):
                self.assertEqual(safe_source(source), source)

    def test_noncanonical_private_profile_tracking_and_lookalike_urls_rejected(self):
        for source in (
            SOURCE.replace("https:", "http:"),
            SOURCE.replace("www.instagram.com", "instagram.com"),
            SOURCE.replace("www.instagram.com", "www.instagram.com.evil.example"),
            SOURCE.replace("www.instagram.com", "m.instagram.com"),
            SOURCE.replace("www.instagram.com", "user@www.instagram.com"),
            SOURCE.replace("www.instagram.com", "www.instagram.com:443"),
            SOURCE.replace("www.instagram.com", "WWW.Instagram.com"),
            SOURCE + "?igsh=tracking",
            SOURCE + "#fragment",
            SOURCE.rstrip("/"),
            "https://www.instagram.com/p/",
            "https://www.instagram.com/p/%44fXT6fmNOND/",
            "https://www.instagram.com/p/../direct/",
            "https://www.instagram.com/p/" + "a" * 65 + "/",
            "https://www.instagram.com/someprofile/",
            "https://www.instagram.com/direct/inbox/",
            "https://www.instagram.com/accounts/login/",
            "https://www.instagram.com/stories/someprofile/123/",
            "https://www.instagram.com/reel/Abc123/",
        ):
            with self.subTest(source=source), self.assertRaises(ValueError):
                safe_source(source)

    def test_csv_preserves_original_source_and_workflow_observation(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "input.csv"
            path.write_text("code,source_url\nNG-dX626jFL," + SOURCE + "\n")
            candidates, report = read_csv(path, SEASON, DATE)
        self.assertEqual(report["invalid"], [])
        self.assertEqual(candidates[0]["code"], "NG-dX626jFL")
        self.assertEqual(
            candidates[0]["sources"],
            [dict(sourceUrl=SOURCE, discoveredAt=DATE, sourcePublishedAt=None)],
        )

    def test_publication_keeps_unverified_status_and_exposes_domain_only(self):
        entry = dict(record(), sourceUrl=SOURCE)
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "snapshot"
            stage([entry], output)
            _, raw, data = read_pair(output)
        self.assertEqual(data["codes"][0]["source"], "instagram.com")
        self.assertEqual(data["codes"][0]["status"], VERIFICATION)
        self.assertNotIn(SOURCE.encode(), raw)
        self.assertFalse(entry["redemptionVerified"])


if __name__ == "__main__":
    unittest.main()
