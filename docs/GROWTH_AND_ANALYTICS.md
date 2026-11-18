# Growth, localization and analytics

Implementation and local QA: November 18, 2026. No account configuration, production data updates, merge or production deployment is part of this change.

## Baseline and rationale

The owner supplied these Vercel Analytics figures; this work did not access the account dashboard:

| Window | Visitors | Views | Bounce | Route visitors |
| --- | ---: | ---: | ---: | --- |
| 30 days | 597 | 1,149 | 64% | English 531; root 59; Arabic 12; Indonesian 2 |
| 7 days | 448 (+185%) | 857 (+166%) | 63% | English 437; Arabic 9 |

Recent daily traffic: about 60–70 visitors. Country shares: Pakistan 36%, India 19%, Bangladesh 12%, Indonesia 7%, Sri Lanka 6%, other 20%. Devices: mobile 92%, desktop 7%, tablet 1%. OS: Android 69%, iOS 24%, Windows 5%, Linux 2%. Google Android Search app contributed 39 visitors over 30 days, including 38 in the last seven days; Facebook variants also appear.

These support prioritizing mobile, Urdu, search discovery and interaction measurement. Direct/unattributed traffic is not automatically organic. Route visitor counts overlap and should not be summed as unique people. Page views, copies, attempts and outbound opens do not prove redemption.

The pre-change source already supported Arabic, English and Indonesian, localized metadata/routes, sitemap/robots, safe official and creator links, light/dark modes, local history/search, sharing and Vercel Analytics. The production English page loaded 11,775 codes, but its initial HTML contained an empty React root. The existing snapshot-age warning correctly reflected the November 5 snapshot; it was not removed.

Baseline: 72 frontend tests, lint, typecheck and production build passed. Main JS: 288.13 kB raw / 90.27 kB gzip.

## Implemented changes

- Added complete typed Urdu translations, route, metadata, selector and RTL typography.
- Added visible translated pre-JavaScript introduction, instructions, independence and unverified-code disclosures.
- Added optional, production-only GA4 with explicit consent, withdrawal and cross-tab consent synchronization.
- Instrumented existing user actions with bounded, typed event payloads; retained Vercel page analytics.
- Added localized WhatsApp sharing, production URL sharing and an allowlist of campaign parameters.
- Improved muted light-theme contrast and the theme button's accessible name. New controls have at least 44px targets and wrap on mobile.

No new dependencies, server functions, public Firestore access or history format changes. Dataset entries/order, seeded browsing, current-code persistence, progress, Undo and creator code/destinations are preserved.

## SEO architecture

The Vite build writes static HTML for /ar/, /en/, /id/ and /ur/, including unique translated titles/descriptions, self-canonicals, lang/dir, social metadata, reciprocal hreflang and x-default pointing to /. The root retains Arabic static fallback and existing browser-language resolution. Explicit locale routes take precedence and are not country-redirected.

The build inserts a semantic visible introduction into the React root, with purpose, three instructions, official link, community disclaimer and native-language links. React replaces it with the interactive tool; this is not full SSR of the dataset. Instructions and disclaimers remain available without JavaScript, while browsing requires JavaScript. Static generation neither reads Firestore nor processes the snapshot.

Sitemap lists the four production locale canonicals. Robots permits crawling and references the production sitemap. Existing WebSite structured data and branded social image are reused; no official-service, review, reward or verified-code schema is added. Query strings and fragments never enter canonicals.

VERCEL_ENV=preview builds add noindex, nofollow to root and locale HTML, retain production canonicals, and disable both analytics providers. Do not rely on robots blocking to prevent indexing: crawlers must see noindex. Vercel preview authentication remains an optional owner setting, not changed here. Old preview deployments must be rebuilt or protected separately.

## Languages and further localization

All four dictionaries have 187 matching keys and matching placeholders. Arabic and Urdu are RTL; English and Indonesian are LTR. Codes remain LTR with exact case. Numbers and dates use the locale, while code values and source identifiers are never translated.

