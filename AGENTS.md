# Codex instructions

Read `docs/PROJECT_INSTRUCTIONS.md`, `docs/UX_MVP_ADDITIONS.md`, `docs/DATA_IMPORT_RUNBOOK.md`, `docs/NUSUK_APP_EVIDENCE.md`, and `docs/IMPORT_REPORT.json` before writing code. Follow these specs; do not invent competition limits or verified code statuses.

Current approved scope: **Phase 2A administrative data management and safe publishing only**, in addition to the completed Phase 1 UI. Do not activate production imports, deploy rules, replace the checked-in feed, enable billing, submissions, reports or scraping automatically. Production and publishing activation are manual owner steps in `docs/PHASE2A_ADMIN.md`. Public visitors must never access Firestore.

Preserve Phase 1: polished mobile-first Arabic RTL static Vite+React+TypeScript app, accessible copy/next/skip, official Nusuk link, info ticker, local seen-history and no repeated display, graceful loading/offline/empty states, no runtime Firestore dependence. Test and report results before moving to Phase 2.

All Nov 2026 candidates are unverified. Preserve case (NG- plus 8 alphanumerics provisional), source provenance, and exact deduplication. Build public browsing CDN-first via static JSON; never query Firestore for each Next. Firestore Spark must stay no-billing. Don't commit credentials or enable public write permissions. User submissions can be off until genuine server-side abuse controls exist. Report-invalid after 10 independent reports is post-MVP, with review not irreversible deletion.

This is an independent community project, not official Nusuk.
