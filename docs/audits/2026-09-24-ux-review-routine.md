# Prepio UI/UX Review — 2026-09-24 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Baselines:
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md),
[`2026-09-03`](./2026-09-03-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review: the authenticated research→practice loop was exercised live
(login → resume a plan via a card's **Continue practice** → type + save a text answer → attempt both
Favorite and Needs-work flags). It was **not** an end-to-end fresh-research pass — no new research run
was submitted (that spends real OpenAI/Tavily budget on the tester account and takes minutes), so the
research **form** was inspected live but **Start Research** was not clicked. Backend state and the
flag-write failure below were probed live.

- **Playwright Chromium: PASS (direct this run).** The egress TLS filter that reset Chromium's
  ClientHello in prior runs did **not** bite this time — a plain
  `chromium.launch({ proxy: { server: HTTPS_PROXY }, args: ['--ignore-certificate-errors'] })` with
  the installed build (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, pinned via
  `executablePath` because the npm `playwright` wants build 1228) loaded the app cleanly. No MITM shim
  was needed. (If a future run gets `net::ERR_CONNECTION_RESET`, the 2026-09-03 shim note still
  applies.)
- **Frontend (Vercel): PASS** — `curl … /` → `200`; Chromium load → `200`, title
  `Prepio - Interview Prep Tool`.
- **Backend (Supabase): PASS** — login with the tester account succeeded (`POST auth/v1/token` →
  `200`, Enter-submit → redirect to `/interviews`). A **text-answer save persisted live**
  (`POST practice_answers` → `201`, session progress advanced Q1→Q2, "1 answered"). Both the
  **Favorite and Needs-work flag writes failed live** (`POST user_question_flags` → `400 / 42P10`).

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile 390×844), the new
**guest static sample** (desktop + mobile, **zero backend calls** confirmed), `/auth` (invite-only,
autocomplete probe), `/pricing` (now 404), `/interviews`, practice mode (desktop + mobile) —
**question-as-`<h1>` on both breakpoints** — text-answer save (`201`), **both flag writes
(`400/42P10`)**, notes autosave, `/history`, `/new-interview` research form (structure), protected-route
redirect, and a landing keyboard-focus pass. `/profile` was probed and now **404s** (route removed by
the freeze), so there was **no CV surface to screenshot** this run. Screenshots under
[`assets/2026-09-24/`](./assets/2026-09-24/).

## Freeze-scope compliance note (read before landing this doc)

**#354 (2026-09-22) added a new line to `CLAUDE.md` that did not exist at run #20:** *"Do not add
features, recurring audits or routine dependency PRs."* ([`CLAUDE.md:26`](../../CLAUDE.md), under
*Current Product Truth*). This run #21 is the first review executed under that line, so the tension is
real and is called out here rather than glossed:

