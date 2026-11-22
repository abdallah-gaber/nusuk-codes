# Task-first UX audit

## Baseline

Chrome captures show the checked-out main revision `1644b89` built in production mode and served privately at the canonical origin. External requests were blocked. The English locale uses the existing published snapshot, with a dummy GA ID to show the undecided consent state. Each capture starts at the top with no interaction. The comparison state uses a saved Decline choice.

| Viewport | Consent shown | Consent declined | Card starts | Copy and Next with consent | Copy and Next after decline |
| --- | --- | --- | ---: | --- | --- |
| 320 × 568 | [Before](qa/task-first/before-320-consent.jpg) | [Before](qa/task-first/before-320-declined.jpg) | 607 px | Neither | Neither |
| 360 × 640 | [Before](qa/task-first/before-360-consent.jpg) | [Before](qa/task-first/before-360-declined.jpg) | 607 px | Neither | Neither |
| 390 × 844 | [Before](qa/task-first/before-390-consent.jpg) | [Before](qa/task-first/before-390-declined.jpg) | 532 px | Neither | Copy only |
| 412 × 915 | [Before](qa/task-first/before-412-consent.jpg) | [Before](qa/task-first/before-412-declined.jpg) | 532 px | Neither | Both |
| 1280 × 900 | [Before](qa/task-first/before-1280-consent.jpg) | [Before](qa/task-first/before-1280-declined.jpg) | 371 px | Both | Both |

The title, tagline and header controls occupy 133–189 px on mobile. The season bar, official-app introduction and carousel take another 399–418 px before the code card. The fixed consent banner consumes the last 167–188 px of the mobile viewport and can overlap the code and its actions. Progress presents multiple counts and disclosures before Search Codes. Help is spread across the carousel, app introduction, card and FAQ.

The GA4 call sites already report manual page views and ten interaction events. Clipboard success is tracked correctly. Website share currently fires on intent and can include cancellation, false attribution on fallback, and unobservable WhatsApp delivery. See the [current event catalog](GROWTH_AND_ANALYTICS.md#ga4-event-catalog).

## Proposed hierarchy

1. Compact brand, language selector, theme control and Privacy link.
2. Code browser with an unverified label, selectable code, Copy and Next side by side, then Tried, Skip, Undo and Open Nusuk.
3. Compact progress summary and Search Codes. Expand either to reveal its existing controls.
4. Inline analytics consent with equally weighted choices. It occupies its own space in the page flow.
5. Optional How to use help, season and source information, FAQ, website sharing, creator support and full privacy preferences.

## Implementation plan

- Reorder and simplify the existing components. Replace carousel content with static, expandable usage guidance and keep disclosures near their relevant actions.
- Keep the feed and history logic intact. Retain the four static localized routes, SEO metadata and navigation.
- Add an impression for the visible code and primary actions and a bounded event for opening search, progress or help. Count native/clipboard sharing only after the relevant API resolves. Keep the WhatsApp link available.
- Repeat the viewport captures and check all four locales, 200% text, keyboard traversal, consent, history flows and analytics in an isolated browser.

## After

| Viewport | Consent shown | Consent declined | Card starts | Copy and Next end by |
| --- | --- | --- | ---: | ---: |
| 320 × 568 | [After](qa/task-first/after-320-consent.jpg) · [Scrolled to prompt](qa/task-first/after-320-consent-in-flow.jpg) | [After](qa/task-first/after-320-declined.jpg) | 117 px | 275 px |
| 360 × 640 | [After](qa/task-first/after-360-consent.jpg) | [After](qa/task-first/after-360-declined.jpg) | 117 px | 278 px |
| 390 × 844 | [After](qa/task-first/after-390-consent.jpg) | [After](qa/task-first/after-390-declined.jpg) | 117 px | 282 px |
| 412 × 915 | [After](qa/task-first/after-412-consent.jpg) | [After](qa/task-first/after-412-declined.jpg) | 117 px | 285 px |
| 1280 × 900 | [After](qa/task-first/after-1280-consent.jpg) | [After](qa/task-first/after-1280-declined.jpg) | 72 px | 265 px |

The code and both primary actions are visible and hit-testable on load in all ten English captures. At 320 px, the undecided prompt starts below the first viewport. [200% text at 320 × 568](qa/task-first/after-320-large-text.jpg) · [Consent at 200% text](qa/task-first/after-320-large-text-consent.jpg).

## Verification

- Passed 139 frontend tests, 52 admin regression tests and 8 local demo emulator tests. Frontend and admin lint, TypeScript typecheck and the production build passed.
- Chrome checked 40 locale, theme and viewport combinations with consent present. It also checked all four locales at 320 × 568 with 200% root text, including keyboard access to both consent choices and no horizontal scrolling.
- Keyboard checks covered the skip link, primary actions, privacy access, consent and reset dialog. Browser interactions covered Copy, Next and reload, Tried, Skip, Undo, Open Nusuk destination, local search, history export/import/reset, consent persistence and cross-tab withdrawal.
- Axe reported zero violations across the four locales in light and dark with the search, progress, help and privacy panels expanded. Physical devices and screen readers were outside this test environment.
- The [GA4 event matrix](GROWTH_AND_ANALYTICS.md#ga4-event-catalog) describes the full catalog. Isolated Chrome tested consent gating, visibility and locale deduplication, disclosure opens, pending/canceled/failed share and successful fallback, and the custom event payloads. The Google tag was blocked and a test ID was used, so the results verify the site's commands. GA4 ingestion and reporting remain unverified for this revision.
- All localized static HTML and metadata checks passed. The built manifest and 12,181-code snapshot match the baseline byte for byte. The application history format, admin and publication workflows were preserved.
- The dedicated review branch opts out of automatic Vercel deployment. Existing deployment rules still apply to other branches.

Run the browser checks from the repository root with installed Chrome, Playwright and optionally axe-core. This serves the production-shaped build inside the browser with external requests blocked.

```sh
VITE_GA_MEASUREMENT_ID=G-CONSENTQA VITE_GA_MANUAL_EVENTS_ONLY=true VERCEL_ENV=production \
  npm run build -- --outDir /tmp/nusuk-consent-qa-build --emptyOutDir
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  AXE_QA_MODULE=/absolute/path/to/axe-core/axe.min.js \
  node scripts/qa_consent.mjs
```

[Browser QA report](qa/task-first/browser-qa.json)
