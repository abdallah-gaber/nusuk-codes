# Phase 1 operations

- `npm ci`; run all four checks; `npm run build` produces `dist/` for a static host.
- To update a development fixture, review canonical input, run `npm run snapshot`, inspect diff and counts, run checks. Do not automatically merge historical codes or promote pending candidates.
- On a bad snapshot, restore the previous complete deployment (manifest and hash asset together). Hash, wrong-season, malformed payload and 404 failures fall back to a validated cached copy, or show Retry + the official app link. No history deletion.
- Set `maintenance: true` in checked-in manifest for a visible maintenance/read-only message. Submission UI remains off unconditionally. No discovery workflow exists to pause in Phase 1.
- Storage full/blocked: session browsing continues, with a warning when history cannot persist. Export JSON before clearing browser data. Import merges and validates season/schema; no account sync. Reset requires a dialog confirmation.
- Static host and browser cache availability still limit offline access. Zero-cost plans are not unlimited uptime promises. Later, manually monitor Firebase Usage/quota and Vercel Usage dashboards; remain Spark without billing, no Blaze, Functions, paid backups, TTL/PITR or automatic upgrade. Firebase quota must not affect CDN browsing.
- Never run load tests on third-party services. Current tests are local fixtures and mocked network only.

## Phase 2A administration

Use `docs/PHASE2A_ADMIN.md` for the exact procedure and `imports/2026-11-01/PUBLICATION_RESULT.md` for the approved 1,540-code publication and rollback. The initial setup/migration is recorded historically in `docs/PHASE2A_ACTIVATION.md`. Keep `admin/config.json` updates disabled until owner configuration, export/reconcile and emulator verification. No frontend Firestore traffic is introduced. Deny-all rules must be owner-deployed. Operator imports use slices <=250, single concurrency, explicit confirmation and fail-stop reports; replay is idempotent. Back up code/source/audit JSON before migration. No delete/restore command exists.

`npm run snapshot` now stages published administrative data to a new private directory; it does not write live CDN files. Legacy fixtures use `npm run snapshot:preview -- --output .admin-work/preview-fixture`. Use confirmed `admin promote` after reviewing changes, then a protected publishing PR and complete static deployment. Retain previous hash assets and archived manifests. Rollback is confirmed and offline, available even with updates disabled. Set updates false, stop the active operator and revoke credentials to halt administration. Browser cached data may outlive administrative hiding; static offline clients cannot guarantee immediate revocation.
