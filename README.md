# Prepio

Prepio is an interview-prep app that turns a company, role, job description, resume, and candidate profile into targeted research, likely interview stages, tailored questions, and practice sessions.

## Current Status

Shipped:

- Research pipeline for company, role, job, resume, stage, prep-plan, and question generation.
- Guest research preview flow with cached preview storage and rate-limit tables.
- Authenticated history, dashboard, saved practice sessions, favorites, skips, and self-ratings.
- Resume upload for PDF/DOCX, pasted resume text, active resume versioning, and file cleanup.
- Structured candidate profile with AI-assisted CV import, automatic safe merges, and conflict review.
- Practice audio upload, transcription, and saved answer transcripts.
- Billing: Stripe webhook, Checkout session creation, Customer Portal session creation, user-facing pricing page, and entitlement-gated paid features.
- AI answer feedback on submitted practice answers, gated by entitlement.
- Offline banners, PWA metadata, mobile practice flows, and core UI tests.

Not shipped yet:

- Readiness scoring based on feedback.
- Lifecycle notifications.

> "Shipped" above means merged to `main`. The production backend has been frozen since
> 2026-05-15 — guest preview, paid answer feedback, CV import, voice transcription, and the
> billing purchase flow are not deployed there yet. Each gap is narrower than the feature
> name suggests: recording and saving a voice answer does work in production, only the
> transcript generation is missing; and the billing tables and frontend are live, so
> `/pricing`, `/billing/return`, and the entitlement read work and always resolve free —
> what is absent is Checkout, the Customer Portal, and the webhook that would write a paid
> row. See `docs/ARCHITECTURE.md`, `docs/BILLING.md`, and PREPIO-124.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn-style UI components, TanStack Query.
- Backend: Supabase Auth, Postgres, Storage, Realtime, Edge Functions.
- Search and AI: Tavily-backed research plus OpenAI-backed analysis/generation.
- Billing: Stripe webhook, entitlement foundation, Checkout, and Customer Portal.
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
