# Nusuk Umrah winners automation POC

## Decision

Fully unattended synchronization is **not demonstrated with the credential-free sources tested**. Public search found leads for 3 of 10 recent historical dates. Successful retrieval and OCR still left missing fields, and country extraction needed a visual check. Keep production updates reviewed. The next source test worth running is Meta Business Discovery with an existing eligible account and approved access, if available. The POC adds no schedule, credentials, billing or publishing path.

## Discovery and source access

| Source | Discovery | Evidence and access |
| --- | --- | --- |
| Nusuk first-party feed | No documented winners feed, export or API surfaced. The app link opened the App Store from desktop. | Nusuk’s open-data catalogue contains aggregate statistics. The app’s Winners screen remains an in-app reference. [Nusuk open data](https://www.nusuk.sa/open-data) · [Official app link](https://nusuk.go.link/winners) |
| X public embeds | The documented profile oEmbed returned HTML for a profile widget with **zero individual post URLs**. The known-post oEmbed returned the author, permalink and display date. | Public post embeds rendered the original posters for all 12 X permalinks tested. The timeline widget is documented for display. X’s terms restrict scraping, so the POC has no widget crawler. [oEmbed API](https://docs.x.com/x-for-websites/oembed-api) · [X timeline widgets](https://help.x.com/en/using-x/embed-x-feed) · [X terms](https://x.com/en/tos) |
| X supported API | The authenticated user-post timeline supports discovery by account ID, dates and pagination. It can also return media attachment metadata. | Developer app, bearer token and prepaid credits required. This API route was evaluated from its documentation and was not exercised with a token. X reports $0.005 per returned post. At 1–10 billable posts/day, post reads alone would be about $0.15–$1.50/30 days, before extra resources or cross-day retries. [User-post API](https://docs.x.com/x-api/users/get-posts) · [X pricing](https://docs.x.com/x-api/getting-started/pricing) |
| Facebook | The documented Page Feed/Published Posts endpoints require a token and applicable Page permissions or Page Public Content Access. No credential-free discovery feed was demonstrated. | The public embed displayed the original poster for November 11. It displayed a relative date, and the direct post capture presented a sign-in prompt. This run left the date unresolved. [Page Feed](https://developers.facebook.com/docs/graph-api/reference/page/feed/) · [Published posts](https://developers.facebook.com/docs/graph-api/reference/page/published_posts/) |
| Instagram | Business Discovery can list media for eligible professional accounts through an authenticated Meta app user. @MyNusuk eligibility, required access and media coverage remain untested. | An approved Meta app, appropriate professional account, permissions and usable token are prerequisites. If those already exist, test the documented media fields and whether they include original image URLs and publication timestamps for this account. [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery) |
| Search | The live test used the search tool available in this session. It indexed some third-party references to official posts. Dates and keywords repeatedly returned the same posts. | Search is useful for leads. Coverage and indexing latency remain unproven for daily synchronization. A supported service such as Brave offers Web Search at $5 per 1,000 requests with monthly credits. One query per day would list at $0.15 for 30 days before credits, and even a plan covered by credits requires payment details. No Brave account or API key was used. [Brave Search API](https://brave.com/search/api/) · [Payment requirements](https://api-dashboard.search.brave.com/app/documentation/general/privacy-policy) |

## Historical test on 25 November 2026

The recent sample used the ten consecutive dates November 16–25. The name-free query template was `"MyNusuk" "nusuk.go.link/winners" after:YYYY-MM-DD before:YYYY-MM-DD`, with the next date as the upper bound. I pooled results and assigned a hit to a day only when the original public post confirmed its date and Umrah announcement. Results from direct official-domain searches did not yield dated post permalinks in this sample. The three candidates came from indexed references and were reopened in X’s public embed.

The second sample used November 6–15 to test extraction on ten additional real announcements. I followed the Umrah announcement links under those dates in a publicly indexed community archive. That step was assisted. Only original Nusuk posts, their rendered public embeds and X’s documented post oEmbed supplied extraction evidence. The source URLs and names in the verified dataset were never inputs to either discovery or extraction. The candidate output was written and hashed before the scoring command read ground truth. [Public archive used for link discovery](https://noblestudent.com/winners/)

| Stage | Observed result |
| --- | ---: |
| Recent date-based search, direct official post results | 0/10 |
| Recent date-based search, leads recovered through indexed references and verified against original posts | 3/10 (30%) |
| Older assisted archive lookup | 10/10 (100%) |
| Original poster visible in public embed after independently obtaining a lead | 13/13 (100%) |
| Exact winner number from OCR | 13/13 (100%) |
| Exact published name from OCR | 10/13 (77%) |
| Exact date from the rendered image alone | 8/13 (62%) |
| Exact date using the rendered timestamp and optional documented X oEmbed | 12/13 (92%) |
| Country flag visually identified and matched in scoring | 13/13 (100%, assisted) |
| Whole record matched existing ground truth, including assisted country | 9/13 (69%) |
| Whole record matched on the recent search sample, including assisted country | 2/10 (20%) |
| Fully unattended publishable records | 0/20 (0%) |

Whole-record scoring requires exact name, country, winner number, date and canonical permalink. No name substitutions, transliterations or archive lookup repairs were applied. The edited November 13 embed displayed a last-edited timestamp. The date scored for that row came from the separate X oEmbed date, whose timezone is unspecified. A scored match here is a historical comparison and carries no production approval.

| November date | Discovery | Original post | Extraction and score |
| --- | --- | --- | --- |
| 6 | Assisted | [X](https://x.com/MyNusuk/status/2118703284756120059) | Exact with assisted country |
| 7 | Assisted | [X](https://x.com/MyNusuk/status/2119068261203460421) | Arabic name rejected after mixed-script OCR |
| 8 | Assisted | [X](https://x.com/MyNusuk/status/2119430615095242990) | Exact with assisted country |
| 9 | Assisted | [X](https://x.com/MyNusuk/status/2119782725691331012) | Exact with assisted country |
| 10 | Assisted | [X](https://x.com/MyNusuk/status/2120145427185983499) | Exact with assisted country and oEmbed date after OCR truncated the year |
| 11 | Assisted | [Facebook](https://www.facebook.com/MyNusuk/posts/pfbid0STWtTUij4v9i3VsjXuS8qcLNavwFLEQfjvQhJunRM5Q9E3RrRsvf9fpB8r6qUU8fl) | Poster visible. Absolute post date unavailable in this capture |
| 12 | Assisted | [X](https://x.com/MyNusuk/status/2120872595000070161) | Exact with assisted country and oEmbed date after OCR truncated the year |
| 13 | Assisted | [X](https://x.com/MyNusuk/status/2121252160927322474) | Exact with assisted country and oEmbed date. Rendered date was an edit date |
| 14 | Assisted | [X](https://x.com/MyNusuk/status/2121601150197641360) | The Latin surname was misread as a digit and the name was rejected |
| 15 | Assisted | [X](https://x.com/MyNusuk/status/2121964869570154535) | Exact with assisted country |
| 16–18 | Date-based search | — | No verified lead from the query set |
| 19 | Date-based search | [X](https://x.com/MyNusuk/status/2123407317949415774) | Exact with assisted country |
| 20 | Date-based search | [X](https://x.com/MyNusuk/status/2123850769744986523) | Exact with assisted country |
| 21 | Date-based search | — | No verified lead from the query set |
| 22 | Date-based search | [X](https://x.com/MyNusuk/status/2124493968993898623) | Arabic surname was misread in Latin characters and the name was rejected |
| 23–25 | Date-based search | — | No verified lead from the query set |

The run incurred $0 in additional service charges and used Node, Tesseract.js 6.0.1, the open English and Arabic `tessdata_fast` models and a local browser. The 13 public captures took about 35 seconds, and one batch of local OCR took about 9.5 seconds. These are workstation timings for the test. Public embeds were opened for known permalinks, and no alternate authentication method was used. Standard GitHub-hosted runners for a public repository have no Actions compute charge. [Tesseract.js](https://github.com/naptha/tesseract.js/tree/v6.0.1) · [Language models](https://github.com/tesseract-ocr/tessdata_fast) · [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## Run the local POC

Use Node 22 or later. Put the OCR package and English/Arabic models in a scratch directory outside the repository. Capture the full original public embed at 1100 × 1900 physical pixels, using English UI and Riyadh time. The parser was tested on that framing. Supply the capture dimensions and path for each case. The code never polls a social platform or opens a login page.

```sh
scratch=$(mktemp -d)
npm install --prefix "$scratch/npm" tesseract.js@6.0.1
mkdir -p "$scratch/tessdata"
curl -fLsS https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata -o "$scratch/tessdata/eng.traineddata"
curl -fLsS https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/ara.traineddata -o "$scratch/tessdata/ara.traineddata"

node scripts/winners-poc/poc.mjs discover "$scratch/search-links.json"
node scripts/winners-poc/poc.mjs extract "$scratch/evidence.json" "$scratch/npm" "$scratch/tessdata" > "$scratch/candidates.json"
shasum -a 256 "$scratch/candidates.json"
node scripts/winners-poc/poc.mjs score "$scratch/candidates.json" src/winners/data.json
```

- `search-links.json` is an array of URL strings from an authorized search output or public links found through search. For third-party indexed leads, supply the original post permalink. The replay deduplicates exact-account X and Facebook permalinks. It does not fetch the index or authorize the post.
- `evidence.json` is an array of objects with `sampleDay`, `url`, `image`, `width` and `height`. The sample day is only a scoring label. `image` is the screenshot relative to the manifest. Optionally, supply a separately observed flag as `observedCountry` and a file path for `oEmbed`, the documented X JSON response for that permalink. For example, `curl -fLsS -G https://publish.x.com/oembed --data-urlencode "url=$permalink" --data-urlencode omit_script=true` fetches one known post. Capture evidence only from views available without a sign-in prompt.
- `extract` keeps missing or conflicting fields null and emits `review-required`, the evidence SHA-256 and independent date observations. A screenshot hash supports audit and replay. Publisher authentication still comes from the official source or a reviewer opening the original. `score` is the only command that reads the winners archive.
- Candidate JSON digest for this run was `5a8a4274f719088c0509ec853916576f7327f49d6d231f7a77127dc01696e872`. SHA-256 for the English and Arabic model files was `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` and `e3206d3dc87fd50c24a0fb9f01838615911d25168f4e64415244b67d2bb3e729`, respectively.

## Operational architecture if a supported source passes

1. **Prove discovery in shadow mode.** Compare the source against independently checked official announcements over a later live interval, recording completeness, lag, media retrieval and late or edited posts. Use the account ID, original post ID, immutable publication timestamp and image attachment from the provider response. Check identity, competition and prize, and retrieve only official attached media. An approved Meta integration is the no-billing candidate. X is a documented paid fallback if the owner chooses that tradeoff.
2. **Keep the job stateless.** Use standard GitHub-hosted runners. Start with a manual dispatch and a dry-run default. After the source passes, schedule 20:20 and 00:20 UTC, around 23:20 and 03:20 in Riyadh, and use a 72-hour lookback to absorb late announcements and skipped runs. Retry transient failures with a small backoff budget, honor `Retry-After`, and report authentication/permission errors without looping. Serialize runs. Compare against the checked-in archive and the candidate PR branch, deduplicating by account/post ID and winner number. Hold conflicting dates, names or ordinals for review. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
3. **Stage a single reviewed dataset change.** Create the proposed row in temporary output, then run the current winners validator and tests against the staged data. Keep the original permalink, media SHA-256, provider timestamp, raw OCR, independent evidence and a reason for each refusal in the job summary or a short-lived artifact. A dry run stops there. A missed source or disagreement leaves the current website data in place. Re-read main before proposing a change so repeat runs and concurrent edits remain idempotent.
4. **A — Recommended after discovery is proven.** Give a separate PR-creation step only the necessary write permissions on `data/winners-*`. Open or refresh one review PR with the draft JSON and original poster link. Owner review can become a quick comparison and merge. Auto-deploy for these branches is disabled by the existing Vercel configuration. A PR opened with `GITHUB_TOKEN` may require approval to run its PR workflows. Plan for that approval, or separately evaluate a narrowly scoped GitHub App if automatic PR CI is required. [Repository settings for Actions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) · [GitHub token event behavior](https://docs.github.com/en/actions/concepts/security/github_token)
5. **B — Require evidence that this POC did not establish.** Require an authenticated, stable source with confirmed publisher identity and the original post ID, immutable publication time converted to the Saudi date and the original image. Require independent first-party corroboration for exact spelling, country, prize and ordinal, ideally structured text from Nusuk, with the poster as a cross-check. Two OCR passes on a single poster share failure modes. A repost of the same poster and a high confidence score are also insufficient. Require exact field agreement, no ambiguous flag or missing field, no conflicting source/date/ordinal, existing schema validation, and a live shadow run that covers both scripts, delays and edits and finds zero false accepts. Retain owner-approved publishing authorization and a tested pause and rollback. Route any exception to A. Neither production path was enabled in this POC.

If a source is inaccessible or incomplete, use official account notifications or a reader-supplied original permalink as the lead. Run the poster through local OCR, compare the candidate with the original and use the existing reviewed update process. The prototype can remove most typing from that fallback, while the review confirms details the source or OCR cannot establish. [Reviewed winners update procedure](WINNERS.md)

## Repository verification

Lint, typecheck, all 176 existing tests and the production build passed. The discovery replay also passed a mixed-URL test covering canonicalization, duplicate removal and rejection of lookalike hosts. An independent build from the merged main branch produced byte-identical output to the POC branch.
