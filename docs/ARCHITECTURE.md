# Architecture

Prepio is a React/Vite app backed by Supabase Auth, Postgres, Storage, Realtime, and Edge Functions.

## Frontend

Main areas:

- `src/pages/Interviews.tsx`: "Your interviews" — the signed-in landing surface (`/interviews`); interview cards with state, answered counter, needs-work count, and one-tap practice.
- `src/pages/Home.tsx`: research entry, guest preview, resume upload/paste, auth handoff. Serves `/` for guests and `/new-interview` when signed in.
- `src/components/preview/*`: unauthenticated research preview UI.
- `src/pages/Practice.tsx`: question practice, notes, audio recording, answer save, completion.
- `src/pages/Profile.tsx` and `src/pages/profile/*`: canonical candidate profile, resume versions, import/merge flow.
- `src/pages/Dashboard.tsx`: current prep overview.
- `src/pages/History.tsx`: past searches and practice sessions.
- `src/services/searchService.ts` and `src/services/search/*`: Supabase access layer.
- `src/services/entitlements.ts`: frontend entitlement read-through.
- `src/shared/entitlement-rules.ts`: canonical frontend entitlement rules.
- `src/hooks/useSearchProgress.ts`: realtime progress with polling fallback.

## Backend

Supabase Edge Functions:

- `interview-research`: orchestrates research and generation.
- `research-preview`: generates and caches unauthenticated preview output.
- `company-research`: finds and summarizes company/interview-process evidence.
- `job-analysis`: extracts role requirements.
- `cv-analysis`: parses resume/CV text.
- `interview-question-generator`: standalone question-generation endpoint. Service-role-gated (rejects non-service callers) and has no in-repo caller — the live research pipeline generates questions inline inside `interview-research`. Preserved for external/operator invocation; see the top-of-file note in `supabase/functions/interview-question-generator/index.ts`.
- `profile-import`: creates candidate-profile import drafts.
- `practice-audio-transcribe`: transcribes uploaded practice recordings.
- `answer-feedback`: paid-only structured coaching for saved practice answers.
- `create-checkout-session`: creates a Stripe Checkout session from a cadence, server-side price mapping only.
- `create-portal-session`: creates a Stripe Customer Portal session for self-serve plan management.
- `stripe-webhook`: syncs Stripe subscription state into Supabase billing tables.

> **Deployment state (live-probed 2026-08-27).** Only `interview-research`,
> `company-research`, `job-analysis`, `cv-analysis`, and `interview-question-generator` are
> deployed to production. The other seven — `research-preview`, `create-checkout-session`,
> `create-portal-session`, `stripe-webhook`, `answer-feedback`, `profile-import`,
> `practice-audio-transcribe` — return the gateway `404` and have never been deployed. "In
> this repo" and "in production" are not the same thing for anything in that list. Tracked as
> PREPIO-124 (Urgent).

Shared function utilities live under `supabase/functions/_shared`.

All user-facing functions (everything except `stripe-webhook`, which has no
browser caller) compose CORS headers through `buildCorsHeaders` in
`supabase/functions/_shared/cors.ts`. The helper honors the optional
`APP_ALLOWED_ORIGINS` env var — a comma-separated allowlist that's echoed
back when the request's `Origin` matches — and falls back to `*` when the
var is unset. Set `APP_ALLOWED_ORIGINS` in production secrets (typically
the deployed `APP_BASE_URL` plus the Vercel preview origin pattern) to
turn off the wildcard.

## Data Model

Core tables:

- `profiles`: auth-linked user metadata and seniority level.
- `searches`: research jobs, progress, role/company inputs, status.
- `interview_stages`: likely interview rounds for a search.
- `interview_questions`: generated questions and guidance fields.
- `prep_plans`: structured prep plan JSON for a search.
- `practice_sessions`: one user practice run for one search.
- `practice_answers`: text answers, audio path, transcript text, timing, self-rating.
- `answer_feedback`: paid structured coaching feedback for submitted practice answers, including strengths, improvements, STAR breakdown, one next action, and regeneration lineage.
- `user_question_flags`: favorite, needs-work, skipped.
- `resumes`: active profile resume versions and per-search snapshots.
- `candidate_profiles`: canonical structured interview profile.
- `profile_imports`: pending/applied/dismissed merge drafts from resumes.
- `research_previews`: cached guest preview output.
- `research_preview_rate_limits`: preview abuse/rate-limit state.
- `billing_customers`: user to Stripe customer mapping.
- `billing_subscriptions`: Stripe subscription state and entitlement source.
- `billing_events`: Stripe webhook idempotency/audit log.
- `ops.scraped_urls` and `ops.tavily_searches`: research cache and operational logging. `ops.tavily_searches` is written on every Tavily call; `ops.scraped_urls` is read by `company-research` Phase 0 but **nothing currently writes it** — see [`RESEARCH_PIPELINE.md`](./RESEARCH_PIPELINE.md) and PREPIO-51.

