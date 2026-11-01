# Phase 2A — administrative data management and safe publishing

Initial implementation was local. Restricted production access is now configured; see [the current activation status](PHASE2A_ACTIVATION.md). Imports, review and public snapshot promotion remain separately gated. The approved checked-in feed now contains 1,540 codes; see [the publication execution record](../imports/2026-11-01/PUBLICATION_RESULT.md). The original 1,132-code asset remains available for rollback. Every candidate remains `community_submitted_unverified` / `redemptionVerified: false`.

## Architecture and scope

Firestore Standard, default database, project `nusuk-codes`, **Spark without billing** is the future administrative source of truth. Privileged Python CLI → explicit human review → validated local staging directory → explicit local promotion → reviewed Git PR → atomic static hosting deployment. Public browser → CDN manifest + hash snapshot only. No frontend Firebase dependency, public API, serverless request path, SDK credentials in Vite, user submissions, reports, social collection, schedule, Functions or paid backup service.

Administrative publication means explicit approval for public community display under the owner’s documented policy; it does not fabricate independent source/season verification. It does **not** mean a code was redeemed or verified by Nusuk. The public status stays unverified; `candidatePreview: true` continues to describe unverified community candidates, including administratively published records.

All scripts default to no production connection. CSV validation, plan parsing, snapshot verification, promotion and rollback can run without Firebase SDK imports. Remote commands require either the loopback emulator (`demo-nusuk-codes`) or **all** production gates: `--production --project nusuk-codes`, an explicit `NUSUK_ENABLE_PRODUCTION=nusuk-codes`, and an explicit credential environment variable (`NUSUK_FIREBASE_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`). Production writes additionally require enabled checked-in updates, an actor, `--apply`, and an exact command-specific confirmation token. These gates prevent mistakes; IAM is the real authorization boundary.

## 1. Install and test locally first

From the repository root, with Node 22+, Python 3.13 and Java 21+:

```sh
npm ci
python3 -m venv admin/.venv
admin/.venv/bin/pip install -r admin/requirements-lock.txt
npm run lint
npm run lint:admin
npm run typecheck
npm test
npm run test:admin
npm run build
npm run test:emulator
```

Ensure the shell's `JAVA_HOME` / `java` selects Java 21 or newer. The Firebase CLI is fetched on demand at pinned version 15.1.0; it is not a frontend dependency. Emulator runs use only loopback port 8080 and demo project `demo-nusuk-codes`, require no login or credentials, and test public REST access with anonymous and emulator-authenticated requests. They include migration and exact replay of all 1,132 candidates. The emulator data is disposable and is not exported to production.

The PR/manual validation workflow runs these checks with **read-only GitHub permissions, no secrets and no schedule**. GitHub Actions has account quotas; local checks remain the no-cost alternative if Actions minutes are unavailable. No production import or publishing workflow is installed.

## 2. Owner: check existing Firebase configuration

In the Firebase console, select existing project **nusuk-codes**. Verify Standard Edition, the default database, intended region and Spark, without a billing account. Do not create a second database or change a region. If the database is not yet created, the owner must create it in Production mode and select its permanent region. Do not enable Blaze, Functions, TTL, PITR, managed backups, extensions, scheduled Firebase jobs or paid services.

Inspect existing data and rules before changing them. Save the current rules locally for reference. With the owner's Firebase CLI login, deliberately deploy only these files after the emulator tests pass:

```sh
npm exec --yes --package firebase-tools@15.1.0 -- firebase login
npm exec --yes --package firebase-tools@15.1.0 -- firebase deploy --project nusuk-codes --only firestore:rules,firestore:indexes
```

`firestore.rules` denies **every client read and write**, including published codes, authenticated users, submissions, config and nested collections. The index file disables indexing for large source/batch/review-note fields; ordinary season/status/code/normalizedLookup equality filters use built-in index merging. If production requests report a missing index, stop and inspect the exact query; do not fall back to client reads or silently export a partial feed. No index/rule deployment was executed by this implementation task.

## 3. Owner: least-privilege credentials

Use dedicated administrative identities, not the web app, your personal owner identity or a broadly privileged project key. Prefer a read-only exporter identity separate from the importer/reviewer. Configure IAM on **this project only**. A custom importer role needs `datastore.entities.get`, `datastore.entities.list`, `datastore.entities.create`, `datastore.entities.update` and `datastore.databases.get`; no delete, IAM, billing, Functions or project-owner permissions. Exporter needs only entity get/list and database get. Verify permissions against current Google IAM documentation and test the intended identity; do not expand privileges automatically after an error. IAM applies beyond Security Rules, so restrict who can obtain these credentials. Rules/index deployment remains an owner operation, not an importer privilege.

