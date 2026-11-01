# Phase 2A validation — 2026-11-01

Implemented locally, production not activated. `admin/config.json` remains `updatesEnabled: false`. No credentials were created, read, committed or used for production. No Firebase rule/index deploy, production import/review, CDN promotion or hosting deployment ran.

## Results

- ESLint: pass.
- Administrative Python Ruff lint: pass (`admin/` and `scripts/`).
- TypeScript typecheck: pass.
- Vitest: **12 passed**, including original history/CDN regressions, live manifest-driven count validation and actual Python-generated snapshot compatibility with future observation dates.
- Pure Python pipeline suite: **20 passed**.
- Actual Firebase Firestore Emulator / Java 21: **5 passed**, demo project only. Includes real CLI dry-run/apply/export/reconcile/review, transaction and review conflict checks, published-only snapshot filtering, legacy-ID duplicate blocking, full migration/replay of all **1,132** candidates in <=250-code chunks, and anonymous/authenticated public REST denials (documents, collections, nested sources/audit, config, submissions and unknown paths).
- Production Vite build: pass; 30 modules. No admin SDK, Google credential markers or emulator environment markers found in `dist/`.
- `git diff --check`: pass.

See [check output](phase2a-checks.log) and [emulator output](phase2a-emulator.log). The emulator installation and run used a temporary npm/JAR cache, not production credentials. No emulator state is committed.

## Safety cases covered

Exact-case IDs and case-only variant investigation; within-file and existing duplicates; distinct provenance preservation; ignored CSV approval claims; malformed CSV, wrong seasons and unsafe hosts; non-mutating dry-runs; explicit confirmation / kill switch / wrong target / config guards; repeated imports; failure before commit and lost commit responses; successful earlier chunks retained; separate source and review audit records; optimistic review conflicts; deterministic sorted snapshots; wrong status/review/season/redemption flags blocked; private fields stripped; empty/oversized/truncated data guarded; missing/mismatched review inventory blocked; removal confirmation; stale-current-SHA failure; disk failure before manifest switch; previous manifest/asset retention; rollback; exclusive backup/report creation.

The 1,132-record preview manifest, its hash asset, canonical CSV, original case and all existing verification labels remain unchanged. Regenerating the legacy fixture to a new ignored staging directory produces the same original SHA-256 `e7812d4f1cc7887736f58e74402ffb9b6b18fa2813c05880f9ecd4dc9fdac4b1` and passes integrity verification. No public snapshot asset was replaced. The frontend history namespace/behavior is unchanged; only date compatibility and source transparency copy were adjusted for future imports.

## Activation limits / owner work

Production IAM/credentials, Spark/Standard/default-database state and deployed rules have not been verified remotely. Owner must follow `docs/PHASE2A_ADMIN.md` in order: verify plan/database, deploy deny-all rules, configure least-privilege credentials outside checkout, export/reconcile first, deliberately enable updates, dry-run/confirm migration, review, stage/verify, review additions/removals and explicitly promote through a publishing PR. The CI workflow is checked in but has not run on GitHub; it requires Actions to be available and has no secrets/write permissions/schedule.

Operation estimates assume one source per code, canonical existing data and no retries: dry-run ~3U reads; apply ~4U reads / 2U writes; repeat ~4U reads / zero writes. Initial 1,132 migration with dry-runs: ~7,924 reads / 2,264 writes. These are estimates, not quota reservations. Emulator behavior cannot prove production IAM, query/index or quota availability. A production failure leaves the existing CDN dataset intact; reruns preserve committed provenance.

Local evidence JSON export is bounded and fails if its 5,000-read budget or per-code evidence cap is exceeded; it is not a managed backup/automatic restore service. Case-only or malformed legacy records require owner investigation; no destructive repair is attempted. Static offline caches can retain previously published codes; administrative hiding is not instant revocation. The existing development dependency advisory limitations from Phase 1 are unchanged; no npm dependency or Firebase frontend SDK was added.
