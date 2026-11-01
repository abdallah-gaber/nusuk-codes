# Data import + future Facebook scans (Codex implementation contract)

## Initial data
- `current_season_codes.csv` contains **1,132 distinct exact-case code strings**: 1,131 from one contributor-exported Facebook page, plus 1 separately user-supplied sample.
- CSV extracted on 2026-11-01. **It does NOT prove the date of publication of each Facebook comment, contest eligibility, or successful redemption.** All are `community_submitted_unverified`. Require explicit moderator review / season checks before publishing. Avoid public display of Facebook individual profiles or commenting user names.
- Never merge legacy `historical_codes.csv` into active season automatically.
- `official_link` is constructed only using the known observed Nusuk sharing link format; opening does not guarantee a successful redemption and must not be misrepresented as 'redeem success'.

## Contributor workflow (every few days)
1. Open a public Facebook post in their own Chrome browser, load visible comments, paste the reviewed standalone extractor JS (see previous chat). It only reads content currently loaded and never fetches private data.
2. Repeat after loading more comments and on other accessible public posts. Export with `window.nusukDownload()` to `nusuk-codes.csv`.
3. Place any such files in `data/incoming/` (or upload through admin-only secure ingest workflow). **Never blindly overwrite the canonical season file.** Keep original files as audit trail outside public assets.
4. Run `npm run ingest -- --season 2026-11 --input data/incoming/FILE.csv --dry-run`. Dry-run MUST report rows, invalid, duplicates within file, already in collection, genuinely new, conflicting sources and candidates pending review; zero writes.
5. Run `npm run ingest -- --season 2026-11 --input ... --apply` as a privileged operator only after checking the report. Use deterministic ID = SHA-256(`${season}\0${exact_case_code}`) for Firestore document; upsert with create-if-absent/transaction and avoid overwriting existing `status`, `reviewedAt`, or source evidence. Track multiple source sightings separately and bound doc sizes. Import is repeatable/idempotent: running same file twice results in 0 newly created entries.
6. Review `pending` entries; approved-only snapshot build; unit-test correctness, then deploy CDN snapshot through protected PR. If a code exists in an earlier snapshot, do not make it appear newly added or change its stable ID/history.
7. Archive summary + bad data report. Preserve per-source provenance with reported observation time distinct from actual post timestamp.

## Extraction safeguards
- Pattern provisional `NG-[A-Za-z0-9]{8}` (case-sensitive code, prefix exact); strip surrounding whitespace / punctuation and parse `id=` URLs; reject unknown formats into review queue.
- Do not use lowercased dedup keys unless Nusuk officially documents case-insensitivity; case-only variants must be flagged for manual investigation, not silently merged.
- Do not trust CSV status/source fields as moderation approval. Spreadsheet formulas / CSV cells are untrusted: never eval data, or use innerHTML; escape CSV if re-exporting to Excel and display sanitized text.
- Protect against malicious source URLs; only safe http(s) links and allowlisted nusuk domain for constructed official link. No server-side fetch of user-submitted URLs without SSRF protections.
- Avoid indiscriminate Facebook scraping / evading access controls, login walls, or CAPTCHA.
