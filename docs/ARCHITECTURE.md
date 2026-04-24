# Architecture

Technical architecture of Prepio: stack, project structure, data model, edge functions, and data flows.

## Stack

### Frontend
| Technology | Role |
|-----------|------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| shadcn/ui + Radix | Accessible component primitives |
| TanStack Query | Server state management (used in hooks) |
| React Router | Client-side routing |
| react-swipeable | Touch gesture handling |
| react-hook-form + Zod | Form state and validation |
| mammoth + pdfjs-dist | Client-side resume parsing (DOCX, PDF) |
| vite-plugin-pwa | Progressive web app support |

### Backend
| Technology | Role |
|-----------|------|
| Supabase Auth | Authentication (email/password) |
| Supabase Postgres | Primary database with RLS |
| Supabase Edge Functions | Deno-based serverless functions |
| Supabase Storage | File storage (resume PDFs/DOCX) |
| Supabase Realtime | Live progress updates for research runs |
| OpenAI API | LLM for research synthesis and question generation |
| Tavily API | Web search and content extraction |

## Project Structure

```
src/
├── pages/                    # Route-level components
│   ├── Home.tsx              # Research entry form
│   ├── Dashboard.tsx         # Research results (also /search/:searchId)
│   ├── Practice.tsx          # Practice session
│   ├── History.tsx           # Practice history and stats
│   ├── Profile.tsx           # CV and preference management
│   ├── Auth.tsx              # Authentication flows
│   └── NotFound.tsx          # 404
├── components/
│   ├── Navigation.tsx        # App shell nav
│   ├── AuthProvider.tsx      # Auth context wrapper
│   ├── PublicHeader.tsx      # Branded header for public pages
│   ├── OfflineBanner.tsx     # Offline detection
│   ├── ProgressDialog.tsx    # Research progress UI
│   ├── SessionSummary.tsx    # Practice completion
│   ├── dashboard/            # Dashboard-specific components
│   ├── practice/             # Practice-specific components
│   ├── history/              # History-specific components
│   └── ui/                   # shadcn/ui primitives
├── hooks/
│   ├── useAuth.ts            # Auth state and actions
│   ├── useSearchProgress.ts  # Research progress polling
│   ├── useNetworkStatus.ts   # Online/offline detection
│   ├── useInstallPrompt.ts   # PWA install prompt
│   ├── use-mobile.tsx        # Mobile breakpoint (768px)
│   └── use-toast.ts          # Toast notifications
├── services/
│   ├── searchService.ts      # All Supabase API calls
│   ├── sessionSampler.ts     # Question sampling (Fisher-Yates)
│   └── tavilyAnalyticsService.ts  # Tavily usage stats
├── lib/
│   ├── candidateProfile.ts   # Profile types and merge logic
│   ├── researchDraft.ts      # Draft persistence and auth return state
│   └── resumeUpload.ts       # Client-side resume parsing
├── integrations/supabase/
│   ├── client.ts             # Supabase client instance
│   └── types.ts              # Generated database types (canonical)
└── types/
    └── supabase.ts           # Legacy type mirror (prefer integrations/)

supabase/
├── functions/
│   ├── interview-research/   # Pipeline orchestrator
│   ├── company-research/     # Web scraping and company intel
│   ├── job-analysis/         # Role requirements extraction
│   ├── cv-analysis/          # Resume parsing and analysis
│   ├── interview-question-generator/  # Question generation
│   ├── profile-import/       # AI profile import and merge
│   └── _shared/              # Shared utilities
│       ├── config.ts         # Model config, Tavily config, feature flags
│       ├── auth.ts           # Request authorization
│       ├── openai-client.ts  # OpenAI client wrapper
│       ├── tavily-client.ts  # Tavily client with logging
│       ├── progress-tracker.ts  # Research progress updates
│       └── ...               # URL dedup, scrapers, logging
├── migrations/               # SQL migration files
└── config.toml               # Supabase project config

tests/
├── unit/test_edge_functions/  # Deno unit tests for edge functions
└── integration/test_workflows/  # End-to-end workflow tests
```

## Database Schema

### Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile (1:1 with auth.users). Email, name, seniority. |
| `searches` | Research runs. Company, role, status, progress fields. Realtime-enabled. |
| `resumes` | CV text, parsed data, file metadata. Supports `manual`, `upload`, `search_snapshot` sources. One active profile resume per user. |
| `search_artifacts` | Research output JSON (raw research, comparison analysis, prep guidance). One row per search. |
| `interview_stages` | Generated interview stages per search (name, order, narrative). |
| `interview_questions` | Generated questions per search/stage. Rich rubric: category, difficulty, STAR flags, scoring criteria. |
| `user_question_flags` | Per-user question bookmarks: `favorite`, `needs_work`, `skipped`. |
| `practice_sessions` | Practice session records per user/search. |
| `practice_answers` | Individual answers within a session (text, time). |
| `candidate_profiles` | Structured profile JSONB (experience, education, skills, projects). Completion score. |
| `profile_imports` | AI-drafted profile imports with merge suggestions and status tracking. |
| `scraped_urls` | Backend URL cache for research pipeline. |
| `tavily_searches` | Tavily API call log (type, query, status, timing, credits). |

