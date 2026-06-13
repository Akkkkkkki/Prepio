# Roadmap

This tracks product reality against the latest `main` branch.

## Shipped

### Research and prep

- Tavily/OpenAI-backed research pipeline.
- Company research, job analysis, CV analysis, prep-plan generation, interview stages, and tailored questions.
- Question guidance fields: answer approach, good signals, weak signals, seniority expectation, and sample outline.
- Search progress tracking through `searches.status`, `progress_step`, and `progress_pct`.
- Guest preview UX backed by `research-preview`, `research_previews`, and `research_preview_rate_limits`.

> Known gaps: (1) live retrieval in `company-research` is throttled (few queries, no raw
> content/extraction, caching off) to fit a synchronous timeout; (2) the evidence log shown
> to users is **LLM-invented rather than retrieval-backed**, and confidence is model-asserted
> rather than computed — so synthesis leans on model priors dressed up as research. The full
> as-is analysis and the target grounded-evidence (v3) architecture are in
> [`docs/RESEARCH_PIPELINE.md`](./RESEARCH_PIPELINE.md), tracked under the **[Epic] Research
> pipeline v3** (PREPIO-76) in **Quality & Maintenance** (`area:research-pipeline`).

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
- Voice recording, upload to `practice-audio`, non-blocking transcription via `practice-audio-transcribe`, and saved transcript text.
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

- Research pipeline v3 (grounded evidence): remove fabricated/stub inputs, build a
  retrieval-backed evidence ledger with resolvable citations, derive confidence from
  corroboration, and validate staged synthesis output. Sequenced rollout in
  [`docs/RESEARCH_PIPELINE.md`](./RESEARCH_PIPELINE.md) under the **[Epic] Research pipeline
  v3** (PREPIO-76); the async-job refactor PREPIO-40 unblocks the richer-retrieval steps.
- Readiness scoring based on actual answer feedback.
- Better dashboard/history progress views (trends, recurring weak signals,
  one-click launch into a needs-work practice queue).
- Post-answer rubric self-check for free users, reusing each question's
  `good_answer_signals` / `evaluation_criteria` to close the loop without a
  model call.
- Lifecycle messaging for research completion and practice follow-up.
- Public navigation, legal pages, and footer.

## Later

- SEO/content engine and public company interview pages.
- Real-time conversational mock interviews (starting with follow-up question
  drilling that reuses each question's `follow_up_questions`).
- Speech-pattern feedback after transcription quality and cost are proven.
- More normalized relational storage for research artifacts.

The practice-enhancement backlog behind the items above is tracked in the
**Prepio** Linear team: feedback UI in PREPIO-11 (with PREPIO-32 for the paid
gate), and PREPIO-41 (rubric self-check), PREPIO-45 (history progress +
readiness), and PREPIO-47 (follow-up "interviewer mode") under Quality &
Maintenance.

## Product Decisions

- Keep the research-first wedge. The moat is role/company-specific prep.
- Feedback before scoring. A score without feedback is activity math.
- Paid feedback only. Free users can practice and save answers, but expensive answer analysis is an entitlement.
- Subscription first. Use Stripe subscriptions instead of one-off packaging.