If using a service-account key, create it in Google IAM/Firebase's service-account settings and supply its JSON directly through the local `NUSUK_FIREBASE_CREDENTIALS_JSON` environment variable in a dedicated private operator shell. Do not paste it into chat, a command history, a repository file or CI logs. Initialization errors redact credential details, and inline credentials must belong to the explicit project. An alternative is an explicit ADC path via `GOOGLE_APPLICATION_CREDENTIALS`, pointing to a restricted private file **outside this checkout**. Rotate/revoke a key if exposed. This example shows only the alternative path and ordinary non-secret gates:

```sh
export GOOGLE_APPLICATION_CREDENTIALS='/absolute/private/path/outside/repo/admin-credentials.json'
export NUSUK_ENABLE_PRODUCTION='nusuk-codes'
export NUSUK_ADMIN_ACTOR='owner'
unset FIRESTORE_EMULATOR_HOST
```

Never paste a key into chat, add `VITE_` variables, commit a key/.env/export, or place it in `public/`. `.env.example` contains names/path placeholders only; Python does not automatically load `.env`. The CLI uses the default database and explicit project options, not an inferred project from the credential file. Keyless external-account ADC credentials may also be supplied via this environment path if already configured; configuring federation is not required here. GitHub Secrets are **not needed** for the provided local publishing path. Never expose admin secrets to PR workflows, forked code or `pull_request_target`.

### Keyless access configured on this computer

The activation session created `nusuk-codes-reader` and `nusuk-codes-editor` service accounts and matching `nusukCodesReader` / `nusukCodesEditor` project custom roles, with the owner explicitly approving those resources and service-account-level Token Creator bindings. Reader has the three read permissions described above; editor adds entity create/update only. No service-account private key was created.

Use `GOOGLE_APPLICATION_CREDENTIALS` to point to the one existing, explicitly approved local ADC store, and set `NUSUK_IMPERSONATE_SERVICE_ACCOUNT` to the reader or editor service-account email. The CLI accepts only those two identities in `nusuk-codes`, rejects the reader for write commands, and rejects an ambiguous inline-credential override. Google's authentication library creates short-lived impersonation tokens **in memory** (30 minutes); no refresh-token copy or new credential profile file is created. The original ADC store remains sensitive owner-account authentication material and must be kept private/revoked if exposed.

On this computer, the ignored files `.admin-work/activation/reader.env` and `editor.env` contain **only non-secret environment settings and the ADC file path**, not credential JSON. For example, `source .admin-work/activation/reader.env` prepares a read-only administrative shell. The editor profile still cannot write unless updates are enabled and the CLI receives explicit `--apply` and confirmation. These local paths do not automatically provision another developer's machine; that user needs their own authorized login and impersonation binding.

The scripts do not inspect or alter billing. The owner must confirm Spark before every operational session and monitor Firebase Usage. No API gate can substitute for that manual plan check.

## 4. Export and reconcile before the first migration

Keep `admin/config.json` → `updatesEnabled: false` initially. Read-only exports are allowed through explicit production gates even while updates are disabled:

```sh
npm run admin -- export --project nusuk-codes --production --output .admin-work/before-migration.json --with-evidence
npm run admin -- reconcile --project nusuk-codes --production --input .admin-work/before-migration.json
```

Export writes a **new** JSON file, never overwrites a backup and never deletes database records. Basic export reads code documents only. `--with-evidence` includes each code's immutable `sources` and review `audit` subcollections. Both code and evidence exports have hard read caps; exceeding a cap aborts rather than saving an incomplete backup. Evidence export has a 5,000 document-read budget (including empty queries); if the data is larger, make smaller explicit exports or extend reviewed tooling before proceeding. The current CLI caps a normal export at 5,000 records and 100 source/audit records per code; do not treat a capped failure as a backup.

Reconcile compares all code documents against the baseline, reports missing/extra/changed IDs, noncanonical IDs and case-only variants, and performs zero writes. Exit 1 means differences/investigation required, not that records were repaired. Source/audit collections remain in full evidence backups; reconciliation compares code documents only. There is no destructive database restore or deletion command. Preserve a copy of exports securely outside the repository; an uncommitted local file is not a disaster recovery service.

If existing documents use legacy IDs, incompatible statuses (including old `approved`), missing verification fields or missing normalization, stop and investigate the export. Do not bulk relabel or delete them. Exact-code queries detect legacy ID duplicates and block new canonical import; reconciliation identifies other malformed/case-only legacy entries. Imports never overwrite or normalize existing documents into a new schema automatically. Deliberate legacy migration is an owner review task if such records are found.