### Planned near-term additions

These are not shipped yet. They are the recommended data additions for the current roadmap.

| Table / area | Purpose |
|--------------|---------|
| `answer_feedback` | Structured AI feedback per `practice_answer`. Paid-only — rows only exist for subscribers. Columns: `model`, `model_version`, `summary`, `next_action`, `strengths` (text[]), `improvements` (text[]), `star_evaluation` (jsonb nullable), `created_at`, `superseded_by` (self-fk for regen). |
| `billing_customers` | 1:1 with users. Stripe customer linkage (`stripe_customer_id`). |
| `billing_subscriptions` | 1:1 with users at v1. Columns: `stripe_subscription_id`, `status`, `cadence` (`monthly`/`quarterly`/`annual`), `current_period_end`, `cancel_at_period_end`. Entitlement is *derived* from this row — there is no separate entitlements table. |
| `billing_events` | Webhook audit log. Columns: `stripe_event_id` (unique), `event_type`, `payload`, `processed_at`. Powers idempotency. |
| `usage_events` | Per-action usage log (research started, feedback generated, etc.) for monitoring and future credit-pack metering. |
| `notification_jobs` | Outbound email or push jobs keyed to product events. |

### Key relationships

```
auth.users → profiles (trigger: handle_new_user)
searches → search_artifacts (1:1)
searches → interview_stages (1:many)
searches → interview_questions (1:many)
searches → practice_sessions (1:many)
practice_sessions → practice_answers (1:many)
interview_questions → user_question_flags (1:many per user)
resumes → candidate_profiles (last_resume_id)
resumes → profile_imports (resume_id)
```

### Row-Level Security

- **User-owned tables** (`profiles`, `searches`, `resumes`, `practice_sessions`, `user_question_flags`, `candidate_profiles`, `profile_imports`): `auth.uid()` matches row owner.
- **Read-through-search** (`interview_stages`, `interview_questions`): SELECT when `search_id` belongs to user.
- **Service role only** (`search_artifacts` writes, `scraped_urls`): Edge functions write via service role key.
- **Realtime**: `searches` table is published for live progress updates.

### Storage

- **Bucket**: `resume-files` (private, PDF and DOCX). Storage RLS enforces user folder ownership.

## Edge Functions

### `interview-research` — Orchestrator

The main pipeline entry point. Called from the frontend via `supabase.functions.invoke()`.

**Flow:**
1. Receives company, role, CV text, userId, searchId
2. Loads resume (search snapshot → user profile fallback → request body)
3. Calls `company-research`, `job-analysis`, and `cv-analysis` in parallel
4. Feeds results to `interview-question-generator` with enhanced synthesis prompt
5. Saves artifacts, stages, and questions to database
6. Updates search status to `completed` (or `failed` on error)

Progress is reported via the `update_search_progress` RPC throughout the pipeline.

### `company-research`

Scrapes public interview data using Tavily search and extraction. Targets Glassdoor, Blind, Reddit, and company sites. Includes URL deduplication, native scrapers, and DuckDuckGo fallback. Returns structured company intelligence.

### `job-analysis`

Analyzes job posting URLs from the research form. Extracts structured role requirements (responsibilities, qualifications, tech stack). Falls back to stubs when URLs aren't available.

### `cv-analysis`

Parses and analyzes CV text. Returns structured profile data. Used for both research pipeline context and profile import drafts.

### `interview-question-generator`

Generates categorized question banks per interview stage. Uses a question-first approach: real interview questions from research are used as foundations, then tailored with company/job/CV context. Targets 30-50 high-quality questions (5-8 per category).

### `profile-import`

AI-powered profile import. Takes resume data, generates a structured draft profile, creates merge suggestions for existing profile fields, and inserts a `profile_imports` row for user review.

### Shared config (`_shared/config.ts`)

Central configuration for the pipeline:
- **Model selection**: `getOpenAIModel()` reads `OPENAI_MODEL` env var, falls back to `gpt-4o`. `isGPT5Model()` helper for compatibility.
- **Tavily**: Search depth, max results, time range, credit cap, allowed domains, query templates.
- **Content**: Snippet lengths, URL filters, quality patterns.
- **Performance**: Timeouts, retries, concurrency caps.

## Near-Term Architecture Sketches

Implementation shape for planned features. Product priority and rationale live in [ROADMAP.md](./ROADMAP.md) and [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md).

### AI answer feedback (paid-only)

A new `answer-feedback` edge function, modelled on `interview-question-generator`:

