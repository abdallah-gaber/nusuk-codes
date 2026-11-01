"""Real Admin SDK and public REST rules tests. Refuses every non-demo/non-loopback target."""

import base64
import json
import os
import tempfile
import unittest
import io
from contextlib import redirect_stdout
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from admin.cli import apply_import, parser, plan_import, reconcile, review_plan, run
from admin.model import SEASON, code_id, read_csv
from admin.publishing import read_pair, stage
from admin.store import connect
from admin.incremental import new_record
from admin.incremental_store import IncrementalStore
from admin.update import parser as update_parser, run as update_run

HOST = os.environ.get("FIRESTORE_EMULATOR_HOST", "")
PROJECT = "demo-nusuk-codes"
ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(HOST, "Firestore emulator not running; use npm run test:emulator")
class EmulatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = connect(
            PROJECT, False, True, dict(updatesEnabled=False, projectId="nusuk-codes")
        )

    def test_quick_import_batch_rpc_snapshot_and_idempotent_replay(self):
        adapter = IncrementalStore(self.store)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "admin").mkdir()
            (root / "admin/config.json").write_text(
                json.dumps(
                    dict(
                        projectId="nusuk-codes",
                        season=SEASON,
                        updatesEnabled=False,
                        quickImportEnabled=True,
                        maxExportRecords=5000,
                    )
                )
            )
            original = (root / "admin/config.json").read_bytes()
            baseline = adapter.published(SEASON, 5000)
            if not baseline:
                source_evidence = dict(
                    sourceUrl="https://facebook.com/post/quick-base",
                    discoveredAt="2026-11-01T00:00:00Z",
                    sourcePublishedAt=None,
                )
                base_candidate = dict(
                    id=code_id(SEASON, "NG-QIKBASE1"),
                    code="NG-QIKBASE1",
                    season=SEASON,
                    sources=[source_evidence],
                )
                base = new_record(
                    base_candidate, "emulator-base", "test", "2026-11-01T00:00:00Z"
                )
                adapter.create_batch(
                    [(base, base_candidate["sources"])],
                    "emulator-base",
                    "test",
                    "emulator-base",
                )
                baseline = adapter.published(SEASON, 5000)
            stage(baseline, root / "public/data")
            source = root / "incoming.csv"
            source.write_text(
                "code,source_url,season\n"
                + "".join(
                    f"NG-QIK{i:05d},https://facebook.com/post/quick,2026-11\n"
                    for i in range(1, 106)
                )
            )
            args = update_parser().parse_args(
                [
                    "--file",
                    str(source),
                    "--dry-run",
                    "--observed-at",
                    "2026-11-01T00:00:00Z",
                    "--project",
                    PROJECT,
                    "--prepare-only",
                    "--actor",
                    "emulator-owner",
                ]
            )

            def latest_plan():
                files = sorted(
                    (root / ".admin-work/quick-import").glob("*/attempt-*/plan.json")
                )
                return json.loads(files[-1].read_text())

            with redirect_stdout(io.StringIO()):
                self.assertEqual(
                    update_run(args, root, factory=lambda *a: self.store), 0
                )
                first = latest_plan()
                self.assertEqual(first["new"], 105)
                args.apply, args.dry_run, args.confirm = (
                    True,
                    False,
                    first["confirmation"],
                )
                self.assertEqual(
                    update_run(args, root, factory=lambda *a: self.store), 0
                )
                args.apply, args.dry_run = False, True
                self.assertEqual(
                    update_run(args, root, factory=lambda *a: self.store), 0
                )
                replay = latest_plan()
                self.assertEqual(replay["estimatedOperations"]["writes"], 0)
                args.apply, args.dry_run, args.confirm = (
                    True,
                    False,
                    replay["confirmation"],
                )
                self.assertEqual(
                    update_run(args, root, factory=lambda *a: self.store), 0
                )
            manifest, _, data = read_pair(root / "public/data")
            self.assertEqual(manifest["codeCount"], first["expectedPublishedCount"])
            self.assertEqual(
                len({r["code"] for r in data["codes"]}), len(data["codes"])
            )
            self.assertEqual((root / "admin/config.json").read_bytes(), original)
            for code in ["NG-QIK00001", "NG-QIK00002"]:
                identity = code_id(SEASON, code)
                row = self.store.get(identity)
                self.assertEqual(row["status"], "published")
                self.assertFalse(row["redemptionVerified"])
                self.assertEqual(len(self.store.export_sources(identity)), 1)
                self.assertEqual(len(self.store.export_audit(identity)), 1)
            # A create precondition conflict must abort the ENTIRE write batch.
            candidates, report = read_csv(source, SEASON, "2026-11-01T00:00:00Z")
            fresh = dict(
                candidates[0], code="NG-QIK99999", id=code_id(SEASON, "NG-QIK99999")
            )
            items = [
                (
                    new_record(
                        c, report["inputSha256"], "test", "2026-11-01T00:00:00Z"
                    ),
                    c["sources"],
                )
                for c in [fresh, candidates[0]]
            ]
            with self.assertRaises(Exception):
                adapter.create_batch(
                    items, report["inputSha256"], "test", report["inputSha256"]
                )
            self.assertIsNone(self.store.get(fresh["id"]))
            self.assertEqual(self.store.export_sources(fresh["id"]), [])

    def test_cli_dry_run_apply_export_reconcile_and_review(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "import.csv"
            source.write_text(
                "code,source_url\nNG-CLI00001,https://facebook.com/post/cli-test\n"
            )
            args = parser().parse_args(
                [
                    "import",
                    "--input",
                    str(source),
                    "--observed-at",
                    "2026-11-02T00:00:00Z",
                    "--dry-run",
                ]
            )
            dry, failed = run(args)
            self.assertFalse(failed)
            self.assertEqual(dry["new"], 1)
            identity = code_id(SEASON, "NG-CLI00001")
            self.assertIsNone(self.store.get(identity))
            args.apply, args.dry_run, args.actor, args.confirm = (
                True,
                False,
                "test",
                dry["confirmation"],
            )
            applied, failed = run(args)
            self.assertFalse(failed)
            self.assertEqual(applied["result"]["created"], 1)
            self.assertEqual(run(args)[0]["result"]["created"], 0)
            exported = root / "export.json"
            result, failed = run(
                parser().parse_args(
                    ["export", "--output", str(exported), "--with-evidence"]
                )
            )
            self.assertFalse(failed)
            self.assertEqual(result["exported"], 1)
            self.assertFalse(
                run(parser().parse_args(["reconcile", "--input", str(exported)]))[1]
            )
            decision = dict(
                id=identity,
                code="NG-CLI00001",
                expectedStatus="pending",
                expectedRevision=0,
                status="hidden",
                note="CLI emulator workflow test",
            )
            plan = root / "review.json"
            plan.write_text(json.dumps([decision]))
            review = parser().parse_args(["review", "--input", str(plan), "--dry-run"])
            report, failed = run(review)
            self.assertFalse(failed)
            self.assertEqual(report["results"][0]["result"], "ready")
            review.apply, review.dry_run, review.actor, review.confirm = (
                True,
                False,
                "test",
                report["confirmation"],
            )
            self.assertFalse(run(review)[1])
            self.assertEqual(self.store.get(identity)["status"], "hidden")

    def test_end_to_end_transactions_review_and_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "codes.csv"
            path.write_text(
                "code,source_url,season\nNG-TEST0001,https://facebook.com/post/test,2026-11\nNG-TEST0002,https://facebook.com/post/test,2026-11\n"
            )
            entries, _ = read_csv(path, SEASON, "2026-11-02T00:00:00Z")
            self.assertEqual(plan_import(self.store, entries)["new"], 2)
            result = apply_import(
                self.store, entries, "emulator-test", "test-operator", "test-sha"
            )
            self.assertFalse(result["failed"])
            self.assertEqual(result["created"], 2)
            first = self.store.get(entries[0]["id"])
            self.assertEqual(first["status"], "pending")
            self.assertIs(first["redemptionVerified"], False)
            decision = dict(
                id=first["id"],
                code=first["code"],
                expectedStatus="pending",
                expectedRevision=0,
                status="published",
                sourceReviewed=True,
                seasonReviewed=True,
                note="Emulator fixture review only",
            )
            decisions, plan_hash = review_plan(json.dumps([decision]))
            self.assertEqual(
                self.store.review_one(decisions[0], plan_hash, "test"), "updated"
            )
            self.assertEqual(
                self.store.review_one(decisions[0], plan_hash, "test"), "alreadyApplied"
            )
            with self.assertRaises(ValueError):
                self.store.review_one(
                    dict(decision, status="hidden"), "another-plan", "test"
                )
            published = self.store.get(first["id"])
            # Same import cannot overwrite publication or provenance.
            repeated = apply_import(
                self.store, entries, "another-batch", "test", "another-sha"
            )
            self.assertEqual((repeated["created"], repeated["sourcesAdded"]), (0, 0))
            self.assertEqual(self.store.get(first["id"]), published)
            # Add another sighting; first evidence and review remain unchanged.
            entries[0]["sources"].append(
                dict(
                    sourceUrl="https://facebook.com/post/other",
                    discoveredAt="2026-11-03T00:00:00Z",
                    sourcePublishedAt=None,
                )
            )
            self.assertEqual(
                apply_import(
                    self.store, entries[:1], "new-sighting", "test", "new-sha"
                )["sourcesAdded"],
                1,
            )
            self.assertEqual(len(self.store.export_sources(first["id"])), 2)
            self.assertEqual(self.store.get(first["id"]), published)
            self.assertEqual(len(self.store.export_audit(first["id"])), 1)
            records = self.store.list(SEASON, 100, published=True)
            self.assertIn(first["id"], [r["id"] for r in records])
            self.assertNotIn(entries[1]["id"], [r["id"] for r in records])
            stage(records, Path(folder) / "stage")
            manifest, _, data = read_pair(Path(folder) / "stage")
            self.assertEqual(manifest["codeCount"], 1)
            self.assertEqual(data["codes"][0]["observedAt"], "2026-11-02")
            export = self.store.list(SEASON, 100)
            self.assertFalse(
                any(reconcile(export, self.store.list(SEASON, 100)).values())
            )

    def test_legacy_id_duplicate_is_blocked_without_overwriting(self):
        self.store.client.collection("codes").document("legacy-id").set(
            dict(code="NG-LEGACY01", season=SEASON)
        )
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "legacy.csv"
            path.write_text(
                "code,source_url\nNG-LEGACY01,https://facebook.com/post/legacy\n"
            )
            entries, _ = read_csv(path, SEASON, "2026-11-01T00:00:00Z")
            result = apply_import(
                self.store, entries, "legacy-test", "test", "test-sha"
            )
            self.assertEqual(len(result["failed"]), 1)
            self.assertIsNone(self.store.get(entries[0]["id"]))

    def test_migrate_and_replay_all_1132_candidates_in_bounded_chunks(self):
        entries, report = read_csv(
            ROOT / "data/current_season_codes.csv", SEASON, "2026-11-01T00:00:00Z"
        )
        self.assertEqual(report["unique"], 1132)
        for replay in [False, True]:
            created = 0
            for offset in range(0, len(entries), 250):
                result = apply_import(
                    self.store,
                    entries[offset : offset + 250],
                    "migration-test",
                    "test",
                    report["inputSha256"],
                )
                self.assertFalse(result["failed"])
                created += result["created"]
            self.assertEqual(created, 0 if replay else 1132)
        for entry in [entries[0], entries[-1]]:
            stored = self.store.get(entry["id"])
            self.assertEqual(stored["status"], "pending")
            self.assertEqual(stored["verification"], "community_submitted_unverified")
            self.assertIs(stored["redemptionVerified"], False)

    def test_policy_display_approval_keeps_redemption_unverified(self):
        from admin.model import COMMUNITY_POLICY

        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "policy.csv"
            path.write_text(
                "code,source_url\nNG-POLICY01,https://facebook.com/post/policy-test\n"
            )
            entries, _ = read_csv(path, SEASON, "2026-11-01T00:00:00Z")
            self.assertFalse(
                apply_import(self.store, entries, "policy-test", "test", "fixture")[
                    "failed"
                ]
            )
            row = self.store.get(entries[0]["id"])
            decision = dict(
                id=row["id"],
                code=row["code"],
                expectedStatus="pending",
                expectedRevision=0,
                status="published",
                publicationPolicy=COMMUNITY_POLICY,
                syntaxChecked=True,
                seasonAttributed=True,
                sourceReviewed=False,
                seasonReviewed=False,
                note="Owner community-display policy; redemption is unverified",
            )
            _, plan_id = review_plan(json.dumps([decision]))
            self.assertEqual(
                self.store.review_one(decision, plan_id, "test"), "updated"
            )
            self.assertEqual(
                self.store.review_one(decision, plan_id, "test"), "alreadyApplied"
            )
            published = self.store.get(row["id"])
            self.assertIs(published["redemptionVerified"], False)
            self.assertIs(published["sourceReviewed"], False)
            self.assertIs(published["seasonReviewed"], False)
            self.assertEqual(published["publicationPolicy"], COMMUNITY_POLICY)
            stage([published], Path(folder) / "stage")
            self.assertEqual(len(self.store.export_audit(row["id"])), 1)

    def test_rules_deny_anonymous_and_authenticated_public_access(self):
        # Emulator accepts unsigned test tokens; they are never production credentials.
        def encode(value):
            return (
                base64.urlsafe_b64encode(json.dumps(value).encode())
                .decode()
                .rstrip("=")
            )

        token = (
            encode(dict(alg="none", typ="JWT"))
            + "."
            + encode(
                dict(
                    sub="test-client",
                    user_id="test-client",
                    aud=PROJECT,
                    iss=f"https://securetoken.google.com/{PROJECT}",
                    iat=1,
                    exp=4102444800,
                    firebase=dict(sign_in_provider="custom"),
                )
            )
            + "."
        )
        base = f"http://{HOST}/v1/projects/{PROJECT}/databases/(default)/documents/"
        paths = [
            "codes",
            "codes/" + code_id(SEASON, "NG-TEST0001"),
            "submissions/test",
            "config/public",
            "other/doc",
            "codes/example/sources/source",
            "codes/example/audit/change",
        ]
        for auth in [None, "Bearer " + token]:
            for path in paths:
                for method in ["GET", "PATCH", "DELETE"]:
                    headers = {"Content-Type": "application/json"}
                    if auth:
                        headers["Authorization"] = auth
                    data = b'{"fields":{}}' if method == "PATCH" else None
                    with self.assertRaises(HTTPError) as denied:
                        urlopen(
                            Request(
                                base + path, headers=headers, data=data, method=method
                            ),
                            timeout=5,
                        )
                    self.assertIn(denied.exception.code, [400, 403])
                    # Collection paths PATCH/DELETE are invalid API routes; document paths must fail permission checks.
                    if path != "codes":
                        self.assertEqual(denied.exception.code, 403)


if __name__ == "__main__":
    unittest.main()
