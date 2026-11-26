# Season policy

This policy guides season maintenance. The site presents one edition at a time.

## Identity and evidence

Give each officially announced challenge edition a distinct identity. A new November, Ramadan or calendar year alone does not establish a new challenge. Use verified official announcements and the official app's current rules before defining or activating an edition.

The current implementation uses `nov-2026` in public snapshots and browser history and `2026-11` in administrative records. These identifiers refer to the same dataset. Its release count is maintained in the public manifest. [Current manifest](../public/data/manifest.json)

## Code uniqueness and reuse

Preserve exact capitalization. Deduplication is scoped to a dataset/season, with case-only variants investigated rather than silently merged.

Distinct strings do not imply global uniqueness, permanent validity, successful redemption or eligibility. There is currently no confirmed official policy in the project's evidence establishing whether referral codes persist or reset between challenge seasons. Do not automatically migrate previous-season codes into a new active season.

## Lifecycle

- **Upcoming.** An official edition has been identified. Prepare its evidence, sources and activation plan before displaying it as active.
- **Active.** The owner has reviewed the evidence and explicitly approved activation and a validated snapshot. Published community candidates remain redemption-unverified.
- **Archived.** Preserve the edition's historical datasets and provenance. Clearly label any archived presentation so it cannot be mistaken for active candidates.

Upcoming is a planning state. The Active and Archived presentations use the same dataset and history schema. Preserve old codes and keep local history tied to its original season.

## Prepare a future season

1. Verify that the challenge is running or officially announced. Record the official evidence and its date.
2. Confirm the observed code format, relevant official links, participation rules and remaining uncertainties.
3. Review public community sources and distinguish observation dates from publication dates.
4. Prepare a migration and activation plan covering identifiers, constants, schemas if needed, local-history compatibility, dataset isolation, snapshot validation and rollback.
5. Assess any proposed reuse of old codes using fresh season evidence. Syntax alone is insufficient.
6. Obtain owner review before implementation and explicit approval before activation or publication.

Use the established administrative runbooks for controlled data changes. Historical execution reports retain the counts and decisions of their original sessions. [Full runbook](PHASE2A_ADMIN.md) · [Quick Import](QUICK_IMPORT.md) · [Provenance](../DATA_PROVENANCE.md)

## Owner procedure for archiving the current season

The site implements Active and Archived presentation for the existing `nov-2026` edition. The build defaults to Active when `NUSUK_SEASON_STATUS` is unset. Vite accepts the exact values `active` and `archived`, and rejects other values. Time, the snapshot manifest, and visitor actions never change the mode. The import pipeline and its policy stay separate from presentation.

1. **Verify and approve closure.** Review the official Nusuk app rules or a primary announcement covering the full challenge, including any extension or correction. Confirm that the edition has ended and record the owner's approval in the archival release. Winner announcement dates and the Ramadan prize window do not establish the challenge dates. Review the final published winner records and reconcile any README statistics before activating. The finale reads its counts from the verified archive. [Winners review process](WINNERS.md)
2. **Record the dates if verified.** In a reviewed change to `src/season.ts`, set `season.verifiedDates` to `{ startsOn: "YYYY-MM-DD", endsOn: "YYYY-MM-DD", evidenceUrl: "https://…" }`. Use an official source or a reviewed project evidence note when the source is only available in the app. Leave `verifiedDates` as `null` when the full range lacks evidence. The UI then omits the date range.
3. **Validate the candidate locally.** Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run validate:winners`. Run the browser matrix below. For a manual review, run `NUSUK_SEASON_STATUS=archived npm run build` and `npm exec -- vite preview --host 127.0.0.1`. Check `/`, each locale route (`/ar/`, `/en/`, `/id/`, `/ur/`), and the `#winners-history` and `#browser` links. Check that the finale counts all verified records and counts each known country once. In the archive, check that the latest five appear first, the disclosure reveals the complete list, and announcement links point to the original sources. Verify that the code collection is labeled historical with no Nusuk redemption actions. Review light and dark themes, RTL, keyboard focus, and a browser with saved progress and a privacy choice. Confirm the finale celebration plays once and is skipped when reduced motion is enabled. Run `NUSUK_SEASON_STATUS=active npm run build` to verify the rollback build.
4. **Activate in production only after owner approval.** In Vercel, record the current Active production deployment for rollback. In the project's environment variables, set `NUSUK_SEASON_STATUS=archived` for **Production**. In Deployments, redeploy the intended reviewed production commit with the updated environment and verify that the custom domain points to that deployment. This variable is read at build time, so saving it alone does not change the served site. [Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
5. **Verify the live release.** Test the same locale URLs in a fresh session and a session with saved history. Check localized page titles, canonical URLs and alternates, the closing message and date evidence (if available), the winner and country counts, announcement links, historical search, progress export, and privacy controls. Check that the manifest and the hash-addressed snapshot match the intended release and that there are no active referral links. Deployment changes presentation only. Keep the season identifiers, history storage and snapshot together.
6. **Roll back if needed.** In Vercel, remove the Production variable or set it to `active` so the next build defaults to Active. In Deployments, roll back to the saved Active production deployment for immediate recovery, or redeploy the intended reviewed commit with Active explicitly selected. Verify the live celebration banner, Copy and Next, search, privacy choice, and the previously saved code in the same browser. Keep the existing URLs and browser storage throughout. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)

To run the browser matrix, install Playwright in a separate location if it is unavailable in the checkout, and use a system installation of Google Chrome. The suite builds both variants in temporary directories and serves them inside the test browser, without contacting the live site. A separate test build checks a 55-record synthetic archive across all four locales. Set `SEASON_QA_SCREENSHOTS` to an output directory to capture the Arabic mobile dark view and the expanded English desktop view using the checked-in winners dataset. The committed screenshots are review captures from local builds. [Finale visual evidence](qa/season-finale/)

```sh
npm install --prefix /tmp/nusuk-browser-qa playwright
PLAYWRIGHT_MODULE=/tmp/nusuk-browser-qa/node_modules/playwright/index.mjs node --test scripts/qa_season.mjs
```

A future edition requires its own reviewed activation and data plan. Keep this historical snapshot and local history scoped to `nov-2026`.
