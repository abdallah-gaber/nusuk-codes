# Phase 1 architecture

Static Vite SPA. Visitor fetches `/data/manifest.json`, then the content-addressed snapshot. No Firestore reads, online writes, Functions, realtime listeners or trackers. All Next/Copy/Open actions operate locally. Tailwind is compiled with Vite; CSS decorations and system Arabic fonts avoid external font/image requests.

Manifest carries schema, canonical `nov-2026` season (CSV `2026-11`), generation date, count, SHA-256, snapshot URL, readOnly/submissionsEnabled, maintenance and candidatePreview flags. Fetches timeout after 10 seconds. The client validates the manifest, exact count, duplicate codes, status, season, source domains and payload checksum before use. The provisional regex is a syntax check only.

The last-good raw snapshot and manifest are cached in localStorage, then revalidated on fallback. Storage failures never block browsing. History is stored independently at `(season, exact-case code)` with a per-browser random seed for a deterministic Fisher–Yates shuffle. Seen means displayed, including the current card; tried/skipped are explicit local annotations. Copy/Open never advance. Next has no daily limit. Exhaustion does not restart without confirmed reset. Undo restores the previous card and history. Cross-tab updates follow last-writer-wins; simultaneous clicks in different tabs can lose a local annotation. No device synchronization; export/import unions exact-case arrays without replacing existing history.

Only data assets are cached; this is not a PWA. Offline fallback works when the application shell is already available (open tab or browser HTTP cache), not a guaranteed cold offline launch. A network failure never clears history. A valid cached snapshot may be old; the UI labels fallback and age. `readOnly` is operational metadata: Phase 1 always disables submissions regardless of manifest flags.

Full dataset provenance lives outside `public/`. The public JSON exposes source domains and observation date only. Candidate status remains unverified. Production publication requires deliberate moderator approval/season review in a later phase; the Phase 1 manifest deliberately declares `candidatePreview: true`.

Vercel header configuration: manifest max-age 300/s-maxage 600; hash snapshots max-age one year immutable. Deploy snapshot and manifest together; retain the prior deployment for rollback. JSON payload measured at 130,234 raw / 9,225 gzip bytes before hosting compression. No chunking needed.
