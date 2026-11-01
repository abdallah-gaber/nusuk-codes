# Quick incremental import and publication

Implemented locally; production activation, imports and deployment have **not** been performed by this change. The current 1,540-code release is untouched. This workflow is for the existing `2026-11` season and owner policy `community-current-season-v1`.

## Routine commands

With the existing local administrative environment prepared:

```sh
npm run codes:update -- --file data/incoming/new-codes.csv --dry-run
npm run codes:update -- --file data/incoming/new-codes.csv --apply
```

Dry-run is the default. It performs **read-only production lookups**, prints counts and a deterministic `UPDATE 2026-11 <planId>` confirmation, and saves private details. Apply computes a fresh plan, prints that same summary, and requires typing the exact current token **once before any Firestore write**. A stale token fails. A noninteractive operator can supply the exact reviewed token with `--confirm 'UPDATE 2026-11 <planId>'`; there is no `--yes` shortcut.

The confirmation covers the bounded import and validated local snapshot/rollback preparation, plus opening a publishing PR by default. It never authorizes merging or production deployment. PR review is the separate release boundary. `--prepare-only` stops at local snapshot preparation without Git commit, push or PR creation.

## One-time local prerequisites (owner must activate later)

1. Review/merge the tooling through the normal approved code-review process first. Use the existing Python virtualenv/dependencies, Node and `gh` login. No new Firebase identity, API, service-account key, CI credential, paid feature or permission is needed.
2. Keep `admin/config.json` → `updatesEnabled: false`. Quick imports have a separate opt-in, also disabled by default. In the private editor shell/profile, deliberately set:

   ```sh
   source .admin-work/activation/editor.env
   export NUSUK_ENABLE_QUICK_IMPORT=nusuk-codes
   export NUSUK_QUOTA_HEADROOM="$PWD/.admin-work/quota-headroom.json"
   ```

   The environment opt-in does not edit the tracked kill switch or open a public endpoint. The alternative `quickImportEnabled: true` config flag is intended for deliberately reviewed configuration, not a per-run edit. Production still requires `NUSUK_ENABLE_PRODUCTION=nusuk-codes`, the existing explicit ADC path, approved editor impersonation and an actor. Existing reader credentials work for dry-run only; reader apply is rejected. Never source production credentials for emulator testing.
3. Start automatic PR preparation from **clean, current `main`** in `abdallah-gaber/nusuk-codes`. The CLI checks the exact remote, fetches `origin/main`, requires matching HEAD, and checks local GitHub authentication before prompting/writing. It does not reset, stash or merge operator changes. Keep CSVs outside Git or in ignored `data/incoming/`.
4. Before apply, inspect the Firebase Usage console and confirm Spark with no billing. Write remaining daily document-read/write allowances to the private file below. Subtract already-used operations, including a preceding dry-run; do not assume a new day's full allowance. The attestation must be at most one hour old, and is checked again immediately before writes:

   ```json
   {
     "project": "nusuk-codes",
     "checkedAt": "<actual ISO UTC timestamp from this check>",
     "billingEnabled": false,
     "readsRemaining": 12000,
     "writesRemaining": 8000
   }
   ```

   `--quota-headroom /private/path/quota.json` can replace the environment path. Counts must be integers within Spark's daily ceilings. Apply requires estimated operations **plus 20% headroom** to fit. The file is a manual owner attestation, not an API measurement or quota reservation. We intentionally do not grant Monitoring/billing permissions or query account-wide usage automatically. Other traffic and retries can consume quota; a quota/network failure stops the run. Never enable billing to continue.

For a read-only preview, source `.admin-work/activation/reader.env` instead. Dry-run requires no quick-import opt-in or quota attestation. Do not paste credentials into commands, reports, chat or GitHub Secrets.

## CSV and policy

Required UTF-8 columns: `code,source_url`. Optional: `season,discovered_at,source_date`. Existing Facebook extractor CSVs are accepted; CSV status fields cannot grant approval. Preserve `NG-` followed by eight exact-case alphanumeric characters; official Nusuk referral URLs are parsed by the existing validator. Only the existing allowlisted HTTPS source hosts are accepted; URLs are never fetched.

Every new code gets one primary document, its distinct source documents (up to 20) and one minimal audit in **the same atomic batch**, all create-if-absent. It starts published for community display, revision 1, with the policy, syntax and season-attribution flags. It remains `community_submitted_unverified` and `redemptionVerified: false`; independent source/season-review flags remain false. Format and owner-attributed season are not redemption verification.

