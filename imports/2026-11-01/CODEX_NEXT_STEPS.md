# Nusuk Hub — next ingestion and publication request

## Verified input counts

- Prior canonical candidate count: **1,132** (all unverified)
- New extractor export: **451 distinct, correctly formatted** codes, 0 within-file duplicates
- Exact-case intersection with prior 1,132: **43**
- New unique code candidates: **408**
- Expected total after ingestion: **1,540**
- These results are from comparing the attached CSV to the prior canonical seed file, not a new live Firestore export. **You MUST reconcile again against Firestore before applying**.

## Input files

- `new_codes_only.csv`: 408 new candidate codes, original observed source URL
- `already_existing_source_sightings.csv`: 43 duplicate codes with an additional observed source; optional source sightings; must NOT create duplicate code records
- `IMPORT_REPORT.json`: fingerprint and reconciliation metrics

## Implementation instructions for Codex

1. Inspect the current repository and `docs/PHASE2A_ADMIN.md`, `docs/PHASE2A_ACTIVATION.md` and existing commands before operating. Respect current production credentials, least-privilege access and `updatesEnabled: false`.
2. Default to **dry run**, compare all input codes against **live Firestore** (including season), preserve exact case, prevent duplicates using deterministic IDs/transactions, and produce a readable plan. If live values differ from expected counts, STOP and report rather than silently adjust.
3. The site owner's new publication rule is **publish syntactically valid community codes from the current season without requiring redemption testing**. Mark `redemptionVerified: false`, disclose unverified status publicly. Distinguish approval for display from verified redemption. Keep source provenance and moderation/audit metadata. Avoid accidentally publishing historical-season records.
4. Add the 408 candidate records (or the truly missing subset from live reconciliation) only with explicit owner approval, using existing bounded importer; any overlapping source sightings may be recorded idempotently if supported by the CLI, no duplicate code documents.
5. Prepare a **separate and explicit moderation/publish plan** to mark eligible current-season candidates published, create a deterministic validated snapshot, and promote it as an atomic manifest+content change with rollback. Ensure `public/data` is untouched before owner approval. Keep static CDN architecture: no public Firestore SDK/reads, no paid Firebase features, no billing attachment.
6. Maintain a dry-run preview reporting document creates, source creates, approvals and snapshot differences with expected live total **1,540**, but never automatically promise exact counts if Firestore has changed in the meantime.
7. Run tests, lint, typecheck, and production build, document rollback and safe update disablement. Do not enable submissions or invalid-code reports yet.
8. Never commit service-account keys, OAuth tokens, private local `.admin-work` files or other secrets.

## Facebook extraction coverage caveat

The post reportedly contains over 17,000 comments, but **451 code matches do not establish that all comments were loaded**. The prior browser script stops on idle/no new codes, not on a verified total-comment boundary. For next extractor improvement track loaded-comment count / load-more clicks / end reason and use a bounded manual stop. Do not claim 100% extraction or use hidden APIs/circumvent authentication controls.
