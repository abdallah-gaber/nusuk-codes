# Operations

- `npm ci`; run all four checks; `npm run build` produces `dist/` for a static host.
- To update a development fixture, use `npm run snapshot:preview -- --output .admin-work/preview-fixture` with a fresh staging directory and inspect the result. Do not automatically merge historical codes or promote pending candidates.
- On a bad snapshot, restore the previous complete deployment (manifest and hash asset together). Hash, wrong-season, malformed payload and 404 failures fall back to a validated cached copy, or show Retry + the official app link. No history deletion.
- Set `maintenance: true` in checked-in manifest for a visible maintenance/read-only message. Submission UI remains off unconditionally. No automated discovery workflow is enabled.
- Storage full/blocked: session browsing continues, with a warning when history cannot persist. Export JSON before clearing browser data. Import merges and validates season/schema; no account sync. Reset requires a dialog confirmation.
- Static host and browser cache availability still limit offline access. Zero-cost plans are not unlimited uptime promises. For approved administrative sessions, manually monitor Firebase Usage/quota and Vercel Usage dashboards; remain Spark without billing, no Blaze, Functions, paid backups, TTL/PITR or automatic upgrade. Firebase quota must not affect CDN browsing.
- Never run load tests on third-party services. Current tests are local fixtures and mocked network only.

## Phase 2A administration

Use [the full runbook](docs/PHASE2A_ADMIN.md) for setup, migrations, periodic backups and emergencies. Use [Quick Import](docs/QUICK_IMPORT.md) for routine approved CSV updates, its bounded operations and checkpoint workflow. Keep administrative updates disabled between approved sessions. Both paths preserve exact case, unverified redemption status and provenance, with explicit gates before writes. No frontend Firestore traffic is introduced.

The [initial activation](docs/PHASE2A_ACTIVATION.md) and [earlier publication](imports/2026-11-01/PUBLICATION_RESULT.md) reports are historical records. Consult [the manifest](public/data/manifest.json) for the current release inventory.

`npm run snapshot` now stages published administrative data to a new private directory; it does not write live CDN files. Legacy fixtures use `npm run snapshot:preview -- --output .admin-work/preview-fixture`. Use confirmed `admin promote` after reviewing changes, then a protected publishing PR and complete static deployment. Retain previous hash assets and archived manifests. Rollback is confirmed and offline, available even with updates disabled. Set updates false, stop the active operator and revoke credentials to halt administration. Browser cached data may outlive administrative hiding; static offline clients cannot guarantee immediate revocation.
