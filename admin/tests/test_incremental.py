import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from admin.incremental import execute_update, plan_update, save
from admin.model import SEASON, code_id, read_csv
from admin.publishing import read_pair, replace_manifest, stage
from admin.tests.test_pipeline import DATE, record
from admin.update import check_headroom, parser, quota_attestation, run


class QuickMemoryStore:
    """Atomic fake with injectable failures before AND after a successful commit."""

    def __init__(self, records):
        self.records = {r["id"]: copy.deepcopy(r) for r in records}
        self.sources, self.audits = {}, {}
        self.batches = 0
        self.fail_batch = None
        self.lost_response = False
        self.fail_read = None
        self.snapshot_queries = 0
        self.costs = []

    def get_many(self, identities):
        if self.fail_read == "lookup":
            raise ConnectionError("offline")
        return {i: copy.deepcopy(self.records.get(i)) for i in identities}

    def conflicts(self, candidates):
        if self.fail_read == "conflicts":
            raise TimeoutError("deadline")
        values = {r["code"] for r in candidates}
        lower = {v.lower() for v in values}
        matches = [r for r in self.records.values() if r["code"].lower() in lower]
        # Exact and normalized queries, two empty minimums for all-new small inputs.
        reads = max(1, len([r for r in matches if r["code"] in values])) + max(
            1, len(matches)
        )
        if not matches:
            reads = 2 * ((len(values) + 29) // 30)
        return copy.deepcopy(matches), reads

    def count(self, season, published=False):
        if self.fail_read == "quota":
            raise RuntimeError("resource exhausted")
        return sum(
            r["season"] == season and (not published or r["status"] == "published")
            for r in self.records.values()
        )

    def published(self, season, limit):
        self.snapshot_queries += 1
        if self.fail_read == "snapshot":
            raise ConnectionError("offline")
        rows = [
            r
            for r in self.records.values()
            if r["season"] == season and r["status"] == "published"
        ]
        if len(rows) > limit:
            raise ValueError("cap exceeded")
        return copy.deepcopy(rows)

    def create_batch(self, items, batch_id, actor, input_hash):
        self.batches += 1
        if self.fail_batch == self.batches and not self.lost_response:
            raise ConnectionError("quota/network")
        if any(r["id"] in self.records for r, _ in items):
            raise ValueError("exists=false precondition failed")
        self.costs.append(sum(2 + len(s) for _, s in items))
        for row, sources in items:
            self.records[row["id"]] = copy.deepcopy(row)
            self.sources[row["id"]] = copy.deepcopy(sources)
            self.audits[row["id"]] = [dict(revision=1, status="published")]
        if self.fail_batch == self.batches and self.lost_response:
            raise TimeoutError("commit accepted, reply lost")


class IncrementalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = record("NG-BASE0001")
        self.store = QuickMemoryStore([self.base])
        self.manifest = stage([self.base], self.root / "public/data")
        self.original_manifest = (self.root / "public/data/manifest.json").read_bytes()
        self.counter = 0

    def csv(self, codes, extra=""):
        path = self.root / "input.csv"
        path.write_text(
            "code,source_url,season\n"
            + "".join(
                f"{code},https://facebook.com/post/quick,2026-11\n" for code in codes
            )
            + extra
        )
        return path

    def plan(self, path):
        candidates, report = read_csv(path, SEASON, DATE)
        current, _, _ = read_pair(self.root / "public/data")
        plan, old = plan_update(self.store, candidates, report, current, DATE, 5000)
        return candidates, plan, old

    def apply(self, prepared):
        self.counter += 1
        out = self.root / f"run-{self.counter}"
        out.mkdir()
        candidates, plan, old = prepared
        result = execute_update(
            self.store, candidates, plan, old, self.root, out, "owner", DATE
        )
        return result, out

    def test_mixed_existing_and_new_then_identical_replay_zero_writes(self):
        path = self.csv([self.base["code"], "NG-NEW00001", "NG-NEW00001"])
        prepared = self.plan(path)
        self.assertEqual(
            (prepared[1]["new"], prepared[1]["existing"], prepared[1]["duplicates"]),
            (1, 1, 1),
        )
        result, output = self.apply(prepared)
        self.assertEqual(result["codeCount"], 2)
        self.assertTrue((output / "checkpoint.json").exists())
        self.assertEqual(self.store.records[self.base["id"]], self.base)
        first = copy.deepcopy(
            (self.store.records, self.store.sources, self.store.audits)
        )
        batches = self.store.batches
        snapshot_queries = self.store.snapshot_queries
        retry = self.plan(path)
        self.assertEqual(
            (retry[1]["new"], retry[1]["estimatedOperations"]["writes"]), (0, 0)
        )
        self.apply(retry)
        self.assertEqual(batches, self.store.batches)
        self.assertEqual(snapshot_queries, self.store.snapshot_queries)
        self.assertEqual(
            first, (self.store.records, self.store.sources, self.store.audits)
        )
        new = self.store.records[code_id(SEASON, "NG-NEW00001")]
        self.assertFalse(new["redemptionVerified"])
        self.assertFalse(new["sourceReviewed"])
        self.assertEqual(new["status"], "published")
        self.assertEqual(new["reviewPlanId"], prepared[1]["planId"])

    def test_hidden_invalid_and_pending_records_untouched(self):
        codes = ["NG-HIDE0001", "NG-BAD00001", "NG-WAIT0001"]
        for code, status in zip(codes, ["hidden", "invalid", "pending"]):
            row = record(code)
            row["status"] = status
            self.store.records[row["id"]] = row
            self.store.sources[row["id"]] = [dict(original=True)]
        before = copy.deepcopy((self.store.records, self.store.sources))
        prepared = self.plan(self.csv(codes + ["NG-NEW00001"]))
        result, _ = self.apply(prepared)
        self.assertEqual(result["codeCount"], 2)
        for identity, old in before[0].items():
            self.assertEqual(self.store.records[identity], old)
        for identity, old in before[1].items():
            self.assertEqual(self.store.sources[identity], old)

    def test_case_sensitive_identity_with_explicit_variant_block(self):
        upper, lower = "NG-NEW00001", "NG-new00001"
        self.assertNotEqual(code_id(SEASON, upper), code_id(SEASON, lower))
        prepared = self.plan(self.csv([upper, lower]))
        self.assertTrue(prepared[1]["blocked"])
        self.assertEqual(prepared[1]["caseVariants"], 1)
        with self.assertRaises(ValueError):
            self.apply(prepared)
        self.assertEqual(self.store.batches, 0)
        self.apply(self.plan(self.csv([upper])))
        prepared = self.plan(self.csv([lower]))
        self.assertTrue(prepared[1]["blocked"])
        self.assertEqual(self.store.records[code_id(SEASON, upper)]["code"], upper)

    def test_invalid_source_malformed_rows_and_cross_season_conflicts(self):
        path = self.csv(
            ["bad"],
            "NG-NEW00001,https://evil.example/post,2026-11\nNG-NEW00002,https://facebook.com/post,2026-02\nNG-NEW00003\n",
        )
        prepared = self.plan(path)
        self.assertEqual(prepared[1]["invalid"], 3)
        self.assertEqual(prepared[1]["crossSeasonConflicts"], 1)
        foreign = record("NG-NEW00004")
        foreign.update(season="2026-02", id=code_id("2026-02", foreign["code"]))
        self.store.records[foreign["id"]] = foreign
        prepared = self.plan(self.csv([foreign["code"]]))
        self.assertEqual(prepared[1]["crossSeasonConflicts"], 1)
        self.assertTrue(prepared[1]["blocked"])
        self.assertEqual(self.store.batches, 0)

    def test_bounded_partial_batch_failure_and_lost_reply_safe_retries(self):
        path = self.csv([f"NG-Q{i:07d}" for i in range(90)])
        for lost in [False, True]:
            with self.subTest(lost=lost):
                self.store = QuickMemoryStore([self.base])
                self.store.fail_batch, self.store.lost_response = 2, lost
                with self.assertRaises((ConnectionError, TimeoutError)):
                    self.apply(self.plan(path))
                result_path = self.root / f"run-{self.counter}/result.json"
                stopped = json.loads(result_path.read_text())
                self.assertEqual(stopped["confirmedCreated"], 83)
                self.assertEqual(len(stopped["uncertainBatchIds"]), 7)
                self.assertEqual(
                    (self.root / "public/data/manifest.json").read_bytes(),
                    self.original_manifest,
                )
                self.store.fail_batch = None
                result, _ = self.apply(self.plan(path))
                self.assertEqual(result["codeCount"], 91)
                self.assertEqual(len(self.store.audits), 90)
                self.assertTrue(all(cost <= 250 for cost in self.store.costs))
                self.assertEqual(sum(len(v) for v in self.store.audits.values()), 90)
                # Restore only the LOCAL test fixture for the second fault scenario.
                (self.root / "public/data/manifest.json").write_bytes(
                    self.original_manifest
                )

    def test_snapshot_failure_does_not_switch_manifest_and_retry_recovers(self):
        path = self.csv(["NG-NEW00001"])
        self.store.fail_read = "snapshot"
        with self.assertRaises(ConnectionError):
            self.apply(self.plan(path))
        self.assertEqual(
            (self.root / "public/data/manifest.json").read_bytes(),
            self.original_manifest,
        )
        self.assertEqual(len(self.store.records), 2)
        self.store.fail_read = None
        result, _ = self.apply(self.plan(path))
        self.assertEqual(result["confirmedCreated"], 0)
        self.assertEqual(result["codeCount"], 2)

    def test_manifest_write_failure_and_confirmed_offline_rollback(self):
        path = self.csv(["NG-NEW00001"])
        from admin.publishing import atomic_write

        def disk_failure(target, raw, **kwargs):
            if target == self.root / "public/data/manifest.json":
                raise OSError("disk full")
            return atomic_write(target, raw, **kwargs)

        with patch("admin.publishing.atomic_write", side_effect=disk_failure):
            with self.assertRaises(OSError):
                self.apply(self.plan(path))
        self.assertEqual(
            (self.root / "public/data/manifest.json").read_bytes(),
            self.original_manifest,
        )
        result, _ = self.apply(self.plan(path))
        old_manifest = self.manifest
        old_raw = (
            self.root / "public/data" / Path(old_manifest["snapshotUrl"]).name
        ).read_bytes()
        replace_manifest(
            self.root,
            old_manifest,
            old_raw,
            result["snapshotSha256"],
            f"ROLLBACK {old_manifest['snapshotSha256']}",
            rollback=True,
        )
        self.assertEqual(read_pair(self.root / "public/data")[0], self.manifest)

    def test_accidental_cdn_removal_is_blocked(self):
        self.store.records[self.base["id"]]["status"] = "hidden"
        prepared = self.plan(self.csv(["NG-NEW00001"]))
        with self.assertRaisesRegex(ValueError, "cannot remove/change"):
            self.apply(prepared)
        self.assertEqual(
            (self.root / "public/data/manifest.json").read_bytes(),
            self.original_manifest,
        )

    def test_network_or_quota_failure_before_import_writes_nothing(self):
        path = self.csv(["NG-NEW00001"])
        for failure in ["lookup", "conflicts", "quota"]:
            self.store.fail_read = failure
            with self.assertRaises((ConnectionError, TimeoutError, RuntimeError)):
                self.plan(path)
            self.assertEqual(self.store.batches, 0)

    def test_cli_one_confirmation_checkpoint_and_persistent_observation(self):
        (self.root / "admin").mkdir()
        save(
            self.root / "admin/config.json",
            dict(
                projectId="nusuk-codes",
                season=SEASON,
                quickImportEnabled=True,
                updatesEnabled=False,
                maxExportRecords=5000,
            ),
        )
        original_config = (self.root / "admin/config.json").read_bytes()
        path = self.csv(["NG-NEW00001"])
        args = parser().parse_args(
            ["--file", str(path), "--dry-run", "--observed-at", DATE]
        )
        with (
            patch("admin.update.IncrementalStore", return_value=self.store),
            redirect_stdout(io.StringIO()),
        ):
            self.assertEqual(run(args, self.root, factory=lambda *a: None), 0)
            plans = list(
                (self.root / ".admin-work/quick-import").glob("*/attempt-*/plan.json")
            )
            token = json.loads(plans[0].read_text())["confirmation"]
            args.apply, args.dry_run, args.actor, args.prepare_only = (
                True,
                False,
                "owner",
                True,
            )
            args.confirm = "wrong"
            with self.assertRaises(ValueError):
                run(args, self.root, factory=lambda *a: None)
            self.assertEqual(self.store.batches, 0)
            args.confirm = None
            prompts = []
            self.assertEqual(
                run(
                    args,
                    self.root,
                    factory=lambda *a: None,
                    input_fn=lambda prompt: prompts.append(prompt) or token,
                ),
                0,
            )
            self.assertEqual(len(prompts), 1)
        self.assertEqual(
            (self.root / "admin/config.json").read_bytes(), original_config
        )

    def test_quota_attestation_expiry_billing_and_margin(self):
        at = datetime.now(timezone.utc)
        q = dict(
            project="nusuk-codes",
            billingEnabled=False,
            checkedAt=at.isoformat(),
            readsRemaining=50000,
            writesRemaining=20000,
        )
        path = self.root / "quota.json"
        save(path, q)
        self.assertEqual(quota_attestation(path, at), q)
        plan = self.plan(self.csv(["NG-NEW00001"]))[1]
        check_headroom(plan, q)
        with self.assertRaises(ValueError):
            check_headroom(plan, dict(q, writesRemaining=0))
        for changes in [
            dict(billingEnabled=True),
            dict(checkedAt=(at - timedelta(hours=2)).isoformat()),
        ]:
            save(path, dict(q, **changes))
            with self.assertRaises(ValueError):
                quota_attestation(path, at)

    def test_checkpoint_drift_and_unexpected_total_block_snapshot(self):
        prepared = self.plan(self.csv([self.base["code"], "NG-NEW00001"]))
        self.store.records[self.base["id"]]["revision"] += 1
        with self.assertRaisesRegex(ValueError, "Touched records"):
            self.apply(prepared)
        self.assertEqual(self.store.snapshot_queries, 0)

    def test_concurrent_unrelated_insert_blocks_on_total_drift(self):
        prepared = self.plan(self.csv(["NG-NEW00001"]))
        extra = record("NG-EXTRA001")
        extra["status"] = "pending"
        self.store.records[extra["id"]] = extra
        with self.assertRaisesRegex(ValueError, "Unexpected final document count"):
            self.apply(prepared)
        self.assertEqual(self.store.snapshot_queries, 0)
        self.assertEqual(
            (self.root / "public/data/manifest.json").read_bytes(),
            self.original_manifest,
        )

    def test_duplicate_rows_with_distinct_evidence_are_kept_in_atomic_create(self):
        path = self.csv(
            ["NG-NEW00001"], "NG-NEW00001,https://facebook.com/post/another,2026-11\n"
        )
        prepared = self.plan(path)
        self.assertEqual(prepared[1]["estimatedOperations"]["writes"], 4)
        self.apply(prepared)
        identity = code_id(SEASON, "NG-NEW00001")
        self.assertEqual(len(self.store.sources[identity]), 2)
        self.assertEqual(len(self.store.audits[identity]), 1)

    def test_operation_estimates_for_500_and_2000_new_codes(self):
        self.store = QuickMemoryStore([record(f"NG-B{i:07d}") for i in range(1540)])
        for incoming, reads, writes in [(500, 3081, 1500), (2000, 7682, 6000)]:
            prepared = self.plan(self.csv([f"NG-Q{i:07d}" for i in range(incoming)]))
            self.assertEqual(prepared[1]["estimatedOperations"]["reads"], reads)
            self.assertEqual(prepared[1]["estimatedOperations"]["writes"], writes)

    def test_pr_handoff_stages_only_public_pair_and_archive_never_merges(self):
        from admin.release import create_pr, check_release_base

        result, output = self.apply(self.plan(self.csv(["NG-NEW00001"])))
        plan = json.loads((output / "checkpoint.json").read_text())
        plan.update(season=SEASON, new=1, existing=0)
        calls = []

        def fake_git(root, *args):
            calls.append(args)
            if args == ("branch", "--show-current"):
                return "main"
            if args == ("rev-parse", "HEAD"):
                return "base"
            if args == ("diff", "--name-only"):
                return "public/data/manifest.json"
            return ""

        with (
            patch("admin.release.git", side_effect=fake_git),
            patch(
                "admin.release.subprocess.run",
                return_value=SimpleNamespace(
                    stdout="https://github.com/example/repo/pull/1\n"
                ),
            ) as cli,
        ):
            url = create_pr(self.root, plan, result, output, "base")
            self.assertIn("/pull/1", url)
            staged = next(args for args in calls if args[0] == "add")
            self.assertNotIn("-A", staged)
            self.assertTrue(
                all(
                    path.startswith(("public/data/", "snapshots/history/"))
                    for path in staged[2:]
                )
            )
            self.assertNotIn("merge", cli.call_args.args[0])
            self.assertNotIn("--force", [a for call in calls for a in call])
        with patch("admin.release.git", return_value=" M unrelated.txt"):
            with self.assertRaisesRegex(ValueError, "clean main"):
                check_release_base(self.root)
        with patch(
            "admin.release.git",
            side_effect=lambda root, *args: {
                ("branch", "--show-current"): "main",
                ("rev-parse", "HEAD"): "base",
                ("diff", "--cached", "--name-only"): ".env.local",
            }[args],
        ):
            with self.assertRaisesRegex(ValueError, "base/index changed"):
                create_pr(self.root, plan, result, output, "base")

    def test_disabled_and_emergency_gates_stop_before_connect(self):
        (self.root / "admin").mkdir()
        path = self.csv(["NG-NEW00001"])
        args = parser().parse_args(["--file", str(path), "--apply", "--actor", "test"])
        for enabled, stop in [(False, ""), (True, "1")]:
            save(
                self.root / "admin/config.json",
                dict(
                    projectId="nusuk-codes",
                    season=SEASON,
                    quickImportEnabled=enabled,
                    updatesEnabled=False,
                    maxExportRecords=5000,
                ),
            )
            factory = Mock()
            with patch.dict(
                "os.environ",
                {
                    "NUSUK_ENABLE_PRODUCTION": "",
                    "NUSUK_ENABLE_QUICK_IMPORT": "",
                    "NUSUK_DISABLE_ADMIN_UPDATES": stop,
                },
            ):
                with self.assertRaisesRegex(ValueError, "disabled"):
                    run(args, self.root, factory=factory)
            factory.assert_not_called()

    def test_periodic_export_read_budget_is_explicit_bounded_and_fail_closed(self):
        from admin.cli import parser as legacy_parser, run as legacy_run

        store = SimpleNamespace(
            list=lambda *a, **kw: [copy.deepcopy(self.base)],
            export_sources=lambda *a, **kw: [],
            export_audit=lambda *a, **kw: [],
        )
        target = self.root / "backup.json"
        args = legacy_parser().parse_args(
            ["export", "--with-evidence", "--output", str(target), "--read-budget", "2"]
        )
        with patch("admin.cli.connect", return_value=store):
            with self.assertRaises(ValueError):
                legacy_run(args)
            self.assertFalse(target.exists())
            args.read_budget = 20000
            result, failed = legacy_run(args)
            self.assertFalse(failed)
            self.assertEqual(result["exported"], 1)
        args.read_budget = 20001
        with self.assertRaises(ValueError):
            legacy_run(args)


if __name__ == "__main__":
    unittest.main()
