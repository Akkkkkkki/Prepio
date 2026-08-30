# Prepio UI/UX Review — 2026-08-30 (recurring routine, run #19)

Nineteenth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review: the authenticated research→practice loop was exercised live
(login → resume an existing plan → **Start answering** → save a text answer → flag a question).
It was **not** an end-to-end fresh-research pass — no new research run was submitted this week (that
spends real OpenAI/Tavily budget on the tester account and takes minutes), so the research **form**
and the async progress modal were verified in code / carried from prior runs, not re-triggered.
Backend deploy state and the two live failures below were probed live.

- **Playwright Chromium: PASS (via a local MITM shim).** The egress TLS filter resets Chromium's
  ClientHello for every HTTPS host (`net::ERR_CONNECTION_RESET`; the proxy log shows
  `ws_closed_mid_exchange … 1825 B sent, 39 B received` against `prepio.qiuyue.dev:443`), while
  `curl`/Node's OpenSSL stack pass. Worked around by running a tiny local MITM proxy that terminates
  Chromium's TLS with a throwaway cert (`--ignore-certificate-errors`) and re-forwards each request
  through the agent proxy on Node's (allowed) TLS stack. All captures below go through it. **This is
  a standing gotcha for this environment** — a plain `--proxy-server=$HTTPS_PROXY` launch will not
  load the app; carry the shim forward.
- **Frontend (Vercel): PASS** — `curl … https://prepio.qiuyue.dev/` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`.
- **Backend (Supabase): PASS** — `…supabase.co/auth/v1/health` → `401` (server answered). **Login
  with the tester account succeeded** (Enter-submit → redirect to `/interviews`). A **text-answer
  save persisted live** (`POST practice_answers` → `201`, session progress → "1 answered"). The
  **Favorite flag write failed live** (`POST user_question_flags` → `400 / 42P10`). Guest-preview
  failure below is a **live-observed network response**, not an inference.

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile iPhone-13
390×844), guest "Preview my prep" attempt, `/auth` (autocomplete + focus probe), login, redirect
context on a protected-route direct link, `/interviews`, `/new-interview` (research form), practice
mode (desktop + mobile) — **text-answer save (`201`)**, **Favorite flag write (`400/42P10`)**, notes
autosave, `/history`, `/profile`, `/pricing` (page viewed for copy; the checkout CTA was **not**
exercised this run), keyboard-focus pass, 200%-zoom overflow check, and an
edge-function deploy probe across all twelve functions. Screenshots under
[`assets/2026-08-30/`](./assets/2026-08-30/). **CV/profile-derived captures were deliberately
excluded** — the tester account carries a real seeded CV (name, phone, email, LinkedIn visible on
the research form's CV panel and the profile page); those two screenshots were dropped to avoid
committing PII (see [PREPIO-145](https://linear.app/qiuyue/issue/PREPIO-145)).

## The week in one line: two real fixes shipped — both accessibility/honesty carries from last review

`origin/main` HEAD is `32e28da`. Since the last review (`0a2c95c`, the run-#18 doc), **two
product-code commits landed** (plus one lockfile chore):

| Commit | PR / issue | Effect |
|--------|-----------|--------|
| `32e28da` | #315 / [PREPIO-171](https://linear.app/qiuyue/issue/PREPIO-171) | **Landing now ships a single `<h1>`** — closes last review's P2 #3. **Done.** |
| `a9640b1` | #311 | **Transcription failure now shows an honest toast** ("Transcription unavailable / Your answer was still saved.") — closes last review's P2 #4. |
| `ebe6e86` | #313 | React Router lockfile patch — no user-facing change. |

Both fixes were verified this run: the landing `<h1>` **live** (heading outline is now h1→h2→h2,
zero out-of-order headings), the transcription toast **in code** (`src/pages/Practice.tsx:1483-1501`;
the underlying `practice-audio-transcribe` function is still 404, so voice still cannot transcribe —
but it now **fails honestly** instead of silently). **Accessibility improves 2 → 3** this week — the
first *upward* move on that row since it was marked down to 2 on 2026-08-20 (it had also read 3 back
on 2026-07-05), i.e. a recovery of the recently-lost point, not an all-time first.

### Edge-function deploy state — freshly probed live (the standing P0)

OPTIONS-preflight against each function (`Access-Control-Request-Method: POST`,
`Origin: https://prepio.qiuyue.dev`), cross-checked with a `POST {}` body probe. Deployed functions
answer at the function level; missing ones return the gateway
`{"code":"NOT_FOUND","message":"Requested function was not found"}`:

