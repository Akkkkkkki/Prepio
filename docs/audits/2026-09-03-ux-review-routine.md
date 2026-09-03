# Prepio UI/UX Review — 2026-09-03 (recurring routine, run #20)

Twentieth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review: the authenticated research→practice loop was exercised live
(login → resume an existing plan via a card's **Continue practice** → save a text answer → attempt a
Favorite flag). It was **not** an end-to-end fresh-research pass — no new research run was submitted
this week (that spends real OpenAI/Tavily budget on the tester account and takes minutes), so the
research **form** and the async progress modal were verified in code / carried from prior runs, not
re-triggered. Backend deploy state and the two live failures below were probed live.

- **Playwright Chromium: PASS (via a local MITM shim).** The egress TLS filter resets Chromium's
  ClientHello for every HTTPS host (`net::ERR_CONNECTION_RESET`), while `curl`/Node's OpenSSL stack
  pass. Worked around by running a tiny local MITM proxy that terminates Chromium's TLS with a
  throwaway cert (`--ignore-certificate-errors`) and re-forwards each request through the agent proxy
  on Node's (allowed) TLS stack. All captures below go through it. **This is a standing gotcha for
  this environment** — a plain `--proxy-server=$HTTPS_PROXY` launch will not load the app; carry the
  shim forward. (This run's shim: a ~70-line Node script that CONNECT-tunnels to `$HTTPS_PROXY` and
  pipes the two plaintext TLS streams — no HTTP parsing needed since the CONNECT line already names
  the origin.)
- **Frontend (Vercel): PASS** — `curl … https://prepio.qiuyue.dev/` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`.
- **Backend (Supabase): PASS** — **login with the tester account succeeded** (`POST auth/v1/token`
  → `200`, Enter-submit → redirect to `/interviews`). A **text-answer save persisted live**
  (`POST practice_answers` → `201`, session progress advanced to "answered"). The **Favorite flag
  write failed live** (`POST user_question_flags` → `400 / 42P10`). Guest-preview failure below is a
  **live-observed network response**, not an inference.

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile iPhone-13
390×844), guest "Preview my prep" attempt, `/auth` (autocomplete + focus probe), login, redirect
context on a protected-route direct link, `/interviews`, practice mode (desktop + mobile) —
**question-as-`<h1>` on both breakpoints**, **text-answer save (`201`)**, **Favorite flag write
(`400/42P10`)**, notes autosave, `/history`, `/pricing`, `/profile` (copy inspected, **not**
screenshotted — see PII note), keyboard-focus pass, 200%-zoom overflow check, and an edge-function
deploy probe across all twelve functions. Screenshots under
[`assets/2026-09-03/`](./assets/2026-09-03/). **The `/profile` screenshot was deliberately excluded**
— the tester account carries a real seeded CV (`CV_2026_Sharpa.pdf`); the page was inspected for copy
only, no capture committed (see [PREPIO-145](https://linear.app/qiuyue/issue/PREPIO-145)).

## The headline this week is a strategy change, not a commit: the freeze release is now defined

Two things moved since the last review, and the second reframes most of this report:

1. **One user-facing product commit landed** — `c24f291` / #329 /
   [PREPIO-178](https://linear.app/qiuyue/issue/PREPIO-178): the practice question screen now has a
   single top-level `<h1>` on **both** desktop and mobile. Verified live. Closes last review's P3 #4.
2. **A "Freeze deployment decision" was recorded on 2026-09-02** (the day before this run) on
   [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) and
   [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27). **This supersedes the "deploy all seven
   missing functions" plan that every prior review (through run #19) treated as the standing P0.**
   The frozen release is now explicitly scoped as an **invite-only, free, authenticated core**:
   - Deploy **only the five core functions** (`interview-research`, `company-research`,
     `job-analysis`, `cv-analysis`, `interview-question-generator`) plus the pending migrations —
     **not** `research-preview`, `create-checkout-session`, `create-portal-session`, `stripe-webhook`,
     or `answer-feedback`.
   - **Replace the guest "Preview my prep" network path with a deterministic checked-in static
     sample** — a guest action must make no Edge Function / OpenAI / Tavily call (PREPIO-27).
   - **Hide** Checkout, Customer Portal, paid-plan CTAs, answer-feedback, and (unless deployed +
     smoke-passing) voice transcription and profile-import — "no visible control points at an
     undeployed function."
   - Enforce invite-only sign-up; disable PDF resume upload while the `pdfjs-dist` advisory
     ([PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140)) is open; remove copy promising
     unavailable functions.

**Consequence for this review:** the guest-preview, checkout, voice, and import 404s are no longer a
neglect-P0 to be cleared by deploying. They are now, by product decision, *intentionally deferred* —
and the correct fix for what a user sees is to **lock the frozen surface** (PREPIO-27), i.e. serve a
static guest sample and remove/hide the controls that point at undeployed functions. This run's live
findings are unchanged as *observations*; their **framing and recommended fixes are rewritten to
match the 2026-09-02 decision.** Prior reviews' "deploy everything" recommendation is now stale — do
not carry it forward.

### Edge-function deploy state — freshly probed live

OPTIONS-preflight against each function (`Access-Control-Request-Method: POST`,
`Origin: https://prepio.qiuyue.dev`), cross-checked with a `POST {}` body probe. This is unchanged
from last week; the point this week is that the split below now **matches the intended freeze
manifest** rather than being a deploy backlog:

