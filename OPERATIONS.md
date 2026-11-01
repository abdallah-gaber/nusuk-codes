# Phase 1 operations

- `npm ci`; run all four checks; `npm run build` produces `dist/` for a static host.
- To update a development fixture, review canonical input, run `npm run snapshot`, inspect diff and counts, run checks. Do not automatically merge historical codes or promote pending candidates.
- On a bad snapshot, restore the previous complete deployment (manifest and hash asset together). Hash, wrong-season, malformed payload and 404 failures fall back to a validated cached copy, or show Retry + the official app link. No history deletion.
- Set `maintenance: true` in checked-in manifest for a visible maintenance/read-only message. Submission UI remains off unconditionally. No discovery workflow exists to pause in Phase 1.
- Storage full/blocked: session browsing continues, with a warning when history cannot persist. Export JSON before clearing browser data. Import merges and validates season/schema; no account sync. Reset requires a dialog confirmation.
- Static host and browser cache availability still limit offline access. Zero-cost plans are not unlimited uptime promises. Later, manually monitor Firebase Usage/quota and Vercel Usage dashboards; remain Spark without billing, no Blaze, Functions, paid backups, TTL/PITR or automatic upgrade. Firebase quota must not affect CDN browsing.
- Never run load tests on third-party services. Current tests are local fixtures and mocked network only.
