# Nusuk Community Codes Hub — Codex Implementation Brief

> Owner: abdallah-gaber | Target: `nusuk.abdallahgaber.dev` | Date: 2026-11-01
> Independent community utility, **not affiliated with Nusuk or Saudi authorities**.

## Mission
Build and deploy a production-quality, Arabic-first (Egypt-friendly), responsive, accessible public community web app for discovering and submitting Nusuk competition referral codes. Show a code → copy → next, remember previously shown codes locally and don't show them again on the same browser. Never imply a code has been verified in Nusuk; no official API for validation is known. Feature flags and graceful degradation for unexpectedly high traffic. No billing. No paid features.

## Crucial data-integrity guardrails
- Current season is `nov-2026`, and **1,132 community-sourced unverified candidate codes are supplied in this package**. Do not import historical codes as active.
- `data/historical_codes.csv` contains legacy codes from a February 2026 public article and is **research-only** (disabled by default). Do not publish historical codes without fresh in-app validation and season attribution.
- `current_season_codes.csv` now contains 1,132 distinct candidate codes including a separately submitted sample. See `NUSUK_APP_EVIDENCE.md` for confirmed app wording and limits of evidence. DO NOT fabricate entries to make the count reach 1000.
- Source pages may include misleading/inaccurate information. Actual contest dates, code format, daily limits, and validity must be checked in the current Nusuk app and official terms before describing them as facts.
- Preserve code **case**, trim whitespace and punctuation only; exact `NG-[A-Za-z0-9]{8}` is a *provisional* format derived from past samples, not an official guarantee. Do not uppercase/lowercase codes. Treat unknown formats as moderation pending.
- Site must disclose: independent project, not official; no guarantee of eligibility or validity; users redeem in official Nusuk only. Do not ask for Nusuk accounts, personal identity, passwords, phone numbers, passports or OTPs.

## Mandatory companion specs (read first)
- `DATA_IMPORT_RUNBOOK.md`: follow for all new CSVs, dedupe and idempotence.
- `UX_MVP_ADDITIONS.md`: implement official link opening, information ticker, trustworthy daily-limit copy, and fair browsing.
- `IMPORT_REPORT.json`: exact counts and caveats.

## Stack and deployment
- Vite + React + TypeScript + Tailwind CSS; minimal dependencies; RTL `lang="ar" dir="rtl"` as default, tasteful Arabic typography (system fallbacks). Mobile-first.
- Vercel Hobby hosts *static* SPA and immutable/hash-versioned JSON snapshot through its CDN. **Do not require Vercel Functions for normal visitor journeys.** All code browsing is local after one CDN request.
- Firebase Firestore **Spark** (without billing) as source of truth for admin-reviewed codes and user submissions. Use Firebase Web SDK only where appropriate; use a dedicated, least-privileged server credential for trusted administrative import/snapshot jobs. Do NOT put admin credentials in app or repository.
- GitHub Actions (scheduled every 48 hours, plus manual workflow_dispatch) does a modest, permitted public-source discovery job, normalizes, deduplicates, queues for manual review, and exports a compact, stable, public snapshot. Prefer creating a PR with generated `public/data/codes.json` and its `manifest.json` rather than pushing silently to main. Document that scheduled GitHub Actions may be delayed and do not guarantee exact timing. Source discovery must NOT use Vercel as a scraping backend; Vercel fair-use policy disallows scrapers.
- User submissions go to a separately permissioned Firestore collection (`submissions`), with App Check when feasible; enforce Firestore rules and reasonable server-side quotas. Client-only limits are merely UX controls and not security boundaries. Without a trusted rate-limited endpoint and reliable abuse mitigation, turn submissions **off by default** and provide a source-link submission via GitHub Issue form / moderator-controlled channel. Never allow anonymous direct writes into published `codes`.

## Firestore model / access
- `codes/{codeId}`: `{code, season, sourceUrl, sourcePublishedAt, discoveredAt, reviewedAt, status: 'pending'|'approved'|'rejected'|'expired', addedBy: 'import'|'moderator'|'community', normalizedLookup, lastValidationNote?}`. Use deterministic SHA256 of exact code+season for ID to deduplicate without case corruption.
- `submissions/{id}`: `{code, season, sourceUrl?, submittedAt, reviewStatus, abuseSignals?}` with tight security rules. Consider not enabling public writes in MVP. Never expose secrets/PII in the public snapshot.
- `config/public`: `{season, submissionsEnabled, updatedAt}`; public app should primarily read these from a CDN manifest rather than Firestore.
- Default Firestore rules: public cannot write `codes`, cannot read pending/unapproved entries or unreviewed submissions, and cannot write config. If public submission writes are implemented, require validated auth/App Check and carefully designed rules, with bounded lengths and restrictive schema. Add unit tests for rules using emulator.
- Never rely on Firebase API key secrecy; Firebase web config is public by design. Only credentials with administrative access are secrets.