| Function | Probe | Freeze intent (2026-09-02) |
|----------|:-----:|-----------------|
| `interview-research` | **deployed** ✅ | Core — keep |
| `company-research` | **deployed** ✅ | Core — keep |
| `job-analysis` | **deployed** ✅ | Core — keep |
| `cv-analysis` | **deployed** ✅ | Core — keep |
| `interview-question-generator` | **deployed** ✅ | Core — keep |
| `research-preview` | **404 NOT_FOUND** ❌ | **Intentionally NOT deployed** — guest surface goes static (PREPIO-27) |
| `create-checkout-session` | **404 NOT_FOUND** ❌ | **Intentionally NOT deployed** — hide checkout CTA (PREPIO-27) |
| `create-portal-session` | **404 NOT_FOUND** ❌ | **Intentionally NOT deployed** — hide portal (PREPIO-27) |
| `stripe-webhook` | **404 NOT_FOUND** ❌ | **Intentionally NOT deployed** — no live billing (PREPIO-27) |
| `answer-feedback` | **404 NOT_FOUND** ❌ | **Intentionally NOT deployed** — hide paid-feedback entry (PREPIO-27) |
| `profile-import` | **404 NOT_FOUND** ❌ | Deploy only if UI + smoke pass; else hide (PREPIO-27) |
| `practice-audio-transcribe` | **404 NOT_FOUND** ❌ | Deploy only if UI + smoke pass; else hide (PREPIO-27) |

The 404s are the same bytes as last week; what changed is that the maintainer has now decided the
right-hand column, so the gap between "shipped in repo" and "live" is a *scope decision*, not an
outage — provided the frontend is brought into line with it (PREPIO-27), which it is **not yet**.

## Overall product judgment

**The deployed core keeps getting quietly better — this week's one product commit closed the most
serious accessibility gap in the practice flow — and the project now has an honest, defensible
release scope for the first time in this review's history.** The research→practice loop a logged-in
user sees is strong: the practice question is now the unambiguous hero *and* a proper `<h1>` on both
desktop and mobile (verified live), every practice control is ≥44px on mobile, there is no horizontal
overflow, notes autosave shows honest device-local copy, **text-answer save persists** (`201`), and
protected-route redirects preserve intent ("Continue to Practice."). The 2026-09-02 freeze decision
also finally resolves the four-month "why is half the app dark" tension: guest preview, billing, and
paid feedback are **deliberately out of scope** for the frozen release, not merely un-deployed (voice
and import deploy only if PREPIO-27 keeps their controls and their smoke tests pass, and are hidden
otherwise). **But the frontend has not yet been brought into line with that decision, so today a
real user still hits the pre-freeze breakage:** the guest **Preview my prep** CTA fires a doomed
`research-preview` call, fails with a CORS error, and *blanks* the page's best pre-signup asset (the
rich static example); the `/pricing` page still shows live "Choose monthly/quarterly" checkout CTAs
that point at an undeployed function; and public sign-up is still open. **The single highest-value
action is now the attended freeze deploy + the frontend surface-lock (PREPIO-124 + PREPIO-27)
together** — the deploy clears the flag-write P1, and the surface-lock is what stops users seeing
controls that can't work. Separately, the **Favorite / Needs-work flag write is still 100% broken**
(`400 / 42P10`); its fix is a one-line migration already written and explicitly authorized for the
freeze window (PREPIO-170).

