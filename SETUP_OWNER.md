# Owner setup — Phase 1

No Firebase project, credentials, billing, service account, DNS changes or hosting account are needed now.

Install Node 22+, run `npm ci`, then `npm run dev`. Validate with lint/typecheck/test/build. Share the local Phase 1 preview for review only: candidates are not approved production data.

Later phases require separate implementation and review. Firebase Spark rules/emulator and least-privilege admin snapshot export are Phase 2; public Vercel deployment/custom domain is Phase 3. Use the exact DNS values supplied by the eventual host without disturbing existing apex/www records. See supplied `docs/OWNER_SETUP.md`; its Firebase/discovery steps are deferred, not completed here.

Never commit admin credentials or request Nusuk login information. Submissions and invalid-code reporting need real server-side abuse controls before enabling. A client-only quota is not security.
