# Prepio

Prepio is an interview-prep app that turns a company, role, job description, resume, and candidate profile into targeted research, likely interview stages, tailored questions, and practice sessions.

## Current Status

Shipped:

- Research pipeline for company, role, job, resume, stage, prep-plan, and question generation.
- Authenticated history, dashboard, saved practice sessions, favorites, skips, and self-ratings.
- Resume upload for PDF/DOCX, pasted resume text, active resume versioning, and file cleanup.
- Structured candidate profile with AI-assisted import and merge drafts.
- Practice audio upload, transcription, and saved answer transcripts.
- Offline banners, PWA metadata, mobile practice flows, and core UI tests.

Not shipped yet:

- Stripe billing, subscription tables, entitlement resolver, Checkout, Customer Portal, or webhooks.
- AI answer feedback on submitted practice answers.
- Readiness scoring based on feedback.
- Lifecycle notifications.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn-style UI components.
- Backend: Supabase Auth, Postgres, Storage, Edge Functions.
- Search and AI: Tavily-backed research plus OpenAI-backed analysis/generation.
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
- [Billing plan](docs/BILLING.md)
- [Runbook](docs/RUNBOOK.md)
- [Design audits](docs/audits/README.md)