Not yet shipped:

- `usage_events`
- `notification_jobs`

> `supabase/schema.sql` is a stale snapshot missing `billing_customers`,
> `billing_subscriptions`, `billing_events`, `research_previews`, and
> `research_preview_rate_limits`. Only the last two are explained by the deploy freeze;
> `billing_v1` **is** applied in production (as version `20260515131539`), so the billing
> tables exist live and the snapshot simply predates them. Treat
> [`supabase/migrations/`](../supabase/migrations) as the source of truth for schema until
> it is refreshed. See PREPIO-173.
>
> **Before any `db:push`:** the local and production migration histories diverge — two
> already-applied migrations were re-timestamped in the repo (`billing_v1` is
> `20260514000000` locally vs `20260515131539` in production; `security_hardening_and_resume_rpc`
> is `20260515150000` vs `20260515171733`). A blind push can stop on the unmatched remote
> version or re-run the local security migration as if it were new. Reconcile with
> `supabase migration repair` first. See PREPIO-124.

## Storage

- `resume-files`: authenticated resume uploads. PDF and DOCX are supported.
- `practice-audio`: authenticated practice recordings used for transcription and saved answer context.

## Key Flows

### Research

1. User enters company, role, optional job description, resume, and notes. When both
   `VITE_PROFILE_STORY_LINKING` and `PROFILE_STORY_LINKING` are enabled, the canonical
   structured profile replaces the legacy CV-analysis prompt block and exposes opaque
   `S*` story handles to synthesis.
2. Browser creates a `searches` row.
3. Browser invokes `interview-research`.
4. Edge Functions generate company/job/profile insights, stages, prep plan, and questions.
   Linked profile bullets persist as text/source snapshots on each question so Practice
   remains stable after a profile edit.
5. Progress updates land on the search row and are read by realtime/polling UI.

The current (v2) implementation, its quality gaps, and the target grounded-evidence (v3)
architecture are documented in [`RESEARCH_PIPELINE.md`](./RESEARCH_PIPELINE.md). Read it
before changing anything under `supabase/functions/interview-research`,
`company-research`, `job-analysis`, or `_shared` retrieval code.

### Guest preview

1. Visitor submits company/role preview inputs.
2. Browser invokes `research-preview`.
3. Edge Function checks preview rate limits and cache.
4. Preview output is returned without creating a full authenticated research run.

### Resume and profile

1. User uploads PDF/DOCX or pastes resume text.
2. Text is extracted client-side where possible.
3. `save_resume_version` creates a new active resume and supersedes the previous active version.
4. `profile-import` creates a draft.
5. Safe additions are auto-applied to the canonical profile.
6. Conflicts remain available for user review.

### Practice

1. User chooses stages/questions.
2. Notes autosave locally while practicing.
3. User can save text, audio, or both.
4. Audio is uploaded to `practice-audio` and transcribed. A failed transcribe call raises a
   non-blocking "Transcription unavailable. / Your answer was still saved." notice rather
   than failing silently; a successful-but-empty transcript stays silent.
5. The answer row stores text, `audio_path`, `transcript_text`, elapsed time, and optional self-rating.

### Billing

1. Stripe sends subscription events to `stripe-webhook`.
2. The function verifies the Stripe signature.
3. The handler resolves the user from `billing_customers` or Stripe customer metadata.
4. Subscription state is written to `billing_subscriptions`.
5. `billing_events` prevents duplicate processing.
6. Entitlement reads derive `free` or `paid` from the subscription row.

Checkout and Customer Portal session creation are implemented (`create-checkout-session`,
`create-portal-session`, both with local handler tests). They are not deployed to production
yet — see PREPIO-124.

## Security Model

Most user-owned tables use row-level security scoped to `auth.uid()`. Edge Functions use service-role access for server-side generation, billing sync, and writes. Paid features must enforce entitlement checks on the server before expensive AI calls run.