## 5. Initial migration and future CSV imports

Copy future contributor exports into ignored `data/incoming/`, leaving the canonical 1,132-code CSV unchanged. Inputs need UTF-8 CSV columns `code,source_url`; optional `season,discovered_at,source_date`. Existing supplied columns are accepted; **CSV status/approval/note fields never confer publication approval**. Valid code cells may contain exact `NG-` tokens or an exact official `https://services.nusuk.sa/app?...&id=...` URL. Case is preserved, and only surrounding punctuation/whitespace is trimmed. Unknown formats/hosts, malformed records, wrong seasons, missing sources and formula-shaped code values block import.

`--observed-at` is required and must be a timezone-aware ISO timestamp. Use the actual contributor observation time, not a made-up post publication date. For the initial date-only dataset, the examples use `00:00:00Z` as a normalized day marker, not a known precise extraction time; retain that precision limitation with the original CSV and migration reports. A row's `discovered_at` overrides it; `source_date` is optional actual publication evidence. Source URLs are allowlisted HTTPS Facebook post / official Nusuk URLs and are never fetched by the scripts. No Facebook scraping or login bypass is performed. Input files are capped at 5 MB/10,000 rows; one import invocation handles at most **250 unique codes**, each at most 20 source sightings, sequentially with API concurrency one. Exact duplicate rows are reported and their distinct evidence retained; case-only variants require investigation and are never merged.

First validate offline (no credentials, reads or writes):

```sh
npm run validate:csv -- --input data/current_season_codes.csv --season 2026-11 --observed-at 2026-11-01T00:00:00Z
```

After owner verification/configuration and emulator tests, deliberately set `updatesEnabled: true` in `admin/config.json`. This activates administrative update capability only; it changes no data by itself. Run one bounded dry-run:

```sh
npm run ingest -- --input data/current_season_codes.csv --season 2026-11 --observed-at 2026-11-01T00:00:00Z --project nusuk-codes --production --offset 0 --limit 250 --dry-run --report .admin-work/plan-0000.json
```

Read the full report. It includes row counts, invalid rows, exact duplicates, case variants, selected/deferred counts, existing/new IDs and the **exact** confirmation token, which binds project, season, exact file SHA256 and selected slice. Then run the same command with `--apply --actor owner --confirm 'COPY THE EXACT confirmation VALUE FROM THE REPORT'` instead of `--dry-run`, and use a new report filename. This is a manual command; no production import has been activated for you.

Repeat dry-run/review/apply for offsets **250, 500, 750, 1000**, always with limit 250. The final slice has 132 codes. Do not change/reorder the CSV between slices. A changed file produces a new SHA/confirmation. The batch identifier defaults to the exact file SHA; an optional `--batch` adds a human-readable label. Keep the original file and reports as an audit trail. All 1,132 imported documents start **pending**, not published.

For future CSVs, substitute their path and genuine observation timestamp. No frontend source edits are needed for new current-season codes or observation dates. This release deliberately accepts only competition season `2026-11` (public alias `nov-2026`); a different competition season needs an explicit season migration so history/feed seasons cannot silently mix.

Partial failures: each code and all its new source sightings commit atomically in one transaction. The first failed code stops the invocation; reports distinguish processed, failed and skipped. Previous successful transactions stay intact. Re-run the **same slice/file/observation time** after fixing access/network/quota availability. Create-if-absent, stable IDs and source evidence IDs make replay safe even if a commit succeeded but its response was lost. SDK transaction conflict retries are capped at three; there is no unlimited application retry, quota polling loop or automatic billing upgrade. Existing published/hidden/invalid/pending records are never overwritten by imports; new distinct evidence is added without changing their status, revision or original provenance.

After migration, export another complete evidence backup and reconcile against it. Comparing to the pre-migration baseline should show deliberate new IDs only. Confirm expected totals and pending/unverified status before review.

## Current display policy — 2026-11-01 update

The owner's current rule is `community-current-season-v1`: display syntactically valid community codes attributed to the current season without requiring redemption testing. New review decisions may use `publicationPolicy`, `syntaxChecked: true` and `seasonAttributed: true` instead of claiming independent source/season review. Redemption stays unverified/false. Legacy source-reviewed decisions remain supported for compatibility. Policy approval is separate from permission to apply writes or publish a snapshot; all existing confirmation/update gates remain.

See `imports/2026-11-01/PUBLICATION_PLAN.md` for the reconciled 408-code addition, 43 source sightings, complete projected 1,540-code snapshot, tests and rollback. `python3 -m admin.prepare --help` documents the offline, no-network planner. Its projected inventory is not promotable; actual publication must regenerate a stage from approved published Firestore records. The older examples below describe the legacy review path; do not set independent-review flags merely to satisfy an old example.