Resolution remains explicit URL → saved language → supported browser language → Arabic. No IP/country lookup, forced Urdu, suggestion popup or second history format. Existing local language persistence and scroll restoration remain.

Urdu is a complete authored translation, not native-speaker certified. Owner/native speakers should review Urdu phrasing, typography on target Android/iOS devices and cultural tone before promotion. Indonesian was checked for key coverage and the unverified/no-guarantee/optional-support meanings; native-speaker copy review remains recommended. Fonts use available system Naskh/Nastaliq/Tahoma/Arial fallbacks without downloading font files.

Bengali and Hindi are deliberately not selectable/indexable. To release either: add a complete dictionary satisfying TranslationKey, extend the language/name/Intl locale/metadata registries, add Vercel locale rewrites and sitemap entries, then run completeness/placeholder/routing/metadata/RTL-or-LTR tests and native review. The path parser and build generator derive supported routes from the typed registry; no incomplete dictionary falls back silently.

## GA4 event catalog

All events require eligible production configuration and granted consent.

| Event | Trigger and meaning | Parameters beyond locale |
| --- | --- | --- |
| copy_code | Clipboard write resolves successfully; browser/search/creator | source |
| next_code | Next selects another unseen code | — |
| skip_code | User records Skipped | — |
| mark_tried | User records Tried; not redemption | — |
| undo_tried | Undo reverses a Tried action in the current session | — |
| open_nusuk | Click on official, current-code or creator invitation link; not proof the app opened | source |
| language_change | Manual selector change, not automatic detection/back navigation | previous_locale |
| share_website | User initiates native/copy/WhatsApp sharing; includes canceled native sheets | share_method |
| history_export | Valid history serialized and browser download initiated; saving cannot be observed | — |
| history_import | History parses successfully and is accepted for local merging | — |

Allowed locale values: ar, en, id, ur. Sources: browser, search, creator, intro, footer, error, empty; copy_code accepts only browser/search/creator. Search has no outbound-link action. Share methods: native, clipboard, whatsapp. Native failures may fall back to clipboard; the event describes the initial method, not confirmed delivery.

The runtime drops unknown payload properties and rejects invalid enum values/events. No code, clipboard data, history contents, seed, user ID, name, email, phone, filename or arbitrary action text is sent. History import/export events contain no record counts or data.

page_view is manual: send_page_view=false, one event per active locale transition, deduplicated across repeated effects. Canonical page_location omits all query/hash data; page_title is translated. Referrer is origin-only. Back/forward locale transitions are handled. Repeated calls for the same locale are suppressed; a real reload or consent regrant starts a new page view.

## Public environment variables

| Variable | Setup |
| --- | --- |
| VITE_GA_MEASUREMENT_ID | Public GA4 web-stream ID of the form G-…; production scope only |
| VITE_GA_MANUAL_EVENTS_ONLY | Set exactly true only after disabling the stream's entire Enhanced Measurement feature |
| VITE_DEPLOYMENT_ENV | Derived at build time from Vercel VERCEL_ENV; do not configure by hand |

Without a valid ID and the explicit manual-events acknowledgment, no Google tag is loaded and no Google commands are queued. Development, noncanonical hosts and Vercel previews never track. The public ID is not a credential; never place service accounts or other secrets in VITE_ variables. No credentials are added to CI.

Existing Vercel Analytics remains separate, canonical-production-only, without the optional GA consent requirement. Its page URL is reduced to the production locale canonical before sending. Disclosures explain the providers separately.

## Google Search Console: owner setup

1. Sign in to Search Console with the intended owner Google account.
2. Prefer a Domain property for abdallahgaber.dev, if you control the whole domain. It includes nusuk.abdallahgaber.dev. Obtain Google's actual verification TXT token.
3. In Cloudflare DNS, add that token as the requested root-domain TXT record. Keep existing A/CNAME/MX/TXT records, proxy and SSL settings intact. Do not place a conflicting TXT at a CNAME-backed subdomain. This task did not make DNS changes.
4. Verify ownership, then submit https://nusuk.abdallahgaber.dev/sitemap.xml.
5. After an approved production release, inspect the live /ar/, /en/, /id/ and /ur/ URLs. Confirm rendering, chosen canonical, indexability, mobile usability and sitemap discovery. Request indexing once where useful; do not repeatedly submit identical URLs.

