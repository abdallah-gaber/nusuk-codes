# Instagram candidates — read-only Quick Import result

Production dry-run completed November 18, 2026 using the existing reader identity. No Firestore writes, status changes, snapshot replacement or deployment occurred. Both tracked administrative update flags remain false.

## Input and unchanged evidence

- Supplied file: nusuk-instagram-clean-candidates.csv (kept outside Git).
- SHA-256: 84506cb245dc2c48909b531f96e790b08b8b43cf9340d41a2f760f9ce68aef54.
- 402 rows / 402 distinct exact-case codes.
- Every row retains the supplied source: https://www.instagram.com/p/DfXT6fmNOND/.
- No dates or season were supplied in the CSV. The configured active season is 2026-11; Quick Import saved its normal first-receipt fallback, 2026-11-18T09:20:52.750173Z. This is workflow observation, not an invented Instagram publication/extraction date.
- The owner's previously excluded matches, case-review cases and placeholder were not added back. This dry-run reconciled only the supplied 402-row file.

## Firestore reconciliation

| Item | Count |
| --- | ---: |
| Current Firestore total / published | 11,779 / 11,779 |
| New codes | 402 |
| Existing exact matches | 0 |
| Additional existing-code source records | 0 |
| Duplicate input rows | 0 |
| Invalid / cross-season / case-variant / legacy-ID conflicts | 0 / 0 / 0 / 0 |
| Expected final total / published | 12,181 / 12,181 |

The plan is not blocked. The dry-run uses approximately 454 estimated document reads and zero writes, not a full backup or source/audit export.

Future apply estimate: 13,050 reads including verification and the complete snapshot query; 1,206 writes (402 primary + 402 source + 402 audit records). The mandatory 20% margin requires at least 15,660 remaining reads and 1,448 remaining writes in a fresh owner quota attestation. Counts are estimates, not measured quota counters. Subtract this dry-run and other project usage before attesting.

Current reviewed token:

    UPDATE 2026-11 a15da72795948a3036c6d5b0cdd1157bea7219c75e03b1052b87debcd8b4e893

The CLI recomputes a fresh plan before writes and rejects a stale token. Do not force this token if production changes.

## Minimal source support and checks

Administrative source validation accepts only canonical HTTPS www.instagram.com/p/<shortcode>/ URLs. It rejects profiles, private routes, tracking queries, fragments, alternate/lookalike hosts and noncanonical syntax, without fetching or rewriting evidence. Publishing and frontend validation now accept the existing public domain-only representation, instagram.com; the public schema is unchanged.

Targeted checks passed: 52 Python pipeline/incremental/Instagram tests (including four new source tests), 14 core frontend tests, targeted Python lint, frontend lint/typecheck and production build. Coverage includes exact source preservation, malformed/unsafe URL rejection, staged snapshot integrity, unverified status, public-only provenance and client acceptance/rejection.

## Before actual import

1. Review and merge the source-validation PR manually. Default Quick Import publication requires clean, current main; do not bypass this check by applying from the feature branch.
2. Confirm the supplied CSV SHA above, review these counts and authorize the exact apply confirmation. Use the same unchanged file so the saved receipt/provenance identities remain stable.
3. Check Spark usage/no billing and prepare a quota attestation at most one hour old, with the required headroom. Follow [QUICK_IMPORT.md](QUICK_IMPORT.md) for the existing editor identity and temporary environment opt-in. Do not change either tracked kill switch.
4. From that approved clean main checkout, the next write command is:

       npm run codes:update -- --production --project nusuk-codes --file /Users/abdallahgaber/Downloads/nusuk-instagram-clean-candidates.csv --apply

   It prints the fresh summary and requires the exact confirmation before writing. Do not run it without the reviewed approval and quota attestation.
5. New entries remain community_submitted_unverified with redemptionVerified=false; display publication follows the existing owner policy. The workflow preserves existing entries, builds/checks the complete snapshot within unchanged limits, retains rollback assets and opens a separate publishing PR. Review/merge/deployment remain owner-controlled.

The current live/checked-in 11,779-code snapshot remains unchanged, SHA-256 a683aba328ce34d50ee124a1a5d7f8121de0bdddd47252d675dafb6956686373. Private checkpoints and the full plan remain in the ignored .admin-work/quick-import/<input SHA>/attempt-0001/ directory. No credentials, CSV or full provenance export is committed.