## 6. Review explicit decisions, then publish administratively

Each `codes/{sha256}` ID is SHA-256 of `2026-11 + NUL + exact_case_code`. Record fields include exact code, season, primary source URL, discovery timestamp, optional actual source publication date, status (`pending|published|hidden|invalid`), verification, `redemptionVerified: false`, initial batch/file SHA, creator/time, normalized lookup for **investigation only**, and revision. Separate `sources/{hash}` documents retain additional sightings; `audit/{planHash}` records status changes with previous status, note, actor, time and revision.

From the export, create a private JSON review plan for **selected** records, max 250 decisions. Example structure (substitute actual exported ID/code/revision):

```json
[
  {
    "id": "<exported canonical document ID>",
    "code": "NG-dX626jFL",
    "expectedStatus": "pending",
    "expectedRevision": 0,
    "status": "published",
    "sourceReviewed": true,
    "seasonReviewed": true,
    "note": "Describe the actual source/season evidence reviewed; redemption remains unverified."
  }
]
```

Do not set independent-review booleans without evidence. Under the new owner policy, valid current-season community codes may instead receive explicit policy-based display approval without redemption testing. Use `hidden` or `invalid` to stop future display after review; no irreversible deletion. Re-publishing also requires explicit evidence. Save the plan at `.admin-work/review.json`:

```sh
npm run admin -- review --project nusuk-codes --production --input .admin-work/review.json --dry-run
```

Inspect the results and copy its exact confirmation. Repeat with `--apply --actor owner --confirm 'REVIEW nusuk-codes 2026-11 <planHash>' --report .admin-work/review-result.json`. Revision/status/code are rechecked transactionally; a conflicting review fails rather than overwriting newer decisions. Replaying the same already-applied plan is a no-op. Plans and errors are recorded locally; committed review audit documents preserve successful changes if a later item fails. Source sighting imports do not invalidate a review revision or replace original evidence. Review changes do not change the CDN feed until a snapshot is explicitly promoted and deployed.

## 7. Stage a snapshot, inspect it, and promote through a PR

```sh
npm run snapshot -- --project nusuk-codes --production --output .admin-work/stage-001
npm run admin -- verify-snapshot --input .admin-work/stage-001
```

Snapshot query reads **published current-season** records only and checks source/season review metadata and unverified status. Output is deterministic by exact-case code order and stable metadata-derived generation time. It strips full URLs, identities, audit and batch fields; public data contains only exact code, unverified status, source domain and observation date. Staging writes a new directory atomically, never overwrites prior staging and never touches `public/`. Malformed records, wrong season, missing metadata, duplicate codes, byte limits, truncated queries and empty feeds fail closed. An empty feed requires deliberate `--allow-empty` at staging and promotion. Published does not mean redemption verified.

Inspect `manifest.json`, the hash JSON, and private `publication.json` inventory. Promotion requires the matching code-ID/review-revision inventory; the old preview fixture lacks it and cannot accidentally be promoted through this command. This inventory is a local workflow check, not a signature or a substitute for review of trusted operator/CI source code. Compare its expected count and contents to the review/export. If only some old preview candidates have been reviewed, the new published-only snapshot will omit the rest: **do not promote until you deliberately approve that removal**, or keep the current preview unchanged while reviewing more records. The script never silently merges pending candidates into a published snapshot.

Preview the exact add/remove diff without touching any public files (works while updates are disabled):

```sh
npm run admin -- promote --input .admin-work/stage-001 --dry-run
```

The report includes exact added/removed code lists, the current SHA, and the confirmation token. Copy the **current** SHA from checked-in `public/data/manifest.json` and the staged SHA. Explicitly promote locally:

```sh
npm run admin -- promote --input .admin-work/stage-001 --expect-current '<current snapshotSha256>' --confirm 'PUBLISH <staged snapshotSha256>'
```

Any removal requires additional `--allow-removals`; an empty replacement additionally requires `--allow-empty`. A lock prevents simultaneous promotion processes. Validation and current-SHA checks happen before writing. The prior manifest is archived at `snapshots/history/<manifest-hash>.manifest.json`, prior code assets are retained, the new immutable asset is written first, and the live manifest is atomically replaced **last**. Disk failures before the final replacement leave the prior manifest usable. If a killed process leaves `.admin-work/publishing.lock`, verify no publisher is running before removing that stale lock. Do not delete old code assets referenced by archived manifests.