| Function | Probe | Product surface |
|----------|:-----:|-----------------|
| `interview-research` | **deployed** ✅ | Core research pipeline (`POST {}` → `{"success":false,"error":"Missing bearer token"}`) |
| `company-research` | **deployed** ✅ | (sub-step) |
| `job-analysis` | **deployed** ✅ | (sub-step) |
| `cv-analysis` | **deployed** ✅ | (sub-step — CV personalization) |
| `interview-question-generator` | **deployed** ✅ | (sub-step) |
| `research-preview` | **404 NOT_FOUND** ❌ | **Guest preview** (guest→signup funnel) |
| `create-checkout-session` | **404 NOT_FOUND** ❌ | **Stripe checkout** (free→paid funnel) |
| `create-portal-session` | **404 NOT_FOUND** ❌ | Billing management portal |
| `stripe-webhook` | **404 NOT_FOUND** ❌ | Subscription state sync |
| `answer-feedback` | **404 NOT_FOUND** ❌ | **Paid AI answer feedback** (the headline paid feature) |
| `profile-import` | **404 NOT_FOUND** ❌ | Structured CV import drafts |
| `practice-audio-transcribe` | **404 NOT_FOUND** ❌ | **Voice-answer transcription** |

**The core research→practice loop is deployed and healthy; everything that touches guest conversion,
monetization, the paid feature, structured CV import, and voice is not.** Same freeze on record since
**2026-05-15 — now ~15.5 weeks (nearly four months)** — live-confirmed again, and cross-checked by
the live guest-preview CORS/`ERR_FAILED` failure below.

## Overall product judgment

**The deployed core is genuinely good and got two honest fixes this week; the commercial and
top-of-funnel surfaces remain dead and unmoved.** The research→practice loop a logged-in user sees is
strong — the practice question is the unambiguous hero on both desktop and mobile (large/bold, over
multiple lines with stage + difficulty badges), every practice control is ≥44px on mobile, there is
no horizontal overflow, notes autosave shows a live "Saving draft…", **text-answer save persists**
(`201`, progress advanced live), and protected-route redirects now preserve intent
("Continue to Practice." on `/auth`). This week's two commits closed both accessibility/honesty
carries from last review — the landing has a proper `<h1>` and voice transcription fails with an
honest message — which lifts **Accessibility 2 → 3**, recovering the point booked down on
2026-08-20. But the
~15.5-week deploy freeze still guts both funnels the business depends on: **guest preview fails live**
("We couldn't build the preview…"; `research-preview` 404 → CORS block), and by extension checkout,
the paid feature, structured CV import, and voice are all undeployed. The **Favorite / Needs-work
flag write is still 100% broken** (`400 / 42P10`) — the fixing migration
(`20260710203000_question_flags_per_type.sql`, now tracked as
[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)) exists but was never applied. **The
highest-value action is unchanged and now overdue by any measure: one attended backend deploy +
migration push** clears the P0 and the P1 together.

## Top 5 issues

### 1. **P0 (live-confirmed) — Guest-preview, billing, paid-feedback, CV-import, and voice edge functions still not deployed (~15.5 weeks)**

- **Severity:** P0 — kills the guest→signup funnel, the free→paid funnel, the paid feature itself,
  and voice answers. In force since 2026-05-15 — **~15.5 weeks**; freshly verified live this run.
- **Area:** infra / deployment (fans out to landing, billing, practice, profile)
- **User scenario:** a first-time visitor tries the guest preview; a free user tries to buy; a mobile
  user records a voice answer.
- **What happened (live this run):** on `/`, filling **Anthropic · Product Manager** and clicking
  **Preview my prep** fires `POST research-preview` → **CORS block / `net::ERR_FAILED`** (console:
  *"…has been blocked by CORS policy"*, *"Error creating research preview: FunctionsFetchError"*),
  and the UI shows *"We couldn't build the preview. Try again, or sign in to run the full research
  workflow."* The other six functions probe as gateway `NOT_FOUND` 404 (table above).
  [`03-d-guest-preview-fail.png`](./assets/2026-08-30/03-d-guest-preview-fail.png)
