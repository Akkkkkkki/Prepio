# Roadmap

This tracks product reality against the latest `main` branch.

## Shipped

### Research and prep

- Tavily/OpenAI-backed research pipeline.
- Company research, job analysis, CV analysis, prep-plan generation, interview stages, and tailored questions.
- Question guidance fields: answer approach, good signals, weak signals, seniority expectation, and sample outline.
- Search progress tracking through `searches.status`, `progress_step`, and `progress_pct`.
- Guest preview UX backed by `research-preview`, `research_previews`, and `research_preview_rate_limits`.
- Research runs as an async background job, decoupled from the 15s function timeout (PREPIO-40).
- Role-family-aware query planning (up to 6 queries shaped by level, country, and the user
  note) replaced the static SWE-biased templates; the no-op DuckDuckGo fallback is gone and
  empty retrieval is now logged rather than papered over (PREPIO-80).
- The evidence log is built in code from real retrieval; synthesis cites `ev-*` IDs only and
  unresolved IDs are dropped before persistence (PREPIO-78). Evidence recency is captured and
  displayed (PREPIO-52).
- Synthesis output is schema-validated with one bounded repair pass; a plan that is
  structurally usable but fails content validation persists with an honest
  `summary.synthesisQuality.degraded` marker instead of silently completing (PREPIO-79).
  Note the limit: a response that is unparseable or missing `summary` / `stageRoadmap`
  returns `null` before validation runs, and the caller marks the whole search failed — so
  "degraded" covers validation failures, not every failed synthesis.
- `job-analysis` marks stub requirements as synthetic so synthesis cannot present them as
  evidence (PREPIO-82).

> Known gaps: (1) retrieval depth is still throttled — `maxResults: 3`, `searchDepth: 'basic'`,
> deep extraction hard-skipped, and the `ops.scraped_urls` cache read but never written
> (PREPIO-48, PREPIO-51); (2) stage confidence is still model-asserted rather than computed
> from corroboration (PREPIO-81), and there is no evidence-sufficiency gate (PREPIO-50);
> (3) synthesis is still one mega-call — only the validation half of the staged-generation
> split shipped (PREPIO-149). Above all, (4) **none of this is measured yet**: the eval
> corpus and harness (PREPIO-154, PREPIO-148) and the shadow-run comparison (PREPIO-162) come
> before further quality work, so "better" stops being a matter of opinion. The full as-is
> analysis and the target grounded-evidence (v3) architecture are in
> [`docs/RESEARCH_PIPELINE.md`](./RESEARCH_PIPELINE.md), tracked under the **[Epic] Research
> pipeline v3** (PREPIO-76) in **Quality & Maintenance** (`area:research-pipeline`).

### Resume and profile

- PDF and DOCX upload.
- Local file parsing before save.
- Active resume versioning through `save_resume_version`.
- Resume snapshots attached to searches.
- Structured candidate profile with import drafts and merge suggestions.
- The structured profile feeds research directly, and questions carry hybrid question→story
  links persisted as text/source snapshots so Practice stays stable after a profile edit
  (PREPIO-57, behind `VITE_PROFILE_STORY_LINKING` / `PROFILE_STORY_LINKING`).
- Profile completeness is framed as a next action with a grounded story-gap CTA (PREPIO-59).
- The Home research form prefills from profile preferences (PREPIO-58).
- CV import auto-applies safe additions to the profile and leaves conflicts for review.
- Resume deletion removes database rows, uploaded files, and pending import drafts.

### Practice

