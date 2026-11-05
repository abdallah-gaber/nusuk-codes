# Candidate provenance and review boundary

The original fixture, `data/current_season_codes.csv`, was copied from the supplied starter. Its exact-case candidates came from a contributor-exported Facebook post and a user-supplied official sharing link. The original import report and app evidence are historical records, not the current release inventory. [Original report](docs/IMPORT_REPORT.json) · [App evidence](docs/NUSUK_APP_EVIDENCE.md)

The current published dataset is identified by the checked-in manifest and its content-hashed snapshot. Administrative provenance is maintained separately from the minimal public entries, which contain the exact code, unverified status, source domain and observation date. [Current manifest](public/data/manifest.json)

Observation or extraction dates do not establish individual comment publication dates, season eligibility, successful redemption, prizes or daily limits. Administrative statuses are pending/published/hidden/invalid. Published records retain `community_submitted_unverified` and `redemptionVerified: false`. The owner policy permits syntactically valid current-season community candidates to be displayed without successful redemption verification.

The full import CLI creates pending records. The gated Quick Import workflow can create published/unverified records under that policy and append missing source sightings to existing records without modifying their primary documents or display statuses. Exact case and original provenance are preserved. CSV status fields alone never authorize publication. [Full runbook](docs/PHASE2A_ADMIN.md) · [Quick Import](docs/QUICK_IMPORT.md)

`npm run snapshot` stages published administrative data. `npm run snapshot:preview -- --output .admin-work/preview-fixture` only regenerates the original offline fixture into a fresh directory outside `public/`. Neither command alone authorizes production publication.

Historical research codes are not automatically included in an active dataset. Future season attribution and code reuse require review. The source code's MIT License does not assert ownership of community code strings, Nusuk branding or external source content. [Season policy](docs/SEASONS.md) · [LICENSE](LICENSE)
