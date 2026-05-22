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
- Billing foundation: Stripe webhook, billing tables, shared entitlement rules, frontend and Edge entitlement readers.
- Offline banners, PWA metadata, mobile practice flows, and core UI tests.

Not shipped yet:

- User-facing pricing page, Stripe Checkout session creation, Customer Portal session creation, and upgrade prompts.
- AI answer feedback on submitted practice answers.
- Readiness scoring based on feedback.
- Lifecycle notifications.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn-style UI components, TanStack Query.
- Backend: Supabase Auth, Postgres, Storage, Realtime, Edge Functions.
- Search and AI: Tavily-backed research plus OpenAI-backed analysis/generation.
- Billing: Stripe webhook and entitlement foundation. Checkout and portal flows are next.
- Tests: Vitest for the main frontend/service suite. Deno edge-function tests exist but are legacy.

## Main Commands

```bash
npm test
npm run build
make test
```

`npm test` is the main local safety net. `make test` runs older Deno files and should not be treated as a release gate until those tests are updated.

## Key Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Testing](docs/TESTING.md)
- [Product strategy](docs/PRODUCT_STRATEGY.md)
- [Billing contract](docs/BILLING.md)
- [Runbook](docs/RUNBOOK.md)
- [Design audits](docs/audits/README.md)
