# Approved community publication — 2026-11-01

The owner explicitly approved the production import, display approval and Git/Vercel publication of 408 new codes, targeting 1,540 exact-case unique codes. This record accompanies the release PR; deployment commit and live verification are reported after that PR merges. No UI or public runtime architecture changes are included.

## Production execution

Immediately before writes, a fresh complete production evidence backup and reconciliation confirmed the approved baseline: 1,132 pending codes, exactly 408 missing candidates and 43 additional source sightings for existing codes. There were zero unexpected differences, invalid rows, duplicate codes or case variants. Billing was disabled with no linked account. Input fingerprints matched the approved plan.

Three sequential import slices (250 + 158 new codes, then 43 existing-code sightings) created 408 pending code documents and 451 immutable source records, with no failures. Verification confirmed unchanged original primary fields, exact-case values and preserved source records. Seven revision-guarded review batches (250 × 6 + 40) approved all 1,540 for community display and created 1,540 immutable audits, with no failures or skipped decisions.

The fresh post-review evidence export and reconciliation confirmed:

| Item | Actual |
| --- | ---: |
| Season 2026-11 code documents | 1,540 |
| Exact-case distinct codes | 1,540 |
| Published under community display policy | 1,540 |
| Pending / hidden / invalid | 0 / 0 / 0 |
| Source records | 1,583 |
| Review audit records | 1,540 |
| Redemption verified | 0 |
| Unexpected reconciliation differences | 0 |

All records retain `community_submitted_unverified` / `redemptionVerified: false`. `community-current-season-v1`, `syntaxChecked: true` and `seasonAttributed: true` document owner-approved display eligibility; independent source/season review booleans remain false. Original primary provenance, import metadata and every source record were preserved. The original 451-row unsplit export was not supplied; the fingerprint/coverage and normalized observation-day caveats in the plan still apply.

Administrative updates were enabled only inside the approved guarded import, review and local staging/promotion operations, then restored to **false** after each operation. No credential changes, Firestore client permission changes, billing activation, deletion, Functions, scheduled jobs, submissions, reports or scraping were introduced.

## Snapshot and privacy

The actual published-only Firestore stage contains 1,540 codes and matches the approved projected content hash:

- SHA-256: `db5b4c1d652c370a0caef104fc7aa40a5aabe5dba037ef98a556e36e003fc91f`.
- Public asset: `/data/codes.db5b4c1d652c370a.json` (177,154 bytes; 12,015 gzip bytes).
- Complete snapshot diff: **408 additions, zero removals**.
- Actual moderation-derived generation time: `2026-11-01T13:50:29.547764Z`.
- Actual inventory is non-projected and passes code-ID/revision validation; no planning preview was promoted.
- Every public entry contains exactly `code`, unverified `status`, source domain and observation date. No full source URLs, actors, review notes, document IDs, input hashes or audit/import metadata are included in the CDN feed.
- Public visitors continue to read static CDN files only, with zero Firestore operations. Deny-all Firestore Security Rules and restricted administrative IAM remain unchanged.

Promotion validated the complete data/manifest pair and expected-current checksum, preserved the old immutable asset, archived its manifest, and replaced the manifest last. The frontend’s real schema/checksum validator also accepts the 1,540-code pair. Credentials, private publication inventories, backups and detailed operator reports remain in ignored local `.admin-work/publication-1540-approved/`, never in Git or `public/`.

Logical write totals: **859 import creates + 3,080 review writes = 3,939 writes**. Snapshot staging/promotion causes zero Firestore writes. Read estimates follow the runbook: import dry-run/apply about 3,157 reads for 451 selected candidates, seven review dry-runs/applications about 3,080 reads, published staging 1,540 reads; evidence exports/reconciliation add bounded reads. These are estimates, not billing counters or quota reservations. No operation failure required retrying a slice.

## Validation and release boundary

Passed after actual snapshot promotion: ESLint, Ruff, TypeScript, 12 frontend tests, 25 administrative tests, six real loopback Firestore Emulator tests, production build and the actual frontend snapshot integrity check (43 tests total). The PR validation workflow repeats the app/admin/emulator checks without secrets. Do not bypass a failed check or changed PR head. The existing Vercel Git integration deploys the complete static pair after the approved PR merge; no privileged publishing API or runtime function is added.

Verify the canonical production manifest and hash asset after deployment: exactly 1,540 distinct codes, expected checksum, public-only fields, old asset availability and successful Arabic app loading. The live manifest may remain cached briefly under existing CDN headers; preserve the old deployment until verification succeeds.

## Exact rollback

Previous snapshot SHA-256: `e7812d4f1cc7887736f58e74402ffb9b6b18fa2813c05880f9ecd4dc9fdac4b1`.

Previous archived manifest: `snapshots/history/e345cd90badf3da89a3d6de0dc472c9334697e5e4d8ba3175ad55f08dd6db205.manifest.json`. Its referenced 1,132-code asset is retained in `public/data/` and in the deployment.

Prefer restoring the previous complete Vercel deployment. Alternatively, from this release checkout, use the existing offline confirmed rollback:

```sh
npm run admin -- rollback \
  --input snapshots/history/e345cd90badf3da89a3d6de0dc472c9334697e5e4d8ba3175ad55f08dd6db205.manifest.json \
  --expect-current db5b4c1d652c370a0caef104fc7aa40a5aabe5dba037ef98a556e36e003fc91f \
  --confirm 'ROLLBACK e7812d4f1cc7887736f58e74402ffb9b6b18fa2813c05880f9ecd4dc9fdac4b1'
```

Inspect the restored complete pair, run validation, then review/commit/deploy that rollback through a separately approved PR. This operation works while administrative updates are disabled. Do not execute it just to test production rollback. CDN rollback does not delete Firestore data, erase source/audit records, undo display review or clear local browser history. Any inverse Firestore review requires a fresh reconciliation and separate approval. Cached offline feeds may persist until refresh.
