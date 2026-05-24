# Architecture

Prepio is a React/Vite app backed by Supabase Auth, Postgres, Storage, Realtime, and Edge Functions.

## Frontend

Main areas:

- `src/pages/Home.tsx`: research entry, guest preview, resume upload/paste, auth handoff.
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
- `interview-question-generator`: generates tailored questions and answer guidance.
- `profile-import`: creates candidate-profile import drafts.
- `practice-audio-transcribe`: transcribes uploaded practice recordings.
- `stripe-webhook`: syncs Stripe subscription state into Supabase billing tables.

Shared function utilities live under `supabase/functions/_shared`.

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
- `ops.scraped_urls` and `ops.tavily_searches`: research cache and operational logging.

Not yet shipped:

- `usage_events`
- `notification_jobs`

## Storage

- `resume-files`: authenticated resume uploads. PDF and DOCX are supported.
- `practice-audio`: authenticated practice recordings used for transcription and saved answer context.

## Key Flows

### Research

1. User enters company, role, optional job description, resume, and notes.
2. Browser creates a `searches` row.
3. Browser invokes `interview-research`.
4. Edge Functions generate company/job/resume insights, stages, prep plan, and questions.
5. Progress updates land on the search row and are read by realtime/polling UI.

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
4. Audio is uploaded to `practice-audio` and transcribed.
5. The answer row stores text, `audio_path`, `transcript_text`, elapsed time, and optional self-rating.

### Billing

1. Stripe sends subscription events to `stripe-webhook`.
2. The function verifies the Stripe signature.
3. The handler resolves the user from `billing_customers` or Stripe customer metadata.
4. Subscription state is written to `billing_subscriptions`.
5. `billing_events` prevents duplicate processing.
6. Entitlement reads derive `free` or `paid` from the subscription row.

Checkout and Customer Portal session creation are not implemented yet.

## Security Model

Most user-owned tables use row-level security scoped to `auth.uid()`. Edge Functions use service-role access for server-side generation, billing sync, and writes. Paid features must enforce entitlement checks on the server before expensive AI calls run.
