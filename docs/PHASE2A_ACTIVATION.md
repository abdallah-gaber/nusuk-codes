# Phase 2A production setup — 2026-11-01

## Completed

- Renewed owner Firebase and Google Cloud CLI authentication with explicit approval for local ADC storage outside the repository.
- Verified existing project `nusuk-codes`, default Firestore database, Standard Edition, `eur3`, free tier, PITR disabled, billing disabled and no linked billing account.
- Backed up rules, IAM, service accounts and index metadata privately under ignored `.admin-work/activation/`.
- Confirmed deployed rules already deny every client read/write. They were preserved. Anonymous production code listing returns HTTP 403.
- Enabled IAM/IAM Credentials APIs for keyless administration. No billing account, Functions, scheduled service or paid backup was enabled.
- Created the explicitly approved reader/editor service accounts and custom roles. Reader has database transaction/get and entity get/list permissions; editor adds entity create/update only. Neither has delete, billing, IAM-management or deployment permissions.
- Granted the approved owner account service-account-level Token Creator on only these two identities. No project-wide Token Creator binding was added.
- Verified both reader and editor can authenticate using short-lived in-memory impersonation from the one existing local ADC store. No service-account private keys were created; both new accounts have zero user-managed keys. No OAuth refresh-token copies or additional credential profiles were created.
- Deployed the three committed field-index exemptions (`sourceUrl`, `importBatch`, `reviewNote`); there were no existing custom composite indexes to remove.
- Exported and reconciled existing current-season code records: **0 records, no differences**. A separate bounded collection check confirmed no other code documents across seasons.
- Validated the supplied CSV: 1,132 exact-case candidates. The first 250-code production dry-run found **250 new / 0 existing / 0 invalid / 0 within-file duplicates / 0 case variants**, with zero writes.

## Approved initial migration completed

After explicit owner approval, the five bounded slices created **1,132 code documents and 1,132 source records** (250 + 250 + 250 + 250 + 132). All batches completed with **zero reported failures**. Each code is `pending`, `community_submitted_unverified`, `redemptionVerified: false`, with revision 0. No review decision, audit entry or publication was fabricated.

The post-migration evidence export contains all 1,132 codes and source records. Verification compared every document ID, exact-case code, original primary source, source sighting hash, season, file SHA, batch identifier and verification/status field to the supplied CSV. The `NG-dX626jFL` sample is preserved exactly once. Reconciliation reports no missing, extra, changed or noncanonical records and no case variants.

Full export fingerprint (canonical JSON): `e116097bdeb77182557c54dbf7957612ac74c7f6677a4dc58e0947980b9d9686`. Actual exports, per-slice plans/apply reports and verification details remain private in ignored `.admin-work/activation/`.

The operator restored **`updatesEnabled: false`** after the migration. No code was marked published or redemption-verified. The canonical CSV and CDN preview are unchanged; snapshot SHA-256 remains `e7812d4f1cc7887736f58e74402ffb9b6b18fa2813c05880f9ecd4dc9fdac4b1`. Initial migration therefore used exactly **2,264 document creates** (code + source), with no existing records overwritten. SDK/accounting retries can add reads; observed batch outcomes contained no failures or duplicates.

**Next publication boundary:** an explicit source/season moderation decision is still required before generating and promoting a published-only snapshot. No snapshot promotion, deployment of new dataset contents, user submissions, invalid-code reports, scraping or billing upgrade was performed. Future imports must use the usual fresh dry-run/confirmation path and deliberately enable updates only for the operator session.

## Local operator access

Ignored `.admin-work/activation/reader.env` and `editor.env` contain only non-secret environment settings and the path to the existing approved ADC store. Source the reader profile for exports/dry-runs; use the editor only for explicitly approved mutations. Credentials never enter the repo, frontend or GitHub Actions.

`NUSUK_IMPERSONATE_SERVICE_ACCOUNT` is restricted in code to the two approved identities. Reader write commands and mixed inline-credential overrides are rejected. Target access tokens live in memory for 30 minutes and are not saved. The base ADC store is still sensitive owner-account authentication material; local impersonation is not a sandbox against malicious code running as that same local owner.

Raw IAM backups, dry-run reports, exported records, source credentials and operator scripts are private/local and not committed. See [the operator runbook](PHASE2A_ADMIN.md) for commands, future CSVs, review, publication, rollback and emergency stop.

## Validation

ESLint, Python Ruff, TypeScript typecheck and production build pass. **38 tests pass:** 12 frontend/compatibility, 21 pure admin tests, and 5 real Firestore Emulator tests. The added test covers the approved impersonation allowlist, reader write rejection, and ambiguous credential overrides. Actual production access checks were read-only and used both scoped identities. The emulator used only `demo-nusuk-codes`.

Logs: `docs/qa/phase2a-activation-checks.log` and `docs/qa/phase2a-activation-emulator.log`. No frontend Firebase dependencies, user submissions, invalid-code reports or scraping were introduced.
