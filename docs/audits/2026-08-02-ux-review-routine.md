# Prepio UI/UX Review — 2026-08-02 (recurring routine, run #12)

Twelfth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-19`](./2026-07-19-ux-review-routine.md),
[`2026-07-23`](./2026-07-23-ux-review-routine.md),
[`2026-07-26`](./2026-07-26-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` still required; standing run-#8 gotcha).
- **Live-app reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the standing workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server` from `HTTPS_PROXY`).

Coverage this run: logged-out landing + guest-preview POST (desktop
1440×900); `/pricing` + *Choose monthly* click, `/auth`, `/dashboard`
logged-out redirect (desktop); logged-in `/interviews`, `/history`,
`/new-interview` (desktop); full mobile practice flow through Q1 — Quick
start → **breathing interstitial** → Q1, with a live flag-toggle network
probe, a real answer save, and a touch-target sweep (mobile 390×844).
Backend state re-verified directly against the production Supabase project
(`vjwrirrqprjzdorignlz`) via `list_migrations` / `list_edge_functions`.
Screenshots under [`assets/2026-08-02/`](./assets/2026-08-02/).

## Overall product judgment

**The production backend is still frozen at 2026-05-15 — nothing shipped
since run #11, so every P0/P1 from last week reproduces, several now at
their sixth consecutive week.** `list_migrations` still ends at
`20260515171733` and only the 5 original research edge functions are
deployed (byte-identical to run #11): guest "Preview my prep" is dead for
the **sixth** straight week (`research-preview` CORS/404), the practice
Favorite/Needs-work flags still `400 / 42P10` on every click (migration
`20260710203000` unapplied), and paid checkout would still fail after
sign-in (`create-checkout-session`/`stripe-webhook` undeployed). The one
piece of forward motion is in *code, not production*: the **PREPIO-111 fix
that replaces the `/new-interview` marketing hero with a task header merged
to `main` mid-session** (`b9a3a0c`; `origin/main` advanced from `bc34f68`
to `b9a3a0c` while this review was running). Live `/new-interview` still
read *"Get insider insights on any company's interview process… for you and
your friends"* at test time (12:21, before the merge landed — 11th audit),
so the remaining action for PREPIO-111 is **deploy verification, not
merging**. On the broken flags, the failure is **silent**: `handleToggleFlag`
(`Practice.tsx:1336–1347`) only latches the active state *after*
`result.success`, so on the 400 the button label stays *"Needs work"* and
`aria-pressed` stays `"false"` (correctly inactive) — the write just fails
with nothing but a `console.error`, no user-facing toast. (An earlier draft
mis-read the screenshot's dark-green button as an optimistic "looks like
success" state; that is a sticky `:hover` artifact of the synthetic tap, not
a latched active state — corrected per this PR's automated review.) The
highest-value action remains a single attended backend deploy — it recovers
guest conversion, monetization, transcription, answer feedback, and the
practice flags at once. It is intentionally not performed by this
unattended review job.

## Top 5 issues

### 1. **P0 (carried from run #11, now 6th week of consequences) — Production backend still frozen at 2026-05-15: 7 pending migrations + 7 undeployed edge functions**

- **Severity:** P0 (breaks guest conversion, monetization, and a core practice action simultaneously; drift now ~2.5 months)
- **Area:** infra / deployment (fans out to landing, billing, practice)
- **What happened (re-verified against prod `vjwrirrqprjzdorignlz` this run):**
  - `list_migrations` → newest applied is still `20260515171733_security_hardening_and_resume_rpc`. The repo still has **7 newer, never-applied** migrations (`20260516120000` … `20260710203000_question_flags_per_type`). **Unchanged from run #11.** The known divergence caveat still holds: `billing_v1` (`20260514000000` local vs `20260515131539` prod) and `security_hardening_and_resume_rpc` (`20260515150000` local vs `20260515171733` prod) are re-timestamped, so a blind `db:push` needs `supabase migration repair` first.
  - `list_edge_functions` → still only `interview-research, cv-analysis, company-research, interview-question-generator, job-analysis`. The repo has **13** function dirs (`_shared` + 12 functions), so **7 functions remain undeployed**: `research-preview`, `answer-feedback`, `create-checkout-session`, `create-portal-session`, `practice-audio-transcribe`, `profile-import`, `stripe-webhook`.
- **User-facing breakage confirmed live this run:**
  1. **Guest preview** (`/`, desktop): filled *Anthropic / Product Manager* → *Preview my prep* → console `Access to fetch at '…/functions/v1/research-preview' … blocked by CORS policy … does not have HTTP ok status` + `Error creating research preview: FunctionsFetchError`; red banner *"We couldn't build the preview. Try again, or sign in to run the full research workflow."*; the right column stays on its silent pre-click state *"Your Anthropic preview will appear here."* [`03-d-guest-result.png`](./assets/2026-08-02/03-d-guest-result.png). **Sixth consecutive week.**
  2. **Practice flags** (see issue #2).
  3. **Paid checkout**: not re-exercised end-to-end this run (logged-out *Choose monthly* correctly routes to `/auth` — see Notable observations), but `create-checkout-session`/`stripe-webhook` remain undeployed, so an *authenticated* checkout would still CORS/404 exactly as captured in run #11.
- **Why it matters:** the two growth-and-revenue funnels (guest→signup, free→paid) plus a core practice action are all still dead in production. Sixth week for the guest funnel.
- **Recommended fix (maintainer, attended):** (a) reconcile the divergent migration history and pre-check for duplicate `(user_id, question_id, flag_type)` rows before applying `20260710203000`; (b) `npm run db:push` (7 pending); (c) `npm run functions:deploy` (7 missing, verify `verify_jwt=false` on `research-preview`); (d) smoke-test each recovered surface incl. a real checkout→`stripe-webhook`→entitlement round-trip; (e) add a deploy-parity/health check so drift can't silently persist again. Frontend tracks `main` via Vercel — no frontend redeploy needed.
- **Tracking:** assumed still blocked by the Linear free-issue cap (run #9–#11 finding; not re-tested this run). GitHub-ready ticket #1.
- **Not performed by the review job** — cost-incurring, guest-facing, unattended.

### 2. **P1 (carried) — Practice Favorite / Needs-work still fail on every click (`400 / 42P10`), silently — no user-facing error**

- **Severity:** P1 (a labeled core action fails, the user gets no error, curation data is lost)
- **Area:** practice
- **What happened (live, mobile 390×844, Q1 "How do you handle scope changes in ongoing AI projects?"):** clicking *Favorite* then *Needs work* produced two `POST …/rest/v1/user_question_flags?on_conflict=user_id,question_id,flag_type → 400` with console `Error setting question flag: {code: 42P10, message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"}`. Both button labels stayed *"Favorite"* / *"Needs work"* and `aria-pressed` stayed `"false"` — i.e. the React state correctly reflects an inactive (failed) flag; nothing persists and the user sees no error. [`62-m-flags.png`](./assets/2026-08-02/62-m-flags.png).
  - **Screenshot caveat (corrected per this PR's automated review):** the dark-green fill on *Needs work* in that screenshot is **not** an active/latched state — it is the outline button's `hover:bg-accent` treatment left sticky after the synthetic tap (the probe clicked *Favorite* then *Needs work*, so the cursor rested on *Needs work*). `handleToggleFlag` (`Practice.tsx:1336–1347`) updates `questionFlags` **only** after `result.success`, so there is no optimistic latch and no `aria-pressed`/visual mismatch in real use.
- **Root cause (unchanged, DB-verified prior runs):** `user_question_flags` still carries the old `UNIQUE (user_id, question_id)`; migration `20260710203000_question_flags_per_type` (drops it, adds `(user_id, question_id, flag_type)`) is one of the 7 unapplied migrations from issue #1. `searchService.ts:~1719` upserts on the new tuple, so the upsert 400s.
- **Why it matters:** a user who taps *Needs work* to mark a question for another pass gets no confirmation and no error; the flag never persists and the curation is silently lost.
- **Recommended fix:** the write recovers via issue #1's migration. Independently of the deploy, the frontend should **surface a toast on flag-write failure** — today `handleToggleFlag` only `console.error`s, so the failure is invisible to the user. (The optimistic-state rollback an earlier draft asked for already exists — the code latches only on success.) Optionally, guard the flag buttons' hover styling behind `@media (hover: hover)` so a mobile tap doesn't leave a sticky accent fill. *These are code fixes that do not depend on the deploy.*
- **Tracking:** Linear cap (assumed). GitHub-ready ticket #2.

### 3. **REPEAT P1 (fifth consecutive week) — Practice launches into a "Breathe in… / Cycle 1 of 3" breathing interstitial before Q1**

- **Severity:** P1 (held; a `main`-branch issue, not a deploy gap)
- **Area:** practice / core flow
- **What happened (live, mobile):** *Continue practice* → *Quick start* → *Start practice* opens a full-screen breathing loop that gates Q1. Verbatim: *"Breathe in… | Cycle 1 of 3 | Don't show again | Skip."* Only *Skip* exits to Q1. [`50-m-post-start.png`](./assets/2026-08-02/50-m-post-start.png); Q1 past the gate: [`60-m-q1.png`](./assets/2026-08-02/60-m-q1.png).
- **Why it matters:** violates *"the current practice question is the hero"* and *"time-to-value beats feature count."* Three taps and a timed interstitial stand between *Continue practice* and the first question.
- **Recommended fix (unchanged):** move the interstitial behind an opt-in (off by default), or invert *"Don't show again"* to pre-checked, or cap the gate at ≤5s and auto-advance.
- **Tracking:** Linear cap (assumed). GitHub-ready ticket #3.

### 4. **REPEAT P2 (sixth consecutive week) — Interviews card counter and History disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What happened (live):** `/interviews` card reads *"In progress · OpenAI · Solutions Architect · 4 of 40 practiced · 10%"* (it incremented from *3 of 40 · 8%* the moment this run's answer saved — so the counter is live and correct), while `/history` still renders the empty state *"Ready to start practicing / Your first practice session will appear here…"* ([`35-m-history.png`](./assets/2026-08-02/35-m-history.png)). Two surfaces disagree about whether the user has practiced anything.
- **Why it matters:** History is the surface the app tells a returning user to resume from, yet it looks untouched while the card claims 10%. The card's *Continue practice* is the only working resume affordance.
- **Recommended fix (unchanged, option 1 preferred):** render in-progress sessions as an *"In progress · resume"* row in `/history`; or relabel the card counter from *"practiced"* to *"answered"* with a tooltip.
- **Tracking:** Linear cap (assumed). GitHub-ready ticket #4.

### 5. **REPEAT P2 (8th audit) — `/auth` sign-in fields still have no `autocomplete` attributes**

- **Severity:** P2 (held; genuine unfixed bug in `main`, not deploy lag)
- **Area:** auth / accessibility
- **What happened (live, desktop `/auth`):** both `#signin-email` and `#signin-password` return `autocomplete = null`. Fields *are* real-labelled (`<label for>` present) and skip-to-main works, so this is narrowly the autofill/password-manager hint. [`20-d-auth.png`](./assets/2026-08-02/20-d-auth.png).
- **Why it matters:** browsers and password managers can't reliably offer credential autofill; WCAG 1.3.5 (Identify Input Purpose) / OWASP ASVS V2.1.9. A returning user under time pressure has to type both fields by hand.
- **Recommended fix:** add `autocomplete="email"` / `autocomplete="current-password"` to the sign-in fields (and `new-password` on sign-up). PR #244 did exactly this but was never merged ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123), Backlog).
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) exists — update, don't re-file. GitHub-ready ticket #5 cross-references it.

## Notable live observations (not top-5)

### Positives — holding

- **Landing hero + static example** unchanged and strong — [`01-d-landing.png`](./assets/2026-08-02/01-d-landing.png). Verbatim hero: *"Research-first interview prep / Walk into your next interview knowing exactly what to expect."* Guest form controls: *Company \* (placeholder "e.g. Stripe, OpenAI, Ramp")*, *Role (optional)*, *Preview my prep*, honest sub-copy *"No resume needed. No account needed for preview."* Carrying the funnel while the live preview 404s.
- **Skip-to-main works** — first Tab on the logged-out landing lands on `A[href="#main-content"]`. Ninth confirmation.
- **Q1 is a clean question-as-hero** — [`60-m-q1.png`](./assets/2026-08-02/60-m-q1.png): *Q1/10*, timer, *Behavioral Round / Medium* badges, the question in large type, *Recommended — Aim for 1-2 min*, then flags, *Record answer* (primary), *Notes*, *Quick notes*, and *Skip / Save & Continue* pinned at the bottom. Layout is exactly right.
- **Answer save works server-side** — typing an answer and *Save & Continue* → `POST …/rest/v1/practice_answers → 201`. The save path itself is healthy (only the *flag* write is broken).
- **PREPIO-108 autosave copy honest** — Q1 shows *"Quick notes / Saved on this device while you practice"* and *"Draft kept in this tab."* Holds.
- **Touch targets all ≥44px on mobile Q1** — measured: Back 44×44, Practice-actions (⋯) 44×44, *Favorite* 112×44, *Needs work* 138×44, *Answer guide* 126×44, *Record answer* 217×48, *Notes* 103×48, *Skip* 173×48, *Save & Continue* 173×48. PREPIO-122 held.
- **Pricing copy honest** — *"Research, prep plans, and practice stay free. Paid subscriptions unlock AI feedback on saved practice answers…"* ([`14-d-pricing.png`](./assets/2026-08-02/14-d-pricing.png)).
- **Logged-out checkout routes to `/auth`** — *Choose monthly* on `/pricing` while logged out navigates to `/auth` with **no console error** ([`15-d-checkout-attempt.png`](./assets/2026-08-02/15-d-checkout-attempt.png)) — correct gating. (The undeployed `create-checkout-session` breakage only manifests for an *authenticated* user, per run #11.)
- **`/dashboard` logged-out → `/auth`** — protected-route redirect correct.

### One bit of forward motion (merged to `main` mid-session, not yet live)

- **PREPIO-111 fix merged to `main` during this review** (`b9a3a0c`, *"Replace marketing hero on signed-in /new-interview with a task header"*): the logged-in `/new-interview` hero becomes *"Prep a new interview"* with a back-to-Your-interviews breadcrumb on both breakpoints. `origin/main` advanced `bc34f68 → b9a3a0c` while this review ran, so it is **merged, not awaiting merge** (correction per this PR's automated review). At test time (12:21, before the merge landed) live `/new-interview` still read the marketing hero *"Prepio · Get insider insights on any company's interview process. Tailored prep for you and your friends"* ([`11-d-new-interview.png`](./assets/2026-08-02/11-d-new-interview.png)), 11th audit. The remaining action is **deploy verification** — confirm Vercel has served `b9a3a0c` to production and the task header now renders live.

### Tracked repeats confirmed live

- **Nav has no "Interviews" item** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) — logged-in nav verbatim: `Prepio · Home · Dashboard · Practice · Practice History · Pricing · Profile`. **11th audit.**
- **`/history` "Go to Dashboard" CTA** points to `/dashboard` (which redirects to `/interviews`) — sixth consecutive audit. Component of PREPIO-101.
- **Mobile: typed answers persist via *Save & Continue* (201), but the only visible textarea on Q1 is still *Quick notes* (device-local); *Record answer* is the primary answer path.** Product decision carried from runs #7–#11.

## Journey scorecard

Rows marked **↑** improved since run #11, **=** unchanged, **↓** worse. Cells marked **(live)** are live-verified this run.

| Area | Run #11 | Run #12 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong; guest preview broken sixth week (issue #1). |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` marketing hero still live at test time (11th audit); PREPIO-111 fix merged to `main` mid-session (`b9a3a0c`), awaiting deploy. |
| Research progress/loading | — | — | = | Not scored — guest preview 404s and no fresh authenticated research run kicked off (practiced the existing OpenAI SA interview). Ninth owed cycle. |
| Generated output clarity | 4 | 4 | = | **(live)** Q1 (Behavioral Round, Medium) is a clean question-as-hero; 40 questions / 4 stages. |
| Practice mode | 2 | 2 | = | **(live)** Interstitial still gates Q1 (5th wk) and flags still 400 — silently, no user-facing error (issue #2). Save path itself works (201). Held at the run-#11 low. |
| Mobile usability | 3 | 3 | = | **(live)** Clean question-as-hero, all touch targets ≥44px; undercut by the two silently-broken flag buttons on that same screen. |
| Resume/profile trust | 4 | 4 | = | Not re-audited in depth (tester PII); `/new-interview` shows *"CV added (6,434 chars)… Last updated 5/17/2026 … Personalizes every question"* — profile memory intact. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (10% vs empty), sixth week. |
| Error/empty states | 2 | 2 | = | **(live)** Guest-preview error banner honest but right column stays silently pre-click; flag failure is silent — no toast (issue #2). Held at run-#11 low. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main + ≥44px targets confirmed; `aria-pressed` correctly tracks flag state (the dark-green in the screenshot is sticky hover, not an active-state mismatch — see issue #2); `autocomplete=null` unfixed (issue #5). Real SR pass still owed. |
| Copy quality | 4 | 4 | = | **(live)** Hero, autosave, pricing copy all honest. "Cycle 1 of 3" interstitial still reads as from a different app. |

**Composite trend: flat vs run #11 (which was already −2 vs run #9).** Nothing
shipped to production this week, so the low scores hold rather than recover.
The flag failure is silent (no user-facing toast) but the code correctly
keeps `aria-pressed`/label inactive on failure, so there is no
accessibility-state regression to add — Practice mode and Error states are
held at the run-#11 low of 2/2 for the same underlying break.

## Regression check

| Item | State | Note |
|------|-------|------|
| Production backend frozen at 2026-05-15 | **Still frozen — unchanged from run #11** | 7 pending migrations + 7 undeployed functions, byte-identical `list_migrations`/`list_edge_functions`. **P0.** |
| Guest "Preview my prep" broken | **Still broken — sixth consecutive week** | `research-preview` CORS/404. Part of issue #1. |
| Practice flags broken (`400 / 42P10`) | **Still broken — silent (no toast)** | Every click 400s; label + `aria-pressed` correctly stay inactive, but the user sees no error. **P1**, issue #2. |
| Breathing interstitial before Q1 | **Still broken — fifth consecutive week** | `main`-branch issue. Issue #3. |
| Interviews counter vs History mismatch | **Still broken — sixth consecutive week** | 10% vs empty. Issue #4. |
| `/new-interview` marketing hero | **Merged to `main` mid-session — awaiting deploy** | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111). `b9a3a0c` on `main` (advanced `bc34f68→b9a3a0c` during this run); live still showed the hero at test time (11th audit). Deploy verification remains. |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) | **11th audit unshipped.** |
| `/auth` autocomplete missing | **Still unfixed in `main`** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | 8th audit. #244 never merged. Issue #5. |
| Save & Continue writes answer (201) | **Holding** ✅ | `practice_answers` POST → 201 this run. |
| Touch targets ≥44px on mobile Q1 | **Holding** ✅ | All 9 measured controls ≥44px. |
| Skip-to-main + landing hero + static example | **Holding** ✅ | Unchanged. |
| Autosave "Draft kept in this tab" | **Holding** ✅ | Visible on Q1. |
| Logged-out checkout → `/auth` | **Holding** ✅ | Clean redirect, no console error. |

**Zero of the long-running P0/P1/P2 findings shipped to production. The
dominant fact is unchanged from run #11: the production backend has not been
deployed in ~2.5 months, and the broken practice flag fails silently (no
user-facing error). The single positive is that the PREPIO-111 fix merged to
`main` mid-session (`b9a3a0c`) — it now awaits deploy verification rather
than merging.**

## Recommended tickets

Listed GitHub-ready because the Linear workspace is assumed to remain at its
free-issue cap (run #9–#11 finding; updates to existing issues still work).
Once the cap is lifted, file these to Linear per CLAUDE.md conventions
(Quality & Maintenance unless noted).

1. **[P0] Deploy the production backend to parity with `main` and add a drift guard.** Reconcile the divergent migration history (`billing_v1`, `security_hardening_and_resume_rpc`) and pre-check for duplicate `(user_id, question_id, flag_type)` rows; then `npm run db:push` (7 pending) and `npm run functions:deploy` (7 missing incl. `research-preview`, `stripe-webhook`, `profile-import`; verify `verify_jwt=false` on `research-preview`). Smoke-test guest preview, a real checkout→`stripe-webhook`→entitlement round-trip, flag toggle (+`aria-pressed`), transcription, and answer feedback. Add a deploy-parity CI/health check. *Type: Bug · area:infra.*
2. **[P1] Surface a toast when a practice flag write fails.** Independent of the deploy: `handleToggleFlag` (`Practice.tsx:1336–1347`) today only `console.error`s on a `user_question_flags` write error, so the failure is invisible to the user — show a toast. (Active-state latching already happens only on success; no rollback needed.) Optionally guard the flag buttons' hover styling behind `@media (hover: hover)` so a mobile tap doesn't leave a sticky accent fill. *Type: Bug · area:practice.*
3. **[P1] Remove the breathing interstitial from the default practice start** (opt-in off by default, or invert "Don't show again" + cap the gate at ≤5s and auto-advance). *Type: Bug · area:practice.*
4. **[P2] Reconcile the Interviews "practiced" counter with History** — render in-progress sessions as a resume row in `/history` (preferred), or relabel the counter to "answered" with a tooltip. *Type: Bug · area:practice.*
5. **[P2] Ship `autocomplete` on `/auth` (PREPIO-123)** — add `email` / `current-password` / `new-password` to sign-in and sign-up fields. PR #244 already implements it; rebase-and-merge or re-implement. *Existing issue — update, don't re-file. Type: Bug · area:auth.*
6. **[P3] Verify the PREPIO-111 deploy.** `b9a3a0c` (marketing hero → task header on `/new-interview`) is already merged to `main`; confirm Vercel has served it to production and the task header renders live. *Existing issue — update once deploy-verified.*

## Next-run focus

1. **Re-verify the backend deploy** (ticket 1): guest-preview OPTIONS→200 + POST; authenticated *Choose monthly* → Stripe redirect **and** a webhook→entitlement update; flag toggle persists and `aria-pressed` flips.
2. **Confirm the PREPIO-111 deploy landed** — `b9a3a0c` is on `main`; verify `/new-interview` now shows the task header live.
3. **Re-test the flag failure toast** (ticket 2) even before the deploy — the toast is a frontend-only change.
4. **Budget a real authenticated research run end-to-end** — ninth audit owed. Rotate to a fresh company (Palantir, Amazon).
5. **Real keyboard-only + screen-reader pass** — still owed; pair it with the `aria-pressed` and `autocomplete` checks.

`Capability: live browser verified`
