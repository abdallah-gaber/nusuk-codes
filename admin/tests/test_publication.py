import copy
import json
import tempfile
import unittest
from pathlib import Path

from admin.cli import review_plan
from admin.model import COMMUNITY_POLICY, SEASON, canonical, digest, read_csv
from admin.prepare import prepare
from admin.publishing import read_pair, stage, validate_inventory
from admin.tests.test_pipeline import DATE, ROOT, record


def live_fixture():
    candidates, _ = read_csv(ROOT / "data/current_season_codes.csv", SEASON, DATE)
    records = []
    for candidate in candidates:
        row = record(candidate["code"])
        row.update(
            **candidate["sources"][0],
            status="pending",
            revision=0,
            sourceReviewed=False,
            seasonReviewed=False,
            sources=[dict(**s, id=digest(canonical(s))) for s in candidate["sources"]],
            audit=[],
        )
        records.append(row)
    return dict(
        schemaVersion=1,
        project="nusuk-codes",
        season=SEASON,
        withEvidence=True,
        records=records,
    )


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.site = self.folder / "site"
        data = self.site / "public/data"
        data.mkdir(parents=True)
        manifest = json.loads(
            (ROOT / "admin/tests/fixtures/preview-manifest.json").read_text()
        )
        (data / "manifest.json").write_text(canonical(manifest))
        name = Path(manifest["snapshotUrl"]).name
        (data / name).write_bytes((ROOT / "public/data" / name).read_bytes())

    def test_explicit_community_policy_does_not_assert_redemption_or_source_verification(
        self,
    ):
        row = record()
        row.update(
            publicationPolicy=COMMUNITY_POLICY,
            syntaxChecked=True,
            seasonAttributed=True,
            sourceReviewed=False,
            seasonReviewed=False,
        )
        manifest = stage([row], self.folder / "stage", planning_only=True)
        _, _, data = read_pair(self.folder / "stage")
        self.assertEqual(data["codes"][0]["status"], "community_submitted_unverified")
        self.assertIs(row["redemptionVerified"], False)
        with self.assertRaises(ValueError):
            validate_inventory(self.folder / "stage", manifest, data)
        decision = dict(
            id=row["id"],
            code=row["code"],
            expectedStatus="pending",
            expectedRevision=0,
            status="published",
            publicationPolicy=COMMUNITY_POLICY,
            syntaxChecked=True,
            seasonAttributed=True,
            note="Owner display policy; redemption remains unverified",
        )
        review_plan(json.dumps([decision]))
        for changes in [
            dict(publicationPolicy="unknown"),
            dict(syntaxChecked=False),
            dict(seasonAttributed=False),
        ]:
            with self.assertRaises(ValueError):
                review_plan(json.dumps([dict(decision, **changes)]))
            with self.assertRaises(ValueError):
                stage([dict(row, **changes)], self.folder / "bad")

    def run_plan(self, live, name):
        export = self.folder / f"{name}.json"
        export.write_text(canonical(live))
        bundle = ROOT / "imports/2026-11-01"
        return prepare(
            export,
            bundle / "new_codes_only.csv",
            bundle / "already_existing_source_sightings.csv",
            bundle / "IMPORT_REPORT.json",
            self.folder / name,
            DATE,
            DATE,
            root=self.site,
        )

    def test_full_1540_plan_and_rollback_without_mutating_live_input(self):
        live = live_fixture()
        original = copy.deepcopy(live)
        report = self.run_plan(live, "full")
        self.assertFalse(report["blocked"])
        self.assertEqual(
            (
                report["documentCreates"],
                report["sourceCreates"],
                report["publicationApprovals"],
            ),
            (408, 451, 1540),
        )
        self.assertEqual(report["projectedSources"], 1583)
        self.assertEqual(report["estimatedWrites"]["total"], 3939)
        self.assertEqual((report["snapshotAdded"], report["snapshotRemoved"]), (408, 0))
        self.assertEqual(live, original)
        _, _, data = read_pair(self.folder / "full/snapshot")
        self.assertEqual(len(data["codes"]), 1540)
        self.assertEqual(len({c["code"] for c in data["codes"]}), 1540)
        self.assertEqual(len(report["reviewBatches"]), 7)
        old, _, old_data = read_pair(self.folder / "full/rollback")
        self.assertEqual(old["snapshotSha256"], report["rollbackSnapshotSha256"])
        self.assertEqual(len(old_data["codes"]), 1132)
        again = self.run_plan(live, "again")
        self.assertEqual(
            report["snapshot"]["snapshotSha256"], again["snapshot"]["snapshotSha256"]
        )

    def test_live_drift_stops_even_when_final_union_still_1540(self):
        live = live_fixture()
        candidates, _ = read_csv(
            ROOT / "imports/2026-11-01/new_codes_only.csv", SEASON, DATE
        )
        candidate = candidates[0]
        row = record(candidate["code"])
        row.update(
            **candidate["sources"][0],
            status="pending",
            sources=[dict(**s, id=digest(canonical(s))) for s in candidate["sources"]],
            audit=[],
        )
        live["records"].append(row)
        report = self.run_plan(live, "drift")
        self.assertTrue(report["blocked"])
        self.assertEqual(report["actual"]["trulyMissingCodes"], 407)
        self.assertEqual(report["expectedTotalDifference"], 0)
        self.assertFalse((self.folder / "drift/snapshot").exists())

    def test_hidden_codes_are_not_silently_republished(self):
        live = live_fixture()
        live["records"][0]["status"] = "hidden"
        report = self.run_plan(live, "hidden")
        self.assertTrue(report["blocked"])
        self.assertTrue(report["blockedModerationIds"])
        self.assertFalse((self.folder / "hidden/snapshot").exists())
