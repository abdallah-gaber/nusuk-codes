# مفاتيح نسك · Nusuk Codes Hub

Independent Arabic-first community code browser. **Phase 1 only. Not affiliated with Nusuk.**

## Run

Node 22+ and npm. Run `npm ci`, `npm run dev` (localhost:5173).

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Regenerate the deterministic fixture with `npm run snapshot`.

## What ships

Responsive RTL React + TypeScript + Vite + Tailwind interface, theme override/system dark mode, selectable exact-case codes, Copy, official Nusuk link, explicit Next/Skip/Tried, Undo, confirmed reset, persistent season-scoped history, cross-tab synchronization, JSON history export/merge, touch/keyboard educational strip, source disclosures, FAQs and site sharing. Loading, errors/retry, empty, exhausted, stale, maintenance, offline/cache and blocked-storage states are implemented.

The supplied 1,132 candidates are a **development preview**, not approved production data. Zero have confirmed redemption. No login, personal data, trackers, Firebase SDK, backend, public submissions or automated discovery. No deployment has been performed. See [DATA_PROVENANCE.md](DATA_PROVENANCE.md).

## Phase boundary

Phase 2 Firebase, security rules/emulator, privileged import/moderation, Phase 3 public deployment/DNS, Phase 4 collection and Phase 5 broader hardening remain deferred. No Firebase or DNS setup is needed to run Phase 1.

See [ARCHITECTURE.md](ARCHITECTURE.md), [OPERATIONS.md](OPERATIONS.md), [SETUP_OWNER.md](SETUP_OWNER.md), and `docs/` for supplied specifications and evidence.
