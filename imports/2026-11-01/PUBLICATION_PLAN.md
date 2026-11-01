# Read-only import and publication plan — 2026-11-01

**Historical read-only plan, subsequently explicitly approved by the owner.** The counts and caveats below record the planning baseline. See [the execution record](PUBLICATION_RESULT.md) for the approved operation; do not rerun this original pre-import plan against the now-imported database.

The requested bundle was originally found at workspace sibling `nusuk-import-2026-11-01/`; its four files were copied byte-for-byte into this folder. Planning artifacts and the fresh production export are private under `.admin-work/reconciliation-1540/`.

## Live reconciliation

| Item | Expected | Actual |
| --- | ---: | ---: |
| Existing production current-season codes | 1,132 | 1,132 |
| Missing candidates from new-only CSV | 408 | 408 |
| Existing codes in source-sightings CSV | 43 | 43 |
| Projected exact-case unique codes | 1,540 | 1,540 |
| Difference from expected total | 0 | 0 |

All 1,132 production records are pending/unverified; none are published, hidden or invalid. The evidence export reconciles with zero missing, extra, changed or noncanonical records and no case-only variants. Neither input file contains invalid rows, within-file duplicates or case variants. The two inputs are disjoint. All 43 source sightings are additional evidence for existing code documents; none creates another code record.

File SHA-256 fingerprints:

- New-only 408-row CSV: `6183d67922575f6e36420ce5260cab1db84abd9a22872ea45de2684ea8af8e2a`.
- Existing-source-sightings 43-row CSV: `d3faefc8f3d3b3866368c33e94d5b4bb6d96e3784f4746827855571d184072f1`.
- The report's `9aea67a9767e16965182a51a3f2a701f03050dac9698f1f65b9907a9e832adc8` refers to an original 451-row export that was not supplied. Its binary fingerprint cannot be independently verified. The split files independently establish 451 distinct exact-case codes, 43 existing and 408 new.

Observation time is represented as `2026-11-01T00:00:00Z`, a day marker from the provided bundle date, not a known exact extraction time or Facebook publication date. Season `2026-11` is owner-attributed, not independently verified competition eligibility. 451 matches do not establish that all reported 17,000+ comments were loaded. No source URLs were fetched or scraped.

## Explicit display policy

`community-current-season-v1` approves display of syntactically valid community codes attributed to the current season. It does **not** require redemption testing or assert independent source/eligibility verification. The planned moderation records carry `syntaxChecked: true`, `seasonAttributed: true` and the explicit policy name. Existing source-review facts are preserved; no new independent source-review claims are manufactured. Every public entry remains `community_submitted_unverified`, and every administrative record remains `redemptionVerified: false`.

Administrative publication still requires a separate approved write operation, revision checks, actor, note, timestamp and immutable audit entry. Hidden/invalid records are never silently restored; count drift or conflicting moderation blocks the planner even when a projected union happens to remain 1,540.

## Proposed approved sequence (not executed)

1. Refresh the read-only evidence export/reconciliation before executing any writes. Re-run the planner; stop if counts, code identities, source evidence, statuses, revisions, case variants or fingerprints differ. Confirm Spark/no billing and quota headroom. Save the original complete export.
2. With separate explicit import approval, deliberately enable updates and use the existing importer for the new-only CSV in slices **0:250 and 250:250** (250 + 158 records). Run a fresh dry-run before each slice; pass the exact emitted IMPORT confirmation only after reviewing its report. This creates **408 pending code documents + 408 source records**.
3. If the source-sighting portion is approved, import the 43-row sightings CSV in one slice **0:250**, expecting **0 code creates + 43 source creates**. Preserve all existing primary fields, original batches, statuses and source records. Replaying either file must be idempotent.
4. Export/reconcile the post-import state: expect 1,540 codes, 1,583 source records, all redemption-unverified, with new codes pending. Do not proceed on drift. The current 5,000-read evidence-export budget can accommodate the projected 4,663 reads for code/source/audit queries under these counts, assuming no extra history.
5. With separate explicit display-approval authorization, dry-run and apply the **seven** prepared review plans (250 × 6 + 40), using the current revision/status preconditions and exact REVIEW tokens. Expect 1,540 status updates and 1,540 immutable audit creates. This never confirms redemption.
6. Export/reconcile again and regenerate a **fresh actual published-only snapshot** from Firestore. Require exactly 1,540 unique current-season records and the same intended public payload checksum. If partial review, quota failure or drift occurs, leave CDN files untouched; resume or prepare a revised plan only after read-only reconciliation.
7. With explicit snapshot/publication approval, inspect the new manifest and actual review inventory, then run `promote --dry-run`. Require **+408 / −0** against the existing CDN feed. Promote with the exact expected-current SHA and PUBLISH token; review the Git diff and validation, then publish the complete manifest + immutable asset through the separately approved repository/deployment workflow.
8. Restore updates disabled on success or failure. Never add a public Firestore SDK/read/write path, billing, user submissions, reports, scheduled Firebase work or scraping.

