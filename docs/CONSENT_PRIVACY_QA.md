# Final consent UX and privacy QA

November 18, 2026. This PR adds the banner; it does not deploy it. Production observations below use the deployed PR #23 implementation. The owner separately confirmed receipt in GA Realtime; this investigation observes browser requests, not private GA reports.

## Implementation

- A small bottom banner appears only when analytics is eligible and no valid consent choice exists. Its two equally styled buttons are Accept and Decline, with no preselection, modal, backdrop or focus trap. Browsing works without a decision.
- The banner and existing inline preferences use the same state, AnalyticsClient, consent key and choice handler. The header Privacy link remains. Either choice immediately removes the banner; full preferences can still change it.
- All four locales include the short explanation and buttons (190 translation keys each). Arabic/Urdu remain RTL; codes remain exact-case LTR.
- ResizeObserver measures the real banner height, including its bottom/safe-area offset. Matching body padding, scroll padding/margins and raised notices keep focused controls reachable above it. Window resizing/language changes also update spacing. There is no entrance animation or automatic focus movement.
- The existing nusuk:analytics-consent:v1 granted/denied values remain unchanged. localStorage is preferred for writes; sessionStorage is the fallback. A fallback represents a newer choice and takes read precedence until a primary write succeeds, so an old accepted value cannot undo a session-only withdrawal after a failed write. With both blocked, a mounted page keeps its choice in memory and prompts again after reload. No history schema changes.
- Native storage events synchronize normal tabs. A same-origin BroadcastChannel also synchronizes choices when localStorage is unavailable, with no rebroadcast loop. Only granted/denied values are shared, never codes, history or identifiers. If both cross-tab mechanisms are unavailable, isolated tabs cannot synchronize; they still default to no Google tracking until an explicit choice.
- Strict Mode cleanup removes listeners, closes the channel and releases reserved spacing. AnalyticsClient still deduplicates scripts, config and page views.

## Observed production network behavior

Test environment: isolated headless Google Chrome with fresh browser contexts and no extensions. These were real HTTPS visits to production and real Google requests; no production code or dashboard was changed. Separate local UI tests explicitly block Google script loading and are not counted as network-ingestion evidence.

| Scenario | Observation |
| --- | --- |
| Fresh visitor | 0 Google tag requests and 0 GA collection requests during the observation window |
| Decline, then Next | 0 Google tag/collection requests |
| Accept | One tag request; collection to www.google-analytics.com/g/collect received HTTP 204 |
| Next / language change | Observed next_code, language_change and manual page_view, including batched requests |
| Regrant after withdrawal | One new manual page_view; copy_code subsequently observed; one script element and one config command in that document |
| Accepted consent in another tab | Its own page view is expected; it is a separate document, not duplicate initialization |
| Withdrawal, after earlier batch drained | 0 new manual commands after subsequent Next/language change; opt-out true; no further collection in that settled observation |
| Cross-tab withdrawal | Other tab's opt-out flag became true; subsequent Next generated 0 new manual commands |
| Delayed Google response | Held the fetched script response (HTTP 200), withdrew, then released it; 0 observed collection requests and Next still advanced |
| Sensitive query/search probe | Harmless synthetic markers in email/code/search query parameters and the local search field were absent from observed collection URLs/bodies; page_location was the clean /en/ canonical |

The copied code was not present in the observed copy event request. No real email address or private history was used as test input. Raw requests, GA client/session IDs and cookie values are not committed; the [sanitized summary](qa/consent/privacy-network-summary.json) contains counts, event names, canonical URLs and pass/fail observations only.

**Important observed limitation:** a short-interval test withdrew while accepted events were still buffered inside Google's loaded SDK. A later request contained the already-queued next_code, language_change and page_view even with the opt-out flag true. The application's manual command count did not increase after withdrawal. A settled-queue test produced no subsequent collection. Therefore we do not claim that withdrawal cancels every later network transmission: already-consented buffered batches and in-flight requests may finish. No new application events are generated after withdrawal.

We retained Google's opt-out flag and immediate application event gating. We did not add a denied-consent update that could introduce cookieless pings, monkey-patch browser networking, remove consent safeguards or claim old traffic can be recalled.

The user-facing optional choice is Google-specific. Existing Vercel Analytics is separate; “no Google requests” does not mean the website makes no network requests.

## Local browser and automated checks

The new banner was tested as a locally built production artifact, privately fulfilled at the canonical origin inside an isolated browser. Nothing was hosted or deployed. Google traffic was blocked in these UI tests, so acceptance tests there validate real React/storage behavior and command setup, not vendor delivery.

