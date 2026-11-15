# Prepio UI/UX Review — 2026-11-05 (recurring routine, run #21)

Twenty-first run of the recurring UX-review routine, and the first since the freeze
surface-lock shipped. Immediate baseline:
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20). Operating contract:
[`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

- **Playwright Chromium: PASS.** Loaded the live app headless through the agent proxy
  (`chromium.launch({ proxy: { server: $HTTPS_PROXY } })` + a context with
  `ignoreHTTPSErrors: true`). **The ClientHello-reset gotcha documented in run #20 did not
  reproduce this cycle** — a plain proxied launch loaded every host (`200`), so the MITM
  shim was not needed. Carry both notes forward; the environment's TLS behaviour has
  varied between runs.
- **Frontend (Vercel): PASS** — `curl` and Chromium both return `200`, title
  `Prepio - Interview Prep Tool`.
- **Backend (Supabase): PASS** — login with the tester account succeeded
  (`POST auth/v1/token` → `200` → `/interviews`); a text answer persisted live
  (`POST practice_answers` → `201`); flag writes were probed live (still failing, below).

**Engine / matrix scope — read this narrowly.** This run is Chromium-only at two viewports
(desktop 1440×900, mobile 390×844, `deviceScaleFactor: 1`). **Not exercised this cycle:**
WebKit/Safari, an Android-engine pass, and a throttled-network run — so Safari-specific
rendering, real device-pixel behaviour, and slow-network loading states are **not**
verified here. No fresh research run was submitted (it spends real OpenAI/Tavily budget);
the research **form** was inspected in the live DOM (copy/labels/disclosure) but not
triggered. Per the routine's PII contract, **`/profile` is now a 404 and `/new-interview`
was deliberately not screenshotted** (its CV textarea renders the seeded résumé); only
non-CV copy was read from `/new-interview`, and no CV text is transcribed below.

Screenshots: [`assets/2026-11-05/`](./assets/2026-11-05/).

## The headline: the freeze surface-lock shipped, and it is live and clean

Since run #20, the freeze work landed on `main` and is now serving in production. Verified
live this run (Linear status in parentheses):

- **Guest surface is now a static, in-page sample with zero network calls**
  ([PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27), **Done**). The landing CTA is
  `View sample plan`, which expands an *"Illustrative sample · Payments company · Product
  Manager — A fictional example of a prep plan. These are practice prompts, not verified
  questions from a particular employer. No live research runs when you open this sample."*
  with stage-grouped concrete questions. **Request log during the whole guest interaction:
  empty** (`net: []`). This directly closes run #20's **P0 #1** — the old guest CTA fired a
  doomed `research-preview` call, failed on CORS, and blanked the page's best asset. Gone.
- **Billing / profile / settings URLs now 404.** `/pricing`, `/profile`, `/settings` all
  render the 404 component (`404 Error: User attempted to access non-existent route`) — the
  old live-but-dead checkout CTAs and the PII-bearing profile page are unrouted
  (PREPIO-27). Satisfies the freeze acceptance row "old pricing/billing/profile/settings
  URLs show unavailable/404 without backend work."
- **`/auth` is invite-only** — the public **Sign Up** tab is gone; copy reads *"Prepio is
  free and invite-only. Sign in with your invited account. Ask the person who invited you
  if you need access."* (PREPIO-27).
- **`/auth` autocomplete attributes are present** — `#signin-email` →
  `autocomplete="email"`, `#signin-password` → `autocomplete="current-password"`, both
  properly `<label>`-associated. This **closes run #20's P2 #3**, the 15-audit repeat
  ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123), **Done**).
- **`/history` empty-state now disambiguates finished vs in-progress** — *"No finished
  sessions yet. Finished practice sessions appear here with answers, timing, and notes.
  Answers you save in an unfinished session stay on that interview in Your interviews."*
  This **closes run #20's P3 #4** (the narrow symptom tracked under
  [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107), whose broader "needs-work
  surfacing + Review tab" scope remains in Backlog).