1. Entitlement check via `getEntitlement(userId)`. Free users short-circuit here — **no OpenAI call is made**.
2. Load the `practice_answer`, source `interview_questions` row, parent `searches` context, and candidate profile.
3. Call OpenAI with a structured prompt (best-class model from `_shared/config.ts`, no small-model fallback).
4. Parse with Zod, write one `answer_feedback` row linked to `practice_answer_id`, return to the UI.

Use a separate table (not JSON on `practice_answers`) because feedback may be regenerated (via `superseded_by`), model metadata/versioning matters, and the paid-only row makes the tier boundary query-explicit.

### Billing

v1 uses **Stripe Billing** with Stripe-hosted UI where possible:

- **3 Prices on one Product**, one per cadence (`monthly`, `quarterly`, `annual`).
- **New subscriptions** via Stripe Checkout (hosted).
- **Management** (upgrade, downgrade, cancel, payment method) via Stripe Customer Portal (hosted). No custom UI at v1.
- **Webhook** handles `customer.subscription.created|updated|deleted` and `invoice.payment_failed`. Idempotent via `stripe_event_id` on `billing_events`.
- **Entitlement** is derived in one place: `getEntitlement(userId)` reads `billing_subscriptions`, returns `{ tier: 'free' | 'paid', cadence, currentPeriodEnd }`. Every paid gate calls this; do not scatter plan checks across components.

Full contract (events, columns, UI flow, tax) in [BILLING.md](./BILLING.md).

### Observability

Deliberately minimal at v1, chosen to be easy to swap later:

- **Error tracking:** Sentry (free tier) in both the Vite/React client and edge functions. Default SDK config; no custom transports or integrations. Removable in minutes.
- **Structured logs:** Supabase native function logs — no external log pipeline. Edge functions emit single-line JSON (`{ level, fn, event, ... }`) via a small `_shared/log.ts` helper so logs are greppable in the Supabase dashboard.
- **Product analytics:** deferred. Not needed until the free→paid funnel exists.
- **Runbook:** see [RUNBOOK.md](./RUNBOOK.md) for stalled-search recovery, Tavily credit checks, edge-function rollback, and missing-feedback diagnostics.

Decision rationale: we expect to revisit observability once billing lands and there are paying users to protect. Picking low-lock-in tools now keeps the migration cost near zero.

### Notification lifecycle

Event-driven, not campaign-heavy. Product events (research completed, first practice completed, inactivity windows) insert a `notification_jobs` row; a worker or scheduled edge function renders payloads, the provider sends, and delivery state is recorded for retry/suppression.

### SEO and crawlable content

Architectural constraint: do not build indexed company pages until we choose a rendering model that produces crawlable HTML (likely SSR/SSG for public pages while the authenticated app stays SPA). Not required for feedback, pricing, or landing-page framing.

## Data Flows

### Research flow

```
User submits form
  → Frontend creates `searches` row (status: pending)
  → Frontend updates to `processing` and invokes `interview-research`
  → Edge function runs pipeline (progress updates via RPC → realtime to client)
  → Results saved: search_artifacts, interview_stages, interview_questions
  → Search marked `completed`
  → Dashboard loads results via RLS queries
```

### Resume flow

```
User uploads PDF/DOCX
  → Client-side parsing (mammoth/pdfjs)
  → If signed in: upload to Supabase Storage, save to `resumes` table
  → On new search: DB trigger copies latest resume to search row
  → Edge functions load resume: search snapshot → profile fallback → request body
```

### Practice flow

```
User selects stages/filters → sessionSampler generates question set
  → practice_sessions row created
  → User answers questions (text notes, local voice)
  → practice_answers saved per question
  → answer feedback generated and stored (planned)
  → user_question_flags updated (favorites, skipped)
  → Session completed → summary shown → history updated
```

### Auth flow

```
Sign up → Supabase Auth creates user → handle_new_user trigger creates profile
Sign in → Session stored in localStorage → ProtectedRoute checks session
Password reset → Email flow via Supabase Auth
```

### Billing flow (planned)

```
User hits paid gate or pricing CTA
  → Checkout Session created (cadence: monthly | quarterly | annual)
  → Stripe confirms purchase, fires customer.subscription.created
  → Webhook upserts billing_customers + billing_subscriptions (idempotent via stripe_event_id)
  → Frontend refetches entitlement; paid features unlock

Later lifecycle:
  customer.subscription.updated  → refresh cadence / period end
  customer.subscription.deleted  → downgrade to free at period end
  invoice.payment_failed         → flag status; notify user
  Customer Portal                → user self-serves upgrade/downgrade/cancel
```

### Notification flow (planned)

```
Research or practice event occurs
  → notification_jobs row inserted
  → worker picks up pending jobs
  → provider sends email or push
  → delivery result stored for retries and audit
```