Every existing code is **skipped completely**, including pending/hidden/invalid records: no status change, original provenance overwrite, extra audit or source write. The private CSV retains additional sightings; use the separate existing provenance importer if you deliberately want to append those sightings later. Distinct evidence within new-code duplicate rows is preserved. Case variants are flagged and block apply rather than being merged. Cross-season exact matches, wrong-season CSV rows, legacy IDs, invalid rows and count/cap drift block publication.

Use actual `discovered_at` values or `--observed-at` when known. Otherwise the first local receipt time is saved once per exact file SHA and reused, explicitly as **workflow observation**, never a Facebook publication/extraction time. Reusing the same file with a different fallback timestamp is rejected. Input bytes and metadata are retained privately, making retries stable.

## What one run does

1. Validate the CSV and local manifest/hash pair. Look up only incoming canonical IDs in **100-document BatchGet RPCs**. Check exact and normalized incoming values using bounded **30-value queries**, across seasons for conflicts. Normalized lookup only flags case variants; identity always uses exact case. Use two count aggregations for existing total/published counts.
2. Save an affected-ID checkpoint: existence, revision, status and primary-record fingerprint. No source/audit collection export. The token binds the CSV SHA, checkpoint, counts, observation fallback, policy and current snapshot SHA.
3. After confirmation, create new code/source/audit bundles in sequential atomic batches of **at most 250 writes** (83 codes per batch with one source each). API concurrency is one; all RPCs have deadlines and automatic SDK retries are disabled. `create` preconditions prevent overwriting a record if another operator wins a race.
4. Batch-read touched primary records once; require unchanged skipped records and exact created records. Check the final total via one aggregation. Read **published primary snapshot fields only once**, capped at 5,000 codes, with no source/audit subcollection scans. Require the planned published total.
5. Build the complete sorted, content-hashed snapshot using the existing schema, byte budgets, checksum and actual publication inventory. Existing CDN entries must be byte-equivalent as entries; no automatic removals or changed provenance. Separate moderation publishing must handle hiding/removals first. A failed check leaves the prior manifest active.
6. Archive the previous manifest, retain old immutable assets, and replace the local manifest **last** under the existing publication lock. Never stage `publication.json`, input CSVs, checkpoints, credentials or `.admin-work` in Git.
7. Default production apply commits only the public manifest/new asset/previous-manifest archive on a new `codes/...` branch and opens a PR via `gh`. No force push, merge, protection bypass or deploy command exists. Existing CI validates the PR; configured Vercel preview builds may run on the branch. **The owner reviews and approves any merge/production deployment.**

An identical replay whose published count still matches the current CDN pair is a no-op: no writes, snapshot query, local promotion or PR. If a prior partial run left newly published Firestore records ahead of the CDN, replay finishes the complete snapshot without re-creating those codes/audits.

## Failures and safe retry

All private evidence is in `.admin-work/quick-import/<exact-input-sha>/attempt-####/`: plan, checkpoint, result and (when generated) actual staged snapshot. The original CSV and persistent observation metadata sit alongside attempts. Existing files are retained; a local lock prevents two quick-import sessions. Do not remove a stale lock until checking that its operator process has stopped.

On a batch error, the first failed/ambiguous batch stops further writes. `result.json` identifies confirmed batches and uncertain IDs. A lost commit response may mean that entire batch succeeded. Fix the specific credential/network/quota issue, refresh quota headroom, and rerun the **same unchanged CSV** with a fresh confirmation. Targeted lookups recognize already-created documents; there is no destructive rollback, blind overwrite, unbounded retry or repeated full export. Do not publish the partial result manually. No later write is scheduled in the background.

If post-verification or snapshot generation fails, existing Firestore creates can remain published but the live CDN is unchanged. Re-plan and investigate the reported IDs/counts; do not force a count or bypass preservation. For historical/legacy data anomalies use the full reconciliation runbook separately.

If PR preparation fails, the validated local pair and previous snapshot remain. Inspect the current Git branch/status and the private result; finish only the missing Git/PR step. Do not repeat Firestore work just because `gh` or a push failed. A local failure after a manifest switch does not change production; review/restore the retained pair rather than assuming remote deployment happened.

Emergency stop: interrupt the operator, set `NUSUK_DISABLE_ADMIN_UPDATES=1` for new quick sessions, unset `NUSUK_ENABLE_QUICK_IMPORT`, leave both config flags false, and unset production credential environment settings. Revoke impersonation access only if compromised. No scheduled worker or public admin API exists.

