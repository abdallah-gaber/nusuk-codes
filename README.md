# مفاتيح نسك · Nusuk Codes Hub

Independent Arabic-first community code browser. Not affiliated with Nusuk. All codes remain **unverified**.

## Public app

Node 22+. `npm ci`, `npm run dev` (localhost:5173).

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Pipeline compatibility tests also need Python 3.13 (no admin SDK required for those tests).

Responsive RTL copy-first UI, local history/Undo/import/export, seeded unseen browsing, compact accessible tips, official links with caveats, CDN-only snapshots and cache fallback. No frontend Firebase SDK, login, Firestore writes or privileged API. The checked-in CDN feed contains 1,540 unverified current-season community codes; the original 1,132-code asset is retained for rollback.

Vercel Web Analytics is mounted once in production builds using `@vercel/analytics/react`. Enable Web Analytics in the Vercel project and deploy the reviewed change to begin collecting page views. Local development does not mount Analytics. No custom events, code values or local browsing history are sent by application tracking code; no analytics credentials or environment variables are required.

## Phase 2A administrative pipeline

Implemented; restricted production administrative access is now configured. **The approved import and display review are complete: 1,540 published/unverified codes, 1,583 source records and 1,540 review audits. Administrative updates are disabled.** See [activation status](docs/PHASE2A_ACTIVATION.md). Firestore is the configured administrative source of truth. The deployed and supplied Security Rules deny every public Firestore read/write. Imports default to dry-run, preserve case and provenance, use deterministic IDs and bounded transactions, and never promote status. Moderation and snapshot promotion are separate explicitly confirmed operations.

Start with the full [safe activation runbook](docs/PHASE2A_ADMIN.md). It covers local/emulator setup, existing-data exports, least-privilege credentials, initial migration, future CSVs, review, staging, Git/PR publication, rollback, operation estimates and emergency stop.

Local admin checks: create `admin/.venv`, install `admin/requirements-lock.txt`, then `npm run lint:admin`, `npm run test:admin`, and (Java 21+) `npm run test:emulator`. The read-only CI workflow needs no secrets and never publishes.

`npm run validate:csv -- --input FILE.csv --season 2026-11 --observed-at ISO_TIMESTAMP` is offline. `npm run admin -- --help` lists administrative commands. `npm run snapshot` now stages published Firestore data; legacy preview regeneration is staging-only via `npm run snapshot:preview -- --output .admin-work/preview-fixture`. Nothing automatically replaces `public/data/`.

User submissions, invalid-code reports, scraping, billing, Firebase scheduled services/Functions and later phases remain off. The existing deny-all rules were preserved and index exemptions deployed. The owner explicitly approved the reconciled 408-code addition and policy-based community publication. See the [publication execution record and rollback instructions](imports/2026-11-01/PUBLICATION_RESULT.md).

See [ARCHITECTURE.md](ARCHITECTURE.md), [OPERATIONS.md](OPERATIONS.md), [SETUP_OWNER.md](SETUP_OWNER.md), [DATA_PROVENANCE.md](DATA_PROVENANCE.md) and `docs/qa/PHASE2A_VALIDATION.md`.