If root-domain ownership is inappropriate, use a URL-prefix property for https://nusuk.abdallahgaber.dev/ and follow its supported verification method. An HTML file/meta token would need a separate owner-provided token and reviewed change; none is fabricated here.

See [Google localized-version guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

## GA4: owner setup and validation

1. Create/use a standard free GA4 property and web stream for https://nusuk.abdallahgaber.dev. Do not enable paid Analytics 360, BigQuery billing integrations or Google Signals.
2. Disable the web stream's entire Enhanced Measurement feature, including automatic page/history changes, scroll, outbound clicks, form and download collection. This is essential: automatic outbound URLs could otherwise include Nusuk codes, and automatic page views could duplicate ours.
3. Set the public measurement ID and VITE_GA_MANUAL_EVENTS_ONLY=true in Vercel's Production environment only. Do not activate these until the repository change and release are approved.
4. After release, first decline: confirm no googletagmanager.com tag request. Use the visible “Analytics and privacy” header link (including mobile) to open the inline preferences near the footer. Grant there: confirm one tag load, one page_view, canonical page_location and no code/query/hash values in collected parameters. Switch language once and verify one additional page view.
5. Use GA Realtime to inspect the ten events during deliberate interactions. For DebugView, use Google's supported Tag Assistant/Analytics debugging tooling on the owner test session; the app does not enable debug_mode for every visitor. Remove debugging afterward and exclude developer/internal traffic.
6. Test all three copy sources, Next, Tried → Undo, Skip, official/invitation links, manual language change, share initiation and valid history import/export. Inspect requests and page context, not just event names. Reject invalid imports and verify no import event.
7. Withdraw consent, check the opt-out flag, cookie removal and absence of subsequent manual events; test cross-tab withdrawal. Repeat with storage blocked, a tag blocker and Facebook/in-app browsers. Regrant should not reload a second tag or double-send page_view.
8. Register event-scoped custom dimensions locale, previous_locale, source and share_method if needed. Recommend copy_code and open_nusuk as optional key events: they measure successful clipboard writes and outbound intent, never keys/rewards/redemption.

Use [manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views), [consent guidance](https://developers.google.com/tag-platform/security/guides/consent), [cookie controls](https://developers.google.com/tag-platform/security/guides/customize-cookies) and [privacy controls](https://developers.google.com/tag-platform/security/guides/privacy). Realtime/DebugView verification with a real property is an owner follow-up, not a completed test.

## Privacy and attribution

Google is opt-in globally using basic consent gating: there is no pre-consent tag load or cookieless ping. The local preference is nusuk:analytics-consent:v1 (granted/denied only), separate from history and language. Blocked storage permits session-only consent. A storage event synchronizes withdrawal across tabs.

Google still receives network/technical data when enabled. Session cookies are requested with cookie_expires=0 and host-only scope; no feature-specific persistent user identifier is introduced. Google Signals and ad personalization are disabled. Withdrawal sets Google's disable flag, stops manual events and expires this host's _ga cookies. It cannot retract requests already sent; a loaded third-party script remains in memory. Verify vendor behavior and the property's retention/access settings during activation. The owner must review the disclosures and consent approach against applicable requirements; this implementation is not a legal determination.

Vercel has separate provider behavior and visitor metrics; opting out of optional Google does not disable Vercel's existing page measurements. GA consent-based visitors/bounce/engagement and Vercel metrics are not interchangeable.

Only these five exact campaign triples enter GA config:

| Campaign | utm_source | utm_medium |
| --- | --- | --- |
| facebook_groups | facebook | social |
| instagram_community | instagram | social |
| whatsapp_community | whatsapp | messaging |
| urdu_launch | community | social |
| organic_community | community | referral |

Example: https://nusuk.abdallahgaber.dev/ur/?utm_source=community&utm_medium=social&utm_campaign=urdu_launch

Do not append personal information. Unknown or mismatched triples are ignored. Config receives bounded campaign_name/source/medium rather than the raw URL. Canonical sharing uses the current language; native and clipboard links are clean. WhatsApp uses the allowlisted WhatsApp campaign, localized text and no third-party SDK.

## Cost and performance

Delivery stays static Vite/React on Vercel CDN. No server functions, databases, paid services, new npm dependencies or font requests. Existing content-hashed snapshot caching and manifest rules are unchanged. No Firestore operations occurred in this work.

During implementation, main independently advanced to 11,779 entries (PR #21). The feature branch preserves that upstream feed unchanged, SHA-256 a683aba328ce34d50ee124a1a5d7f8121de0bdddd47252d675dafb6956686373. No snapshot regeneration or publication occurred in this task. Browser screenshots and Lighthouse were captured against the preceding 11,775-code feed, SHA-256 8dc25b75e96a944580773a3af393b867ef11190c64261832ede7b424c605ca50; the final build/checksum checks use the latest upstream feed.

After the review fixes, main JS is 317.95 kB raw / 98.70 kB gzip (about +8.43 kB gzip against baseline); CSS is 22.71 / 5.79 kB. Static root HTML is 5.94 / 1.79 kB. These sizes exclude the unchanged CDN JSON and Google's optional async tag. All locale dictionaries are bundled for instant switching; this is a deliberate small payload trade-off. Consent delays all Google vendor overhead until opt-in.

Vercel Hobby currently includes 50,000 Web Analytics events per team/month; the supplied 1,149 monthly views alone are about 2.3% of that allowance. Other projects and actual team usage are unknown. New custom events go to free standard GA4, not paid Vercel custom events. Hobby analytics collection pauses at its limit rather than automatically purchasing an upgrade. Check the current [Vercel limits](https://vercel.com/docs/analytics/limits-and-pricing) in the owner dashboard; no account quota or upgrade setting was changed.

Future traffic can consume hosting bandwidth/build/analytics allowances. Monitor those limits; do not enable billing to hide overruns. GA collection and ad blockers introduce incomplete measurements.

## Validation and limitations

| Check | Result |
| --- | --- |
| npm test | 107 tests passed across 10 files |
| npm run lint | Passed |
| npm run typecheck | Passed |
| npm run build | Passed |
| npm run test:admin | 52 tests passed; existing administrative implementation unchanged |
| npm run lint:admin | Passed |
| Preview build | Passed with VERCEL_ENV=preview in a temporary output directory |
| Built HTML | All four production/preview routes: correct direction, one canonical, five alternates, visible main content, preview-only noindex |
| Snapshot | Existing SHA-256 validated; data/admin/history-core files unchanged |
| Browser matrix | Four locales × two themes × 320/360/375/390/412/768/1280 = 56 checks, no horizontal overflow; exact LTR code unchanged |
| Local interactions | Language changes and reload preserved code/progress; Next and Tried → Undo worked; case-insensitive search and exact-case copy success did not change history; safe external links; no Google tag with missing config |
| Lighthouse mobile | Final local run: Performance 96, Accessibility 100, Best Practices 100, SEO 100 |

Final lab metrics: FCP 0.8s, LCP 2.3s, TBT 170ms, CLS 0.046, Speed Index 0.9s. Summary: [qa/growth/lighthouse-summary.json](qa/growth/lighthouse-summary.json). An earlier run scored 70 performance/96 accessibility with a 2.6s unattributable long task; contrast and theme accessible-name issues were corrected. Scores vary with host load and are not production field Core Web Vitals or proof of unchanged real-device performance. Google was unconfigured during this audit.

Automated coverage includes key/placeholder completeness, URL/stored/browser selection and language persistence, Urdu RTL, safe links, static SEO and previews, analytics gating/page-view deduplication/payload allowlists/withdrawal, sharing fallback/cancel/known campaigns, and existing search, history, refresh, no-repeat, Undo and storage fallbacks.

Screenshots are actual local production-build captures of the 11,775-code feed used for browser QA, before the independent upstream dataset release. They are not production changes or mockups:

| Locale | Mobile (390px) | Desktop (1280px) |
| --- | --- | --- |
| Arabic | [Dark](qa/growth/ar-dark-390.jpg) | [Light](qa/growth/ar-light-1280.jpg) |
| English | [Light](qa/growth/en-light-390.jpg) | [Dark](qa/growth/en-dark-1280.jpg) |
| Indonesian | [Dark](qa/growth/id-dark-390.jpg) | [Light](qa/growth/id-light-1280.jpg) |
| Urdu | [Light](qa/growth/ur-light-390.jpg) | [Light](qa/growth/ur-light-1280.jpg) |

The browser matrix used a desktop browser with viewport overrides. Physical Android Chrome, iOS Safari, Facebook/in-app browsers, actual native share sheets, end-to-end clipboard/paste into Nusuk, real screen readers, GSC indexing and real GA event ingestion were not tested. Keep those as pre-promotion owner checks. Local copy UI reported success; browser-session clipboard inspection was not reliable, so no cross-app paste success is claimed. Emulator tests were not repeated because this milestone has no Firestore/admin changes.

## Approved-release checklist

1. Review this PR, Urdu/Indonesian wording, disclosures, screenshots and generated HTML.
2. Complete native/physical-device checks listed above, including 320px, large text, keyboard/focus, themes, clipboard fallback, persistence and in-app browser sharing. Scrolling is required on short screens; no sticky overlays obscure actions.
3. Configure Search Console manually. Configure free GA4 with Enhanced Measurement off before setting the production env acknowledgment. Keep preview env values unset.
4. Merge/release only with owner approval. This implementation does not merge or deploy automatically.
5. Inspect production /ar/, /en/, /id/, /ur/, sitemap, canonicals, hreflang and absence of noindex. Inspect a preview to confirm noindex and no analytics.
6. Verify unchanged feed count/checksum and current-code reload behavior, then perform the consent/Realtime/DebugView checks above.
7. Request indexing and begin weekly measurement. Keep all plans free.

Rollback: revert the reviewed feature commits through a new reviewed PR. To disable only Google collection, remove the two public GA env values and approve a normal rebuild/release; revoking consent disables collection immediately in a browser. Do not change Firestore, the snapshot or saved history for an analytics rollback.

## Weekly dashboard and growth experiments

| Question | Suggested free report |
| --- | --- |
| Are searches finding us? | Search Console impressions, clicks, CTR, indexed pages, top queries and locale landing pages |
| Who uses which language? | GA/Vercel country and locale page breakdowns; compare trends within each provider |
| Which channels help? | GA traffic acquisition plus the five named campaigns; separate direct/unknown and consent gaps |
| Do people use the tool? | Users with copy_code and open_nusuk; share of consenting sessions with each; never label as redeemed |
| How deep is interaction? | (copy_code + next_code + skip_code + mark_tried) / engaged sessions, with the exact definition recorded |
| Are people sharing? | share_website count/users by locale and method; initiations are not confirmed recipients |
| Is mobile healthy? | Search Console field CWV when enough data exists; periodic mobile Lighthouse, errors and manual device checks |
| Are free limits safe? | Vercel team usage/bandwidth/builds/Web Analytics allowance, GA property health |

Review weekly, not per visitor. Compare a two-week pre/post window rather than promising statistical significance at this audience size. First experiments: native-reviewed Urdu launch in relevant communities; localized WhatsApp links; a useful Facebook group post with permission and an explicit campaign; improve copy instructions based on observed usability; refine titles from real Search Console queries. No automated social scraping, intrusive sharing prompts, paid acquisition or redemption claims.


## PR #22 final review follow-up

Instagram distribution now supports exactly utm_source=instagram, utm_medium=social, utm_campaign=instagram_community. Example: https://nusuk.abdallahgaber.dev/en/?utm_source=instagram&utm_medium=social&utm_campaign=instagram_community. Mismatched sources/media, missing fields, unknown names and casing changes are rejected; arbitrary extra query data is never forwarded.

All code copy actions (main browser, search, creator) and copy-link sharing use the same safe clipboard helper. It attempts navigator.clipboard.writeText, then a selectable, read-only temporary LTR textarea with execCommand("copy") when the API is unavailable or rejects. Exact text is preserved. The helper restores focus/selection and removes the field even on failure. It never reads clipboard contents or changes history. Only a resolved modern write or an explicit true legacy return counts as success; copy_code follows success only. Legacy copy is a deprecated best-effort compatibility path, not a guaranteed bypass of in-app browser restrictions. If both mechanisms fail, localized guidance asks the user to select/copy manually. Instagram/Facebook can restrict clipboard or lose user activation after an asynchronous rejection; test real apps and use an external browser/manual copy when necessary. See [MDN compatibility caveats](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand).

The header now provides a translated, 44px-minimum Analytics and privacy link, visible on mobile, which opens and focuses the inline preferences. The two choice buttons share styling and responsive sizing. Choosing neither keeps Google off; no blocking modal, sticky prompt, forced decision or accept-only affordance is used. Decline/withdraw stays as accessible as accept.

**GA automatic collection boundary:** VITE_GA_MANUAL_EVENTS_ONLY is an owner acknowledgment of stream setup, not a programmatically verified guarantee that the SDK sends only our ten custom events. Disabling Enhanced Measurement and send_page_view prevents the configured automatic page/outbound/form/download/search collection, but standard GA events such as first_visit, session_start and user_engagement and their SDK-generated identifiers/technical parameters may still occur after consent. Session-cookie configuration does not eliminate Google's session identifiers or guarantee browser-session restoration behavior. Our strict allowlist sanitizes application event payloads, not every internal vendor request. See [Google's automatically collected events](https://support.google.com/analytics/answer/9234069?hl=en).

Withdrawal immediately stops application events/page views, sets ga-disable-MEASUREMENT_ID before clearing host cookies and keeps it set through repeated locale effects/withdrawals. No new tag is loaded on regrant. We intentionally use the documented property opt-out flag rather than issue a denied-consent update that might introduce cookieless consent-mode requests. A loaded vendor script stays in memory; previously transmitted/in-flight traffic cannot be recalled. The automated delayed-load test verifies our opt-out commands and event gating, not Google SDK network behavior.

Before activation, validate on a real property with Enhanced Measurement completely off and no extra tags/destinations: inspect all requests (including automatic session/engagement events and unload/beacon traffic), canonical page context, absence of code values/queries, exactly one manual page_view per locale transition, and no subsequent collection after withdrawal or cross-tab withdrawal. Also throttle/block the Google script, grant then withdraw before it loads, and test regrant/reload. If vendor collection after withdrawal or sensitive parameters appear, leave Google disabled and investigate; the local test doubles cannot certify those behaviors. No real-property ingestion or physical Instagram/Facebook/iOS/Android testing is claimed.

Review validation: 40 affected clipboard, preferences, sharing and analytics tests passed; lint, typecheck and production build passed. Eight local viewport checks (four languages at 320/390px) confirmed the header link stays visible, is at least 44px tall and introduces no horizontal overflow; its action opens the panel and focuses the summary. Equal accept/decline markup is tested with an eligible analytics test double; the local browser preview has no Google ID and correctly loads no Google tag. [Mobile header](qa/growth/review-privacy-header-320.jpg) · [Opened inline panel](qa/growth/review-privacy-open-320.jpg). Existing 11,779-record dataset is preserved byte-for-byte against main; no Firestore access or deployment is needed for these fixes. Earlier Lighthouse/screenshots above describe the milestone build before this follow-up, not a new audit of these changes.