- 40 layout combinations: ar/en/id/ur × light/dark × 320/360/390/412/1280px. No horizontal overflow; equally wide buttons with at least 44px height.
- Native focus checks for Copy, Next, Skip, Tried and Open Nusuk placed each control within the viewport and above the banner.
- Accept/Decline hide the prompt; accepted/declined reloads keep it hidden; initial consent does not change the current code. Blocked-script browsing still advances normally.
- A saved accepted document creates one Google script/config command. Cross-tab withdrawal and explicit preference reset update the other tab.
- Blocked localStorage: session reload persistence and BroadcastChannel withdrawal worked. Both stores blocked: the choice remains through language changes, with a new prompt only after a reload loses the memory preference.
- Preview build with a valid-format test ID: no Google requests/banner. localhost production build: no Google requests/banner. Development exclusion is additionally covered by automated AnalyticsClient environment tests.
- Unit/protocol tests cover translated markup, equally prominent choices, existing consent values, fallback persistence, reset/storage event parsing, the real Arguments-based transport, opt-in/withdrawal/delayed processing, payload sanitization and existing browsing/history behavior.

Screenshots are actual local-build Chrome captures at 390 × 844, not production or generated mockups:

| English | Arabic | Urdu | Indonesian |
| --- | --- | --- | --- |
| [Mobile](qa/consent/en-mobile.jpg) | [Mobile](qa/consent/ar-mobile.jpg) | [Mobile](qa/consent/ur-mobile.jpg) | [Mobile](qa/consent/id-mobile.jpg) |

[Browser UI evidence](qa/consent/browser-ui-qa.json) includes per-viewport measurements.

## Performance and accessibility

Local mobile Lighthouse with the new banner visible: Performance 100, Accessibility 100, Best Practices 96, SEO 100. FCP/LCP 1.1s, TBT 50ms, CLS 0, Speed Index 1.6s. Best Practices lost points because the private interception fixture returned 404 for the Vercel insights script; this is not an observed production failure. Chrome test flags also disabled back/forward cache. These lab numbers use local artifact fulfillment, exclude post-consent Google work and are not production field metrics or a directly comparable network benchmark.

No application dependencies, server functions or paid services were added. Playwright was used ephemerally as test tooling with the installed Chrome browser; it is not a runtime dependency. Dataset, snapshots, Firestore/admin code, quotas and publication safeguards are untouched.

## Reproduce the offline browser regression checks

The runner uses installed Chrome and a Playwright module. It privately intercepts app requests and aborts Google requests; it does not deploy or perform production imports.

    VITE_GA_MEASUREMENT_ID=G-CONSENTQA VITE_GA_MANUAL_EVENTS_ONLY=true VERCEL_ENV=production npm run build -- --outDir /tmp/nusuk-consent-qa-build
    PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/qa_consent.mjs

The public dummy ID is only for the isolated artifact. Never deploy that test build. Use a temporary output directory and keep the normal build/env configuration unchanged. To use a differently configured QA artifact, set CONSENT_QA_BUILD and CONSENT_QA_ID. CONSENT_QA_OUTPUT changes the evidence output directory. The module can be obtained through an ephemeral npm Playwright installation without adding it to package.json.

## Remaining limits and owner checks

- Standard GA first_visit, session_start, user_engagement and SDK technical/session parameters can still exist after consent with Enhanced Measurement off. Our custom-event allowlist is not a filter for every vendor-generated request. Host/session cookie settings do not eliminate Google identifiers or control browser session restoration.
- Withdrawal clears host _ga cookies and stops new application events, but does not unload Google's JavaScript or recall buffered/in-flight traffic. The batch behavior above is real evidence of that boundary. Account retention, access and deletion controls remain owner-managed.
- No physical Android/iOS, Instagram/Facebook in-app browser, on-screen keyboard or real screen reader validation is claimed. Viewport emulation and reduced-motion testing do not replace those checks.
- Existing Realtime confirmation is owner-supplied. HTTP 204 confirms transport handling, not event processing, report filters or retention in a particular GA property.
- After reviewing and approving a release, repeat a fresh/declined/accepted visit with the new production banner, keyboard/large-text/safe-area checks on phones, and cross-tab withdrawal/regrant. Inspect batched requests and their generation timing rather than treating every request arriving later as a newly generated event.
- Keep Enhanced Measurement, Google Signals and ad personalization disabled. Keep current production-only ID/manual-events settings. No dashboard, billing, Firebase or credential change is required for this banner.

The unchanged 11,779-code snapshot checksum is a683aba328ce34d50ee124a1a5d7f8121de0bdddd47252d675dafb6956686373. All 138 frontend tests and 52 existing admin tests passed, along with frontend/admin lint, typecheck and production build. Admin/emulator integration was not changed; no production Firestore operations occurred. The normal main bundle is approximately 99.5 kB gzip (about 0.8 kB above the transport-fix build); CSS is approximately 6.0 kB gzip. Do not merge or deploy automatically.