## High traffic and cost control: hard requirements
1. Normal visitors read `public/data/manifest.json`, then `codes.<hash>.json` over Vercel CDN, never query Firestore for individual Next clicks. `manifest.json` caches briefly (e.g. 5-15 minutes), versioned data caches immutable for a year. Snapshot can be regenerated periodically and on moderation.
2. Manifest includes `{schemaVersion, season, generatedAt, codeCount, snapshotUrl, snapshotSha256, readOnly, submissionsEnabled}`. Never return a stale snapshot with incorrect season silently.
3. IndexedDB or localStorage history scoped by `(season, code)` using robust serialization. Show copy/next, skip, mark tried, reset history with explicit confirmation; define behavior when all codes are exhausted. Protect against localStorage full/unavailable and cross-tab sync where feasible. No account sync or guarantee across devices.
4. Cache last known-good snapshot in IndexedDB (preferred) / service-worker cache. On CDN failure: load previously cached verified snapshot; if nothing cached, show friendly retry + link to official Nusuk app. A network failure must not erase history.
5. No unnecessary per-user online writes. Avoid realtime listeners, analytics-heavy services, image-heavy assets, third-party trackers. Lazy load optional interface. Cap snapshot size (e.g. 100–250 KB compressed for small-medium datasets; measure actual) and split into chunks if needed.
6. Submission form: limit to e.g. 3 per 24h *as client UX only*, implement real server-side throttling or disable submission when no secure low-cost implementation. Disallow bulk automated submissions, links to phishing, unsafe input. Rate limits on static browsing are usually unnecessary and would worsen DX / introduce server cost.
7. No Blaze upgrade, no credit-card connection, no Google Cloud paid services, no Cloud Functions, no Firestore TTL/PITR/managed backups. Clearly document Firestore Spark service can shut off at quota; fallback static snapshot stays accessible as long as Vercel quota remains available. Vercel Hobby also has caps/fair use; **zero cost does not mean guaranteed uptime**.
8. Provide operational emergency mode: flip a checked-in manifest flag to disable submissions, pause discovery, show read-only service; revert to last-good snapshot by redeploying. Add status and maintenance copy.
9. Daily usage/cost dashboard: document manual Firebase usage & quota dashboard and Vercel usage. Avoid over-promising monitoring with no server-side budget.
10. Load tests only against local server or infrastructure you own/are authorized to test; never stress a production third-party service.

## UI/UX design
- Elegant and credible, inspired by contemporary Islamic geometric geometry with *subtle* ornamental accents (not tacky). Cream/off-white + deep emerald + muted gold, dark mode using system preference and manual override. No fake official badges, official ministry logos or misleading branding.
- Top hero: `مفاتيح نسك` and subheading `مساحة مجتمعية لتبادل أكواد المسابقة` plus season status and last updated timestamp.
- Core hero card: oversized readable, selectable LTR code (dir=ltr), large accessible Copy CTA, clearly visible Next and Skip; a gentle interaction feedback with no intrusive confetti. Show `remaining / seen` locally.
- Below: horizontally scrollable tips strip per `UX_MVP_ADDITIONS.md`, the official deep link action on each code card, how-to-use in 3 succinct steps; source transparency; community submission (if enabled); short FAQs; official app CTA; disclaimer footer.
- Skeleton loading, empty state (`لا توجد أكواد مؤكدة للموسم الحالي بعد`), exhausted state, offline state, sync banner, graceful errors.
- Responsive 320px–desktop, touch targets >=44px, WCAG AA contrast, full keyboard usage, screen-reader aria-live for copy status, reduced-motion support. Honor RTL except code itself. Avoid heavy images; use CSS/SVG decoration.
- No dark-pattern referral boosting or implying the maintainer has higher priority. Consider shuffle with deterministic per-browser seed to spread exposure fairly (not a biased rotation).