- **This review ran per a standing weekly schedule that predates the freeze line.** It adds **no
  feature, no dependency PR, and no *new* recurring-audit type** — it is the pre-existing sanctioned UX
  routine ([`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md), 21 runs).
- **Its findings serve the freeze reconciliation rather than diverting from it.** The one P1 (flag write
  `400/42P10`) is exactly a named freeze gate — [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)
  under the PREPIO-124 reconciliation set in `CLAUDE.md:24`. The rest of the report is *evidence that the
  freeze surface-lock succeeded* (guest/billing/profile surfaces and the voice *control* removed,
  verified live — with one residual voice-hint gap called out as a new finding, not glossed).
- **The two *new* polish recommendations (Top issue #2 landing-sample-by-default, #5 desktop practice flag
  labels) are explicitly deferred to post-freeze.** Do **not** open work for them during the freeze;
  they are recorded for the PREPIO-27 landing pass only.
- **Landing this doc is the maintainer's call.** Per the freeze line, this PR is held as a **draft** and
  should not be merged during the freeze without an explicit decision. If the maintainer would rather
  not carry any recurring-audit doc during the freeze, the review stands on its own in the PR and the
  file can be dropped — no reconciliation work depends on it.

## The headline: the freeze surface-lock (#354) landed — last review's P0 is resolved

Since 2026-09-03 the first-parent window is **16 commits** (see *Regression check* for the full
enumeration and filtering). Three touch the rendered app materially: **#354 "lock Prepio to the
invite-only frozen core"** (the PREPIO-27 surface-lock), **#350** (pdfjs-dist 5→6, clearing the
PREPIO-140 advisory), and **#353** (react-router 6→7); a fourth, **#338**, hides the practice coach
panel when a question has no guidance. #354 is the story: it rewrote the guest, auth, billing, profile,
and practice surfaces to match the 2026-09-02 freeze decision. Its surface changes are **six removals**:
**four clean** (guest preview, `/pricing`, sign-up, `/profile`) — each an improvement; **voice**, whose
control was removed but **left a residual coach hint still pointing at recording** (P2 #6); and the
**paid AI-feedback surface** — #354 gates off the "AI feedback" tab and cached-feedback loading
(`SessionSummary.tsx:274`, `SessionList.tsx:185,346`), an *intentional* freeze-scope decision but an
**observable loss** for any existing paid user (including access to previously-generated feedback), not
an improvement per se. It also carries **one first-impression cost** — the landing's rich example is now
collapsed behind a click (P2 #2). So #354 is a strong **net** improvement, with these loose ends
recorded rather than glossed.
Verified live this run:

| Pre-freeze breakage (2026-09-03 P0/observations) | State on 2026-09-24 |
|---|---|
| Guest **Preview my prep** fires a doomed `research-preview` call → CORS error → **blanks the static example** | **Fixed** — landing now offers **View sample plan**, a checked-in static sample that expands inline and makes **zero backend calls** (verified). |
| `/pricing` shows live **Choose monthly/quarterly** checkout CTAs at an undeployed function | **Fixed** — `/pricing` route removed (renders the app 404). No purchase control anywhere. |
| Public **Sign Up** tab on `/auth` | **Fixed** — `/auth` is sign-in only, with honest invite-only copy ("Sign in with your invited account. Ask the person who invited you if you need access."). |
| `/profile` CV management + PDF upload surface (PII + `pdfjs` advisory risk) | **Fixed** — `/profile` route removed (404); CV is now **paste-only** on `/new-interview`, **no file-upload control** anywhere. |
| Voice **Record answer** control pointing at an undeployed transcription function | **Mostly fixed ⚠️** — the Record *control/button* is gone, but the practice coach hint still reads **"Record for a full answer"** with a mic icon (`src/components/practice/HintBanner.tsx:11-14`, rendered at `Practice.tsx:3113`) while `FROZEN_PRODUCT.voice === false` — a **residual pointer to a removed capability**. See new finding below. |

The frontend now genuinely matches the frozen-core scope. The top-of-funnel no longer shows a control
that can't work.

## Overall product judgment

**The freeze surface-lock is a real, verifiable step up in honesty: almost nothing a first-time visitor
or a logged-in user touches now points at an undeployed function, and last review's top-of-funnel P0 is
gone.** (The one residual exception found this run: the practice coach hint still says "Record for a
full answer" though voice is removed — new P2 #6 below.) The authenticated core a user actually works in
stays strong — the practice question is the
unambiguous hero and a proper `<h1>` on desktop and mobile, text-answer save persists (`201`), notes
autosave shows honest device-local copy, mobile practice has no overflow with every control ≥44px, and
protected-route redirects preserve intent. **Two things temper the win.** First, the single most
prominent functional defect in the frozen core is still live: **Favorite and Needs-work flag writes
fail 100% of the time** (`400 / 42P10`) with a red error toast — the fixing migration is written and
authorized for the freeze window but remains unapplied in production (PREPIO-170). Second, the freeze
traded away the pre-freeze landing's biggest asset: the always-visible rich example that showed real
company-specific questions is gone, replaced by a sparse card whose sample is **one click away** and
uses a **fictional "Payments company"** — honest, but a weaker first-impression proof of "this isn't a
generic ChatGPT wrapper," and a guest can no longer run their own research at all (invite-only). **The
single highest-value action is to apply the flag-write migration in the PREPIO-124 deploy window;** the
next is a light landing pass to make the sample the default rendered state so value is visible without a
click.

## Top issues (6)

### 1. **P1 (live-confirmed) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration exists, is authorized for the freeze, and is unapplied**

- **Severity:** P1 — a core practice triage affordance fails 100% of the time, with a red error toast.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** or **Needs work** to mark what to revisit.
- **What happened (live, desktop `/practice`):** the control reacts optimistically, then
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}` — for **both** the Favorite and the Needs-work write — and a red toast:
  *"Couldn't save your Needs work flag. Try again in a moment."* The flag never persists.
  [`22-d-practice-answering.png`](./assets/2026-09-24/22-d-practice-answering.png)
- **Root cause:** the upsert (`src/services/searchService.ts`) targets a
  `(user_id, question_id, flag_type)` unique constraint that does not exist in production. **The fix is
  already merged** — migration `supabase/migrations/20260710203000_question_flags_per_type.sql` adds
  exactly that constraint — it has simply never been applied. This is a *schema deploy*, inside the
  freeze scope (unlike the deferred functions), not a code fix.
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practice
  next. A promised, visible control that never persists erodes trust in whether *anything* they do
  persists. (Text-answer save, by contrast, is `201` — verified live this run.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze
  window (pre-check/dedupe any conflicting rows first); verify all three entry points persist across a
  reload on desktop and mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo) — confirmed
  live 2026-09-24.
- **P3 rider (carried):** the toast's *"Try again in a moment"* implies transience the deterministic
  `42P10` failure does not have — retrying will never succeed. Moot once the migration ships; not worth
  a separate copy fix ahead of it.

### 2. **P2 (product, new framing) — The freeze landing hides its only proof-of-value behind a click and uses a fictional company**

- **Severity:** P2 — weakens first-time understanding and conversion at the very top of the funnel.
- **Area:** landing
- **User scenario:** a first-time (invited) visitor opens `/` to decide whether Prepio is worth signing
  in for.
- **What happened (live, desktop + mobile `/`):** the page is a single card — "Free · Invite-only", an
  `<h1>` *"Prepare for your next interview"*, a plain description, and *"Explore a fixed example below.
  Invited users can sign in to research their own interview."* with a **View sample plan** button.
  Nothing about the product's output is visible until the button is clicked; the sample then expands to
  a clean, honest three-stage plan — but titled **"Payments company · Product Manager"** (a fictional
  employer), so it demonstrates the *format* but not the *named-company tailoring* that is the whole
  wedge. The pre-freeze landing showed real company-specific questions with "why it matters" **without a
  click**. [`01-d-landing.png`](./assets/2026-09-24/01-d-landing.png),
  [`03-d-guest-sample.png`](./assets/2026-09-24/03-d-guest-sample.png)
- **Why it matters:** the product's differentiation ("depth, company-and-role-specific, not generic AI")
  now costs a click to see and is shown against a made-up company. A visitor who doesn't click leaves
  with only category-level copy. The static sample is genuinely good; it's just not doing its job while
  collapsed. (This is a *first-impression* cost of the freeze, not a bug — the sample and its
  disclaimers are excellent.)
- **Recommended fix:** render the sample plan **open by default** (value-first), and add one line naming
  it as an illustrative *format* example so the fictional company reads as deliberate. Small, in-scope
  landing polish — no new feature.
- **Tracking:** candidate ticket (see Recommended tickets #2) — fits the PREPIO-27 landing surface.

### 3. **P2 (REPEAT, live-confirmed — 16th audit) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields **are** properly `<label>`-associated
  (`labels.length === 1` each), so this is narrowly the autofill / password-manager hint.
  [`04-d-auth.png`](./assets/2026-09-24/04-d-auth.png)
- **Why it matters:** browsers / password managers can't reliably offer credential autofill; an invited
  user under time pressure retypes both fields. Sign-in stays fully in scope under the freeze, so this
  remains worth fixing.
- **Recommended fix:** add `autocomplete="email"` and `autocomplete="current-password"` on the sign-in
  fields. One small PR.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog) — confirmed live
  2026-09-24 (the fix PR #244 was closed unmerged on 2026-08-13; the work needs re-applying).

### 4. **P3 (REPEAT, live-confirmed) — `/history` shows the empty state despite real in-progress practice**

- **Severity:** P3 (visibility-of-status / trust; reads as a bug to a returning user)
- **Area:** history / dashboard
- **What happened (live, `/history`):** the account has two in-progress interviews on `/interviews`
  ("Stripe · Data Product Manager · 4 of 10 answered · 40%", "OpenAI · Solutions Architect · 8 of 40
  answered · 20%") and a text answer was just saved (`201`) this run, yet `/history` renders *"Ready to
  start practicing / Your first practice session will appear here…"* Defensible if history = *completed*
  sessions only, but "your first practice session" reads as "you've never practiced" to a user who has
  answered a dozen questions. [`30-d-history.png`](./assets/2026-09-24/30-d-history.png)
- **Why it matters:** the returning-user's "what did I do / what's left" surface tells them they've done
  nothing. Squarely in the frozen authenticated core.
- **Recommended fix:** either surface in-progress sessions on `/history`, or change the empty-state copy
  to say it lists *completed* sessions and point to `/interviews` for in-progress work.
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (In Progress) — "surface
  needs-work & progress on the interview card and a Review tab" covers this direction.

### 5. **P3 (a11y / consistency, new) — Desktop practice uses icon-only Favorite / Needs-work while mobile labels them**

- **Severity:** P3 (recognition-over-recall; not a failure)
- **Area:** practice / accessibility
- **What happened (live):** on **desktop** `/practice` the Favorite/Needs-work controls are **icon-only**
  (☆ and ⓘ) below the question, while **mobile** shows the same actions as **labeled** buttons
  ("Favorite", "Needs work"). Both carry correct `aria-label`s (so screen readers are fine), but the
  desktop icons are less discoverable than the mobile labels — a sighted desktop user may not know what
  ☆/ⓘ do. [`20-d-practice.png`](./assets/2026-09-24/20-d-practice.png) vs
  [`21-m-practice.png`](./assets/2026-09-24/21-m-practice.png)
- **Why it matters:** low impact, but the desktop/mobile label inconsistency is a small recognition gap
  on the most-used screen.
- **Recommended fix:** add visible text labels (or tooltips) to the desktop Favorite/Needs-work icons
  (mobile already labels them). Folds into the existing practice surface.
- **Tracking:** below the >30-min ticketing threshold; flagged as a report note.
- **Retraction (this run):** an earlier draft also claimed the rewritten landing's focus ring was
  *weakened* to a native `outline: auto 1px`. **Retracted — unsupported.** The landing controls use the
  shared `Button` (`src/components/ui/button.tsx` `buttonVariants`), whose
  `focus-visible:ring-2 ring-ring ring-offset-2` is unchanged by #354, as are the skip link and the
  `PublicHeader` logo; the earlier reading measured a programmatically-tab-focused element (the skip
  link on a wrapped tab loop), not a button's `:focus-visible` state, so it does not establish a
  regression. No focus-ring change is claimed.

### 6. **P2 (freeze-surface gap, new — corrects a "Fixed" claim) — The practice coach hint still says "Record for a full answer" though voice is removed**

- **Severity:** P2 (honesty / freeze-surface consistency; impact modest — a dismissible hint, no broken
  button — but it directly contradicts the freeze's "no pointer to a removed/undeployed function" goal
  and an earlier "voice fully removed" claim).
- **Area:** practice / copy
- **User scenario:** a user opens a practice session and reads the one-time coach hint above the answer
  area.
- **What happened (live, desktop `/practice`):** the hint banner's **first item reads "Record for a full
  answer" with a microphone icon**, even though #354 removed every recording control and
  `FROZEN_PRODUCT.voice === false` — so there is **no record button to act on**. Visible in this run's own
  capture [`20-d-practice.png`](./assets/2026-09-24/20-d-practice.png). Source:
  `src/components/practice/HintBanner.tsx:11-14` (unconditional), rendered at `src/pages/Practice.tsx:3113`.
- **Why it matters:** the freeze surface-lock's stated promise is that the UI no longer points users at
  unavailable functions; this residual copy does exactly that, and a user who reads it will look for a
  record control that isn't there. It also means the "voice → removed" row is **only mostly true** — the
  *control* is gone, the *guidance* is not.
- **Recommended fix:** in `HintBanner.tsx`, drop the mic/"Record for a full answer" item (or gate it on
  `FROZEN_PRODUCT.voice`) so the hint matches the shipped controls — a small change that **completes the
  PREPIO-27 surface-lock**, so it is freeze-scope (finishing the lock), not new feature work.
- **Tracking:** new; fits **[PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27)** (surface-lock
  completion). Confirmed live 2026-09-24.

## Notable live observations (not top-5)

### Positives — live-verified this run

- **Guest sample is honest and makes zero backend calls.** *"Illustrative sample … A fictional example
  of a prep plan. These are practice prompts, not verified questions from a particular employer. No live
  research runs when you open this sample."* Three stages (Hiring manager / Product discussion / Team
  collaboration), each a question + guidance, then *"Sign in to prepare your interview."* Exactly the
  PREPIO-27 intent. [`03-d-guest-sample.png`](./assets/2026-09-24/03-d-guest-sample.png)
- **Practice question is a proper `<h1>` on both breakpoints, and personalization is visible.** Desktop
  question *"In your view, what emerging technology could strongly impact Stripe's product line?"* is the
  `<h1>` and is Stripe-specific; mobile *"Tell us about a time you failed as a leader…"* is the `<h1>`
  too. [`20-d-practice.png`](./assets/2026-09-24/20-d-practice.png),
  [`21-m-practice.png`](./assets/2026-09-24/21-m-practice.png)
- **Text-answer save persists.** `POST practice_answers` → `201`; progress advanced Q1→Q2, "1 answered".
  **Save & Continue is disabled until text is entered** (error prevention).
- **Mobile practice is clean.** No horizontal overflow (390/390); Favorite 112×44, Needs work 138×44,
  Skip/Save 173×48; question-nav dots carry `min-h/w-[44px]` with per-question titles ("Technical Round
  1" …); fixed bottom Skip / Save & Continue bar; quick-notes autosave *"Saved on this device while you
  practice."* [`21-m-practice.png`](./assets/2026-09-24/21-m-practice.png)
- **Protected-route redirect preserves intent.** Logged-out `/practice` → `/auth` with a *"Continue to
  Practice."* banner and honest invite-only copy.
  [`04b-d-redirect.png`](./assets/2026-09-24/04b-d-redirect.png)
- **`/interviews` resumes well.** Cards show state + progress ("4 of 10 answered · 40%") with **Continue
  practice** and **Plan** one click away, plus a prominent **Prep a new interview** CTA.
  [`05-d-interviews.png`](./assets/2026-09-24/05-d-interviews.png)
- **Research form is honest and progressive.** `/new-interview`: Company\* + optional Role, with
  collapsed *"Add your CV — Optional. Personalizes questions to your background. Improves relevance"*
  (paste-only, **no file upload**), *"Role details & job description"*, and *"Notes for the research"*,
  then **Start Research**. Value-framed and skippable per the user-effort-budget rule.

### Minor / to-watch

- **CV paste box has value copy but no explicit privacy line.** The collapsed CV section explains the
  *benefit* ("Personalizes questions to your background") but doesn't state *how the data is used*
  (e.g. "Your CV is used only to personalize this prep plan"). Lower risk now that upload is gone and
  the box is paste-only + optional, but a one-line trust statement near a sensitive-data field is cheap.
- **One spurious aborted `practice_sessions` fetch on `/interviews` load** (`requestfailed`, then `200`
  on the immediate retry) — a benign aborted in-flight request during mount, self-heals; the page
  renders correctly. Noted, not a finding.
- **Desktop has large empty space below the card on `/` and `/interviews`.** The freeze simplification
  leaves a lot of blank canvas on wide screens; cosmetic, folds into any landing pass.

## Journey scorecard

Full authenticated pass. The freeze lock (#354) resolved last review's top-of-funnel P0 but also
thinned the first impression, so most rows hold; the composite is roughly flat with the *nature* of the
risk shifted from "dead surfaces" to "one broken write + a thinner landing". Rows tagged **(live)** were
exercised this run.

| Area | 2026-09-03 | 2026-09-24 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Doomed guest CTA is gone (win), but the rich always-visible example is gone too and the sample is behind a click against a fictional company (P2 #2). Honesty up, proof-of-value down — a wash. |
| Research entry | 4 | 4 | = | **(live)** Company\* + optional Role + collapsed CV(paste)/role/notes; honest, progressive, skippable. Upload removed (freeze). |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged; not re-triggered. Practice-resume spinner ("Loading Practice Session") noted. |
| Generated output clarity | 5 | 5 | = | **(live)** Stage/question + badges (round, difficulty, ROLE SPECIFIC) + guidance; Stripe-grounded. |
| Practice mode | 4 | 4 | = | **(live)** Question is hero + `<h1>`, save persists (`201`), Save gated on non-empty — but Favorite/Needs-work 100% broken (P1 #1) holds it down. |
| Mobile usability | 4 | 4 | = | **(live)** No overflow, ≥44px, fixed bottom bar, question dominates as `<h1>`, honest device-local autosave. |
| Resume/profile trust | 4 | 4 | = | **(live)** `/profile` route removed by the freeze; CV is paste-only + optional with honest value copy (missing a privacy line — minor). Surface shrank, what remains is honest. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** `/interviews` resumes well, but `/history` empty despite in-progress work (P3 #4). |
| Error/empty states | 4 | 4 | = | **(live)** Guest sample, redirect, `/practice` no-search, and invite-only auth all honest; the static-example blanking is gone. Held at 4 by the flag toast's misleading "try again". |
| Accessibility | 4 | 4 | = | **(live)** Practice `<h1>` on both breakpoints, good `aria-label`s, ≥44px practice controls, logical tab order, visible focus ring (shared `Button` `ring-2`, unchanged by #354). Remaining: `/auth` autocomplete null (#3), desktop icon-only practice flags (#5). |
| Copy quality | 4 | 4 | = | **(live)** Invite-only, sample disclaimer, and CV framing are excellent; held by the "try again in a moment" flag toast, the "explore example below" (collapsed) line, and the stale "Record for a full answer" coach hint that points at removed voice (P2 #6). |

**Composite: flat, with the risk profile improved.** The four-month top-of-funnel P0 is closed by the
freeze lock; the dominant remaining defect is the single flag-write migration (PREPIO-170).

## Regression check

**Full change window since run #20:** `git log --first-parent 132816b..9d9b711` is **16 commits**, not
the three user-facing ones the earlier draft named. Enumerated and filtered by **observable-behavior
impact** — a change is *user-facing* if it can alter behavior or output a user observes, whether in the
**rendered UI/client** *or* in **server-side generated content or access** (so the ownership guard and
the evidence-ledger change below count as user-facing even though they touch no rendered code). Only the
last bucket — CI, infra scripts, log-redaction, tests, and docs — has **no observable-behavior surface**
and so cannot produce a UX regression:

- **User-facing, rendered/client (assessed live this run):** #354 freeze surface-lock (the headline
  above); #338
  ([PREPIO-176](https://linear.app/qiuyue/issue/PREPIO-176)) *hide the practice coach panel when a
  question has no guidance* — an **improvement** (the "Practice tools / Show helpers" panel renders only
  when guidance exists; seen live with guidance present, no empty panel); #336
  ([PREPIO-175](https://linear.app/qiuyue/issue/PREPIO-175)) *remove forbidden rounded-3xl tokens from
  the route skeleton* — cosmetic token compliance on the loading skeleton, no behavior change; #350
  pdfjs 5→6 and #353 react-router 6→7 — client dependency bumps (routing verified live: protected-route
  redirect, `/pricing` and `/profile` 404s, practice deep-link all work).
- **Behavior-changing backend on the research-synthesis journey — NOT exercised this run (static read
  only, carried as unverified):** **#337** (interview-research search-ownership authorization guard —
  new `authorization.ts` wired into `interview-research/index.ts`; gates who can access a search) and
  **#340** (`evidence-ledger.ts` re-classifies retrieved job rows by *origin* — the ledger feeds the
  prep-plan synthesis prompt, so it can change the plan, questions, and citations a user receives).
  **No fresh research run was submitted this week** (§Capability check), so neither the synthesis output
  nor the write-side of the ownership gate was exercised end-to-end. Static read: #337 is an
  authorization tightening (risk direction: over-restriction) and the *read* side is indirectly
  fine — resuming and practicing my **own** searches worked live (`searches` GET `200`, practice loaded).
  **#340 is not merely unverified — it carries a *statically-established* narrow trust regression** the
  repo's own [2026-09-12 hygiene review](./2026-09-12-recurring-hygiene.md) records: #340's NFKD /
  combining-mark folding on `companyWords` makes a diacritic brand name (`"L'Oréal"` → `oreal`) produce
  a token that the loose `.includes()` host match in `evidence-ledger.ts:175-177` still grants
  `official_company` / high trust to, so **`oreal.attacker.example` is now over-trusted where it was not
  before #340** — net security-*positive* on the `official_job` branch #340 targeted, but
  security-*negative* on the untouched `official_company` branch for accented names. Its effect on the
  cited evidence and generated plan for such an input still needs a fresh run to confirm live, so the
  *plan* effect is carried as unverified while the trust regression itself is **established**. A
  fresh-research pass is owed to close both.
- **Dependency change with two observable surfaces (assessed, not pixel-verified):** **#343** is
  lockfile-only but is *not* inert-by-category — it touches two behavior-capable surfaces:
  1. **DOCX parsing** — `@xmldom/xmldom` **0.8.13 → 0.8.15** (runtime transitive of `mammoth`, the DOCX
     résumé parser). This surface is **unreachable in the frozen product**: #354 removed every
     file-upload control (CV is paste-only — verified live, `/new-interview` has zero file inputs,
     `/profile` 404s), so it has no observable effect here. Re-assess against 0.8.15 if uploads return.
  2. **Generated CSS** — the bump also refreshes the **browserslist / caniuse-lite** data chain
     (`browserslist` 4.28.2 → 4.28.9, `caniuse-lite`, `baseline-browser-mapping`), which feeds
     **Autoprefixer's** prefix set. The checked-in [2026-09-09 hygiene review](./2026-09-09-recurring-hygiene.md)
     records the resulting **+1.44 KiB** production-bundle change as *expected* autoprefixer output. This
     **does** touch the rendered app, so #343 is not fully inert. I rendered landing, `/auth`,
     `/interviews`, and practice live this run with **no visual breakage observed**, but did **not**
     pixel-diff against the pre-#343 build — so the CSS-output effect is **carried as low-risk /
     not pixel-verified**, not asserted as zero.
- **Not on any user-observable path (infra/CI/tests/docs, no UX-regression surface):** #351 (Edge
  Function typecheck ratchet), #335 / #344 (log redaction), #348 (Playwright smoke as a blocking CI
  gate), #332 (deno-baseline script), #345 (test coverage), #346 / #342 (prior audit docs + PII
  redaction of historical screenshots).

Net across the window, **scoped to the rendered/client paths actually exercised this run** (landing,
guest sample, auth, interviews, practice save + flags, history, redirect, research *form*): **one large
improvement (#354) + one practice improvement (#338), zero functional regressions on those paths;** one
minor intentional first-impression cost (collapsed sample) plus the residual voice hint (P2 #6) from the
#354 rewrite. **Off those exercised paths the window is not regression-free:** #354 also removed the paid
AI-feedback surface (intentional, but a loss for existing paid users), and **#340 carries a
statically-established `official_company` trust regression** (accented-name host over-trust, per the
2026-09-12 audit) — so #340 is not merely "unverified"; its *plan* effect needs a fresh run, its trust
regression is already established. #337's read side is fine live; its write side is unverified.

| Item | State | Note |
|------|-------|------|
| Guest preview (doomed `research-preview` call) | **Fixed** ✅ | Replaced by a static **View sample plan**; zero backend calls (verified). (was P0 — #354 / PREPIO-27) |
| `/pricing` dead checkout CTAs | **Fixed** ✅ | Route removed (renders app 404). |
| Public Sign Up on `/auth` | **Fixed** ✅ | Invite-only sign-in with honest "ask the person who invited you" copy. |
| `/profile` CV/upload PII surface | **Fixed** ✅ | Route removed (404); CV paste-only on `/new-interview`, no file upload. |
| Voice **Record answer** (undeployed transcription) | **Mostly fixed** ⚠️ | Control removed, but the practice coach hint still says "Record for a full answer" (`HintBanner.tsx`), voice off — a residual pointer (P2, new finding). |
| Practice coach panel on guidance-less questions (#338) | **Improved** ✅ | Panel now renders only when guidance exists (PREPIO-176); no empty helper panel. |
| Route loading skeleton tokens (#336) | **Holding** ✅ | `rounded-3xl` removed for token compliance (PREPIO-175); cosmetic, no behavior change. |
| Client deps (react-router 6→7 #353, pdfjs 5→6 #350) | **Holding** ✅ | Routing verified live (redirects + 404 routes + deep-link); pdfjs upgrade also clears PREPIO-140. |
| Paid AI-feedback surface (#354) | **Removed — intentional, but a loss** ⚠️ | #354 gates off the "AI feedback" tab + cached-feedback loading (`SessionSummary.tsx:274`, `SessionList.tsx:185,346`); freeze-scope decision, but existing paid users lose access to previously-generated feedback (Codex PR review). |
| #340 evidence-ledger trust classification | **Narrow regression** ⚠️ | NFKD folding makes `"L'Oréal"`→`oreal`, and the loose `.includes()` host match (`evidence-ledger.ts:175-177`) over-trusts `oreal.attacker.example` as `official_company`; statically established in the [2026-09-12 audit](./2026-09-12-recurring-hygiene.md). Net security-positive on `official_job`, negative on `official_company` for accented names. |
| Practice question `<h1>` (desktop + mobile) | **Holding** ✅ | Question is the `<h1>` on both. |
| Text-answer save | **Holding** ✅ | `201`; progress advanced live. |
| Protected-route redirect context | **Holding** ✅ | `/practice` → `/auth` "Continue to Practice." (captured live). |
| Landing rich always-visible example | **Reduced** ⚠️ | Intentional freeze simplification; sample now behind a click, fictional company (P2 #2). First-impression cost. |
| Landing focus ring | **No change** ✅ | Shared `Button` `focus-visible:ring-2 ring-offset-2` unchanged by #354; an earlier "weaker ring" note is **retracted** (unreliable measurement — see P3 #5). |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10` on both; fixing migration exists, authorized for the freeze, unapplied. (P1 #1, PREPIO-170) |
| `/auth` autocomplete | **Still unfixed — 16th audit** ⚠️ | `null`. (P2 #3, PREPIO-123) |
| `/history` vs in-progress parity | **Still open** ⚠️ | Empty state despite "8 of 40 answered". (P3 #4, PREPIO-107) |

**Net: four pre-freeze breakages fully fixed (guest preview, `/pricing`, public sign-up, `/profile`);
the fifth (voice) is *mostly* fixed — the control is gone but a residual coach hint still points at it
(P2 #6). Zero functional regressions on the rendered/client paths exercised this run, and one minor
intentional first-impression cost (the collapsed sample). But the window is *not* regression-free
overall: #354 also removed the **paid AI-feedback surface** (intentional freeze scope, but a loss of
access to previously-generated feedback for existing paid users), and **#340 introduced a narrow,
statically-established `official_company` trust regression** (accented-name host over-trust, per the
2026-09-12 audit). The synthesis-path commits (#337 read-side ok; #340 plan effect) still need a fresh
research run to confirm live — the #340 trust regression itself is already established.**

## Recommended tickets

> Linear was **not reachable this session** (the MCP connector is unauthenticated in a non-interactive
> run), so no Linear issues were created or commented. A maintainer with Linear access should record the
> live-confirmations and file the unfiled items. Each entry is tagged **[existing]** (maps to an open
> issue — confirm/comment) or **[unfiled]** (a new proposal with no issue yet — needs filing). Existing:
> #1 (PREPIO-170), #3 (PREPIO-123), #4 (PREPIO-107), #6 (fits PREPIO-27). Unfiled/new: #2 and #5 (small,
> post-freeze), and **#7 — the #340 `official_company` trust regression, which has no dedicated issue
> yet** (the 2026-09-12 hygiene review flagged it as a Medium to file under the PREPIO-144 theme).

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the freeze deploy window so the
   Favorite/Needs-work upsert stops returning `42P10`; dedupe any conflicting rows first; verify persist
   across reload on desktop + mobile. → **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)**
   (Urgent; confirmed live 2026-09-24). *Drives the PREPIO-124 attended deploy.* **[existing]**
2. **[P2 · post-freeze] Show the guest sample plan by default on the landing page.** Render the static
   sample expanded (value-first) instead of behind **View sample plan**, and add one line naming it an
   illustrative *format* example so the fictional "Payments company" reads as deliberate. Small landing
   polish — fits the PREPIO-27 landing surface. **Deferred: do not start during the freeze** (per
   `CLAUDE.md:26`); recorded for the post-freeze landing pass. *(New; drafted.)* **[unfiled]**
3. **[P2] Add `autocomplete` attributes to `/auth` sign-in** (`email` / `current-password`). One small
   PR. → **[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (existing; confirmed live, 16th
   audit). **[existing]**
4. **[P3] Surface in-progress work on `/history` (or clarify the empty-state scope)** so a returning
   user who has answered questions isn't told "your first practice session will appear here." →
   **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (existing, In Progress). **[existing]**
5. **[P3 · post-freeze] Label the desktop practice Favorite/Needs-work icons.** Add text/tooltip to the
   desktop ☆/ⓘ controls (mobile already labels them). **Deferred: do not start during the freeze** (per
   `CLAUDE.md:26`); below the >30-min threshold — fold into the next post-freeze practice touch.
   *(New; drafted.)* **[unfiled]**
6. **[P2] Remove the stale "Record for a full answer" voice hint from the practice coach banner.** In
   `src/components/practice/HintBanner.tsx:11-14`, drop the mic/"Record for a full answer" item (or gate
   it on `FROZEN_PRODUCT.voice`) so the hint matches the shipped controls. **This completes the
   PREPIO-27 surface-lock** (removing a residual pointer to a removed capability), so it is freeze-scope
   — not deferred new work. → fits **[PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27)**.
   **[existing]** *(New finding; confirmed live.)*
7. **[P2 · security · unfiled] File the #340 `official_company` trust regression.** #340's NFKD folding
   lets an accented brand name (`"L'Oréal"`→`oreal`) over-trust `oreal.attacker.example` via the loose
   `.includes()` host match (`evidence-ledger.ts:175-177`). The [2026-09-12 hygiene review](./2026-09-12-recurring-hygiene.md)
   flagged this as a **Medium** under the **PREPIO-144** origin-classification theme but **no dedicated
   issue exists yet** — file one (fix: PSL-aware / registrable-label match instead of substring). Not
   exercised live this run; the trust regression is static-established, the plan effect is unverified.
   **[unfiled]**

### Deferred items (per CLAUDE.md hygiene convention)

- **No Linear issues filed this run** (Linear unauthenticated; see note above). **Mapped to existing
  issues (confirm/comment):** #1 → PREPIO-170, #3 → PREPIO-123, #4 → PREPIO-107, #6 → PREPIO-27.
  **Unfiled — a maintainer must file:** #7 (the #340 trust regression, Medium, PREPIO-144 theme) is the
  one actionable item with no issue yet and should be filed; #2 (sample-by-default) and #5 (desktop flag
  labels) are new but small and deferred post-freeze (#5 below the >30-min threshold as a report note;
  #2 drafted into the PREPIO-27 landing pass rather than a fragmenting standalone issue).
- The CV-paste privacy-line note and the "try again in a moment" toast copy are sub-threshold riders,
  flagged into the PREPIO-27 landing pass and the PREPIO-170 deploy respectively.

---

Capability: live browser verified
