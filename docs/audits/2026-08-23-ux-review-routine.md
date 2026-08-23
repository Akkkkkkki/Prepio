# Prepio UI/UX Review — 2026-08-23 (recurring routine, run #17)

Seventeenth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-09`](./2026-08-09-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review. Backend reachability comes and goes with the review
environment: `2026-08-13` (run #15) was a full authenticated pass (login, mobile practice,
a live flag probe, an answer save) but reused an existing interview via *Continue practice*;
`2026-08-20` (run #16) was **frontend-only** (Supabase unreachable that run). This run the
backend is reachable again, so the authenticated loop was exercised end-to-end **and** a
**fresh research run was submitted and completed live** — the first new-research run observed
end-to-end since the async pipeline (PREPIO-40) shipped, so the progress UI below is measured
live here for the first time. (Correction, per Codex review of this PR: an earlier draft
framed this as "the first authenticated pass in five weeks," which was wrong — 08-13 was a
full authenticated pass 10 days prior; only 08-20 was frontend-only. The genuine novelty is
the live *new-research* run, not authentication itself.)

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (`--ssl-version-max=tls1.2` + `--ignore-certificate-errors` + explicit `proxy.server`
  from `HTTPS_PROXY`; standing gotchas).
- **Frontend (Vercel): PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
- **Backend (Supabase): PASS** — the host `vjwrirrqprjzdorignlz.supabase.co` answered this
  run (`/auth/v1/health` → `401`, i.e. the server responded rather than the tunnel
  refusing). **Login with the tester account succeeded** (`signInWithPassword` → redirect
  to `/interviews`), a **real research run completed** (Stripe · Data Product Manager, ~55s),
  practice **save persisted** (`POST 201 practice_answers`, interview counter advanced
  7→8→… live), and the billing/flag failures below are **live-observed network responses**,
  not inferences.

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile 390×844),
guest-preview attempt, `/auth`, login, `/interviews`, a full research run + its progress UI,
the generated dashboard + "Why this plan" personalization, practice mode (desktop + mobile) —
save / favorite / needs-work / skip / notes, `/history`, `/profile`, `/pricing` + a real
checkout attempt, and a keyboard tab-order pass. Screenshots under
[`assets/2026-08-23/`](./assets/2026-08-23/) — **the tester account carries a real seeded CV,
so all personal contact details, CV text, and CV-derived positioning have been redacted from
the profile / new-interview / research / "Why this plan" captures** (per Codex P1 review of
this PR); the research-progress capture is cropped to the modal and two duplicate PII-bearing
captures were removed.

### Edge-function deploy state — freshly probed live (the standing P0)

OPTIONS-preflight against every real function name (`Access-Control-Request-Method: POST`,
`Origin: https://prepio.qiuyue.dev`). Deployed functions answer the preflight `200`; missing
ones return `404` at the gateway:

| Function | Preflight | Product surface |
|----------|:--------:|-----------------|
| `interview-research` | **200** ✅ | Core research pipeline |
| `company-research` | **200** ✅ | (sub-step) |
| `job-analysis` | **200** ✅ | (sub-step) |
| `cv-analysis` | **200** ✅ | (sub-step) |
| `interview-question-generator` | **200** ✅ | (sub-step) |
| `research-preview` | **404** ❌ | **Guest preview** (guest→signup funnel) |
| `create-checkout-session` | **404** ❌ | **Stripe checkout** (free→paid funnel) |
| `create-portal-session` | **404** ❌ | Billing management portal |
| `stripe-webhook` | **404** ❌ | Subscription state sync |
| `answer-feedback` | **404** ❌ | **Paid AI answer feedback** (the headline paid feature) |
| `profile-import` | **404** ❌ | Structured CV import drafts |
| `practice-audio-transcribe` | **404** ❌ | **Voice-answer transcription** |

