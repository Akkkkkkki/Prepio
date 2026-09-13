# Prepio UI/UX Review — 2026-09-13 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md),
[`2026-09-03`](./2026-09-03-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

Full-live review. The authenticated research→practice loop was exercised live (login → resume an
existing plan via a card's **Continue practice** → save a text answer → flag Favorite → walk the
question set on desktop and mobile). It was **not** a fresh-research pass — no new research run was
submitted (that spends real OpenAI/Tavily budget on the tester account), so the research **form** and
the async progress modal are carried from prior runs / code, not re-triggered. Backend deploy state
and the live write failures below were probed directly.

- **Playwright Chromium: PASS (via a local MITM shim).** The egress TLS filter still resets
  Chromium's raw ClientHello for every HTTPS host (a plain `--proxy-server=$HTTPS_PROXY` launch
  hangs), while Node's OpenSSL stack passes. Worked around with a ~90-line local Node proxy that
  terminates Chromium's TLS with a throwaway cert (`--ignore-certificate-errors`) and re-issues each
  request through the agent proxy on Node's TLS stack. **This is a standing gotcha for this
  environment — carry the shim forward.** All captures below go through it.
- **Frontend (Vercel): PASS** — `curl … https://prepio.qiuyue.dev/` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`, landing `<h1>` present.
- **Backend (Supabase): PASS** — login with the tester account succeeded (`POST auth/v1/token` →
  `200`, Enter-submit → redirect to `/interviews`). A **text-answer save persisted live**
  (`POST practice_answers` → `201`). The **Favorite flag write failed live** (`POST
  user_question_flags` → `400 / 42P10`) and did not persist across reload. The guest-preview failure
  below is a **live-observed network response**, not an inference.

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile 390×844), guest
"Preview my prep" attempt (Anthropic · Product Manager), `/auth` (autocomplete + tab probe), login,
`/interviews`, practice on **both** existing interviews (Stripe · Data Product Manager and OpenAI ·
Solutions Architect) on desktop **and** mobile — **question-as-`<h1>` on both breakpoints**,
**text-answer save (`201`)**, **Favorite flag write (`400 / 42P10`)**, **coach-panel hide behaviour
(PREPIO-176)**, **absence of any answer guidance across every question in both interviews**
(dashboard + practice), notes autosave copy, `/history`, `/pricing`, a 720px-viewport reflow check,
and an edge-function deploy probe across all twelve functions. Screenshots under
[`assets/2026-09-13/`](./assets/2026-09-13/). **`/profile` and `/new-interview` were not
screenshotted** — the tester account carries a real seeded CV and both surfaces render it (see the
PII rule in [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) and
[PREPIO-145](https://linear.app/qiuyue/issue/PREPIO-145)).

## The headline this week: PREPIO-176 removed a dead control — and in doing so revealed that the practice coaching layer is empty

Two commits changed a **rendered** surface since run #20; a third changed **research output** without
a UI diff (the remainder are backend log-redaction, security, deps, and a hygiene doc):

1. **[PREPIO-176](https://linear.app/qiuyue/issue/PREPIO-176) / #338 — hide the practice coach panel
   when a question has no guidance.** Verified live and working: on every question in both interviews
   the "Answer guide" surface is now correctly **absent** rather than a titled card with an empty
   body. This is a genuine improvement (it removes a dead affordance).
2. **[PREPIO-175](https://linear.app/qiuyue/issue/PREPIO-175) / #336 — remove forbidden `rounded-3xl`
   tokens from the route skeleton.** Cosmetic loading-skeleton token cleanup; low risk, not
   separately captured live.
3. **[PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144) / #340 — classify retrieved job rows by
   origin, not pipeline channel (code-confirmed, NOT live-exercised).** No UI diff, but a **functional
   pipeline change**: `buildEvidenceLedger` no longer force-classifies every `job-analysis` row as
   `official_job`/high trust — a caller-supplied non-ATS role URL now falls back to
   `market_heuristic`/low trust, which flows into the synthesis prompt and citation validation
   (`interview-research/index.ts`). So it **can** change generated research output on a fresh run.
   Because no fresh research was submitted this week (OpenAI/Tavily budget), this is code-confirmed
   only — not observed live; flagged for the next fresh-run pass.

The important thing PREPIO-176 exposes is stated in its own commit message: *"interview-research
writes empty `evaluation_criteria` / `follow_up_questions` / `suggested_answer_approach` and **never
writes `good_answer_signals`**, so on a fresh run the question-insights object is pure chrome."* In
other words, the deployed research pipeline produces **no answer guidance at all** — no "what strong
answers show", no good/weak signals, no seniority expectation, no sample outline — and PREPIO-176's
fix was to **hide** that empty surface "rather than expanding the synthesis schema" (an explicit
freeze decision). Live confirmation this run: across all 10 Stripe questions and all 40 OpenAI
questions, zero guidance renders anywhere (practice **or** dashboard). So the practice screen is now
honestly **question + stage/difficulty badges + a place to record/type/note — and nothing that
coaches the answer.** That is the single most important product-quality observation this week, and it
is new to this review because prior runs credited the now-hidden empty scaffold as "guidance"
(see the scorecard note on Generated output clarity).

### Edge-function deploy state — freshly probed live (unchanged from run #20)

OPTIONS-preflight + `POST {}` body probe against each function. The freeze (PREPIO-124 + PREPIO-27)
has **not** landed; the split is identical to last week and still matches the intended freeze
manifest rather than being cleared:

| Function | Probe | Freeze intent |
|----------|:-----:|-----------------|
| `interview-research` | **deployed** ✅ | Core — keep |
| `company-research` | **deployed** ✅ | Core — keep |
| `job-analysis` | **deployed** ✅ | Core — keep |
| `cv-analysis` | **deployed** ✅ | Core — keep |
| `interview-question-generator` | **deployed** ✅ | Core — keep |
| `research-preview` | **404** ❌ | Intentionally NOT deployed — guest surface goes static (PREPIO-27) |
| `create-checkout-session` | **404** ❌ | Intentionally NOT deployed — hide checkout CTA (PREPIO-27) |
| `create-portal-session` | **404** ❌ | Intentionally NOT deployed — hide portal (PREPIO-27) |
| `stripe-webhook` | **404** ❌ | Intentionally NOT deployed — no live billing (PREPIO-27) |
| `answer-feedback` | **404** ❌ | Intentionally NOT deployed — hide paid-feedback entry (PREPIO-27) |
| `profile-import` | **404** ❌ | Deploy only if UI + smoke pass; else hide (PREPIO-27) |
| `practice-audio-transcribe` | **404** ❌ | Deploy only if UI + smoke pass; else hide (PREPIO-27) |

## Overall product judgment

**Roughly steady on the deployed core, with one clarifying improvement and one newly-honest gap.**
PREPIO-176 cleaned a dead control out of the practice screen, and the loop a signed-in user sees is
still strong: the question is the unambiguous `<h1>` hero on desktop and mobile, text-answer save
persists (`201`), Save & Continue stays disabled until an answer is entered, notes autosave shows
honest device-local copy, and mobile practice has no horizontal overflow with a fixed bottom bar. But
removing the empty coach panel makes plain what was previously masked: **for every question in both
tester interviews the app now delivers a question and badges with no answer guidance whatsoever** —
the "depth over breadth" coaching the product promises is not being produced by
`interview-research`. Separately, three carried issues are all still live-broken and untouched: the
guest **Preview my prep** CTA still fires a doomed `research-preview` call that **blanks the page's
best pre-signup asset** (the rich static example), `/pricing` still offers **Choose monthly /
quarterly / annual** checkout buttons that point at an undeployed function, and the **Favorite /
Needs-work** flag write still returns `400 / 42P10` on every attempt. The single highest-value action
remains the attended freeze deploy + frontend surface-lock (PREPIO-124 + PREPIO-27), which clears the
top-of-funnel breakage and the flag-write P1 together; the newly-surfaced coaching gap is the most
important *product* finding and is tracked under its ROADMAP-designated owner, PREPIO-176.

## Top 5 issues

### 1. P0 (live-confirmed) — The pre-freeze guest/billing/auth surface is still exposed; it must be locked to the 2026-09-02 freeze decision

- **Severity:** P0 — a first-time visitor's primary CTA fails live and destroys the page's best
  pre-signup proof; `/pricing` offers a purchase that cannot complete. Top-of-funnel, actively worse
  than doing nothing.
- **Area:** landing / billing / auth (surface-lock)
- **User scenario:** a logged-out visitor types a company and clicks **Preview my prep**; or reads
  `/pricing` and clicks **Choose monthly**.
- **What happened (live this run):**
  - The default landing renders a **rich static example** — "How Stripe Senior Product Manager
    questions look in Prepio" with three real questions carrying stage, difficulty, and a concrete
    "why it matters" ([`01-d-landing.png`](./assets/2026-09-13/01-d-landing.png)). Clicking
    **Anthropic · Product Manager → Preview my prep** fires `POST research-preview` → **CORS block /
    `net::ERR_FAILED`** (console: *"…has been blocked by CORS policy"*, *"Error creating research
    preview: FunctionsFetchError"*), shows *"We couldn't build the preview. Try again, or sign in to
    run the full research workflow."*, **and replaces the rich static example with an empty *"Your
    Anthropic preview will appear here"* placeholder** — the CTA *removes* the strongest
    "not-a-ChatGPT-wrapper" demo the page had. Compare
    [`03-d-guest-preview.png`](./assets/2026-09-13/03-d-guest-preview.png) (blanked).
  - `/pricing` still renders live **Choose monthly / Choose quarterly / Choose annual** checkout CTAs
    pointing at the intentionally-undeployed `create-checkout-session`.
    [`32-d-pricing.png`](./assets/2026-09-13/32-d-pricing.png)
  - `/auth` still offers a public **Sign Up** tab (freeze wants invite-only).
- **Why it matters:** the deployed research loop makes the app look fully working to a logged-in smoke
  test, so this pre-signup breakage is exactly what a casual authenticated pass skips — and it is the
  entire top-of-funnel. With the freeze scope decided, the fix is to make the surface match: static
  guest sample, hidden paid controls, invite-only sign-up, no copy promising unavailable features.
- **Recommended fix:** land **PREPIO-27** (guest preview → deterministic checked-in sample with no
  Edge Function call; hide checkout/portal/paid-feedback; invite-only sign-up; disable PDF upload
  while PREPIO-140 is open; strip unavailable-feature copy; add the guest-makes-zero-calls tests). Do
  the attended **PREPIO-124** freeze deploy alongside it (note PREPIO-124 now lists the
  [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) BOLA ownership fix as a deploy
  prerequisite).
- **Tracking:** [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (Urgent, Todo) +
  [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo). Confirmed live 2026-09-13.

### 2. P1 (live-confirmed) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration exists, is authorized for the freeze window, and is unapplied

- **Severity:** P1 — a core practice triage affordance fails 100% of the time and does not persist.
- **Area:** practice
- **User scenario:** during practice a user taps ★ **Favorite** (or **Needs work**) to triage what to
  revisit.
- **What happened (live):** clicking `button[aria-label="Favorite"]` fires
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type` → **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`. The star's `aria-pressed` stays `false` and after a page reload the flag is gone
  (`aria-pressed` null). Confirmed on the Stripe · Data Product Manager session.
- **Root cause:** the upsert (`src/services/searchService.ts:1783`) references a
  `(user_id, question_id, flag_type)` unique constraint that does not exist in production. The fix is
  already written and merged — `supabase/migrations/20260710203000_question_flags_per_type.sql` — it
  has simply never been applied. A schema deploy, inside the freeze scope.
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practice
  next. A visible control that never persists erodes trust in whether anything they do is saved.
  (Text-answer save, by contrast, is `201` — verified live.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze
  window (dedupe conflicting rows first); verify all three entry points persist across reload on
  desktop and mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo) — confirmed
  live 2026-09-13.

### 3. P2 (NEW, live + code-confirmed) — Practice delivers no answer guidance on any question; PREPIO-176 correctly hid the empty panel, but the coaching depth the product promises is absent

- **Severity:** P2 — not a bug (the hide is deliberate), but the "depth over breadth" coaching value
  is not being produced, which directly weakens the product's core differentiation vs. a generic
  question list.
- **Area:** research-pipeline / practice / output
- **User scenario:** a signed-in user practices any question in either existing interview.
- **What happened (live):** across **all 10** Stripe · Data Product Manager questions and **all 40**
  OpenAI · Solutions Architect questions, no answer guidance renders anywhere — no "what strong
  answers show", no good/weak signals, no seniority expectation, no sample outline — in practice
  **or** on the dashboard. The practice card is question + stage/difficulty badges + timer + Practice
  tools (voice/notes) only. [`20-d-practice.png`](./assets/2026-09-13/20-d-practice.png),
  [`21-m-practice.png`](./assets/2026-09-13/21-m-practice.png)
- **Root cause (code-confirmed):** the deployed `interview-research` synthesis hardcodes
  `evaluation_criteria` / `follow_up_questions` / `suggested_answer_approach` empty and never writes
  `good_answer_signals` (per the PREPIO-176 commit message and the `hasQuestionInsightsContent`
  predicate added in `src/components/practice/QuestionInsightsPanel.tsx`). The frontend *supports*
  these fields (`Practice.tsx` reads `good_answer_signals`, `weak_answer_signals`,
  `seniority_expectation`, `sample_answer_outline`) and a separate `interview-question-generator`
  prompt *asks* for them, but the pipeline that actually populates practice questions does not persist
  them. PREPIO-176 chose to hide the empty surface "rather than expanding the synthesis schema."
- **Why it matters:** review question #6 ("does the output feel meaningfully personalized, or generic
  AI content?") and the product promise of "30–50 deeply tailored questions with answer guidance"
  both hinge on this layer. Right now a returning user gets a well-organized list of company/role
  questions but no coaching on how to answer them — the thinnest reading of "prep." Hiding the empty
  panel was the right call; leaving the coaching layer unfilled is the gap.
- **Recommended fix (post-freeze):** populate the answer-guidance fields in `interview-research`
  synthesis (at minimum `good_answer_signals` + a one-line seniority expectation + a short outline),
  so the coach panel PREPIO-176 gates on has real content again. This is deliberately deferred by the
  freeze, so it belongs in the backlog, not the freeze window.
- **Tracking:** this gap already has a designated owner — **[PREPIO-176](https://linear.app/qiuyue/issue/PREPIO-176)**.
  `docs/ROADMAP.md` (**Next** section) assigns exactly this pipeline gap to PREPIO-176: *"Either
  synthesis starts emitting these fields or the columns and their consuming UI come out."* PREPIO-176
  is marked **Done** in Linear for its shipped frontend part (#338 hid the empty panel), but the
  ROADMAP keeps it as the tracking home for the remaining "emit the fields or remove the columns"
  decision. Run #21's live confirmation is added as a comment there (no new issue needed — and the
  workspace is at its free issue cap regardless). Related pipeline work:
  [PREPIO-149](https://linear.app/qiuyue/issue/PREPIO-149) (staged synthesis),
  [PREPIO-76](https://linear.app/qiuyue/issue/PREPIO-76) (pipeline v3).

### 4. P2 (REPEAT, live-confirmed — 16th audit) — `/auth` sign-in fields have no `autocomplete` attributes

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields **are** properly `<label>`-associated
  (`labels.length === 1` each), so this is narrowly the autofill / password-manager hint.
  [`04-d-auth.png`](./assets/2026-09-13/04-d-auth.png)
- **Why it matters:** browsers / password managers can't reliably offer credential autofill; an
  invited user under time pressure retypes both fields. Sign-in stays in scope under the freeze even
  as public sign-up is locked down.
- **Recommended fix:** add `autocomplete="email"` / `current-password` on sign-in (and
  `new-password` + `username` on sign-up if retained behind the invite gate). PR #244 was closed
  unmerged; the two-attribute change needs re-applying.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog) — confirmed
  live 2026-09-13.

### 5. P3 (REPEAT, live-confirmed) — `/history` shows the empty state despite real in-progress practice (and just-saved answers)

- **Severity:** P3 (visibility-of-status / trust; reads as a bug to a returning user)
- **Area:** history / dashboard
- **What happened (live, `/history`):** the account has two in-progress interviews on `/interviews`
  ("Stripe · Data Product Manager · 4 of 10 answered · 40%", "OpenAI · Solutions Architect · 8 of 40
  answered · 20%"), returns real `practice_answers` rows, and I just persisted new answers this run
  (`POST 201`), yet `/history` still renders *"Ready to start practicing / Your first practice
  session will appear here…"* [`30-d-history.png`](./assets/2026-09-13/30-d-history.png)
- **Why it matters:** the returning-user "what did I do / what's left" surface tells them they've done
  nothing when they've answered a dozen questions across two interviews. Defensible only if history =
  *completed* sessions, but the disconnect reads as a bug.
- **Recommended fix:** surface in-progress sessions on `/history`, or make the empty-state copy
  explicit that it lists *completed* sessions and point to `/interviews`. PREPIO-107's "progress on
  the interview card + Review tab" direction covers this — note it has slipped from **In Progress**
  back to **Backlog** (2026-09-02).
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (Medium, Backlog).

## Notable live observations (not top-5)

### Positives — live-verified this run

- **Practice question is the `<h1>` hero on both breakpoints, and PREPIO-176 hides the empty coach
  panel cleanly.** Desktop and mobile both render the question as a large, bold `<h1>`; the "Answer
  guide" surface is correctly absent for the no-guidance questions (no dead control).
  [`20-d-practice.png`](./assets/2026-09-13/20-d-practice.png),
  [`21-m-practice.png`](./assets/2026-09-13/21-m-practice.png)
- **Landing is a strong first impression by default.** Single `<h1>` *"Walk into your next interview
  knowing exactly what to expect."*, a research-first sub-hero, the rich static Stripe example, and a
  clean 3-step "How it works". A first-timer understands the company-and-role value in well under 30s
  without signing in — the only problem is that clicking the CTA blanks it (P0 #1).
- **Text-answer save persists.** `POST practice_answers` → `201`. **Save & Continue is enabled only
  after text is entered** (error prevention) — verified disabled on a fresh question.
- **Mobile practice is clean.** No horizontal overflow (390/390), Favorite/Needs-work render as
  text-labeled buttons on mobile (icon-only with correct `aria-label`s on desktop), Save & Continue
  is 173×48, quick-notes copy is honest device-local *"Saved on this device while you practice."*,
  fixed Skip / Save & Continue bottom bar.
- **`/interviews` resumes well.** Cards show state + progress ("4 of 10 answered · 40%") with
  **Continue practice** and **Plan** one click away, each carrying `?searchId=…`.
  [`05-d-interviews.png`](./assets/2026-09-13/05-d-interviews.png)
- **Narrow-viewport reflow is clean.** At a 720px viewport (a proxy for 200% zoom's effective CSS
  viewport, **not** a device-pixel-accurate browser-zoom test) landing reflows with no horizontal
  scroll (`scrollWidth == clientWidth == 720`).

### Method notes / caveats

- **Keyboard focus order is inconclusive this run.** The headless Tab probe kept focus on `<body>`
  (a known headless-Chromium focus artifact, not a page bug) so I did not re-measure the tab ring;
  run #20's finding (visible focus rings, sensible order) is carried, not re-attested.
- **Favorite/Needs-work desktop targets are 32×28px** — above the WCAG 2.5.8 AA 24px floor but under
  the 44px comfort baseline. Mobile equivalents are comfortably larger. Below the ticketing threshold;
  noted for any practice-chrome pass.

### Freeze-surface items to fold into PREPIO-27 (observed live, unchanged)

- `/pricing` still shows live **Choose monthly / quarterly / annual** checkout CTAs at the undeployed
  `create-checkout-session`. Copy itself is honest; it is the purchase *button* that must go.
- Public **Sign Up** tab still present on `/auth` — freeze wants invite-only.
- PDF resume upload should be disabled in the frozen surface while the `pdfjs-dist` advisory
  (PREPIO-140) is open — not exercised this run (tester CV already seeded).

## Journey scorecard

Full authenticated pass. Two user-facing commits shipped since `2026-09-03`. The one score mover is
**Generated output clarity (5 → 3)** — see the note; this is a *measurement correction*, not a
week-over-week regression (prior runs credited the empty coach scaffold that PREPIO-176 has now
correctly hidden). Rows tagged **(live)** were exercised this run.

| Area | 2026-09-03 | 2026-09-13 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + rich static example strong, but the interactive guest preview still fails and **blanks the static example** (P0 #1). |
| Research entry | 4 | 4 | = | **(carried, not re-submitted)** Honest, progressive, CV-aware form; unchanged in code. |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged in code; not re-triggered. |
| Generated output clarity | 5 | **3** | **▼** | **(live)** Stage/difficulty structure and grouping are good, but **no answer guidance renders on any question** in either interview (P2 #3). The prior 5 credited the empty coach scaffold PREPIO-176 has now hidden — this is a more honest measurement, not a new regression. |
| Practice mode | 4 | 4 | = | **(live)** Question is `<h1>` hero, save persists (`201`), Save enabled only when non-empty, empty coach panel now hidden — but Favorite/Needs-work is 100% broken (P1 #2) and there is no coaching content (P2 #3). |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px primary controls, fixed bottom bar, question dominates as `<h1>`. |
| Resume/profile trust | 4 | 4 | = | **(carried)** Not screenshotted (PII). PDF upload should be disabled under the freeze (PREPIO-27/PREPIO-140). |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Interviews cards resume well, but `/history` empty despite in-progress work and just-saved answers (P3 #5). |
| Error/empty states | 4 | 4 | = | **(live)** `/practice` no-search state and flag failure are honest; held at 4 by the guest-preview blanking the static example (P0 #1). |
| Accessibility | 4 | 4 | = | **(live)** Practice `<h1>` on both breakpoints; flag buttons have `aria-label`s; clean 720px reflow. Remaining: `/auth` autocomplete null (#4). Focus order inconclusive this run (headless artifact). |
| Copy quality | 4 | 4 | = | **(live)** Research/dashboard/practice/pricing copy honest and specific. Freeze still needs a copy pass to drop promises of unavailable features (PREPIO-27). |

**Composite: down one, on Generated output clarity — as a measurement correction.** The deployed core
holds; the newly-honest read is that the coaching layer is empty (P2 #3). The structural anchors are
unchanged: the freeze surface-lock (PREPIO-27), the flag-write migration (PREPIO-170), both inside/
alongside the attended deploy (PREPIO-124).

## Regression check

Two rendered-surface commits merged since the last review (PREPIO-176 #338, PREPIO-175 #336) plus one
functional research-pipeline change with no UI diff (PREPIO-144 #340) — one improvement, no code
regressions observed; PREPIO-144's effect on generated output is code-confirmed but not live-exercised
(no fresh research run this week):

| Item | State | Note |
|------|-------|------|
| Practice coach panel (empty scaffold) | **Fixed** ✅ | Now hidden when a question has no guidance (#338 / PREPIO-176). Removes a dead control. |
| Job-row evidence classification | **Changed (code-confirmed)** ⚠️ | #340 / PREPIO-144: caller-supplied non-ATS role URL now downgrades to `market_heuristic`/low trust (was forced `official_job`/high), feeding synthesis + citation validation. Can change fresh-run output; **not live-exercised** (no research run this week). |
| Practice question heading structure | **Holding** ✅ | Question is `<h1>` on desktop and mobile. |
| Landing `<h1>` + rich static example (default) | **Holding** ✅ | Single `<h1>`; static Stripe example present on load. |
| Text-answer save | **Holding** ✅ | `POST 201`; Save disabled until non-empty. |
| Notes autosave copy | **Holding** ✅ | "Saved on this device while you practice." |
| Mobile practice layout | **Holding** ✅ | No overflow, ≥44px primary controls, fixed bottom bar. |
| Answer guidance in practice | **Newly surfaced** ⚠️ | Empty for every question in both interviews; not a regression (pipeline never populated it) but now visible with the scaffold gone. (P2 #3) |
| Guest preview (live path) | **Still broken** ❌ | `research-preview` 404 → CORS → blanks the static example. Scoped for removal, not deploy (PREPIO-27). (P0 #1) |
| Checkout / portal CTAs | **Still live-but-dead** ❌ | 404 functions; CTAs still shown. Scoped to be hidden (PREPIO-27). (P0 #1) |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10`; fixing migration exists, unapplied. (P1 #2) |
| `/auth` autocomplete | **Still unfixed — 16th audit** ⚠️ | `null`. (P2 #4, PREPIO-123) |
| `/history` vs in-progress parity | **Still open** ⚠️ | Empty state despite "8 of 40 answered". (P3 #5, PREPIO-107 — slipped to Backlog) |

**Net: one improvement, zero code regressions, one newly-honest product gap surfaced.**

## Recommended tickets

Every finding maps to an existing issue; **no new issue is filed** (the workspace is at its free issue
cap regardless). Findings #1, #2, #4, #5 → PREPIO-27, -124, -170, -123, -107. The answer-guidance gap
(#3) is owned by **[PREPIO-176](https://linear.app/qiuyue/issue/PREPIO-176)** — `docs/ROADMAP.md`
(Next) designates it as the home for this exact pipeline gap — so run #21's live confirmation is added
as a comment there. Live-confirmation is recorded in this doc for all six.

1. **[P0] Lock the frozen guest/billing/auth surface** — static guest sample (no Edge Function call),
   hide checkout/portal/paid-feedback, invite-only sign-up, disable PDF upload (PREPIO-140), strip
   unavailable-feature copy, add guest-makes-zero-calls tests. →
   [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (Urgent, Todo).
2. **[P0] Attended freeze deploy** — reconcile migration history, deploy the five core functions +
   pending migrations via the explicit manifest (never the all-functions script); land the
   PREPIO-143 ownership prerequisite first. →
   [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo).
3. **[P1] Apply `20260710203000_question_flags_per_type.sql`** so the Favorite/Needs-work upsert stops
   returning `42P10`. → [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo).
4. **[P2] Populate answer guidance in `interview-research` synthesis** so the practice coach panel has
   real content again (good/weak signals, seniority expectation, short outline). Post-freeze backlog.
   → [PREPIO-176](https://linear.app/qiuyue/issue/PREPIO-176) (ROADMAP's designated owner for this
   gap; Done in Linear for the shipped frontend hide, kept under ROADMAP **Next** for the pipeline
   decision) — live-confirmation comment added this run.
5. **[P2] Add `autocomplete` attributes to `/auth` sign-in (and retained sign-up).** →
   [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog; PR #244 closed unmerged).
6. **[P3] Surface in-progress work on `/history` (or clarify the empty-state scope).** →
   [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (Medium, Backlog).

### Deferred items (per CLAUDE.md hygiene convention)

- **The answer-guidance gap (finding #3) is tracked under its ROADMAP-designated owner,
  [PREPIO-176](https://linear.app/qiuyue/issue/PREPIO-176)** — not a new issue. `docs/ROADMAP.md`
  (Next) assigns this exact pipeline gap to PREPIO-176 (*"Either synthesis starts emitting these
  fields or the columns and their consuming UI come out"*); it is Done in Linear only for the shipped
  frontend hide (#338). Run #21's live confirmation is added as a comment there. No new issue is
  filed — the finding already has a home, and the workspace is at its free issue cap regardless. (A
  stray earlier comment on [PREPIO-149](https://linear.app/qiuyue/issue/PREPIO-149) has been amended
  to defer to PREPIO-176 to avoid split tracking.)
- The Favorite/Needs-work desktop touch-target size (32×28px) and the `/auth` sign-up invite gate are
  below the >30-min ticketing threshold / already covered by PREPIO-27; left as report notes.
- All other findings map to existing open issues (PREPIO-27, -124, -170, -123, -107); live-confirmed
  this run.

---

Capability: live browser verified
