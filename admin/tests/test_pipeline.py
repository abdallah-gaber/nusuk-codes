import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from admin.cli import apply_import, parser, plan_import, reconcile, review_plan, run
from admin.model import SEASON, VERIFICATION, canonical, code_id, read_csv
from admin.publishing import (
    atomic_write,
    checked_pair,
    read_pair,
    replace_manifest,
    stage,
)
from admin.store import connect

ROOT = Path(__file__).resolve().parents[2]
DATE = "2026-11-01T00:00:00Z"


def record(code="NG-dX626jFL", **changes):
    return dict(
        id=code_id(SEASON, code),
        code=code,
        season=SEASON,
        status="published",
        sourceUrl="https://services.nusuk.sa/app?p=27&id=" + code,
        discoveredAt=DATE,
        verification=VERIFICATION,
        redemptionVerified=False,
        sourceReviewed=True,
        seasonReviewed=True,
        reviewedAt=DATE,
        reviewedBy="test",
        reviewNote="Source and season manually reviewed; redemption unverified",
        reviewPlanId="test-plan",
        revision=1,
        **changes,
    )


class MemoryStore:
    def __init__(self):
        self.records = {}
        self.sources = {}
        self.fail = None
        self.after_commit = False

    def get(self, identity):
        return copy.deepcopy(self.records.get(identity))

    def case_variants(self, season, code):
        return [
            r["id"]
            for r in self.records.values()
            if r["season"] == season
            and r["code"].lower() == code.lower()
            and r["code"] != code
        ]

    def import_one(self, entry, batch, actor, input_hash):
        if self.fail == entry["id"] and not self.after_commit:
            raise ConnectionError("network")
        exists = entry["id"] in self.records
        if not exists:
            self.records[entry["id"]] = record(entry["code"])
            self.records[entry["id"]]["status"] = "pending"
        before = len(self.sources.setdefault(entry["id"], set()))
        self.sources[entry["id"]].update(canonical(s) for s in entry["sources"])
        if self.fail == entry["id"] and self.after_commit:
            raise TimeoutError("commit response lost")
        return dict(
            created=not exists, sourcesAdded=len(self.sources[entry["id"]]) - before
        )


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def csv(self, rows):
        path = self.folder / "input.csv"
        path.write_text("code,source_url,season\n" + rows)
        return read_csv(path, SEASON, DATE)

    def test_supplied_1132_remain_case_exact_and_unverified(self):
        entries, report = read_csv(ROOT / "data/current_season_codes.csv", SEASON, DATE)
        self.assertEqual(report["unique"], 1132)
        self.assertFalse(report["invalid"])
        self.assertFalse(report["caseVariants"])
        self.assertIn("NG-dX626jFL", [e["code"] for e in entries])

    def test_duplicate_rows_preserve_distinct_provenance(self):
        entries, report = self.csv(
            "NG-dX626jFL,https://facebook.com/post/1,2026-11\nNG-dX626jFL,https://facebook.com/post/2,2026-11\n"
        )
        self.assertEqual((report["unique"], report["duplicates"]), (1, 1))
        self.assertEqual(len(entries[0]["sources"]), 2)

    def test_invalid_formula_host_season_and_missing_columns(self):
        _, report = self.csv(
            "=bad,https://facebook.com/post,2026-11\nNG-dX626jFL,https://evil.example/app,2026-11\nNG-12345678,https://facebook.com/post,2026-02\nNG-12345679\n"
        )
        self.assertEqual(len(report["invalid"]), 4)
        path = self.folder / "bad.csv"
        path.write_text("code,code\nx,x\n")
        with self.assertRaises(ValueError):
            read_csv(path, SEASON, DATE)

    def test_case_variants_not_merged(self):
        entries, report = self.csv(
            "NG-dX626jFL,https://facebook.com/post,2026-11\nNG-dx626jFL,https://facebook.com/post,2026-11\n"
        )
        self.assertEqual(len(entries), 2)
        self.assertEqual(len(report["caseVariants"]), 1)
        self.assertNotEqual(entries[0]["id"], entries[1]["id"])

    def test_dry_run_does_not_write_and_repeat_import_is_idempotent(self):
        entries, _ = self.csv("NG-dX626jFL,https://facebook.com/post,2026-11\n")
        store = MemoryStore()
        self.assertEqual(plan_import(store, entries)["new"], 1)
        self.assertFalse(store.records)
        self.assertEqual(apply_import(store, entries, "a", "owner", "h")["created"], 1)
        store.records[entries[0]["id"]]["status"] = "published"
        before = copy.deepcopy(store.records)
        result = apply_import(store, entries, "b", "owner", "h")
        self.assertEqual(
            (result["created"], result["existing"], result["sourcesAdded"]), (0, 1, 0)
        )
        self.assertEqual(store.records, before)

    def test_partial_failure_and_lost_commit_response_replay(self):
        entries, _ = self.csv(
            "NG-12345678,https://facebook.com/post,2026-11\nNG-dX626jFL,https://facebook.com/post,2026-11\n"
        )
        for after_commit in [False, True]:
            store = MemoryStore()
            store.fail = entries[1]["id"]
            store.after_commit = after_commit
            result = apply_import(store, entries, "a", "owner", "h")
            self.assertEqual(len(result["failed"]), 1)
            store.fail = None
            retry = apply_import(store, entries, "a", "owner", "h")
            self.assertFalse(retry["failed"])
            self.assertEqual(len(store.records), 2)
            self.assertEqual(sum(len(s) for s in store.sources.values()), 2)

    def test_case_collision_existing_blocks_import(self):
        entries, _ = self.csv("NG-dx626jFL,https://facebook.com/post,2026-11\n")
        store = MemoryStore()
        old = record()
        store.records[old["id"]] = old
        self.assertEqual(
            len(apply_import(store, entries, "a", "owner", "h")["failed"]), 1
        )
        self.assertEqual(len(store.records), 1)

    def test_review_requires_explicit_evidence_and_optimistic_revision(self):
        decision = dict(
            id=record()["id"],
            code=record()["code"],
            expectedStatus="pending",
            expectedRevision=0,
            status="published",
            note="Reviewed season and source",
        )
        with self.assertRaises(ValueError):
            review_plan(json.dumps([decision]))
        decision.update(sourceReviewed=True, seasonReviewed=True)
        parsed, plan_hash = review_plan(json.dumps([decision]))
        self.assertEqual(parsed, [decision])
        self.assertEqual(len(plan_hash), 64)
        with self.assertRaises(ValueError):
            review_plan(json.dumps([decision, decision]))

    def test_production_and_emulator_gates_before_credentials(self):
        config = dict(projectId="nusuk-codes", updatesEnabled=False)
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ValueError):
                connect("nusuk-codes", True, True, config)
        with patch.dict(
            "os.environ", {"FIRESTORE_EMULATOR_HOST": "remote.example:8080"}, clear=True
        ):
            with self.assertRaises(ValueError):
                connect("demo-nusuk-codes", False, False, config)

    def test_confirmation_and_kill_switch_block_before_network(self):
        args = parser().parse_args(
            [
                "import",
                "--input",
                str(ROOT / "data/current_season_codes.csv"),
                "--observed-at",
                DATE,
                "--apply",
                "--actor",
                "test",
            ]
        )
        with patch("admin.cli.connect") as connect_mock:
            with self.assertRaises(ValueError):
                run(args)
            connect_mock.assert_not_called()
        args = parser().parse_args(["promote", "--input", str(self.folder)])
        with self.assertRaises(ValueError):
            run(args)

    def test_reconciliation_reports_drift_without_mutation(self):
        before = [record()]
        after = copy.deepcopy(before)
        after[0]["status"] = "hidden"
        result = reconcile(before, after)
        self.assertEqual(result["changed"], [before[0]["id"]])
        self.assertEqual(before[0]["status"], "published")

    def test_snapshot_determinism_filter_guards_and_private_field_stripping(self):
        rows = [record(), record("NG-12345678")]
        a = stage(rows, self.folder / "a")
        b = stage(list(reversed(rows)), self.folder / "b")
        self.assertEqual(a, b)
        _, raw, data = read_pair(self.folder / "a")
        self.assertNotIn(b"sourceUrl", raw)
        self.assertEqual(len(data["codes"]), 2)
        for field, value in [
            ("status", "pending"),
            ("sourceReviewed", False),
            ("season", "2026-02"),
            ("redemptionVerified", True),
        ]:
            bad = dict(rows[0], **{field: value})
            with self.assertRaises(ValueError):
                stage([bad], self.folder / ("bad-" + field))
        with self.assertRaises(ValueError):
            stage([], self.folder / "empty")

    def test_promotion_failure_never_replaces_live_manifest_and_rollback(self):
        public = self.folder / "public/data"
        public.mkdir(parents=True)
        a_dir, b_dir = self.folder / "a", self.folder / "b"
        a = stage([record()], a_dir)
        b = stage([record(), record("NG-12345678")], b_dir)
        for path in a_dir.glob("*.json"):
            if path.name != "publication.json":
                (public / path.name).write_bytes(path.read_bytes())
        raw = (b_dir / Path(b["snapshotUrl"]).name).read_bytes()
        confirm = "PUBLISH " + b["snapshotSha256"]
        with self.assertRaises(ValueError):
            replace_manifest(self.folder, b, raw + b" ", a["snapshotSha256"], confirm)
        before = (public / "manifest.json").read_bytes()
        original = atomic_write

        def fail_manifest(path, content):
            if path == public / "manifest.json":
                raise OSError("disk failure")
            return original(path, content)

        with patch("admin.publishing.atomic_write", side_effect=fail_manifest):
            with self.assertRaises(OSError):
                replace_manifest(self.folder, b, raw, a["snapshotSha256"], confirm)
        self.assertEqual((public / "manifest.json").read_bytes(), before)
        result = replace_manifest(self.folder, b, raw, a["snapshotSha256"], confirm)
        backup = json.loads((self.folder / result["backup"]).read_text())
        old_raw = (public / Path(backup["snapshotUrl"]).name).read_bytes()
        replace_manifest(
            self.folder,
            backup,
            old_raw,
            b["snapshotSha256"],
            "ROLLBACK " + a["snapshotSha256"],
            rollback=True,
        )
        self.assertEqual(read_pair(public)[0]["snapshotSha256"], a["snapshotSha256"])
        checked_pair(a, old_raw)

    def test_removals_and_stale_expected_manifest_require_explicit_decision(self):
        folder = self.folder / "public/data"
        folder.mkdir(parents=True)
        stage([record(), record("NG-12345678")], self.folder / "old")
        new = stage([record()], self.folder / "new")
        old, raw, _ = read_pair(self.folder / "old")
        (folder / "manifest.json").write_text(canonical(old))
        (folder / Path(old["snapshotUrl"]).name).write_bytes(raw)
        _, new_raw, _ = read_pair(self.folder / "new")
        with self.assertRaises(ValueError):
            replace_manifest(
                self.folder,
                new,
                new_raw,
                old["snapshotSha256"],
                "PUBLISH " + new["snapshotSha256"],
            )
        with self.assertRaises(ValueError):
            replace_manifest(
                self.folder,
                new,
                new_raw,
                "wrong",
                "PUBLISH " + new["snapshotSha256"],
                allow_removals=True,
            )

    def test_promotion_dry_run_is_nonmutating_even_with_updates_disabled(self):
        public = self.folder / "public/data"
        public.mkdir(parents=True)
        stage([record()], self.folder / "old")
        stage([record(), record("NG-12345678")], self.folder / "new")
        old, raw, _ = read_pair(self.folder / "old")
        (public / "manifest.json").write_text(canonical(old))
        (public / Path(old["snapshotUrl"]).name).write_bytes(raw)
        args = parser().parse_args(
            ["promote", "--input", str(self.folder / "new"), "--dry-run"]
        )
        before = (public / "manifest.json").read_bytes()
        with patch("admin.cli.ROOT", self.folder):
            report, failed = run(args)
        self.assertFalse(failed)
        self.assertEqual(report["added"], ["NG-12345678"])
        self.assertEqual((public / "manifest.json").read_bytes(), before)
        self.assertFalse((self.folder / "snapshots").exists())

    def test_atomic_create_cannot_replace_existing_backup(self):
        target = self.folder / "backup.json"
        atomic_write(target, b"original", exclusive=True)
        with self.assertRaises(FileExistsError):
            atomic_write(target, b"changed", exclusive=True)
        self.assertEqual(target.read_bytes(), b"original")

    def test_malformed_csv_and_ignored_status_never_approve(self):
        import csv

        path = self.folder / "bad-quotes.csv"
        path.write_text('code,source_url\n"NG-dX626jFL,https://facebook.com/post\n')
        with self.assertRaises(csv.Error):
            read_csv(path, SEASON, DATE)
        path.write_text(
            "code,source_url,status\nNG-dX626jFL,https://facebook.com/post,published\n"
        )
        candidates, _ = read_csv(path, SEASON, DATE)
        self.assertNotIn("status", candidates[0])

    def test_empty_snapshot_and_current_preview_integrity(self):
        with self.assertRaises(ValueError):
            stage([], self.folder / "empty-blocked")
        allowed = stage([], self.folder / "empty-allowed", allow_empty=True)
        self.assertEqual(allowed["codeCount"], 0)
        fixture = json.loads(
            (ROOT / "admin/tests/fixtures/preview-manifest.json").read_text()
        )
        raw = (ROOT / "public/data" / Path(fixture["snapshotUrl"]).name).read_bytes()
        data = checked_pair(fixture, raw)
        self.assertEqual(len(data["codes"]), 1132)
        for field, value in [
            ("schemaVersion", True),
            ("codeCount", True),
            ("maintenance", "yes"),
        ]:
            with self.assertRaises(ValueError):
                checked_pair(dict(fixture, **{field: value}), raw)

    def test_zero_limit_and_malformed_config_fail_before_connection(self):
        args = parser().parse_args(
            ["export", "--output", str(self.folder / "export.json"), "--limit", "0"]
        )
        with patch("admin.cli.connect") as connection:
            with self.assertRaises(ValueError):
                run(args)
            connection.assert_not_called()
        config = json.loads((ROOT / "admin/config.json").read_text())
        config["updatesEnabled"] = "false"
        path = self.folder / "config.json"
        path.write_text(json.dumps(config))
        args.config = path
        with self.assertRaises(ValueError):
            run(args)

    def test_promotion_requires_matching_review_inventory(self):
        from admin.publishing import validate_inventory

        output = self.folder / "reviewed"
        manifest = stage([record()], output)
        _, _, data = read_pair(output)
        validate_inventory(output, manifest, data)
        inventory = json.loads((output / "publication.json").read_text())
        inventory["records"][0]["revision"] = 0
        (output / "publication.json").write_text(canonical(inventory))
        with self.assertRaises(ValueError):
            validate_inventory(output, manifest, data)
        (output / "publication.json").unlink()
        with self.assertRaises(FileNotFoundError):
            validate_inventory(output, manifest, data)
