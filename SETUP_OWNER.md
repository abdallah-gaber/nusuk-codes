# Owner setup — Phase 2A

The public app still requires only `npm ci` and `npm run dev`; no Firebase configuration or secrets belong in the frontend.

Phase 2A administrative access is configured on this computer and the explicitly approved import/display review is complete: 1,540 published but redemption-unverified codes. Updates remain disabled between approved sessions. See the [publication execution record](imports/2026-11-01/PUBLICATION_RESULT.md). See [the activation record](docs/PHASE2A_ACTIVATION.md). For a new operator or future publishing session, follow [the full activation runbook](docs/PHASE2A_ADMIN.md) in order:

1. Verify existing `nusuk-codes` project, Standard/default database and Spark without billing.
2. Run all app/admin checks and the demo-project Firestore Emulator suite (Python 3.13 / Java 21+).
3. Owner-deploy deny-all rules/index configuration after inspecting existing settings.
4. Create narrowly scoped administrative credentials outside the repo; export environment paths only. No GitHub Secret is needed for the local publishing workflow.
5. Export/reconcile current Firestore data before migration; investigate legacy IDs/schema issues.
6. Deliberately enable updates, dry-run and confirm bounded import slices of at most 250 codes. Verify pending/unverified counts and archive evidence exports.
7. Explicitly review selected candidates using revision-checked plans. Generate a published-only staged snapshot, verify it, approve any removals, promote locally, then review/merge a publishing PR and deploy its complete static pair.
8. Preserve previous assets/manifests for rollback. Disable updates and unset production access after administration.

The pending-only initial import and index setup were completed with approval; existing deny-all rules were preserved. The later approved publication retains the original snapshot for rollback. No billing change, submission/report endpoint or scraping was introduced. No DNS work is required for this phase. The original supplied `docs/OWNER_SETUP.md` is historical guidance; the Phase 2A runbook takes precedence for the implemented workflow.