Then review `git diff`, run all app/admin checks, make a publishing branch/PR containing **only** `public/data/`, the previous manifest archive and necessary documentation, and merge it after CI and owner review. The existing Vercel static deployment (if configured) deploys the checked-in pair together; no Functions or runtime Firestore credentials are required. Publication requires neither frontend source edits nor hand-editing JSON. This manual CLI + PR path is the explicit no-cost equivalent of a privileged publishing Action and avoids storing admin secrets in GitHub. The validation Action cannot publish, write Firestore or merge a PR.

The legacy Phase 1 fixture script is now **staging-only** (`npm run snapshot:preview -- --output .admin-work/preview-fixture`); it refuses `public/` and cannot accidentally overwrite a published feed.

## 8. Rollback and emergency stop

Set `updatesEnabled: false`, stop any running operator process, and unset `NUSUK_ENABLE_PRODUCTION`, `NUSUK_IMPERSONATE_SERVICE_ACCOUNT`, `NUSUK_FIREBASE_CREDENTIALS_JSON` and `GOOGLE_APPLICATION_CREDENTIALS` to disable new privileged sessions. Remove/revoke the service-account credential if compromised. There is no discovery schedule or public submission endpoint to disable. Current CDN browsing continues independently of Firestore or a quota outage.

For a CDN rollback, prefer the host's previous complete deployment, or inspect a retained archive and perform a confirmed local rollback:

```sh
npm run admin -- rollback --input snapshots/history/<previous-manifest-hash>.manifest.json --expect-current '<current snapshotSha256>' --confirm 'ROLLBACK <previous snapshotSha256>'
```

Rollback is offline and is allowed even when updates are disabled, but requires exact confirmation and the unchanged expected current SHA. It validates the previous referenced asset, preserves the outgoing manifest, then atomically restores the old manifest. Review/commit/deploy this rollback pair together. This does not undo Firestore moderation decisions. The browser retains season/code history across snapshot versions. Cached earlier feeds can continue to show hidden codes offline until a refreshed CDN feed loads; emergency revocation cannot be guaranteed in a static offline client.

A missing/invalid CDN snapshot falls back to the browser's checked cached feed or an error/retry state; neither network failure nor Firestore quota issues erase local history. Admin quota/credential failures stop processing and do not replace the live dataset. Zero billing is not unlimited hosting availability.

## Estimated administrative operations

Assuming U selected distinct codes, one source per code, no conflicts/retries, canonical existing data, and one matching/empty document charged per equality query:

| Operation | Document reads | Document writes |
| --- | ---: | ---: |
| Offline CSV validation | 0 | 0 |
| Dry-run import | about 3U (canonical get, exact-code query, case-variant query) | 0 |
| New import | about 4U (two queries + code/source transaction reads) | 2U (code + source) |
| Exact repeat import | about 4U | 0 |
| Existing code, one new source | about 4U | U source documents only |
| Review R decisions | about R | 2R (code update + immutable audit), 0 for already-applied plans |
| Published-only snapshot P records | max(P, 1), cap+1 on overflow | 0 |
| Basic export / reconciliation N records | max(N, 1), cap+1 on overflow | 0 |
| Full evidence export | N + source/audit queries, including empty queries; 5,000-read hard budget | 0 |
| Promotion / rollback / visitor Next/Copy/Open | 0 Firestore reads | 0 Firestore writes |

For one **250-code** new slice: dry-run ~750 reads; apply ~1,000 reads / 500 writes. For **1,132** initial codes across five slices: dry-run + apply ~7,924 reads / 2,264 writes; exact full replay ~4,528 reads / zero writes. One source and no review audits yields a full evidence export ~3,396 reads. Reviewing all 1,132 later is ~1,132 reads / 2,264 writes, followed by ~1,132 snapshot reads. These estimates are not a quota reservation or SLA. Additional sightings, case collisions, retries, concurrent operations, existing unrelated usage, and SDK behavior can add operations; check Usage before each session. The code uses single-operation concurrency, caps selected codes/queries/sightings, and stops on the first import/review failure rather than silently continuing through quota errors.

Standard's currently documented no-cost daily allowances are 50,000 reads / 20,000 writes / 20,000 deletes, with further storage/egress limits. Spark must remain configured without billing; no script upgrades plans. Verify the console and current official docs before activation. Manual staged sessions can be split across days if quota headroom is insufficient.

## References checked for this implementation

- [Admin setup and credential handling](https://firebase.google.com/docs/admin/setup)
- [Server libraries bypass Security Rules and use IAM](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Transactions and retries](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Emulator installation / Java requirements](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [Firestore usage and quotas](https://firebase.google.com/docs/firestore/quotas)
- [Firebase Spark plan](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