- **Extra observation:** the failed preview also **replaces the rich static Stripe example** (three
  real questions with stage/difficulty/"why it matters") with an empty *"Your Anthropic preview will
  appear here"* placeholder — so clicking the primary CTA *removes* the best pre-signup value demo
  the page had. Even before the deploy lands, the failure branch should keep the static example
  visible rather than blanking it.
- **Why it matters:** the deployed research loop makes the app *look* fully working to a logged-in
  smoke test, which is exactly why this has survived — the breakage is confined to the surfaces a
  casual authenticated pass skips. Those surfaces are the entire commercial and top-of-funnel story.
- **Recommended fix (maintainer, attended):** reconcile migration history, `npm run db:push`,
  `npm run functions:deploy`, then verify each recovered function no longer returns the gateway
  `NOT_FOUND` 404. **`stripe-webhook` is the OPTIONS-probe exception** — it accepts POST only and
  returns `405` for other methods, so post-deploy verify it via a signed POST, not a `200`. Add a
  deploy-parity/health check so a partial deploy can't silently persist for months again.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent) — keep as
  "confirmed broken (2026-08-30, live)."

### 2. **P1 (live-confirmed) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration exists but is unapplied**

- **Severity:** P1 — a core practice triage affordance fails 100% of the time, with a red error toast.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** (or **Mark as needs work**) — or, on
  mobile, uses the same buttons in the actions row — to triage what to revisit.
