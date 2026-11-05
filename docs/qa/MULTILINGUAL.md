# Arabic, English and Indonesian

## Implementation

The app uses 177 typed dictionary entries per language in `src/locales/`, with no new dependencies. Add keys to Arabic and both translated dictionaries together. TypeScript and tests enforce complete keys and matching interpolation fields. UI labels, notices, errors, FAQ, provenance, disclaimers, official links, creator support and metadata use these dictionaries. Code values and source identifiers remain unchanged.

The language provider updates the existing component tree. Switching language preserves the current code, history, Undo, search query/filter/pagination, expanded FAQ and scroll position. Dates and numbers follow the selected locale. Arabic uses RTL; English and Indonesian use LTR. Codes remain LTR. Next/ticker arrows and ticker keyboard navigation follow the reading direction.

Preference order is explicit URL, saved choice, browser language preferences, then Arabic. The header selector stores only ar/en/id under `nusuk:language:v1`, separate from browsing history. A direct language URL is also an explicit preference. Storage failures retain the session choice, and a language URL still determines refresh behavior. History remains shared across all three routes with its existing schema, key and season.

The root entry remains compatible with existing query strings and anchors and resolves its client URL to the chosen language without reloading. Sharing the site uses that language URL without adding a referral code.

## Static pages and hosting

The Vite plugin emits `/ar/index.html`, `/en/index.html` and `/id/index.html` with translated titles, descriptions, noscript explanations, self-canonical URLs, reciprocal hreflang links and localized WebSite metadata. Root HTML defaults to Arabic metadata and canonical `/ar/`; x-default points to `/`. The sitemap lists the three canonical language routes.

Six narrowly scoped Vercel rewrites cover the language URLs with and without trailing slashes. Existing CDN headers are preserved. Local preview uses the same path mapping so slashless requests do not fall through to Arabic HTML. Assets and snapshot requests retain their absolute root paths.

## Validation on November 5, 2026

- All 72 frontend tests, lint, typecheck and production build passed. All 50 earlier tests remain passing.
- New tests cover dictionary completeness, interpolation, critical English/Indonesian disclaimers, detection, preference storage failures, path/anchor preservation, direction, dates, safe links and static localized metadata.
- Built local HTTP checks returned 200 with the correct language, direction, canonical and four alternate links for all six language URL forms, without running JavaScript.
- Browser automation checked all three languages in light/dark themes at 1280px and 320px, giving 12 passing layout assertions. Three additional expanded-search checks at 320px retained the Unseen filter and 48 loaded results across languages without overflow or a seen-count change. At 320px, document scroll width matched its available 305px content width after the desktop browser scrollbar.
- Switching Arabic → English → Indonesian preserved the code, seen count and search query. A settled scroll position remained unchanged on switching. Undo remained available and restored the earlier code and count.
- Indonesian survived refresh and root navigation via the saved preference. Expanded FAQ content stayed open across a switch. English and Arabic tabs synchronized Next/Undo while retaining their own languages.
- Snapshot files, checksum, history logic/schema, admin tools, dependencies and external referral destinations are unchanged. Core errors gained translation keys while preserving their existing default messages.

The shared JavaScript bundle measured 288.13 kB raw / 90.27 kB gzip, about 9.86 kB gzip above the previous build. Switching languages makes no translation requests or feed reloads.

## Screenshots

| Language | Desktop light | 320px dark |
| --- | --- | --- |
| Arabic | [Desktop](i18n/ar-desktop.jpg) | [Mobile](i18n/ar-mobile-320.jpg) |
| English | [Desktop](i18n/en-desktop.jpg) | [Mobile](i18n/en-mobile-320.jpg) |
| Bahasa Indonesia | [Desktop](i18n/id-desktop.jpg) | [Mobile](i18n/id-mobile-320.jpg) |

## Remaining checks

Actual Vercel routing and live crawler responses need verification after a separately approved deployment. Detailed app content still requires JavaScript. The existing social image retains Arabic artwork, with translated descriptions and accurate localized alt text. Indonesian copy has not received an independent native-speaker review.

Responsive assertions were executed through browser automation during this task. They do not add a browser runner to CI. No merge, deployment, Firestore operation or production data change was performed.