Example operator command shapes are in `docs/PHASE2A_ADMIN.md`. For imports use this folder's paths and the observation marker above. The initial full input SHA is not substituted for the actual split-file SHA in confirmation tokens or audit metadata.

## Complete projected CDN artifact

Private stage: `.admin-work/reconciliation-1540/plan/snapshot/`.

- Code count: **1,540**, all publicly labeled unverified.
- Data: `codes.db5b4c1d652c370a.json`.
- SHA-256: `db5b4c1d652c370a0caef104fc7aa40a5aabe5dba037ef98a556e36e003fc91f`.
- Size: **177,154 bytes / 12,015 gzip bytes**.
- Diff: **408 additions / zero removals**; source domains/date only, no private URLs, actor identities, audit or import metadata.
- Freshness timestamp is projected at planning time. Actual publication must regenerate it from actual moderation timestamps; the data checksum should remain identical if the approved code/domain/date payload is unchanged.

The data/manifest passed the real frontend integrity validator. `publication.json` explicitly carries `planningOnly: true`; promotion rejects it. This preview is complete for review, but cannot be used as evidence that production import/moderation occurred. Regenerate the real stage after approval and successful writes.

## Rollback and failure handling

A validated copy of the **current 1,132-code manifest and original immutable data** is saved privately at `.admin-work/reconciliation-1540/plan/rollback/`. Current snapshot SHA:

`e7812d4f1cc7887736f58e74402ffb9b6b18fa2813c05880f9ecd4dc9fdac4b1`.

Actual promotion retains that asset and archives its prior manifest under `snapshots/history/<manifest-hash>.manifest.json` before switching the manifest last. If publication must be undone, restore the previous complete hosting deployment or use the runbook's confirmed offline `rollback` command with the actual current SHA and `ROLLBACK e7812d4f1cc7887736f58e74402ffb9b6b18fa2813c05880f9ecd4dc9fdac4b1`, then review/commit/deploy the rollback pair with approval. History stays scoped by season/exact code and is not erased.

CDN rollback does not delete the 408 new Firestore records, erase source sightings or undo moderation audits. If administrative display status must also be reverted, first read/export the actual applied revisions, then prepare a separately approved inverse review plan for only successfully changed records, using the saved `pre-publication-state.json` status/revision inventory. Do not blindly restore documents or delete provenance. Failed imports/reviews stop; original snapshots remain active until a fully validated promotion. Cached offline feeds cannot guarantee instant revocation.

## Estimated writes if approved

- Import including all sightings: **859** creates (408 code + 451 source).
- Display approval: **3,080** writes (1,540 updates + 1,540 audit creates).
- Total: **3,939**, before any retries or later administrative changes.
- Without optional 43 sightings: **3,896** total.
- Snapshot staging/promotion and visitor browsing: **zero Firestore writes**; visitors perform zero Firestore reads.

These are logical-operation estimates, not a quota reservation. Stop on quota, credential or network errors; never attach billing or upgrade a plan. Original inputs and all private reports are retained.

## Validation results

Passed: ESLint, Python Ruff, TypeScript typecheck, production build, **12 frontend tests + 25 admin tests + 6 real emulator tests = 43 tests**. New coverage exercises full 1,540-code planning, deterministic content hashes, live-count drift blocking, preservation of hidden moderation, policy approval without redemption/source-verification claims, actual emulator review/audit transactions, and rejection of projected promotion. The real staged 1,540-code file also passed `src/core.ts` checksum/schema validation. Rollback data passed the same manifest/data integrity checks.

Logs are private at `.admin-work/reconciliation-1540/checks.log` and `emulator.log`. Billing was rechecked: disabled, no linked account. `admin/config.json`, `public/data`, the canonical data and dependency lockfile are unchanged. No credentials or private exports are in the prepared input folder.