- Stage-based question setup.
- Text answers with local autosave.
- Voice recording, upload to `practice-audio`, non-blocking transcription via `practice-audio-transcribe`, and saved transcript text.
- Favorites, needs-work, skip tracking, self-ratings, completion summary, dashboard/history surfaces.
- Mobile practice controls, bottom navigation, swipe handling, and offline guards.
- A failed transcription now says so ("Transcription unavailable. / Your answer was still
  saved.") instead of leaving the recording silently un-transcribed.
- In-session "Needs work" toggle on the practice question screen (PREPIO-120).
- The practice breathing warm-up is opt-in and off by default (PREPIO-126).
- Paid AI answer feedback on submitted practice answers, surfaced in Practice, Session Summary, and History, gated by the shared entitlement resolver, with in-place regeneration (PREPIO-11, PREPIO-97, PREPIO-109). Copy is deliberately scannable — capped bullets for strengths and improvements, a compact STAR row, and exactly one next action.

### Billing

- `billing_customers`, `billing_subscriptions`, and `billing_events` migrations.
- Shared entitlement rules in frontend and Edge-function code.
- `getEntitlement` frontend reader.
- `stripe-webhook` Edge Function with signature verification, idempotency, stale-event protection, and tests.
- Pricing page surface for monthly, quarterly, and annual plans (`src/pages/Pricing.tsx`, PREPIO-14).
- `create-checkout-session` Edge Function with cadence → Stripe Price mapping (PREPIO-28 test coverage).
- `create-portal-session` Edge Function for self-serve plan management (PREPIO-10).
- `/billing/return` post-checkout entitlement polling (`src/pages/BillingReturn.tsx`, PREPIO-28).
- Paid-gate UX on answer feedback (PREPIO-7).

### App shell

- Email/password auth, recovery flows, auth-intent redirects, authenticated navigation, offline banner, and PWA assets.
- "Your interviews" (`/interviews`) is the signed-in landing surface, with interview cards
  carrying state, an answered counter, needs-work counts, and one-tap practice
  (PREPIO-100, PREPIO-105, PREPIO-114, PREPIO-127).
- The redundant research switchers are gone and the Plan is de-densified to hero + one CTA +
  roadmap + collapsed "Why this plan" (PREPIO-102, PREPIO-103, PREPIO-104).
- A documented design-token policy — a 2-step radius scale (`rounded-xl` for normal
  cards, `rounded-[20px]` for prominent panels), one accent, neutral-plus-primary badges,
  sentence-case micro-labels — written into
  [`docs/DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) (PREPIO-106). The **policy**
  shipped; the migration of existing surfaces did not. `src/` still carries **11 distinct
  non-directional radius values** — `rounded-2xl` is the most common (82 uses) and is not
  in the scale at all, and `rounded-3xl`, which `DESIGN_PRINCIPLES.md` explicitly says to
  avoid, is still used 4× in `src/App.tsx` — while `badge.tsx` exposes 4 variants. Read the
  tokens as the rule for new work, not a description of the current UI. Residue tracked in
  PREPIO-175.

## Current Priorities

### 1. Landing and conversion path

- Keep research entry prominent.
- Use guest preview output to explain the value before sign-in.
- Keep authenticated users one click from research and practice.

### 2. Interview-as-object UX restructure

The 2026-06-21 product UX review
([`docs/audits/2026-06-21-ux-review.html`](./audits/2026-06-21-ux-review.html), digest in
[`2026-06-21-ux-review.md`](./audits/2026-06-21-ux-review.md)) found the biggest source of
friction is structural, not feature-level: a linear job (research → plan → practice →
review) is shown as six peer tabs with three overlapping ways to pick a run, and new users
can dead-end on empty states that explain the menu.

- Reorganise the app around a single **interview** object: one "Your interviews" home, plus
  a per-interview workspace with **Plan / Practice / Review** segments and a persistent
  identity header (no hidden `?searchId`).
- Then de-densify the Plan (hero + one CTA + roadmap + collapsed "Why this plan"), make
  practice one tap from a card, and lock the visual system (2 radii, ≤2 badge styles).
- Sequenced P0 → P2 under the **[Epic] Interview-as-object UX restructure** (PREPIO-99;
  children PREPIO-100–107, plus PREPIO-157 and PREPIO-159) in **Quality & Maintenance**.
- **State as of 2026-08-29:** the "Your interviews" home, the switcher deletion, the
  de-densified Plan, and one-tap practice have all shipped, and the design-token *policy*
  was written down — though the migration behind it was not (PREPIO-175). Two
  children remain open: **PREPIO-101** (nav is still Home / Dashboard / Practice / Practice
  History — there is no Plan/Practice/Review workspace header and Dashboard is not yet
  renamed to Plan) and **PREPIO-107** (the interview card carries needs-work and progress,
  but there is no Review tab, and `/history` still shows an empty state next to an
  in-progress card).
- High-priority: takes precedence where it conflicts with existing backlog items
  (PREPIO-34 canceled in favour of the new home; PREPIO-33 shipped, PREPIO-45 closed as a
  duplicate, both reconciled to the restructure's surfaces).

## Next

- **Deploy the backend to parity with `main` (PREPIO-124, Urgent).** Production has been
  frozen since 2026-05-15: 8 migrations are unapplied and 7 edge functions
  (`research-preview`, `create-checkout-session`, `create-portal-session`, `stripe-webhook`,
  `answer-feedback`, `profile-import`, `practice-audio-transcribe`) are undeployed, so guest
  preview, billing, paid feedback, CV import, and **voice transcription** are dead in
  production regardless of what this file says is shipped. Note the precision on the last
  one: the `practice-audio` bucket comes from a migration that *is* applied, and
  `Practice.tsx` uploads the recording and saves `audio_path` before invoking transcription
  asynchronously — so recording and saving a voice answer still work in production, and only
  transcript generation fails (with the honest notice). Everything else below is downstream
  of this.
- **Measure before improving (PREPIO-154, PREPIO-148, PREPIO-162).** A backtest corpus, an
  eval harness reporting top-5 hit rate / citation precision / stage accuracy / degradation
  rate, and a shadow-run harness, so research-pipeline changes can be judged instead of
  asserted.
- **Make the rubric self-check and follow-up drilling actually work (PREPIO-176).** Both
  have shipped UI and are Done in Linear, but `interview-research` hardcodes
  `evaluation_criteria: []` and `follow_up_questions: []` and never writes
  `good_answer_signals` at all
  ([`index.ts:1030-1032`](../supabase/functions/interview-research/index.ts)) — so on
  anything the current pipeline generates, both render empty. Deliberately **not** listed
  under Shipped: a caveat under that heading still reads as shipped to anyone scanning, and
  a feature a user can reach but that never renders is not shipped. Either synthesis starts
  emitting these fields or the columns and their consuming UI come out.
- Research pipeline v3 (grounded evidence): the remaining retrieval depth (PREPIO-48,
  PREPIO-51), the evidence-sufficiency gate (PREPIO-50), computed confidence (PREPIO-81),
  and the staged-synthesis split (PREPIO-149). Sequenced rollout in
  [`docs/RESEARCH_PIPELINE.md`](./RESEARCH_PIPELINE.md) under the **[Epic] Research pipeline
  v3** (PREPIO-76).
- Close the debrief loop: converge the plan on a top-5 (PREPIO-157), a pre-interview plan
  confirmation gate (PREPIO-159), and a post-round debrief that recalibrates the next round
  (PREPIO-158).
- Readiness scoring based on actual answer feedback.
- Better dashboard/history progress views (trends, recurring weak signals,
  one-click launch into a needs-work practice queue).
- Lifecycle messaging for research completion and practice follow-up.
- Public navigation, legal pages, and footer.

## Later

- SEO/content engine and public company interview pages.
- Real-time conversational mock interviews. (Turn-based follow-up drilling has UI but no
  data — see PREPIO-176 under Next — so the live conversational layer sits behind that.)
- Speech-pattern feedback after transcription quality and cost are proven.
- More normalized relational storage for research artifacts.

The practice-enhancement backlog behind the items above is tracked in the **Prepio** Linear
team under Quality & Maintenance. PREPIO-41 (rubric self-check) and PREPIO-47 (follow-up
"interviewer mode") are Done in Linear and their UI shipped, but neither can render on a
current-pipeline question — that gap is PREPIO-176, listed under Next. PREPIO-45 (history
progress + readiness) was closed as a duplicate and its surface folded into PREPIO-107.

## Product Decisions

- Keep the research-first wedge. The moat is role/company-specific prep.
- Feedback before scoring. A score without feedback is activity math.
- Paid feedback only. Free users can practice and save answers, but expensive answer analysis is an entitlement.
- Subscription first. Use Stripe subscriptions instead of one-off packaging.
