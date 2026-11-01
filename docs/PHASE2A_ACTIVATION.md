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

## Import is not yet activated

The owner approval request for the **pending-only initial migration** is still outstanding at this checkpoint. No production code import or review has run. `admin/config.json` remains `updatesEnabled: false`. The 1,132-code CDN preview and canonical CSV are unchanged; no code has been marked published or verified.

The proposed migration is five bounded slices (250, 250, 250, 250, 132), approximately 2,264 document writes, followed by an evidence export and reconciliation. It must preserve exact codes, set `pending` / `community_submitted_unverified` / `redemptionVerified: false`, and restore updates disabled at completion or failure. It does not approve public publication. The actual source/season review step remains separate.

## Local operator access

Ignored `.admin-work/activation/reader.env` and `editor.env` contain only non-secret environment settings and the path to the existing approved ADC store. Source the reader profile for exports/dry-runs; use the editor only for explicitly approved mutations. Credentials never enter the repo, frontend or GitHub Actions.

`NUSUK_IMPERSONATE_SERVICE_ACCOUNT` is restricted in code to the two approved identities. Reader write commands and mixed inline-credential overrides are rejected. Target access tokens live in memory for 30 minutes and are not saved. The base ADC store is still sensitive owner-account authentication material; local impersonation is not a sandbox against malicious code running as that same local owner.

Raw IAM backups, dry-run reports, exported records, source credentials and operator scripts are private/local and not committed. See [the operator runbook](PHASE2A_ADMIN.md) for commands, future CSVs, review, publication, rollback and emergency stop.

## Validation

ESLint, Python Ruff, TypeScript typecheck and production build pass. **38 tests pass:** 12 frontend/compatibility, 21 pure admin tests, and 5 real Firestore Emulator tests. The added test covers the approved impersonation allowlist, reader write rejection, and ambiguous credential overrides. Actual production access checks were read-only and used both scoped identities. The emulator used only `demo-nusuk-codes`.

Logs: `docs/qa/phase2a-activation-checks.log` and `docs/qa/phase2a-activation-emulator.log`. No frontend Firebase dependencies, user submissions, invalid-code reports or scraping were introduced.
