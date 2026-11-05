# Owner setup

The public app requires no Firebase configuration or secrets. Follow the README for local frontend setup. [Development](README.md#development)

Administrative updates are disabled in the checked-in configuration between approved sessions. The manifest identifies the current public release. Earlier setup, migration and publication reports are historical evidence, not a statement of the current database count. [Current manifest](public/data/manifest.json) · [Initial activation record](docs/PHASE2A_ACTIVATION.md) · [Earlier publication record](imports/2026-11-01/PUBLICATION_RESULT.md)

## Administrative workflows

Use the full runbook for a new operator, initial setup, migration, emergency reconciliation or backup. It covers least-privilege access, deny-all public rules, local/emulator checks, explicit approvals and rollback. Stay on Spark without billing. Keep credentials outside the repository and frontend. [Full admin runbook](docs/PHASE2A_ADMIN.md)

Routine approved CSV updates use Quick Import, with its own activation gates, affected-record checkpoint, bounded operations, quota attestation and confirmation. This workflow preserves existing primary records and source evidence while preparing a validated snapshot and publishing PR. It does not authorize a merge or production deployment. [Quick Import](docs/QUICK_IMPORT.md)

Keep prior snapshot assets and manifests for rollback, restore disabled updates after each session, and retain evidence securely. Follow the full runbook before changing rules, indexes, identities or permissions. The supplied `docs/OWNER_SETUP.md` is historical guidance.

## Community follow-ups

The source code uses the owner-approved MIT License. It does not assert ownership of third-party codes, branding or source content. A dedicated confidential Code of Conduct reporting channel still needs an owner-designated contact. Public Issues handle general concerns, and GitHub's reporting mechanisms handle violations of its policies. [LICENSE](LICENSE) · [Code of Conduct](CODE_OF_CONDUCT.md)

Review official evidence and an activation plan before preparing a new challenge season. [Season policy](docs/SEASONS.md)