**The core research→practice loop is deployed and healthy; everything that touches guest
conversion, monetization, the paid feature, structured CV import, and voice is not.** This is
the same freeze on record since 2026-05-15 — **~14 weeks (over three months) of production
outage** as of this run (the `2026-08-13` audit logged it as its **8th consecutive
audit-cycle re-confirmation**, a count of consecutive audits rather than calendar weeks;
`2026-08-20` couldn't reach the backend to re-check) — now **live-confirmed still present**,
and confirmed via three independent user-facing failures below (guest preview, checkout,
transcription), not
just the preflight.

## Overall product judgment

**The authenticated core is genuinely good and, this week, fully verifiable — and the
deploy freeze (in force since 2026-05-15 — ~14 weeks; the 2026-08-13 audit logged its 8th
consecutive audit-cycle re-confirmation) is confirmed still present, now with live user-facing
evidence on three surfaces.** The parts of Prepio that are deployed have clearly improved since the
last full pass: the **async research progress modal** (PREPIO-40) is honest and reassuring
(three named phases, "Safe to leave this screen," a real-time percentage), the **dashboard**
opens with a "You're set up with 10 questions across 4 stages · ~35 min end-to-end" summary
and a single obvious "Start practice" action, and **"Why this plan → Your positioning" shows
real, CV-grounded personalization** ("Lean on: extensive experience in AI and data-driven
product development"; "Mismatch risks: experience primarily as a VP may not align with IC
expectations") — this is the product finally *showing* personalization rather than claiming
it. Practice mode is strong on both desktop and mobile: the question is unambiguously the
hero (20px/600 on mobile), there is no horizontal overflow, controls are ≥44px, there is a
fixed Skip / Save & Continue bottom bar, and **save works and persists**. But the deploy
freeze still guts the two funnels the product depends on: **guest preview fails** ("We
couldn't build the preview…"), **Stripe checkout fails** (clicking "Choose monthly" fires
`create-checkout-session` → CORS/`net::ERR_FAILED` → "unavailable. Please try again later."),
and **voice transcription fails silently**. Separately, the **Favorite / Needs-work flag write
is still broken** (HTTP 400, Postgres `42P10`) — a returning user who favorites a question
gets a red error toast every time. And none of the three landing-page accessibility findings
from last run shipped (still no `<h1>`; `/auth` autocomplete still `null`, now a 12th audit).
The highest-value action is unchanged and now urgent: **one attended backend deploy** would
restore guest conversion, monetization, the paid feature, and voice in a single step.

## Top 5 issues

### 1. **P0 (live-confirmed this run) — Production edge functions for guest preview, billing, paid feedback, CV import, and voice are still not deployed**

- **Severity:** P0 — kills the guest→signup funnel, the free→paid funnel, the paid feature
  itself, and voice answers. In force since 2026-05-15 — **~14 weeks (over three months)** of
  production outage (the `2026-08-13` audit logged its 8th consecutive audit-cycle
  re-confirmation, a count of audits, not calendar weeks); **freshly verified live** this run.
- **Area:** infra / deployment (fans out to landing, billing, practice, profile)
- **User scenario:** a first-time visitor tries the guest preview; a free user tries to buy;
  a mobile user records a voice answer.
- **What happened (all live this run):**
  - **Guest preview** (`research-preview` 404): entering "Anthropic · Product Manager" and
    clicking "Preview my prep" renders *"We couldn't build the preview. Try again, or sign in
    to run the…"* — the pre-signup value demo, which the roadmap makes the centerpiece of
    conversion, does not work. [`03-d-guest-preview.png`](./assets/2026-08-23/03-d-guest-preview.png)
  - **Checkout** (`create-checkout-session` 404): on `/pricing`, "Choose monthly" fires
    `POST create-checkout-session` → **CORS block / `net::ERR_FAILED`** (console:
    *"Access to fetch … blocked by CORS policy"*), and the UI shows *"unavailable. Please try
    again later."* No Stripe redirect. Monetization is dead. [`33-d-checkout-attempt.png`](./assets/2026-08-23/33-d-checkout-attempt.png)
  - **Voice transcription** (`practice-audio-transcribe` 404): the mobile answer flow leads
    with a green **"Record answer"** button, but the transcribe function is absent, so a
    recorded answer never produces a transcript (see issue #4 for the silent-failure copy gap).
  - **Paid AI feedback** (`answer-feedback` 404) and **structured CV import** (`profile-import`
    404) are likewise undeployed.
- **Why it matters:** the deployed research loop means the app *looks* fully working to a
  logged-in tester doing research + practice, which is exactly why this has survived — the
  breakage is confined to the surfaces a casual authenticated smoke-test skips. But those
  surfaces are the entire commercial and top-of-funnel story.
- **Recommended fix (maintainer, attended):** reconcile migration history, `npm run db:push`,
  `npm run functions:deploy`, then verify each recovered function no longer returns the
  **gateway `NOT_FOUND` 404** — i.e. any function-originated status counts as "deployed," not
  specifically `200`. **`stripe-webhook` is the exception the OPTIONS probe misreads** (per
  Codex review of this PR): `supabase/functions/stripe-webhook/index.ts:99` accepts POST only
  and returns **405** for every other method, including OPTIONS, so after a successful deploy
  its preflight is `405`, not `200` — check it for the absence of the gateway `NOT_FOUND` (and
  test its real path with a signed POST) rather than expecting `200`. Add a deploy-parity/health check so
  a partial deploy can't silently persist for weeks again.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent). **Now
  live-confirmed** — update the issue from "unverified" back to "confirmed broken (2026-08-23)."

### 2. **P1 (live-confirmed) — Favorite / Needs-work flag write returns HTTP 400 (`42P10`); the feature is broken for every user**

- **Severity:** P1 — a core practice affordance fails 100% of the time, with an error toast.
- **Area:** practice
- **User scenario:** during practice a user taps the ★ Favorite (or ⃠ Needs work) button on a
  question to triage what to revisit.
- **What happened (live, `/practice`):** the star fills optimistically, then `POST
  user_question_flags` returns **`400`** with body `{"code":"42P10", "message":"there is no
  unique or exclusion constraint matching the ON CONFLICT specification"}`, and a red toast
  appears: *"Couldn't save your Favorite flag / Try again in a moment."* The flag never
  persists. [`08-d-practice-flagged.png`](./assets/2026-08-23/08-d-practice-flagged.png)
- **Why it matters:** favorites / needs-work is how a user under time pressure decides what to
  practice next — a promised, visible control that silently never works erodes trust in
  whether *anything* they do is being saved. (Text-answer save, by contrast, works: `201`.)
- **Recommended fix:** the upsert's `ON CONFLICT (user_id, question_id, flag_type)` references
  a unique constraint that doesn't exist on `user_question_flags` in production. Add the
  matching unique index via migration (and pre-check/dedupe existing rows), OR change the
  write to a select-then-insert/update. This ships with the same deploy as #1 but is a
  *schema* fix, not merely a function deploy — call it out separately so it isn't missed.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (bundled). Consider
  splitting the schema fix into its own issue so it isn't lost behind the function deploy.

### 3. **P2 (REPEAT, live-confirmed — still unfixed) — Landing page ships no `<h1>` and an out-of-order heading hierarchy**

- **Severity:** P2 (WCAG 2.4.6 / 1.3.1; the single most important first-impression page)
- **Area:** accessibility / landing
- **What happened (live, `/`):** `document.querySelectorAll('h1').length === 0` on both
  desktop and mobile. The hero *"Walk into your next interview knowing exactly what to
  expect."* is an `<h3>`; the static example title is an `<h3>`; "How it works" is an `<h2>` —
  so the outline runs **h3 → h3 → h2** with no top-level heading. `/pricing` does it correctly
  (real `<h1>`), so landing is the isolated outlier. **Unchanged since 2026-08-20** — no
  landing/auth commits merged to `main` since (only docs PRs #303, #305).
  [`01-d-landing.png`](./assets/2026-08-23/01-d-landing.png)
- **Why it matters:** heading navigation is a primary screen-reader wayfinding tool; a page
  with no `<h1>` gives an SR user no title anchor on the page that decides whether they trust
  the product enough to sign up.
- **Recommended fix:** promote the hero to `<h1>`; demote the two section titles to
  `<h2>`/`<h3>` to form a valid outline. Mirror `/pricing`'s existing correct pattern.

### 4. **P2 (NEW, live + code-confirmed) — Voice transcription fails silently; no "Transcription unavailable" message**

- **Severity:** P2 (honesty/visibility-of-status gap; compounds the P0 for mobile users)
- **Area:** practice / copy
- **User scenario:** a mobile user taps "Record answer" (the *primary* answer CTA on mobile),
  records, and stops.
- **What happened:** `practice-audio-transcribe` is 404 (issue #1), so
  `transcribePracticeAudio` fails — and `src/pages/Practice.tsx:1482` handles that with a bare
  `if (!transcriptionResult.success) return;`. The audio uploads and the answer row is saved,
  but the user is **told nothing**: no transcript appears and no message explains why. The
  repo's own design principles list the correct copy for exactly this case —
  *"Transcription is unavailable. Your text answer was still saved."* — which is not shown.
- **Why it matters:** on mobile the recommended answer path *is* voice; a user who records and
  sees no transcript and no explanation reasonably concludes their answer was lost. Even after
  the deploy in #1, the silent-failure branch is a latent honesty bug worth fixing on its own.
- **Recommended fix:** in the `!success` branch, surface the design-principles copy
  (*"Transcription is unavailable. Your recording was saved."*) as a toast; keep the answer
  save. Independent of the deploy.
- **Evidence:** `src/pages/Practice.tsx:1481-1482`; mobile flow [`21-m-practice.png`](./assets/2026-08-23/21-m-practice.png).

### 5. **P2 (REPEAT, live-confirmed — still unfixed, 12th audit) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields are properly `<label>`-
  associated, so this is narrowly the autofill/password-manager hint. **PR #244 implements the
  fix but remains unmerged** — 12 audits running. [`04-d-auth.png`](./assets/2026-08-23/04-d-auth.png)
- **Why it matters:** browsers/password managers can't reliably offer credential autofill; a
  returning user under time pressure retypes both fields.
- **Recommended fix:** **merge PR #244** (`autocomplete="email"` / `current-password`, plus
  `new-password` on sign-up). One merge closes this outright.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low).

## Notable live observations (not top-5)

### Positives — live-verified this run (the deployed core is in good shape)

- **Async research progress modal (PREPIO-40) is excellent** — "Research in progress · Building
  interview prep for Stripe – Data Product Manager," three named phases (*Collecting sources ·
  Building interview stages · Preparing practice*) each with a plain-language description, a
  live overall-progress %, and *"Safe to leave this screen. Research keeps running…"* A dual
  "Research Started!" toast confirms async hand-off. Strong visibility-of-system-status.
  [`12-d-research-loading.png`](./assets/2026-08-23/12-d-research-loading.png)
- **Dashboard leads with value + one action** — *"You're set up with 10 questions across 4
  stages. Top focus: System Design Depth. ~35 min end-to-end."* + a single green "Start
  practice · 10." Stage roadmap shows per-stage confidence + priority and a "Start here ·
  highest-leverage round" badge. [`15-d-dashboard-output.png`](./assets/2026-08-23/15-d-dashboard-output.png)
- **Personalization is finally *shown*** — "Why this plan → Your positioning" maps the tester's
  actual CV: *Lean on / Address / Story gaps / Mismatch risks* with CV-specific content, and
  per-signal rationale (*"Crucial for a Product Manager at Stripe to articulate ideas clearly
  across diverse teams"*). Practice questions are role-anchored too (*"How would you improve a
  Stripe product using data insights?"*). [`16-d-whyplan-questions.png`](./assets/2026-08-23/16-d-whyplan-questions.png)
- **Practice mode: question is the hero, mobile clean** — desktop and mobile both foreground the
  question (mobile 20px/600), no horizontal overflow (390/390), all practice controls ≥44px,
  a fixed Skip / Save & Continue bottom bar, honest *"Saved on this device while you practice"*
  notes copy, and text-answer save persists (`201`). [`21-m-practice.png`](./assets/2026-08-23/21-m-practice.png)
- **Flag failure at least surfaces an honest toast** — the `42P10` write failure (#2) shows
  *"Couldn't save your Favorite flag / Try again in a moment"* rather than failing silently
  (though "in a moment" wrongly implies transience — see below).
- **New-interview form: honest, progressive, CV-aware** — *"All you need is the company…"*,
  Company required / Role optional, and *"CV added (6,434 chars). Personalizes every question.
  Using the active resume version from your interview profile."* [`10-d-newinterview.png`](./assets/2026-08-23/10-d-newinterview.png)
- **`/profile` is useful memory, not admin** — CV source shown (*"Current source:
  …CV_2026…pdf"*), completeness meter (*"20% · Next: Add your most recent role"*), honest
  subscription block (*"Free plan. Upgrade when you want detailed AI coaching."*). [`31-d-profile.png`](./assets/2026-08-23/31-d-profile.png)
- **Keyboard tab order + focus-visible healthy on landing** — skip-link → logo → Pricing →
  Sign-in → company → role, matching visual order, each with a visible 2px outline + ring.
- **Empty `/history` copy is well-written** — *"Ready to start practicing / Your first practice
  session will appear here with answers, timing, and notes…"* (but see the parity caveat below).

### Lower-severity notes

- **P3 (copy) — flag error implies transience it doesn't have.** *"Try again in a moment"* on
  the `42P10` toast is misleading: retrying always fails (it's a schema bug, not a transient
  blip). Until #2 is fixed, calmer honest copy (*"Couldn't save your flag right now."*) avoids
  training users to retry a permanently-broken action.
- **P3 (parity, carried — PREPIO-107/99) — `/history` shows the empty state despite in-progress
  practice.** The tester account has an *"In progress · OpenAI · Solutions Architect · 8 of 40
  answered"* interview, yet `/history` renders *"Ready to start practicing / Your first
  practice session will appear here."* A returning user who has done real work sees an empty
  history. Defensible if history = *completed* sessions only, but the disconnect reads as a
  bug. [`30-d-history.png`](./assets/2026-08-23/30-d-history.png)
- **P3 (a11y, carried) — sub-44px landing/auth touch targets.** Landing company/role inputs
  40px, "Sign in"/"Pricing" 36px; `/auth` tab switchers 32px. (Practice-mode mobile controls,
  by contrast, are ≥44px — the gap is specifically landing/auth.) WCAG 2.5.8 AA (24px) passes;
  this is the external 44px ergonomic recommendation. [`02-m-landing.png`](./assets/2026-08-23/02-m-landing.png)

## Journey scorecard

Full authenticated pass this run, so every row is scored **(live)**. Parenthetical is the last
value carried from `2026-08-13` (the last full-loop run) for trend continuity.

| Area | 2026-08-13 | 2026-08-23 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong, but the guest preview — the pre-signup value demo — **fails** (P0 #1), so "see value before signup" still doesn't work. |
| Research entry | 4 | 4 | = | **(live)** Honest, progressive, CV-aware form; real run submits cleanly (`201`/`202`). |
| Research progress/loading | 4 | 5 | ↑ | **(live)** PREPIO-40 async modal is excellent — named phases, live %, "safe to leave." First re-measurement since it shipped. |
| Generated output clarity | 4 | 5 | ↑ | **(live)** Prep summary + time estimate + stage roadmap + CV-grounded "Your positioning." Personalization is now *shown*. |
| Practice mode | 4 | 4 | = | **(live)** Question is hero, save persists — but Favorite/Needs-work is 100% broken (P1 #2), holding the score down. |
| Mobile usability | 3 | 4 | ↑ | **(live)** Practice-mode mobile is strong: no overflow, ≥44px controls, fixed bottom bar, question dominates. (Landing/auth targets still small — P3.) |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile shows CV source, completeness, honest upgrade copy; structured *import* (`profile-import`) is undeployed (P0). |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Interviews cards resume well ("Continue practice · 8 of 40"), but `/history` shows empty despite in-progress work (P3 parity). |
| Error/empty states | 3 | 4 | ↑ | **(live)** Guest-preview, checkout, and flag failures all show honest recoverable copy; empty `/history` copy is good. (Voice fails silently — P2 #4 — keeps it off 5.) |
| Accessibility | 2 | 2 | = | **(live)** Keyboard order + focus + practice-mobile targets good, but no landing `<h1>` (#3), `/auth` autocomplete null (#5), landing sub-44px targets — all unfixed since last run. |
| Copy quality | 4 | 4 | = | **(live)** Research/dashboard/profile/pricing/offline copy honest and specific; "try again in a moment" on a permanent failure is the one off-note (P3). |

**Composite:** four rows up (research progress, output clarity, mobile, error states) reflect
genuine shipped improvements — several measurable live for the first time since the async
pipeline shipped (this run's fresh research run exercised them); nothing regressed. The two anchors are unchanged and structural — the **P0 deploy freeze** and the
**landing accessibility cluster**, both carried, both now live-confirmed still open.

## Regression check

| Item | State | Note |
|------|-------|------|
| Async research progress UI (PREPIO-40) | **New/verified** ✅ | Excellent; first live measurement. |
| Dashboard prep summary + "Your positioning" personalization | **Holding** ✅ | CV-grounded, on-message. |
| Practice question-as-hero (desktop + mobile) | **Holding** ✅ | No overflow, ≥44px, fixed bottom bar. |
| Text-answer save | **Holding** ✅ | `201`, counter advanced 7→8 live. |
| Keyboard tab order + focus-visible | **Holding** ✅ | Matches visual order. |
| Guest preview | **Still broken** ❌ | `research-preview` 404 → "We couldn't build the preview." (P0 #1) |
| Stripe checkout | **Broken (newly live-confirmed)** ❌ | `create-checkout-session` CORS/`ERR_FAILED` → "unavailable." (P0 #1) |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10`, red toast every time. (P1 #2) |
| Voice transcription | **Broken + silent** ❌ | `practice-audio-transcribe` 404; no user message. (P2 #4) |
| Landing `<h1>` / heading order | **Still unfixed** ⚠️ | Zero `<h1>`, h3→h3→h2. (P2 #3) |
| `/auth` autocomplete | **Still unfixed — 12th audit** ⚠️ | `null`; PR #244 unmerged. (P2 #5) |
| `/history` vs in-progress card parity | **Still open** ⚠️ | Empty state despite "8 of 40 answered." (P3, PREPIO-107/99) |

**Net: no shipped-behaviour regressions. Four deployed improvements are now live-verified
(several for the first time since the async pipeline shipped, via this run's fresh research
run); the P0 deploy freeze (guest/billing/feedback/import/voice), the P1 flag write, and the
landing a11y cluster all remain open and are freshly live-confirmed.**

## Recommended tickets

Linear was unauthenticated in this session, so these could not be filed directly; they are
Linear-ready below (mostly updates to existing issues) and filing is owed to the next session
with Linear access.

1. **[P0] Deploy the seven missing edge functions + reconcile schema** — clear the gateway
   `NOT_FOUND` 404 on `research-preview`, `create-checkout-session`, `create-portal-session`,
   `stripe-webhook`, `answer-feedback`, `profile-import`, `practice-audio-transcribe` (any
   function-originated status counts as deployed — **`stripe-webhook` answers OPTIONS with 405
   by design, so verify it via a signed POST, not a 200**, per issue #1); add a deploy-parity
   health check. **Update [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) → confirmed
   broken 2026-08-23 (live).** (Issue #1.)
2. **[P1] Fix `user_question_flags` upsert (`42P10`)** — add the missing
   `(user_id, question_id, flag_type)` unique index (dedupe first) or switch to
   select-then-write. **Split from PREPIO-124 into its own schema issue** so it isn't lost
   behind the function deploy. Area: `area:practice` + Bug. (Issue #2.)
3. **[P2] Landing page: add `<h1>` + fix heading order** — promote hero to `<h1>`, normalise
   outline; mirror `/pricing`. Area: `area:landing` + accessibility. (Issue #3.)
4. **[P2] Surface "Transcription unavailable" copy on transcribe failure** — replace the bare
   `return` at `src/pages/Practice.tsx:1482` with the design-principles toast; keep the answer
   save. Area: `area:practice` + copy. (Issue #4.)
5. **[P2] Merge PR #244 — `/auth` autocomplete** — 12th audit still `null`.
   **Update [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123).** (Issue #5.)
6. **[P3] Honest flag-failure copy** — drop "Try again in a moment" for a permanent failure
   until #2 lands. Area: `area:practice` + copy.
7. **[P3] `/history` ↔ in-progress card parity** — either surface in-progress sessions in
   `/history` or adjust the empty-state copy to distinguish "no *completed* sessions" from "no
   practice at all." **Update [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)/[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99).**

## Next-run focus

1. **Re-probe the deploy state first** (OPTIONS-preflight table above). If the functions no
   longer return the gateway `NOT_FOUND` 404 (remembering `stripe-webhook` answers OPTIONS with
   `405` by design — verify it via a signed POST), re-run guest preview + checkout + a voice
   answer to confirm the funnels recovered; if not, the P0 carries with an even longer clock.
2. **Confirm the `42P10` flag fix** — favorite a question and check for `201` instead of `400`.
3. **Screen-reader pass on landing** — now with the missing-`<h1>` finding as a concrete thing
   to confirm an SR user hits.
4. **Rotate the research company** (Vitol / McKinsey / Palantir) to keep the personalization
   check honest across roles.

`Capability: live browser verified (frontend + backend both reachable; full authenticated pass, incl. the first live end-to-end new-research run since PREPIO-40 shipped)`
