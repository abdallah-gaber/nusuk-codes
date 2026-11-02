# Search and personal progress UX — 2026-11-02

The existing main browser remains primary. A native collapsed disclosure adds local snapshot search and All / Unseen / Tried / Skipped filters, using exact-case history membership and case-insensitive queries. Results retain exact code capitalization. Copy delegates to the existing clipboard action without history changes. Search performs no fetch or storage operation.

Progress is derived from the existing v1 history only. Total, seen, remaining, tried, skipped and percentage are scoped to codes in the loaded snapshot. Next/Skip/Tried/Undo, import merging, reset, cross-tab events, seed and serialization remain unchanged. The current displayed main-browser code continues to count as seen; reset therefore shows one seen after the next display, as before.

Validation: 20 frontend tests, ESLint, TypeScript typecheck and production build passed. New tests cover search/filter purity, exact code values, empty/exhausted results, 10,000 entries with 9,000 seen, counters, Next/Skip/Tried/Undo, reset and parsed imported/cross-tab history.

Local browser checks with the current 6,019-code snapshot:

- Search and result copy left the main code and visible progress unchanged. Clipboard contents exactly matched mixed-case `NG-000CjNE0` after a lowercase query.
- Initial expansion rendered 24 results; Load More rendered 48. Radio filter arrow-key navigation and empty-query states worked.
- Next, Skip, Tried and Undo updated the rendered counters correctly. A second localhost tab synchronized progress; reset restored zero annotations and one seen main-browser code, with 6,018 unseen results.
- Desktop light and 320px dark layouts were inspected. At the 320px viewport, document content width matched the available 305px width after the desktop browser's scrollbar: no horizontal overflow.
- The native file-picker automation failed; no browser-level import completion is claimed. The unchanged importer and imported-history progress/filter calculations are covered by unit tests. No replacement upload flow was introduced.

Trade-offs: native disclosure/radio controls provide keyboard behavior without new dependencies; results grow by 24 on explicit request rather than using virtualization. No search interactions annotate history. Closing/reopening preserves the query/filter while unmounting hidden results. Percentage rounding never shows 100% before all current codes are seen.

Screenshots: [desktop browser/progress](search-progress-desktop.jpg), [desktop search](search-progress-desktop-list.jpg), [320px dark search](search-progress-mobile-320.jpg).

No Firestore/admin tooling, CDN payload/schema, deployment settings or history storage format changed. No merge or production deployment was performed.