- **CV privacy/trust copy is live** on `/new-interview` — *"Your CV text is saved
  privately with this prep plan and used to personalize your questions."*
  ([PREPIO-180](https://linear.app/qiuyue/issue/PREPIO-180), **Done**).

## Overall product judgment

**This is the strongest the top-of-funnel has been in this review's history, and it is a
clear improvement over run #20.** Four months of "why is half the app dark" is resolved:
the guest surface is now an honest static sample that makes *zero* provider calls, the dead
billing/profile routes 404 cleanly, sign-up is invite-only, and the two long-standing
a11y/UX repeats (`/auth` autocomplete, `/history` empty-state ambiguity) are both fixed and
confirmed live. The authenticated core remains solid: the practice question is a proper
`<h1>` on desktop and mobile, text-answer save persists (`201`), there is no horizontal
overflow at 390px, mobile practice controls are all ≥44px, and `/interviews` resumes well
with honest progress and an honest research-error card. **The single remaining core-flow
defect is unchanged from run #20: the Favorite / Needs-work flag write still returns
`400 / 42P10` on both breakpoints** — the fixing migration
(`20260710203000_question_flags_per_type.sql`, [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170),
Urgent/Todo) is still unapplied to production and is gated on the attended freeze deploy
([PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124), In Progress). The highest-value
*product* opportunity now that the P0s are cleared is conversion polish: the guest sample —
the app's best "this isn't a generic ChatGPT wrapper" proof — is hidden behind a click
rather than shown by default.

## Top 5 issues

### 1. P1 (live-confirmed, REPEAT) — Favorite / Needs-work flag write returns `400 / 42P10`

- **Severity:** P1 — a core practice-triage affordance fails 100% of the time, with a red
  error toast, on desktop **and** mobile.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** (or **Needs work**) to mark
  what to revisit.
- **What happened (live this run, both breakpoints):** the control reacts optimistically,
  then `POST user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`**
  with body `{"code":"42P10","message":"there is no unique or exclusion constraint matching
  the ON CONFLICT specification"}`, and a toast appears: *"Couldn't save your Favorite flag
  — Try again in a moment."* The flag never persists. Text-answer save, by contrast, is
  `201` (verified live).
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to
  practice next. A visible control that never persists erodes trust in whether *anything*
  they do is saved.
- **Root cause / fix:** the upsert targets a `(user_id, question_id, flag_type)` unique
  constraint that does not exist in production. The migration that adds it
  (`supabase/migrations/20260710203000_question_flags_per_type.sql`) is written and merged
  but **unapplied** — it ships in the attended freeze deploy (PREPIO-124), with a
  duplicate-row pre-check first (FREEZE_RELEASE §2.5). This is a production DB operation
  owned by the attended runbook, not a code change this review can make.
- **Rider (P3, carried):** the *"Try again in a moment"* copy implies a transience the
  permanent `42P10` failure does not have. Moot once the migration ships; not worth a
  separate copy PR ahead of it.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo),
  gated on [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (In Progress).
  Re-confirmed live 2026-11-05. Evidence: `20-practice-desktop.png`, `21-practice-mobile.png`.

### 2. P2 — The guest sample (the best proof-of-value) is collapsed behind a click

- **Severity:** P2 — conversion friction on the entire top-of-funnel; not broken, but it
  buries the one thing that separates Prepio from "ask ChatGPT for interview questions."
- **Area:** landing / conversion
- **User scenario:** a first-time invited visitor lands on `/`, spends 30 seconds deciding
  whether this is worth signing in for.
- **What happened (live):** the default landing shows a calm hero (*"Prepare for your next
  interview"*), a one-paragraph description, and a single **View sample plan** button. The
  concrete proof — stage-grouped sample questions with *"what strong answers show"*
  guidance — only appears **after** clicking. Above the fold there is no example of the
  actual output. (Run #20 praised the rich static example being *visible*; the freeze made
  it static-but-collapsed.)
- **Why it matters:** "show personalization, don't just claim it" and "time-to-value" both
  argue for proof before the click. The sample is genuinely strong (see
  `03-guest-preview.png`) — it just isn't working for the visitor while it's hidden.
- **Recommended fix:** render the sample **expanded by default**, or surface a single
  teaser question card above the fold with **View full sample plan** to expand the rest.
  Pure front-end, within the frozen static-sample surface; no backend.
- **Evidence:** `01-landing-desktop.png` (collapsed default) vs `03-guest-preview.png`
  (expanded proof). Desktop + mobile, `/`.

### 3. P3 — Returning user can't disambiguate two interviews with the same company·role

- **Severity:** P3 — recognition-over-recall gap for returning users with repeated roles.
- **Area:** dashboard / interviews
- **User scenario:** a user who has researched the same role twice (or a failed run plus a
  retry) returns to `/interviews`.
- **What happened (live):** the account shows **two** cards both titled *"OpenAI · Solutions
  Architect"* — one *"Research needs attention"*, one *"In progress · 8 of 40 answered"* —
  with nothing else to tell them apart (no created date, no run label). The card carries
  state + progress but no identity beyond company·role.
- **Why it matters:** a returning user can't tell which run is which, so "pick up where you
  left off" becomes guesswork for exactly the power user the product targets.
- **Recommended fix:** add a quiet secondary line to the interview card — created date
  (e.g. *"Started Nov 3"*) and/or a short distinguishing detail (seniority, a notes
  snippet). Small, within the authenticated core.
- **Evidence:** `10-interviews.png`, `/interviews`, desktop.

### 4. P3 — Sub-44px "Sign in" nav target on mobile landing

- **Severity:** P3 (external 44px ergonomic baseline; WCAG 2.5.8 AA 24px passes).
- **Area:** landing / accessibility (mobile)
- **What happened (live, 390×844):** the top-nav **Sign in** control measures **71×36**.
  The primary **View sample plan** CTA is 149×44 (passes), and all practice-mode mobile
  controls are ≥44px — so the gap is specifically the landing nav chrome. Carried unchanged
  from run #20's P3 #5.
- **Why it matters:** it's the first control a mobile visitor touches; 36px is a small
  one-handed hit area.
- **Recommended fix:** bump the landing-nav controls to ≥44px min-height. Cosmetic; folds
  into any landing pass (e.g. the issue #2 change).
- **Evidence:** `02-landing-mobile.png`. Below the >30-min ticket threshold — report note.

### 5. P3 — One-time post-login console error (`getInterviewSummaries: No authenticated user`)

- **Severity:** P3 — transient, self-recovering; no user-visible breakage.
- **Area:** interviews / infra
- **What happened (live):** immediately after the login redirect to `/interviews`, the
  console logged `Error getting interview summaries: Error: No authenticated user` and a
  `TypeError: Failed to fetch` once. The page then rendered its cards correctly, and the
  error **did not reproduce on a clean reload of `/interviews`** (`interviewsReloadErrs:
  []`). It reads as a summaries fetch firing in the instant before the session token is
  attached on the redirect.
- **Why it matters:** no user impact today, but a pre-auth-hydration fetch race can surface
  as a flash of empty/error state on slower connections (not tested this cycle).
- **Recommended fix:** gate the `getInterviewSummaries` call on a resolved session (await
  the auth state before first fetch on the post-login redirect). Low priority.
- **Evidence:** console capture only (no screenshot of a transient state), `/interviews`.

## Journey scorecard

Full authenticated live pass. The freeze surface-lock is the mover — four rows up. Rows
tagged **(live)** were exercised this run.

| Area | 2026-09-03 | 2026-11-05 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | **4** | ▲ | **(live)** Honest invite-only hero; guest sample is static with zero calls (old failing CTA gone). Held from 5 only because the proof is collapsed behind a click (P2 #2). |
| Research entry | 4 | 4 | = | **(live DOM, not submitted)** Minimal ask ("All you need is the company"), optional CV/role/notes, honest CV-save disclosure (PREPIO-180). |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged; not re-triggered (budget). |
| Generated output clarity | 5 | 5 | = | **(live)** Stage-grouped questions with difficulty + "why it matters" guidance, both in the guest sample and the authenticated plan. |
| Practice mode | 4 | 4 | = | **(live)** Question is the `<h1>` hero, answer save `201`, Save enabled only when non-empty — but Favorite/Needs-work is 100% broken (P1 #1), holding the score. |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile clean: no overflow (390=390), all controls ≥44px, fixed bottom bar, question dominates. (Landing "Sign in" still 36px — P3 #4.) |
| Resume/profile trust | 4 | 4 | = | **(live, copy only)** CV-save disclosure is honest and specific; `/profile` is intentionally 404 under the freeze (not a regression). |
| Dashboard/history/resume | 3 | **4** | ▲ | **(live)** `/interviews` resumes with progress + honest error card; `/history` empty-state now disambiguates finished vs in-progress. (Duplicate-title cards — P3 #3.) |
| Error/empty states | 4 | **5** | ▲ | **(live)** Guest "no live research runs" note, honest research-error card, clarified `/history` empty state, honest redirect banners. Only blemish: the misleading flag toast (rider on P1 #1). |
| Accessibility | 4 | **5** | ▲ | **(live)** Practice `<h1>` on both breakpoints, `/auth` autocomplete now present (PREPIO-123 closed), visible focus rings, invite-only copy. Remaining: sub-44px landing nav (P3 #4). |
| Copy quality | 4 | **5** | ▲ | **(live)** Honest throughout — invite-only framing, "fictional example / not verified questions", CV-save disclosure, finished-vs-unfinished history. No promises of unavailable features remain. |

**Composite: up materially (four rows up, none down).** The freeze-lock converted the
long-standing top-of-funnel P0 into resolved, honest surfaces, and closed both standing
a11y/UX repeats. The one structural anchor left is the flag-write migration (PREPIO-170,
inside the in-progress PREPIO-124 deploy).

## Regression check

The freeze-lock PRs (#354 lock to invite-only core, #360 close freeze gaps, #363 CV-save
disclosure) plus test/doc chores merged since run #20. **All improvements; zero code
regressions.**

| Item | State | Note |
|------|-------|------|
| Guest preview (old live network path) | **Fixed** ✅ | Replaced by a static in-page sample; zero Edge Function/provider calls. (was P0 #1 — PREPIO-27) |
| Checkout / portal / pricing CTAs | **Fixed** ✅ | `/pricing` 404s; no purchase control shown. (was P0 #1 — PREPIO-27) |
| Public Sign Up tab | **Fixed** ✅ | Removed; invite-only copy. (PREPIO-27) |
| `/auth` autocomplete | **Fixed** ✅ | `email` / `current-password` present. (was P2 #3, 15-audit repeat — PREPIO-123) |
| `/history` empty-state ambiguity | **Fixed** ✅ | Now disambiguates finished vs in-progress + points to Your interviews. (was P3 #4 — narrow symptom of PREPIO-107) |
| CV privacy copy | **Shipped** ✅ | "Your CV text is saved privately with this prep plan…" (PREPIO-180) |
| Practice question `<h1>` (desktop + mobile) | **Holding** ✅ | Single `<h1>` = the question on both breakpoints. |
| Text-answer save | **Holding** ✅ | `POST practice_answers` → `201`; Save disabled until non-empty. |
| No horizontal overflow @390px | **Holding** ✅ | `scrollWidth == clientWidth == 390`. |
| Protected-route redirect context | **Holding** ✅ | `/practice` → `/auth` "Continue to Practice."; `/dashboard` → "Continue to Dashboard." |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10` both breakpoints; migration unapplied. (P1 #1 — PREPIO-170, gated on PREPIO-124) |
| Sub-44px landing "Sign in" target | **Still open** ⚠️ | 71×36 on mobile. (P3 #4) |

**Net: six fixes (two of them long-standing repeats), zero regressions, one carried P1.**

## Recommended tickets

**No new Linear issue is filed this run** — every finding maps to an existing issue or sits
below the >30-min ticket threshold, consistent with the freeze's "pause maintenance" stance
and run #20's precedent.

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** so the Favorite/Needs-work
   upsert stops returning `42P10`; prove persistence across a reload on both breakpoints. →
   [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo), inside
   [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (In Progress). Live-confirmation
   comment added this run.
2. **[P2] Show the guest sample by default (or a teaser above the fold).** New direction
   this run; below the ticket threshold as a standalone — flagged as the top conversion
   opportunity for whenever the landing is next touched. Not filed to avoid spawning
   maintenance work during the freeze.
3. **[P3] Disambiguate same-title interview cards** (created date / short label). → fits
   [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)'s "interview card" scope
   (Backlog); noted there rather than a new issue.
4. **[P3] Bump landing-nav controls to ≥44px** and **[P3] gate `getInterviewSummaries` on a
   resolved session** — both below the >30-min threshold; report notes, fold into the next
   landing / auth-flow pass.

### Deferred items (per CLAUDE.md hygiene convention)

- **No new Linear issues filed.** The one live-open finding maps to PREPIO-170 (gated on
  PREPIO-124); the rest are resolved or sub-threshold.
- PREPIO-27, PREPIO-123, PREPIO-180 are **Done** and live-verified — removed from the
  standing carry list. PREPIO-107's narrow `/history` symptom is fixed; its broader
  needs-work/Review-tab scope stays in Backlog and absorbs P3 #3.

---

Capability: live browser verified (Chromium-only; no WebKit/Android/throttled-network pass;
no fresh research run; no `/profile` or `/new-interview` capture per the PII contract)
