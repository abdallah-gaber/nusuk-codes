# GA4 command transport incident — November 18, 2026

## Root cause and scope

The production shim used an arrow function with rest parameters and pushed the resulting Array into dataLayer. Google treats Arrays as data-layer method calls, while its gtag command dispatcher accepts Arguments objects. Consequently consent, js, config and event messages accumulated without configuring the GA destination. Loading the script successfully and setting the opt-out flag to false could not compensate for that protocol mismatch.

This was a defect in our transport abstraction. Earlier tests mocked runtime.send and verified event names/parameters but did not exercise the browser shim or Google's message-shape distinction.

The fix uses Google's conventional non-arrow function, pushing its real arguments object. The outer typed sendGoogleCommand function still accepts rest parameters, but the value placed in dataLayer is Arguments. The intentional single-line prefer-rest-params lint exception documents this external protocol requirement. Neither the queue nor an existing compatible gtag shim is overwritten.

No consent gates, event payload allowlists, cookie settings, URLs, datasets, history or publication behavior were changed.

## Evidence collected

Production URL: https://nusuk.abdallahgaber.dev/en/. Public measurement ID: G-DP0XBFSREJ (remains environment configuration, not hardcoded in application source).

| Check | Observation |
| --- | --- |
| Production HTML | HTTP 200; references /assets/index-d9WE6OU4.js |
| Production bundle | Contains the rest-array gtag shim; SHA-256 ae7a5530f6f3f2c09ec1189ff8d4620705b3002bfc0e91d66d1effc60cda923b |
| Production browser | Explicitly selected Allow analytics; the DOM then contained the configured Google script URL. Captured warning/error log was empty |
| Google script | Public script downloaded successfully; 472,219 bytes; SHA-256 ed7c281aab49507a27ecd1784bc063c5e2fa29f9b75225230610e8c8b41fa3f2 |
| Actual vendor command classifier | Extracted its pure classifier from that downloaded script and executed it in an isolated Node VM: equivalent event Array → false; Arguments → true |
| Actual vendor dispatch branch | Handles Arrays through method lookup/invocation before reaching its separate Arguments-based gtag command lookup |
| CSP | No enforcing Content-Security-Policy response header or CSP meta tag in the fetched production document |

The parser reproduction used the actual served artifacts, without modifying production or sending fabricated collection requests. Minified function names and hashes identify the investigation snapshot, not stable vendor APIs. Google script contents may change later.

The owner's Chrome Incognito evidence independently showed granted consent, HTTP 200 script load, opt-out flag false, queued events and no collect requests. The artifact-level reproduction explains that combination: commands never reach the gtag dispatcher.

**Browser verification limit:** further Chrome/DevTools inspection was interrupted and browser control became unavailable. This investigation did not independently capture production collect requests or access GA Realtime/DebugView. The fix has not been deployed, so successful fixed-production ingestion cannot yet be claimed. No live runtime patch, production deployment, GA dashboard changes or Measurement Protocol POST was performed.

## Initialization, cookies and automatic measurement review

The intended order is preserved: after explicit consent only, queue consent default (all denied), consent update (analytics granted; advertising denied), js initialization and config; request the async script; queue manual page_view and subsequent user events. Before consent, no Google script or commands are created. Repeated consent effects do not duplicate configuration or same-locale page views.

cookie_expires=0 requests a session cookie; cookie_domain=none scopes it to this host. SameSite=Lax and Secure are compatible with this HTTPS site. These are supported cookie controls, not switches that disable event dispatch. They are retained. See [Google cookie configuration](https://developers.google.com/tag-platform/security/guides/customize-cookies).

Disabled Enhanced Measurement and send_page_view=false suppress the configured automatic measurement/pageview behavior; they do not disable explicitly sent custom events or manual page views. They must remain disabled to avoid outbound Nusuk URLs, search terms and duplicate views. See [manual page-view guidance](https://developers.google.com/analytics/devguides/collection/ga4/views).

After consent, the SDK may still generate standard first_visit, session_start and user_engagement events and technical/session identifiers. Our payload allowlist covers application events; it does not control every vendor-generated parameter. Existing Google Signals/ad-personalization restrictions and sanitized canonical page URLs/referrer origins remain. See the [owner guide](GROWTH_AND_ANALYTICS.md) for real-property checks.

Withdrawal continues to stop application events immediately and set Google's property opt-out flag before expiring host cookies. A loaded tag remains in memory; in-flight requests cannot be recalled. Delayed-load regression coverage verifies that our queued events cannot collect while that opt-out flag is set. The vendor's actual delayed-load, beacon and withdrawal behavior still needs real-browser validation after an approved release. See [Google privacy controls](https://developers.google.com/tag-platform/security/guides/privacy).

## Regression coverage and checks

The new analyticsTransport.test.ts exercises the actual sendGoogleCommand shim with a protocol-aware collection consumer:

- Real Arguments objects, correct consent/config ordering and unchanged privacy configuration.
- No queue, load or collection before consent.
- Manual page_view and sanitized copy_code reach the consumer after consent.
- A negative-control version of the old array shim produces zero collected events.
- No collection after withdrawal, including when the tag processes its queue after withdrawal.
- Regrant initializes only once; an existing data layer and compatible shim are preserved.

This is deterministic offline protocol/consent regression coverage, not a Google network emulator or proof that a particular browser sends requests. Existing production/preview gating and bounded payload tests remain.

Validation: all 127 frontend tests across 13 files passed; lint, typecheck and production build passed. The compiled JavaScript was checked to retain the real arguments-based shim. The exact 11,779-code snapshot remains SHA-256 a683aba328ce34d50ee124a1a5d7f8121de0bdddd47252d675dafb6956686373, and public/data has no diff against main.

## Owner-only release verification

1. Review the dedicated fix PR. Merge/release only with explicit owner approval. Keep the existing public measurement ID and manual-events acknowledgment; do not enable Signals or Enhanced Measurement.
2. In a fresh Chrome Incognito session with extensions/blockers absent, open production DevTools Network → All and preserve the log. Before choosing consent, confirm no Google tag or collection traffic. Declining must keep it off.
3. Grant through Analytics and privacy. Check one tag load and collection requests to a Google Analytics endpoint (which may use a regional hostname or a beacon). Trigger Next or a language change; inspect event names, destination ID and sanitized parameters. Do not paste code/history contents into diagnostics.
4. This read-only Console diagnostic inspects command shapes without displaying payloads:

       (window.dataLayer || []).filter(x => x && ["consent","js","config","event"].includes(x[0]))
         .map(x => ({ kind: Object.prototype.toString.call(x), command: x[0] }))

   The fixed shim's entries should be [object Arguments], not [object Array]. Entries remain in dataLayer after processing; queue length alone does not show failure.
5. Withdraw, then click Next/change language, background the tab and leave the page. Confirm no subsequent collection; repeat cross-tab withdrawal and grant→withdraw while throttling Google script loading. Regrant should not duplicate tag/config/page_view. Already-sent/in-flight traffic is outside revocation.
6. Check GA Realtime and optionally Tag Assistant/DebugView. Confirm property/stream ID, filters and correct debug session if requests exist but reports remain empty. Regional blocking, browser tracking protection, extensions, network policy and additional dashboard destinations must be checked on the owner's actual browser/property.
7. If unexpected collection or sensitive context appears, leave optional Google analytics disabled and investigate before promotion. No billing, Firebase, paid tool or backend change is needed.
