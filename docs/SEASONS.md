# Season policy

This policy guides future maintenance. It does not implement multi-season browsing or change the active dataset.

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

These are operating-policy states, not new schema fields or implemented UI states. Do not delete old codes automatically. Keep local history tied to its season, and do not reinterpret old seen/tried/skipped records as another edition's progress.

## Prepare a future season

1. Verify that the challenge is running or officially announced. Record the official evidence and its date.
2. Confirm the observed code format, relevant official links, participation rules and remaining uncertainties.
3. Review public community sources and distinguish observation dates from publication dates.
4. Prepare a migration and activation plan covering identifiers, constants, schemas if needed, local-history compatibility, dataset isolation, snapshot validation and rollback.
5. Assess any proposed reuse of old codes using fresh season evidence. Syntax alone is insufficient.
6. Obtain owner review before implementation and explicit approval before activation or publication.

Use the established administrative runbooks for controlled data changes. Historical execution reports retain the counts and decisions of their original sessions. [Full runbook](PHASE2A_ADMIN.md) · [Quick Import](QUICK_IMPORT.md) · [Provenance](../DATA_PROVENANCE.md)
