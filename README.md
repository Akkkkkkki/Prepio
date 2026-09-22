# Prepio

Prepio is free, invite-only interview preparation: company/role research, a saved plan,
text practice, saved answers, Favorite / Needs-work, and History. Guests can explore a
fixed local sample without making an AI request.

## Freeze status

The source now locks the product boundary. **Production is not yet a verified freeze.**
The credential/history cleanup, production Auth settings, migration/function reconciliation,
schema/types refresh and one production acceptance pass remain release gates in
[the freeze release runbook](docs/FREEZE_RELEASE.md).

Billing, paid feedback, public signup, dynamic guest research, profile/settings expansion,
voice, file upload and CV import are outside this release. Existing records are preserved.
Use optional pasted CV text when creating research. Restoring any excluded surface needs
an explicit scope decision and deployment/acceptance of its backend path.

`npm run functions:deploy` now prints a dry run of the five-function manifest. Execution
requires a clean reviewed commit, `PREPIO_DEPLOY_COMMIT`, and `--execute`; it can no longer
silently deploy every function. See the runbook before deploying.

Scheduled repository implementation and routine dependency updates are paused. Security
alerts remain in scope. Broader roadmap documents describe deferred work, not this release.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn-style UI components, TanStack Query.
- Backend: Supabase Auth, Postgres, Storage, Realtime, Edge Functions.
- Search and AI: Tavily-backed research plus OpenAI-backed analysis/generation.
- Historical billing implementation is retained but excluded from this release.
- Tests: Vitest for the main frontend/service suite. Deno edge-function tests exist but are legacy.

## Main Commands

```bash
npm test
npm run typecheck
npm run build
make test
```

`npm test` and `npm run typecheck` are the main local safety net and both are blocking CI
steps. `make test` runs older Deno files and should not be treated as a release gate until
those tests are updated.

## Key Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Research pipeline](docs/RESEARCH_PIPELINE.md)
- [Roadmap](docs/ROADMAP.md)
- [Testing](docs/TESTING.md)
- [Product strategy](docs/PRODUCT_STRATEGY.md)
- [Billing contract](docs/BILLING.md)
- [Runbook](docs/RUNBOOK.md)
- [Design audits](docs/audits/README.md)
