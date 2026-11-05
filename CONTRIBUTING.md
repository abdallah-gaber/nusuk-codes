# Contributing to Nusuk Codes Hub

Small contributions are welcome, including bug fixes, Arabic copy, accessibility improvements and tests. Please follow the community standards. [Code of Conduct](CODE_OF_CONDUCT.md)

## Report a bug or propose an improvement

Search existing Issues first. For bugs, include the expected result, actual result, reproduction steps, browser/device and a redacted screenshot if helpful. For ideas, explain the user need and proposed scope before starting a large change. Issues are public. [GitHub Issues](https://github.com/abdallah-gaber/nusuk-codes/issues)

Never attach credentials, service-account files, passwords, OTPs, private participant information or exported personal browsing history. Suggest public source links for review instead of pasting unreviewed code dumps. For community conduct concerns and sensitive incidents, use the reporting guidance. [Reporting concerns](CODE_OF_CONDUCT.md#reporting-and-enforcement)

## Set up locally

Use Node.js 22.12+, npm and Python 3.13. Python is used by frontend snapshot compatibility tests and does not need Firebase access.

1. Fork the repository and clone your fork.
2. Run `npm ci`, then `npm run dev`.
3. Create a descriptive branch with `git switch -c fix/short-description`.

The public app needs no Firebase credentials. Read the repository instructions before changing implementation. [AGENTS.md](AGENTS.md)

## Prepare a pull request

Keep one problem per PR. Explain what changed and why, link an Issue when relevant, and include desktop/mobile screenshots for visible UI changes. Preserve existing behavior unless the change explicitly calls for it.

Run these checks from the repository root.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Add regression coverage for behavior changes when existing tests would miss the bug. Documentation-only changes need Markdown, local link, path and documented-command checks. The existing CI workflow also runs admin lint, Python tests and the demo Firestore Emulator suite. For admin code changes, follow its local setup and checks using the demo project, without production credentials. [Admin testing and setup](docs/PHASE2A_ADMIN.md)

Push your branch to your fork and open a PR against `main`. Allow maintainer review before merge. Contributors must not perform production imports, change existing production statuses, deploy rules, publish snapshots or deploy the website. Production data changes require separate owner approval and the administrative runbooks.

## Accessibility, RTL and privacy

- Keep Arabic-first RTL layouts and exact-case code values rendered LTR.
- Check keyboard focus, accessible labels, status announcements and light/dark contrast.
- Test at 320px width and on desktop, including long text and empty/error states.
- Respect reduced-motion preferences.
- Keep search and copy separate from seen/tried/skipped history updates.
- Keep progress local and preserve season-scoped history compatibility.
- Keep credentials and privileged SDKs out of the frontend. Public visitors must never read or write Firestore.
- Do not add tracking or send personal history or code interactions to analytics.

## Suggest a public source

Open an Issue with the public URL, observed date, claimed season and the basis for that attribution. Explain access restrictions or uncertainty. Do not include participant profiles, private messages or scraped personal data.

A maintainer reviews source suitability, provenance, season and allowlisting. Public visibility does not prove redemption validity or confer permission to republish everything on the page. Do not bypass login walls, private groups, CAPTCHAs or access restrictions. Do not submit bulk code dumps, automated scraping or source allowlist bypasses.

Normal application contributions use local fixtures and the existing snapshot. Privileged imports, source review, quota checks and publication are owner operations. [Quick Import runbook](docs/QUICK_IMPORT.md)

## Licensing

Project source code is MIT-licensed. Contribute only material you have the right to share. That license does not assert ownership of community code strings, Nusuk branding or third-party source content. [LICENSE](LICENSE)