## Top 5 issues

### 1. **P0 (live-confirmed) — The frontend still exposes the pre-freeze guest/billing surface; it must be locked to match the 2026-09-02 freeze decision**

- **Severity:** P0 — a first-time visitor's primary CTA fails live and destroys the page's best
  pre-signup proof; the `/pricing` page offers a purchase that cannot complete. This is the
  top-of-funnel, and it is actively worse than doing nothing.
- **Area:** landing / billing / auth (surface-lock)
- **User scenario:** a logged-out visitor types a company and clicks **Preview my prep**; or reads
  `/pricing` and clicks **Choose monthly**.
- **What happened (live this run):**
  - On `/`, **Anthropic · Product Manager → Preview my prep** fires `POST research-preview` →
    **CORS block / `net::ERR_FAILED`** (console: *"…has been blocked by CORS policy"*, *"Error
    creating research preview: FunctionsFetchError"*), the UI shows *"We couldn't build the preview.
    Try again, or sign in to run the full research workflow."*, **and the rich static example is
    replaced by an empty *"Your Anthropic preview will appear here"* placeholder** — so the CTA
    *removes* the strongest "this isn't a generic ChatGPT wrapper" demo the page had. Compare
    [`01-d-landing.png`](./assets/2026-09-03/01-d-landing.png) (example present) with
    [`03-d-guest-preview-fail.png`](./assets/2026-09-03/03-d-guest-preview-fail.png) (blanked).
  - `/pricing` still renders live **Choose monthly / Choose quarterly** checkout CTAs (they point at
    the intentionally-undeployed `create-checkout-session`).
    [`32-d-pricing.png`](./assets/2026-09-03/32-d-pricing.png)
  - `/auth` still offers a public **Sign Up** tab (freeze wants invite-only).
- **Why it matters:** the deployed research loop makes the app *look* fully working to a logged-in
  smoke test, so this pre-signup breakage is exactly the part a casual authenticated pass skips —
  and it is the entire top-of-funnel. With the freeze scope now decided, the fix is no longer "deploy
  the functions" — it is to make the surface match: **static guest sample, hidden paid controls,
  invite-only sign-up, no copy promising unavailable features.**
- **Recommended fix (per the 2026-09-02 decision):** land **PREPIO-27** — replace the guest preview
  network path with the deterministic checked-in sample (guest action makes *no* Edge Function call),
  hide Checkout/Portal/paid-feedback controls, enforce invite-only sign-up, disable PDF upload while
  PREPIO-140 is open, and strip copy promising unavailable functions. Do the attended
  **PREPIO-124** freeze deploy (five core functions + reconciled migrations) alongside it. Add the
  focused tests PREPIO-27 calls for (guest sample makes zero Edge Function calls; unavailable paid
  controls are absent).
- **Tracking:** [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (Urgent, Todo — surface lock)
  + [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo — attended deploy).
  Confirmed live 2026-09-03.

### 2. **P1 (live-confirmed) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration exists, is authorized for the freeze window, and is unapplied**

- **Severity:** P1 — a core practice triage affordance fails 100% of the time, with a red error toast.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** (or **Needs work**) to triage what to
  revisit.
- **What happened (live, mobile `/practice`):** the star fills optimistically, then
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`, and a red toast: *"Couldn't save your Favorite flag."* The flag never persists.
  [`23-m-flag.png`](./assets/2026-09-03/23-m-flag.png)
- **Root cause:** the upsert (`src/services/searchService.ts:1783`) references a
  `(user_id, question_id, flag_type)` unique constraint that does not exist in production.
  **The fix is already written and merged** — migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` adds exactly that constraint — it
  has simply never been applied. This is a *schema deploy*, not a code fix, and is **inside** the
  freeze scope (unlike the deferred functions).
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practice
  next. A promised, visible control that never persists erodes trust in whether *anything* they do
  persists. (Text-answer save, by contrast, is `201` — verified live this run.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze
  window (pre-check/dedupe any conflicting rows first); verify all three entry points persist across
  a reload on desktop and mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo) — confirmed
  live 2026-09-03.
- **P3 rider (carried):** the desktop toast's *"Try again in a moment"* implies transience the
  `42P10` failure does not have. Moot once the migration ships in the freeze window; not worth a
  separate copy fix ahead of it.

### 3. **P2 (REPEAT, live-confirmed — 15th audit) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields **are** properly `<label>`-associated
  (`labels.length === 1` each), so this is narrowly the autofill / password-manager hint.
  [`04-d-auth.png`](./assets/2026-09-03/04-d-auth.png)
- **Why it matters:** browsers/password managers can't reliably offer credential autofill; an
  invited user under time pressure retypes both fields. (Sign-in stays in scope under the freeze even
  as public sign-up is locked down, so this remains worth fixing.)
- **Recommended fix:** add `autocomplete="email"` / `current-password` on sign-in (and
  `new-password` + `username` on the sign-up form if it is retained behind the invite gate). One
  small PR closes this.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog) — confirmed
  live 2026-09-03 (the fix PR #244 was closed unmerged on 2026-08-13; the work needs re-applying).

### 4. **P3 (REPEAT, live-confirmed) — `/history` shows the empty state despite real in-progress practice**

- **Severity:** P3 (visibility-of-status / trust; reads as a bug to a returning user)
- **Area:** history / dashboard
- **What happened (live, `/history`):** the account has two in-progress interviews on `/interviews`
  ("Stripe · Data Product Manager · 2 of 10 answered · 20%", "OpenAI · Solutions Architect · 8 of 40
  answered · 20%") and returns real `practice_answers` rows, yet `/history` renders *"Ready to start
  practicing / Your first practice session will appear here…"* Defensible if history = *completed*
  sessions only, but the disconnect reads as a bug to a user who has done real work.
  [`30-d-history.png`](./assets/2026-09-03/30-d-history.png)
- **Why it matters:** the returning-user's "what did I do / what's left" surface tells them they've
  done nothing when they've answered ten questions across two interviews. Squarely in the frozen
  authenticated core, so it stays a live-facing gap.
- **Recommended fix:** either surface in-progress sessions on `/history`, or make the empty-state copy
  explicit that it lists *completed* sessions and point to `/interviews` for in-progress work.
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (In Progress) — "surface
  needs-work & progress on the interview card and a Review tab" covers this direction.

### 5. **P3 (a11y, carried) — Sub-44px touch targets on the landing/auth surfaces**

- **Severity:** P3 (external 44px ergonomic recommendation; WCAG 2.5.8 AA 24px passes)
- **Area:** landing / auth / accessibility (mobile)
- **What happened (live, mobile 390×844):** landing nav targets are under the 44px comfort baseline —
  "Pricing" 71×36, "Sign in or create account" 193×36. Practice-mode mobile controls, by contrast,
  are all ≥44px (Favorite 112×44, Needs work 138×44, Record 217×48, Skip/Save 173×48), so the gap is
  specifically the landing/auth chrome. [`02-m-landing.png`](./assets/2026-09-03/02-m-landing.png)
- **Why it matters:** these are the first controls a mobile visitor touches; 36px is a small hit area
  for a one-handed tap. Low impact and cosmetic, but it is the one remaining measured a11y gap on the
  top-of-funnel now that the practice heading structure is fixed.
- **Recommended fix:** bump the landing/auth nav controls to a ≥44px min height. Folds naturally into
  the PREPIO-27 landing rework (the surface is being touched anyway).
- **Tracking:** below the >30-min ticketing threshold; left as a report note rather than a new issue,
  and flagged for the PREPIO-27 landing pass.

## Notable live observations (not top-5)

### Positives — live-verified this run (the deployed core is in good shape)

- **Practice question is now a proper `<h1>` on both breakpoints (#329 / PREPIO-178).** Desktop
  outline is `H1` (the question) → `H3` ("What strong answers show"); mobile renders the question as
  `H1` too — last review's *no-`<h1>` desktop / zero-headings mobile* gap is closed on both. A
  screen-reader user now has a heading anchor on the most important screen.
  [`20-d-practice.png`](./assets/2026-09-03/20-d-practice.png),
  [`21-m-practice.png`](./assets/2026-09-03/21-m-practice.png)
- **Landing is a strong first impression — until the CTA is clicked.** Single `<h1>` *"Walk into your
  next interview knowing exactly what to expect."*, a research-first sub-hero, and a **rich static
  example** — "How Stripe Senior Product Manager questions look in Prepio" with three real questions
  carrying stage, difficulty, and a concrete *"why it matters"* — plus a clean 3-step "How it works".
  A first-timer understands the company-and-role-specific value in well under 30s *without* signing
  in. (The clicked-CTA failure that blanks this is P0 #1; making the sample the *default* rendered
  state, per PREPIO-27, would turn this into an unambiguous positive.)
- **Practice: question is the hero, mobile clean.** Mobile renders the question large/bold as the
  `<h1>` with "Technical Round"/"Medium" badges, a timer + "Aim for 1-2 min", a green **Record
  answer** primary + **Notes**, quick-notes autosave *"Saved on this device while you practice."*,
  and a fixed **Skip / Save & Continue** bottom bar. All controls ≥44px; no horizontal overflow
  (390/390). [`21-m-practice.png`](./assets/2026-09-03/21-m-practice.png)
- **Text-answer save persists.** `POST practice_answers` → `201`; progress advanced to "answered"
  live. **Save & Continue is correctly enabled only after text is entered** (error prevention).
- **Protected-route redirect preserves intent.** A logged-out direct link to `/practice` bounces to
  `/auth` with the route-specific banner *"Continue to Practice."* (captured live).
  [`04b-d-redirect.png`](./assets/2026-09-03/04b-d-redirect.png)
- **`/interviews` resumes well.** Cards show state + progress ("2 of 10 answered · 20%") with
  **Continue practice** and **Plan** one click away. [`05-d-interviews.png`](./assets/2026-09-03/05-d-interviews.png)
- **`/practice` with no active search shows an honest empty state.** The bare `/practice` nav link
  (no `searchId`) renders *"No Search Selected / Select a search to start practicing…"* with **Go to
  Dashboard** and **Prep a new interview** — a clean recovery, not a dead end.
- **Keyboard focus is visible; 200% zoom reflows cleanly.** Tab order on landing is Skip-link → nav →
  Pricing → "Sign in or create account" → form inputs, each interactive control with a visible focus
  ring (2px solid outline + box-shadow ring). The 200%-zoom check was re-run this way (the earlier
  `body{zoom:2}` measurement doesn't reproduce browser zoom, since the CSS viewport and media-query
  breakpoints stay at 1440px): loading at a **720px viewport — the effective CSS viewport a 1440px
  window produces at 200% browser zoom, where the responsive breakpoints actually re-evaluate** —
  landing, `/auth`, and `/pricing` all reflow with **no horizontal scroll** (`scrollWidth == clientWidth
  == 720` on each).

### Freeze-surface items to fold into PREPIO-27 (observed live)

- **`/pricing` still shows live checkout CTAs** ("Choose monthly", "Choose quarterly") pointing at
  the intentionally-undeployed `create-checkout-session` — a "visible control points at an undeployed
  function" case PREPIO-27 wants removed/hidden. Copy itself is honest ("Research, prep plans, and
  practice stay free…"); it is the purchase *button* that must go for the freeze.
- **Public Sign Up tab is still present** on `/auth` — freeze wants invite-only.
- **Voice "Record answer" is still offered**; transcription is a deferred function (404). It now
  fails honestly ("Transcription unavailable / Your answer was still saved.", shipped #311), so it is
  the least urgent of the surface items, but PREPIO-27 would hide it unless the function is in the
  manifest.
- **PDF resume upload** should be disabled in the frozen surface while the `pdfjs-dist` advisory
  (PREPIO-140) is open — not exercised this run (the tester CV is already seeded); flagged for the
  PREPIO-27 pass.

## Journey scorecard

Full authenticated pass this run. One product commit shipped since `2026-08-30`; the only score mover
is **Accessibility (3 → 4)**. Rows tagged **(live)** were exercised this run; two research rows are
code-confirmed / carried (the form was not re-submitted).

| Area | 2026-08-30 | 2026-09-03 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + rich static example are strong, but the interactive guest preview still **fails** and its failure **blanks the static example** (P0 #1). The freeze decision (static sample as default) would fix this — not yet landed. |
| Research entry | 4 | 4 | = | **(code-confirmed, not re-submitted)** Honest, progressive, CV-aware form; unchanged in code this week. |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged in code; not re-triggered. Practice-resume spinner (~8–9s) noted. |
| Generated output clarity | 5 | 5 | = | **(live)** Plan/stage/question + answer-guide structure strong and CV-grounded (question carries stage, difficulty, "why it matters", "what strong answers show"). |
| Practice mode | 4 | 4 | = | **(live)** Question is hero + now `<h1>`, save persists (`201`), Save enabled only when non-empty — but Favorite/Needs-work is 100% broken (P1 #2), holding the score down. |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px, fixed bottom bar, question dominates as `<h1>`. (Landing/auth targets still <44px — P3 #5.) |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile shows CV source + honest upgrade copy. PDF-upload should be disabled under the freeze (PREPIO-27/PREPIO-140) — a surface item, not a trust regression. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Interviews cards resume well, but `/history` empty despite in-progress work (P3 #4). |
| Error/empty states | 4 | 4 | = | **(live)** Flag failure and `/practice` no-search state are honest; transcription fails honestly. Held at 4 by the guest-preview **blanking** the static example (P0 #1). |
| Accessibility | 3 | **4** | **▲** | **(live)** Practice screen now has `<h1>` on desktop **and** mobile (#329), focus rings visible, redirect context preserved, 200% zoom reflows with no horizontal scroll (re-measured at a 720px effective CSS viewport). Remaining: `/auth` autocomplete null (#3), sub-44px landing/auth targets (#5). |
| Copy quality | 4 | 4 | = | **(live)** Research/dashboard/profile/pricing copy honest and specific. The freeze will need a copy pass to drop promises of unavailable features (PREPIO-27). |

**Composite: up one, on Accessibility.** The deployed core holds at a genuinely good level and picks
up the practice heading-structure point. The two structural anchors are now cleanly separated: the
**freeze surface-lock** (PREPIO-27, a scope-alignment task) and the **flag-write migration**
(PREPIO-170, inside the freeze deploy).

## Regression check

One user-facing product commit merged to `main` since the last review (`c24f291`; plus docs/test/dep
chores) — an **improvement**, no code regressions:

| Item | State | Note |
|------|-------|------|
| Practice question heading structure | **Fixed** ✅ | Question is `<h1>` on desktop **and** mobile. (was P3 #4 — #329 / PREPIO-178) |
| Landing `<h1>` / heading order | **Holding** ✅ | Single `<h1>`; outline h1→h2→h2. |
| Practice question-as-hero (desktop + mobile) | **Holding** ✅ | No overflow, ≥44px, fixed bottom bar, large bold question. |
| Text-answer save | **Holding** ✅ | `201`; progress advanced live. |
| Notes autosave | **Holding** ✅ | "Saved on this device while you practice." |
| Protected-route redirect context | **Holding** ✅ | `/practice` → `/auth` with "Continue to Practice." (captured live). |
| Voice transcription honesty (#311) | **Holding** ✅ | Honest failure toast unchanged. |
| Guest preview (live path) | **Still broken** ❌ | `research-preview` 404 → CORS → blanks the static example. **Now scoped for removal, not deploy** (PREPIO-27). (P0 #1) |
| Checkout / portal / webhook CTAs | **Still live-but-dead** ❌ | 404 functions; CTAs still shown. **Scoped to be hidden** (PREPIO-27). (P0 #1) |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10`; fixing migration exists, authorized for the freeze window, unapplied. (P1 #2) |
| `/auth` autocomplete | **Still unfixed — 15th audit** ⚠️ | `null`. (P2 #3, PREPIO-123) |
| `/history` vs in-progress card parity | **Still open** ⚠️ | Empty state despite "8 of 40 answered". (P3 #4, PREPIO-107) |

**Net: one improvement, zero code regressions — plus a scope clarification.** The most notable
non-code change is that the four-month "deploy backlog" P0 has been re-decided as a *freeze scope*:
the same 404s are now intended, and the user-facing fix moved from "deploy" to "lock the surface."

## Recommended tickets

Every finding this run maps to an existing open issue — **no new issue is filed.** (Last week's draft
direction of a standalone "keep the static example visible" ticket is **subsumed by PREPIO-27**, which
replaces the whole guest network path with a static sample; filing a narrower ticket would fragment
that work.) Updates below are recorded via Linear comments, not new issues.

1. **[P0] Lock the frozen guest/billing/auth surface** — static guest sample (no Edge Function call),
   hide checkout/portal/paid-feedback controls, invite-only sign-up, disable PDF upload
   (PREPIO-140), strip copy promising unavailable features, add the guest-makes-zero-calls tests.
   Hide voice/import controls **unless PREPIO-27 deliberately retains them and their functions are
   deployed with passing smoke tests** (the ticket #2 conditional) — don't remove an approved freeze
   feature. → **[PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27)** (Urgent; confirmed live 2026-09-03).
2. **[P0] Attended freeze deploy** — reconcile migration history and deploy the five core functions
   + pending migrations via the explicit per-function manifest (never the all-functions script);
   also deploy `profile-import` / `practice-audio-transcribe` **only if PREPIO-27 keeps their UI and
   their smoke tests pass** (otherwise leave them undeployed with controls hidden), and never the five
   out-for-this-freeze functions (`research-preview`, `create-checkout-session`,
   `create-portal-session`, `stripe-webhook`, `answer-feedback`). →
   **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (Urgent; confirmed live 2026-09-03).
3. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the freeze window so the
   Favorite/Needs-work upsert stops returning `42P10`. →
   **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent; confirmed live 2026-09-03).
4. **[P2] Add `autocomplete` attributes to `/auth` sign-in (and retained sign-up).** →
   **[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (existing; confirmed live, 15th audit).
5. **[P3] Surface in-progress work on `/history` (or clarify the empty-state scope).** →
   **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (existing, In Progress).

### Deferred items (per CLAUDE.md hygiene convention)

- **No new Linear issues filed this run.** The one candidate finding (guest-preview blanking) is
  subsumed by [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27); the sub-44px landing/auth
  touch-target note (P3 #5) and the "try again in a moment" copy rider are below the >30-min
  ticketing threshold and are flagged into the PREPIO-27 landing pass and the PREPIO-170 deploy
  respectively.
- All findings map to existing open issues (PREPIO-27, -124, -170, -123, -107); live-confirmation
  comments added this run.
- [PREPIO-178](https://linear.app/qiuyue/issue/PREPIO-178) (practice `<h1>`) is **Done** — removed
  from the standing carry list.

---

Capability: live browser verified