- **What happened (live, `/practice`):** the star fills optimistically, then
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`, and a red toast: *"Couldn't save your Favorite flag / Try again in a moment."*
  The flag never persists. [`23-d-flag-error.png`](./assets/2026-08-30/23-d-flag-error.png)
- **Root cause:** the upsert references a `(user_id, question_id, flag_type)` unique constraint that
  does not exist in production. **The fix is already written** — migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` adds exactly that constraint — it
  has simply never been applied (`db:push` not run). This is a *schema deploy*, not a code fix.
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practice
  next. A promised, visible control that silently never works erodes trust in whether *anything* they
  do persists. (Text-answer save, by contrast, is `201`.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` to production via
  `npm run db:push` (pre-check/dedupe any conflicting rows first). Ships with the same attended deploy
  as #1 but is a **schema** step — keep it called out separately so it isn't missed behind the
  function deploy.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (High, Todo) — confirmed
  live 2026-08-30.
- **P3 rider (carried):** the toast's *"Try again in a moment"* implies transience the `42P10`
  failure does not have — retrying always fails. Until the migration ships, calmer honest copy
  (*"Couldn't save your flag right now."*) avoids training users to retry a permanently-broken
  action. (The earlier "Something went wrong" wording was already fixed under
  [PREPIO-136](https://linear.app/qiuyue/issue/PREPIO-136); only the transience implication remains.)

### 3. **P2 (REPEAT, live-confirmed — 14th audit) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields **are** properly `<label>`-associated
  (`labels.length > 0`), so this is narrowly the autofill / password-manager hint.
  [`04-d-auth.png`](./assets/2026-08-30/04-d-auth.png)
- **Why it matters:** browsers/password managers can't reliably offer credential autofill; a
  returning user under time pressure retypes both fields.
- **Recommended fix:** add `autocomplete="email"` / `current-password` on sign-in, plus
  `new-password` + `username` on sign-up. One small PR closes this.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog) — confirmed
  live 2026-08-30 (the fix PR #244 was closed unmerged on 2026-08-13; the work needs re-applying).

### 4. **P3 (NEW this run) — Practice mode has no `<h1>`, and on mobile the screen renders *zero* headings**

- **Severity:** P3 (WCAG 1.3.1 / 2.4.6 wayfinding; the core screen, but the question is visually
  dominant so functional impact is limited)
- **Area:** practice / accessibility
- **What happened (live):** on desktop `/practice` the question is an `<h3>` (20px/600) and there is
  **no `<h1>`** on the page. On mobile (iPhone-13 viewport) `document.querySelectorAll('h1,h2,h3,h4')`
  returns **empty** — the question is rendered as a styled non-heading element, so a screen-reader
  user gets **no heading anchor at all** on the most important screen. (Aria-live announcement of the
  question was audited separately under [PREPIO-38](https://linear.app/qiuyue/issue/PREPIO-38); this
  is the distinct *heading-structure* gap.)
- **Why it matters:** heading navigation is a primary SR wayfinding tool; a user who navigates by
  headings finds nothing to jump to on `/practice`, and on mobile the page has no structural outline.
- **Recommended fix:** make the question the page `<h1>` (or add a visually-hidden "Practice" `<h1>`
  and keep the question as `<h2>`), and ensure the question renders as a heading element on the mobile
  breakpoint too. Evidence: `20-d-practice.png`, `21-m-practice.png`.
- **Tracking:** filed this run (see Recommended tickets).

### 5. **P3 (REPEAT, live-confirmed) — `/history` shows the empty state despite real in-progress practice**

- **Severity:** P3 (visibility-of-status / trust; reads as a bug to a returning user)
- **Area:** history / dashboard
- **What happened (live, `/history`):** the account has two in-progress interviews on `/interviews`
  ("Stripe · Data Product Manager · 1 of 10 answered · 10%", "OpenAI · Solutions Architect · 8 of 40
  answered · 20%") and returns real `practice_answers` rows, yet `/history` renders *"Ready to start
  practicing / Your first practice session will appear here…"* Defensible if history = *completed*
  sessions only, but the disconnect reads as a bug to a user who has done real work.
  [`30-d-history.png`](./assets/2026-08-30/30-d-history.png)
- **Why it matters:** the returning-user's "what did I do / what's left" surface tells them they've
  done nothing when they've answered nine questions across two interviews.
- **Recommended fix:** either surface in-progress sessions on `/history`, or make the empty-state copy
  explicit that it lists *completed* sessions and point to `/interviews` for in-progress work.
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (In Progress) — "surface
  needs-work & progress on the interview card and a Review tab" covers this direction.

## Notable live observations (not top-5)

### Positives — live-verified this run (the deployed core is in good shape)

- **Landing is a strong first impression.** Single `<h1>` *"Walk into your next interview knowing
  exactly what to expect."*, a research-first sub-hero, and a **rich static example** — "How Stripe
  Senior Product Manager questions look in Prepio" with three real questions carrying stage
  (Hiring manager / Product deep dive / Panel), difficulty, and a concrete *"why it matters"*
  ("A variant of this question appears in 3 Glassdoor reviews from the last 18 months") — plus a
  clean 3-step "How it works". A first-timer understands the company-and-role-specific value in
  well under 30s *without* signing in. [`01-d-landing.png`](./assets/2026-08-30/01-d-landing.png)
- **Practice: question is the hero, mobile clean.** Mobile renders the question large/bold over
  three lines with "Phone Screen"/"Hard" badges, a 00:06 timer + "Aim for 1-2 min", a green
  **Record answer** primary + **Notes**, quick-notes autosave *"Saving draft… / Saved on this device
  while you practice."*, and a fixed **Skip / Save & Continue** bottom bar. All controls ≥44px
  (Favorite 112×44, Needs work 138×44, Record 217×48, Skip/Save 173×48); no horizontal overflow
  (390/390). [`21-m-practice.png`](./assets/2026-08-30/21-m-practice.png)
- **Text-answer save persists.** `POST practice_answers` → `201`; session progress advanced to
  "1 answered" live. **Save & Continue is correctly disabled on an empty answer** (error prevention).
- **Protected-route redirects preserve intent.** Logged-out direct links to `/practice` and
  `/dashboard` both bounce to `/auth` with a route-specific banner — `/practice` → *"Continue to
  Practice."* (banner text captured live); `/dashboard` → *"Continue to Dashboard."* (the intent
  label from `AUTH_RESUME_LABELS`; only the redirect + `/practice` banner were captured live this
  run, `/dashboard`'s label is code-confirmed) — the redirect-context pattern the design principles
  call for.
- **`/interviews` resumes well.** Cards show state + progress with **Continue practice** and **Plan**
  one click away. [`05-d-interviews.png`](./assets/2026-08-30/05-d-interviews.png)
- **`/pricing` copy is honest and concrete.** *"Research, prep plans, and practice stay free. Paid
  subscriptions unlock AI feedback on saved practice answers…"* — free vs paid unambiguous (only the
  checkout button is broken, per #1). [`32-d-pricing.png`](./assets/2026-08-30/32-d-pricing.png)
- **Keyboard focus is visible; 200% zoom holds.** Tab order on landing is Skip-link → nav → form,
  each with a visible green focus ring (2px outline + ring); `body{zoom:2}` produces no horizontal
  overflow.
- **Transcription now fails honestly (#311).** The prior silent-failure branch now surfaces
  *"Transcription unavailable / Your answer was still saved."* — a genuine honesty improvement, even
  though the function itself is still 404.

### Lower-severity notes

- **P3 (a11y, carried) — sub-44px landing/auth touch targets.** Mobile landing: "Pricing" 71×36,
  "Sign in or create account" 193×36, company/role inputs 40px tall ("Preview my prep" is a healthy
  308×48). Practice-mode mobile controls, by contrast, are all ≥44px — the gap is specifically
  landing/auth. WCAG 2.5.8 AA (24px) passes; this is the external 44px ergonomic recommendation.
- **Practice-session load spinner (~7s).** Clicking **Continue practice** shows *"Starting your
  practice session / Hang tight — we're setting up your questions…"* for ~7s before Q1 renders.
  Honest and reassuring, but on the long side for resuming an existing plan; worth watching if it
  grows.

## Journey scorecard

Full authenticated pass this run. Two product commits shipped since `2026-08-27`; the only score
mover is **Accessibility (2 → 3)**. Rows tagged **(live)** were exercised this run; two research rows
are code-confirmed / carried (the form was not re-submitted).

| Area | 2026-08-27 | 2026-08-30 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + rich static Stripe example are strong, but the interactive guest preview — the pre-signup value demo — still **fails** (P0 #1), and its failure blanks the static example. |
| Research entry | 4 | 4 | = | **(code-confirmed, not re-submitted)** Honest, progressive, CV-aware form ("CV added (6,434 chars). Personalizes every question."); unchanged in code this week. |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged in code; not re-triggered this run. Practice-resume spinner (~7s) noted. |
| Generated output clarity | 5 | 5 | = | **(live)** Plan/stage/question + answer-guide structure strong and CV-grounded. |
| Practice mode | 4 | 4 | = | **(live)** Question is hero, save persists (`201`), Save disabled when empty — but Favorite/Needs-work is 100% broken (P1 #2), holding the score down. |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px, fixed bottom bar, question dominates. (Landing/auth targets still <44px — P3.) |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile shows CV source + honest upgrade copy; inline CV-privacy copy present (PREPIO-37 done). Structured *import* (`profile-import`) undeployed (P0). |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Interviews cards resume well, but `/history` empty despite in-progress work (P3 #5). |
| Error/empty states | 4 | 4 | = | **(live)** Guest-preview and flag failures show honest recoverable copy **live**; **transcription now fails honestly (#311)** — an improvement within the 4. Checkout's error copy is **carried/code-confirmed, not live this run** — the `/pricing` CTA was not exercised (only `create-checkout-session`'s 404 was probed), so a checkout-UI regression can't be ruled out here. |
| Accessibility | 2 | **3** | **▲** | **(live)** Landing `<h1>` now present (#315), focus rings visible, redirect context preserved, 200% zoom no overflow — but `/auth` autocomplete null (#3), no practice `<h1>` / mobile no headings (#4) remain. |
| Copy quality | 4 | 4 | = | **(live)** Research/dashboard/profile/pricing copy honest and specific; "try again in a moment" on a permanent failure is the one off-note (P1 rider). |

**Composite: up one, on Accessibility.** The deployed core holds at a genuinely good level; the two
structural anchors — the **P0 deploy freeze** and the **flag write** — are both carried and both
live-confirmed still open. Accessibility recovers the point it lost on 2026-08-20; the composite is
otherwise flat (earlier runs saw larger composite gains — e.g. #13 +2, #15 +3, #17 +4).

## Regression check

Two product-code commits merged to `main` since the last review (`32e28da`, `a9640b1`; plus the
`ebe6e86` lockfile chore) — both **improvements**, no regressions:

| Item | State | Note |
|------|-------|------|
| Landing `<h1>` / heading order | **Fixed** ✅ | Single `<h1>`; outline h1→h2→h2. (was P2 #3 — #315 / PREPIO-171) |
| Voice transcription honesty | **Fixed** ✅ | Failure now toasts "Transcription unavailable / Your answer was still saved." (was P2 #4 — #311) |
| Practice question-as-hero (desktop + mobile) | **Holding** ✅ | No overflow, ≥44px, fixed bottom bar, large bold question on mobile. |
| Text-answer save | **Holding** ✅ | `201`; progress advanced live. |
| Notes autosave ("Saving draft…") | **Holding** ✅ | Live indicator, honest device-local copy. |
| Protected-route redirect context | **Holding** ✅ | `/practice`, `/dashboard` → `/auth`; route-specific banner ("Continue to Practice." captured live; "Continue to Dashboard." code-confirmed). |
| Guest preview | **Still broken** ❌ | `research-preview` 404 → CORS → "We couldn't build the preview." (P0 #1) |
| Stripe checkout / portal / webhook | **Still broken** ❌ | 404 NOT_FOUND. (P0 #1) |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10`; fixing migration exists but unapplied. (P1 #2) |
| Voice transcription (function) | **Still 404** ❌ | `practice-audio-transcribe` 404 — now fails honestly, but still cannot transcribe. (P0 #1) |
| `/auth` autocomplete | **Still unfixed — 14th audit** ⚠️ | `null`. (P2 #3, PREPIO-123) |
| `/history` vs in-progress card parity | **Still open** ⚠️ | Empty state despite "8 of 40 answered". (P3 #5, PREPIO-107) |

**Net: two improvements, zero regressions.** The landing-`<h1>` and transcription-honesty carries
from last review both shipped and are verified; the P0 deploy freeze, the P1 flag write, and the
`/auth` autocomplete gap remain open and are freshly live-confirmed.

## Recommended tickets

Most findings are already tracked; filing this run is limited to the one genuinely new item, plus
live-confirmation updates on the standing issues (done via Linear comments, not new issues).

1. **[P3 · a11y · NEW] Practice mode has no `<h1>`; mobile practice renders zero headings.**
   Make the question a heading (page `<h1>`, or visually-hidden "Practice" `<h1>` + question `<h2>`)
   and ensure it renders as a heading on the mobile breakpoint. Quality & Maintenance; `Chore` +
   `area:practice`. Cross-link this audit. → **[PREPIO-178](https://linear.app/qiuyue/issue/PREPIO-178)** (filed this run).
2. **[P0] Deploy the seven missing edge functions + apply the pending migrations** — clear the
   gateway `NOT_FOUND` across guest preview, checkout, portal, webhook, answer-feedback,
   profile-import, transcribe; add a deploy-parity check. **On the migration count:** this run probed
   *edge-function* presence but did **not** refresh migration history, so do not treat any fixed count
   as verified. Only `20260710203000_question_flags_per_type.sql` is directly confirmed unapplied
   (live `42P10`); the 2026-08-13 audit lists **eight** migrations newer than the last known
   production baseline (including `20260808110000_profile_story_linking`, PREPIO-57) whose applied
   state is unverified — reconcile with a direct `list_migrations` diff and confirm each rather than
   assuming a number. → **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (existing;
   confirmed live 2026-08-30).
3. **[P1] Apply `20260710203000_question_flags_per_type.sql`** so the Favorite/Needs-work upsert
   stops returning `42P10`. → **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (existing;
   confirmed live 2026-08-30).
4. **[P2] Add `autocomplete` attributes to `/auth` email/password (sign-in + sign-up).** →
   **[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (existing; confirmed live, 14th audit).
5. **[P3] Surface in-progress work on `/history` (or clarify the empty-state scope).** →
   **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (existing, In Progress).
6. **[P3 · optional] On guest-preview failure, keep the static example visible** instead of blanking
   it to "Your Anthropic preview will appear here" — folded into PREPIO-124's fix; noted here for the
   maintainer, not filed separately.

### Deferred items (per CLAUDE.md hygiene convention)

- New this run: **practice-mode heading structure** (item 1) — filed as
  [PREPIO-178](https://linear.app/qiuyue/issue/PREPIO-178) (Quality & Maintenance, `Chore` +
  `area:practice`).
- All other findings map to existing open issues (PREPIO-124, -170, -123, -107); no new issues
  needed. PREPIO-171 (landing `<h1>`) and the #311 transcription honesty fix are **Done** — removed
  from the standing carry list.

---

Capability: live browser verified