## Discovery/import and moderation
- Build `scripts/ingest_sources.py` (or TS equivalent) that takes a *curated* list of legitimate publicly accessible URLs, requests each with sensible rate limits, checks robots/terms and access limits, extracts provisional code tokens, records URL, discovery timestamp and original season context. Never bypass auth, private groups, CAPTCHAs, anti-bot mechanisms; never request credentials/cookies from contributors. Prefer manual paste/share of public post URLs.
- Avoid giving the impression that the system covers all Facebook posts. Many Facebook comments/group contents are not accessible unauthenticated; mark such sources `unavailable`.
- A human moderator explicitly approves new `nov-2026` entries before publishing (or require strong published-date + human review). Strict dedupe, reject older seasons unless valid in current app has been demonstrated.
- Every displayed code should be traceable to at least one provenance record in private admin dataset; public UI may show domain and discovered date only if useful/privacy-conscious.
- `scripts/validate_codes.py` for syntax + duplicate + season + source checks, **not actual redemption validation**. Make JSON and CSV import/export with a clear `status` field.
- Provide `scripts/build_snapshot.py` (offline test mode with CSV fixtures; live mode via secure service account) producing atomic snapshot + manifest with checksums, timestamps, correct season, predictable deterministic order.

## Suggested phases and non-negotiable acceptance gates
**Phase 1: Static UX** — Production-quality responsive site, all states, zero Firebase calls, fixture-driven data and tests; verify 320px/desktop, RTL, keyboard and persistence. No fake active codes.
**Phase 2: Firestore** — Configure Firebase project and security rules, emulator tests, reviewed-only publication, safe seed/snapshot pipeline; verify browser never has admin credentials; default deny writes.
**Phase 3: Public deployment** — Vercel GitHub auto deploy, custom subdomain, preview deployments, DNS and HTTPS instructions, document rollback.
**Phase 4: Collection** — Curated public source ingestion; source-level provenance, pending review process, GitHub Actions scheduled 48h and manual dispatch, no automated mass Facebook scraping, import CSV with review.
**Phase 5: Hardening** — Cache fallback, offline experience, read-only kill switch, edge cases, bundle measurements, accessibility audit, emergency runbook, simulated rate/quota exhaustion.

## Deliverables in repo
`README.md`, `SETUP_OWNER.md`, `ARCHITECTURE.md`, `OPERATIONS.md`, `DATA_PROVENANCE.md`, `.env.example`, working app, tests, Firestore rules + tests, scripts for CSV import/review/snapshot, Actions workflow, example snapshot, and `public/robots.txt` / metadata. No secrets committed.

## Owner manual setup to document clearly
1. Create GitHub `abdallah-gaber/nusuk-codes` (public) and clone locally; apply this brief.
2. Firebase Console → new project `nusuk-codes` → stay on Spark, no billing account; Firestore Database in Standard mode, region chosen once (e.g. europe-west1 if available), Production mode; register Web App and copy web config to Vercel project env only if web SDK required; GitHub Action secret/service account *only if trusted admin automation is needed*. Never post private JSON key in chat or commit it.
3. Vercel → Import GitHub repo → build command `npm run build`, output `dist` → add domain `nusuk.abdallahgaber.dev` → apply exact CNAME or DNS value shown by Vercel at your DNS provider; wait for verification + TLS. Verify existing apex/www site still works.
4. Configure GitHub Actions secrets after implementing least privilege; enable read-only default until current-season codes are verified.
5. After first deploy test anonymous mobile, desktop, repeated visits, cross tabs, CDN fallback, quota-denied scenario.

## References (recheck before release)
- Firestore Standard free-tier: https://firebase.google.com/docs/firestore/quotas
- Spark / billing hard-stop: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Vercel limits: https://vercel.com/docs/limits
- Vercel fair use: https://vercel.com/docs/limits/fair-use-guidelines
- Historical example (NOT current-season data): https://authenticseerah.com/2026/02/20/nusuk-free-umrah-keys/
- Other historic aggregator: https://goodnews.com.pk/nusuk-free-umrah-challenge/

## Codex first task
Implement Phase 1 completely, run lint/typecheck/tests/build and provide proof (screenshots of desktop/mobile, test logs) before moving to Phase 2. Do not equate correct code syntax with Nusuk redemption. Import candidate data as pending, then allow deliberate moderator batch review for publication as clearly labeled unverified community codes; never claim official verification. Avoid asking owner to configure Firebase/DNS until relevant phase is actually ready.


## Evidence update – 2026-11-01
Read `NUSUK_APP_EVIDENCE.md` before implementation. It takes precedence over previous provisional assumptions about app wording, referral links, and limits.
