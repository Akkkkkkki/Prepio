# Roadmap

This tracks product reality against the latest `main` branch.

## Shipped

### Research and prep

- Tavily/OpenAI-backed research pipeline.
- Company research, job analysis, CV analysis, prep-plan generation, interview stages, and tailored questions.
- Question guidance fields: answer approach, good signals, weak signals, seniority expectation, and sample outline.
- Search progress tracking through `searches.status`, `progress_step`, and `progress_pct`.
- Guest preview UX backed by `research-preview`, `research_previews`, and `research_preview_rate_limits`.

> Known gap: live retrieval in `company-research` is currently throttled (few queries, no raw
> content/extraction, caching off) to fit a synchronous timeout, so synthesis leans more on model
> priors than on fresh community evidence. Tracked in the **Prepio** Linear team under
> **Quality & Maintenance** (`area:research-pipeline`, starting with the async-job refactor PREPIO-40).

### Resume and profile

- PDF and DOCX upload.
- Local file parsing before save.
- Active resume versioning through `save_resume_version`.
- Resume snapshots attached to searches.
- Structured candidate profile with import drafts and merge suggestions.
- CV import auto-applies safe additions to the profile and leaves conflicts for review.
- Resume deletion removes database rows, uploaded files, and pending import drafts.

### Practice

- Stage-based question setup.
- Text answers with local autosave.
- Voice recording, upload to `practice-audio`, transcription via `practice-audio-transcribe`, and saved transcript text.
- Favorites, needs-work, skip tracking, self-ratings, completion summary, dashboard/history surfaces.
- Mobile practice controls, bottom navigation, swipe handling, and offline guards.

### Billing foundation

- `billing_customers`, `billing_subscriptions`, and `billing_events` migrations.
- Shared entitlement rules in frontend and Edge-function code.
- `getEntitlement` frontend reader.
- `stripe-webhook` Edge Function with signature verification, idempotency, stale-event protection, and tests.

### App shell

- Email/password auth, recovery flows, auth-intent redirects, authenticated navigation, offline banner, and PWA assets.

## Current Priorities

### 1. Paid AI answer feedback

- Add an `answer-feedback` Edge Function.
- Gate before any OpenAI call through the shared entitlement resolver.
- Store structured feedback separately from `practice_answers`.
- Support regeneration without losing history.
- Show feedback in Practice, History, and Session Summary. The Edge Function,
  table, entitlement gate, and prompt are built and tested; the client call and
  render are still stubbed (`SessionSummary.tsx` "Get detailed coaching").
- Keep feedback concise, direct, and information-dense: capped scannable bullets
  for strengths/improvements, a compact STAR row, and exactly one next action —
  optimized for a fast read, not prose.

### 2. Finish billing product surface

- Add visible pricing UI for monthly, quarterly, and annual plans.
- Add `create-checkout-session`.
- Add `create-portal-session`.
- Add `/billing/return` handling and entitlement polling.
- Add paid-gate UX around answer feedback.

### 3. Landing and conversion path

- Keep research entry prominent.
- Use guest preview output to explain the value before sign-in.
- Keep authenticated users one click from research and practice.

## Next

- Research evidence depth: restore real community-source retrieval as the primary input to
  synthesis, surface the evidence to users, and guard yield. Tracked in Linear under
  **Quality & Maintenance** (`area:research-pipeline`); the async-job refactor PREPIO-40 unblocks
  the richer-retrieval items.
- Readiness scoring based on actual answer feedback.
- Better dashboard/history progress views (trends, recurring weak signals,
  one-click launch into a needs-work practice queue).
- Post-answer rubric self-check for free users, reusing each question's
  `good_answer_signals` / `evaluation_criteria` to close the loop without a
  model call.
- Non-blocking audio transcription so saving a voice answer no longer waits on
  the transcription call.
- Lifecycle messaging for research completion and practice follow-up.
- Public navigation, legal pages, and footer.

## Later

- SEO/content engine and public company interview pages.
- Real-time conversational mock interviews (starting with follow-up question
  drilling that reuses each question's `follow_up_questions`).
- Speech-pattern feedback after transcription quality and cost are proven.
- More normalized relational storage for research artifacts.

See [`reviews/2026-05-28-practice-capability-review.md`](./reviews/2026-05-28-practice-capability-review.md)
for the practice enhancement backlog (Linear-ready issues behind the items
above).

## Product Decisions

- Keep the research-first wedge. The moat is role/company-specific prep.
- Feedback before scoring. A score without feedback is activity math.
- Paid feedback only. Free users can practice and save answers, but expensive answer analysis is an entitlement.
- Subscription first. Use Stripe subscriptions instead of one-off packaging.
