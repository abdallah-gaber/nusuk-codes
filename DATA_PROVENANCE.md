# Candidate provenance and review boundary

Canonical source: `data/current_season_codes.csv` copied unchanged from the supplied starter. 1,132 exact-case candidates: 1,131 contributor-exported codes from one Facebook post and one user-supplied official sharing link (`NG-dX626jFL`). See `docs/IMPORT_REPORT.json` and `docs/NUSUK_APP_EVIDENCE.md`.

Observed/exported 2026-11-01. Observation date does not establish individual comment publication date, current-season eligibility, successful redemption, competition prizes or daily limits. All rows retain `community_submitted_unverified`; source evidence is distinct from redemption verification. The exporter does not approve them. No historical codes are included in public assets; historical research remains in docs only.

`npm run snapshot` checks counts, exact deduplication, source CSV season/status, writes stable input-order compact JSON and a checksum manifest. It is an offline fixture tool only, without Firebase or live import support. Full URLs and notes remain in canonical CSV; public fixture intentionally omits personal profile URLs/names. Do not infer approval from CSV fields on future imports. Follow `docs/DATA_IMPORT_RUNBOOK.md` in later phases for pending imports and explicit moderation.

Production publication is not authorized by this fixture build. Keep all candidates pending until reviewed. There is no actual redemption validation API or guarantee.
