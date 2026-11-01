# Phase 1 validation — 2026-11-01

## Automated

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass. Vitest 5.0.5: 10 tests cover exact-case dataset/counts, SHA-256 tampering, wrong season and unsafe snapshot URLs, exact official URL, robust history imports, deterministic shuffle, all-seen exhaustion and distinct tried/skipped transitions, CDN fetch/cache fallback, corrupt cache and blocked storage.

Production: 29 modules; JS 244.95 KB / 76.43 KB gzip, CSS 15.57 KB / 4.46 KB gzip. Candidate snapshot 130,234 bytes / 9,225 gzip bytes. Build output is excluded from Git and reproducible with the lockfile.

## Browser evidence

Local in-app Chromium browser: desktop 1280px and mobile 320px. At 320px, document `clientWidth` and `scrollWidth` are both 320; `lang=ar`, `dir=rtl`. Screenshots in this directory show desktop, mobile, dark mode and exhausted state.

Verified Next changes to an unseen exact-case code and updates progress; Copy shows live confirmation; Undo restores prior code/progress; keyboard Enter activates Skip, records skipped count and focuses next code heading; reload retains history and avoids prior cards. Cross-tab seen count updates without advancing the other tab's current card. Imported a local test history containing all 1,132 candidates: exhausted UI and zero remaining appeared. Confirmed reset returns to a new round, with cancel initially focused; cancellation leaves history intact. Official links inspected for exact code and official host; no redemption performed. Dark mode manually inspected. The tip strip is manually controlled, not animated.

Error, offline, checksum and blocked-storage behavior have unit coverage. Empty/maintenance/stale/loading UI are implemented but were not separately exercised in a full browser fixture matrix. No formal screen-reader or complete WCAG audit performed. No cold-offline PWA guarantee.

## Dependency audit

Initial critical advisories were in the old Vitest/Tinypool development dependencies; upgrading Vitest removed them. Final `npm audit` reports 11 moderate advisories in ESLint/typescript-eslint's dependency graph, originating in minimatch <11.0.1 (glob amplification denial of service). Latest lint tooling still pulls this range. No untested transitive major override or forced downgrade was applied. These are development-tool limitations; the app has no runtime lint/test tooling. Review patched compatible tooling before untrusted-file CI use.

## Scope

Phase 2 not started; Firebase, rules/emulator, privileged moderation/import, discovery Actions and deployment are deferred. All candidates remain unverified preview data, not approved published production codes. Submissions/reporting disabled. Cross-tab history is last-writer-wins and not a transactional database; simultaneous tab actions can lose annotations. LocalStorage and browser cache availability bound persistence/offline behavior.