## Release verification and rollback

After the owner merges the reviewed PR and the existing Vercel deployment succeeds, run **one** canonical CDN check from that release checkout:

```sh
npm run codes:verify-live
```

It fetches the production manifest and its asset once, requires the reviewed local manifest, then checks season/schema, exact distinct count, public-only entry fields, byte limits and SHA-256. It performs zero Firestore operations. If it fails because the deployment/cache is still old or a real integrity mismatch exists, inspect that specific failure; do not rerun imports, full backups or all test suites. Check the app loads after an approved release as needed.

For rollback, prefer the previous complete Vercel deployment. Alternatively use the existing offline confirmed rollback with the archived manifest from `result.json` and the **actual current** checksum:

```sh
npm run admin -- rollback --input snapshots/history/<previous-manifest-hash>.manifest.json \
  --expect-current '<current snapshot SHA>' --confirm 'ROLLBACK <previous snapshot SHA>'
```

Review/commit/deploy the restored pair through a separately approved PR. This does not delete imported records, source evidence, audits or local visitor history. Cached offline feeds cannot guarantee instant revocation.

## Periodic backup: separate operation

Keep full backups for emergencies/migrations; run a deliberate periodic backup (for example weekly, and before schema/legacy migrations), **not once per routine import**. Check remaining read headroom first. With the existing reader identity, use a new private filename:

```sh
npm run admin -- export --production --project nusuk-codes --with-evidence \
  --read-budget 20000 --output .admin-work/backups/<timestamp>.json
```

Default evidence-export budget remains 5,000; the new explicit bounded override supports up to 20,000 reads for periodic backups after the dataset grows. No truncated export is saved. The 5,000-code and 100-evidence-record-per-code limits remain; stop and review capacity if reached. At 3,540 codes with one source/audit each, about 10,620 reads plus the existing extra sightings are needed. Full exports are still sequential and deliberately separate from the fast path. Copy completed backups securely outside the checkout under the owner's retention policy. `admin reconcile --input <backup>` remains available for migrations/emergencies, not a mandatory routine scan. No paid/managed backup service is enabled.

## Operation estimates

Assumptions: current total/published count **1,540**, incoming codes all valid/new, one source each, no conflicts or retries. Includes one apply preflight, touched-record verification, post-count and one complete published query. Query empty minimums and count aggregation reads are included. These are estimates, not measured billing counters or reserved capacity.

| Incoming | Apply reads | Apply writes | Optional preceding dry-run reads | Reads including that dry-run | Required apply read/write headroom (20% margin) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 3,081 | 1,500 | 538 | 3,619 | 3,698 / 1,800 |
| 2,000 | 7,682 | 6,000 | 2,138 | 9,820 | 9,219 / 7,200 |

For N all-new codes and existing P=1,540, apply reads are approximately `3N + P + 2*ceil(N/30) + 2*ceil(P/1000) + ceil((P+N)/1000)`. Writes are `2N + source-document-count` (3N with one source). Additional existing/cross-season matches add targeted lookup reads; extra distinct sources add writes. Re-importing existing codes costs **zero writes** and, when no snapshot change is needed, only preflight reads. PR creation, CDN checks and visitor browsing cost zero Firestore operations. Stop on any exhausted quota; do not attach billing.

See [the illustrative offline dry-run report](examples/quick-import-dry-run.json) and the existing [administration runbook](PHASE2A_ADMIN.md).

## Safeguards retained and deliberately relaxed

Retained: deny-all public rules, existing least-privilege IAM/keyless local credentials, no public SDK/API, explicit production gates and one exact write confirmation, exact-case deterministic IDs, source validation/provenance, redemption-unverified status, bounded RPCs/writes, atomic create preconditions, immutable audits, fail-stop replay, touched-record/count checks, complete validated snapshots, additive-only routine publishing, previous assets/manifest rollback, reviewed PRs and owner-controlled deployment. No new credentials enter CI; read-only PR validation remains unchanged.

Relaxed for this owner-approved policy: no per-code human display review for **new** eligible community codes; no full source/audit export/reconciliation during routine imports; one post-import snapshot pass instead of repeated exports and integrity scans; skipped existing records receive no additional sightings automatically. Periodic full backups and separate moderation remain available. No claim of redemption, source eligibility or complete Facebook extraction is added.
