# Prepio UI/UX Review — 2026-08-09 (recurring routine, run #13)

Thirteenth run of the recurring weekly UX-review routine. Baselines:
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
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-02`](./2026-08-02-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` still required; standing run-#8 gotcha).
- **Live-app reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the standing workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server` from `HTTPS_PROXY`).

Coverage this run: logged-out landing + guest-preview POST, `/pricing` +
*Choose monthly* click, `/auth`, `/dashboard` logged-out redirect (desktop
1440×900); logged-in `/interviews`, `/history`, `/profile` (desktop); full
mobile practice flow through Q1→Q2 — Continue practice → Quick start →
**breathing interstitial** → Q1, with a live flag-toggle network+toast
probe, a real answer save, and a touch-target sweep (mobile 390×844,
`isMobile`+`hasTouch`). Backend state re-verified directly against the
production Supabase project (`vjwrirrqprjzdorignlz`) via `list_migrations`
/ `list_edge_functions`. Screenshots under
[`assets/2026-08-09/`](./assets/2026-08-09/).

## Overall product judgment

**Two frontend fixes shipped and are live this week — the first real
user-facing forward motion in several runs — but the P0 backend deploy is
still frozen at 2026-05-15, now for the seventh consecutive week.**
[PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125) (Done) and
[PREPIO-127](https://linear.app/qiuyue/issue/PREPIO-127) (Done) both verify
live: the practice Favorite/Needs-work failure now raises an honest toast
instead of failing silently, and the interview card counter now reads
*"5 of 40 answered · 13%"* instead of the misleading *"practiced."* Those
close two of last week's top-5. **But the underlying breakage is unchanged
because nothing deployed to the backend:** `list_migrations` still ends at
`20260515171733` and only the 5 original research edge functions are live,
so guest "Preview my prep" is still dead (`research-preview` CORS/404,
**seventh week**), authenticated checkout would still fail
(`create-checkout-session`/`stripe-webhook` undeployed), and the flag
*write itself* still `400`s on every click — the toast just makes that
failure honest rather than fixing it. The breathing interstitial still
gates Q1 on every practice start ([PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126),
In Progress, **sixth week live**), and `/auth` fields still ship
`autocomplete=null` ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)).
The highest-value action is unchanged and now overdue: **a single attended
backend deploy** recovers guest conversion, monetization, transcription,
answer feedback, and the practice flag write at once. The frontend team is
now visibly outpacing the deploy pipeline — fixes keep landing on `main`
while the one blocking infra step sits in Backlog.

## Top 5 issues

### 1. **P0 (carried, 7th week) — Production backend still frozen at 2026-05-15: 7 pending migrations + 7 undeployed edge functions**

- **Severity:** P0 (breaks guest conversion, monetization, and the practice flag write simultaneously; drift now ~3 months)
- **Area:** infra / deployment (fans out to landing, billing, practice)
- **What happened (re-verified against prod `vjwrirrqprjzdorignlz` this run):**
  - `list_migrations` → newest applied is still `20260515171733_security_hardening_and_resume_rpc`. The repo still has **7 newer, never-applied** migrations (`20260516120000` … `20260710203000_question_flags_per_type`). Unchanged from run #12. The known divergence caveat still holds: `billing_v1` (`20260514000000` local vs `20260515131539` prod) and `security_hardening_and_resume_rpc` (`20260515150000` local vs `20260515171733` prod) are re-timestamped, so a blind `db:push` needs `supabase migration repair` first.
  - `list_edge_functions` → still only `interview-research, cv-analysis, company-research, interview-question-generator, job-analysis`. The repo has 13 function dirs (`_shared` + 12 functions), so **7 remain undeployed**: `research-preview`, `answer-feedback`, `create-checkout-session`, `create-portal-session`, `practice-audio-transcribe`, `profile-import`, `stripe-webhook`.
- **User-facing breakage confirmed live this run:**
  1. **Guest preview** (`/`, desktop): filled *Anthropic / Product Manager* → *Preview my prep* → console `Access to fetch at '…/functions/v1/research-preview' … blocked by CORS policy … does not have HTTP ok status` + `Error creating research preview: FunctionsFetchError`; red banner *"We couldn't build the preview. Try again, or sign in to run the full research workflow."*; the right column stays on its silent pre-click state *"Your Anthropic preview will appear here."* [`03-d-guest-result.png`](./assets/2026-08-09/03-d-guest-result.png). **Seventh consecutive week.**
  2. **Practice flag write** (see issue #2): every toggle still `POST …/user_question_flags … → 400` with `42P10` (migration `20260710203000` unapplied).
  3. **Paid checkout**: logged-out *Choose monthly* correctly routes to `/auth` (see Positives), but `create-checkout-session`/`stripe-webhook` remain undeployed, so an *authenticated* checkout would still CORS/404.
- **Why it matters:** the two growth-and-revenue funnels (guest→signup, free→paid) plus a core practice action are all still dead in production. Seventh week for the guest funnel, while two *frontend* fixes shipped this same week — the deploy step is now the sole bottleneck.
- **Recommended fix (maintainer, attended):** (a) reconcile the divergent migration history and pre-check for duplicate `(user_id, question_id, flag_type)` rows before applying `20260710203000`; (b) `npm run db:push` (7 pending); (c) `npm run functions:deploy` (7 missing, verify `verify_jwt` intent on `research-preview`); (d) smoke-test each recovered surface incl. a real checkout→`stripe-webhook`→entitlement round-trip; (e) add a deploy-parity/health check so drift can't silently persist again.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Backlog). Updated this run with the 7th-week re-verification.
- **Not performed by the review job** — cost-incurring, guest-facing, unattended.

### 2. **P1 (partially resolved) — Practice Favorite/Needs-work write still `400 / 42P10`; the failure is now honest (toast shipped), but the flag still never persists**

- **Severity:** P1 (a labeled core action still fails and persists nothing; downgraded in user-harm because the failure is now visible, not silent)
- **Area:** practice
- **What happened (live, mobile 390×844, Q1 "Discuss how you have aligned project outcomes with business objectives"):** clicking *Favorite* then *Needs work* produced two `POST …/rest/v1/user_question_flags?on_conflict=user_id,question_id,flag_type → 400` with console `Error setting question flag: {code: 42P10, message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"}`. `aria-pressed` correctly stayed `false→false` for both. **New this week:** a toast now appears — verbatim *"Couldn't save that flag / Something went wrong saving your Favorite / Needs work. Please try again."* [`62-m-flag-needswork.png`](./assets/2026-08-09/62-m-flag-needswork.png). This is the [PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125) fix, verified live.
- **Root cause (unchanged):** `user_question_flags` still carries the old `UNIQUE (user_id, question_id)`; migration `20260710203000_question_flags_per_type` is one of issue #1's 7 unapplied migrations, so the upsert on the new tuple `400`s.
- **Why it matters:** the toast closes the silent-data-loss gap (good), but a user who taps *Needs work* still cannot mark a question for another pass — the curation write only recovers via issue #1's deploy. Two things now depend on the deploy: guest preview and this flag write.
- **Copy nit (new, P3, see issue #5):** the toast *body* uses *"Something went wrong"*, which is on Prepio's own copy avoid-list, and names both flags (*"your Favorite / Needs work"*) when only one was toggled.
- **Tracking:** [PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125) (frontend toast) is **Done + live-verified**. The write recovery is [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (issue #1).

### 3. **REPEAT P1 (sixth consecutive week) — Practice launches into a breathing interstitial before Q1**

- **Severity:** P1 (held; a `main`-branch issue, not a deploy gap)
- **Area:** practice / core flow
- **What happened (live, mobile):** *Continue practice* → *Quick start* → *Start practice* opens a full-screen breathing loop that gates Q1. Verbatim: *"Hold… | Cycle 1 of 3 | Don't show again | Skip."* Only *Skip* exits to Q1. [`51-m-breathe.png`](./assets/2026-08-09/51-m-breathe.png); Q1 past the gate: [`60-m-q1.png`](./assets/2026-08-09/60-m-q1.png).
- **Why it matters:** violates *"the current practice question is the hero"* and *"time-to-value beats feature count."* Three taps and a timed interstitial stand between *Continue practice* and the first question.
- **Recommended fix (unchanged):** move the interstitial behind an opt-in (off by default), or invert *"Don't show again"* to pre-checked, or cap the gate at ≤5s and auto-advance.
- **Tracking:** [PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126) (High, In Progress). Updated this run with the 6th-week live confirmation.

### 4. **REPEAT P2 (unfixed in `main`) — `/auth` sign-in fields still have no `autocomplete` attributes**

- **Severity:** P2 (held; genuine unfixed bug in `main`, not deploy lag)
- **Area:** auth / accessibility
- **What happened (live, desktop `/auth`):** both `#signin-email` and `#signin-password` return `autocomplete = null` (measured directly this run). Fields *are* real-labelled (`<label for>` present) and skip-to-main works, so this is narrowly the autofill/password-manager hint. [`20-d-auth.png`](./assets/2026-08-09/20-d-auth.png).
- **Why it matters:** browsers and password managers can't reliably offer credential autofill; WCAG 1.3.5 (Identify Input Purpose) / OWASP ASVS V2.1.9. A returning user under time pressure has to type both fields by hand.
- **Recommended fix:** add `autocomplete="email"` / `autocomplete="current-password"` to the sign-in fields (and `new-password` on sign-up). PR #244 already implemented this but was never merged.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog). Updated this run.

### 5. **P3 (new) — Flag-failure toast body uses "Something went wrong" and names both flags**

- **Severity:** P3 (polish / copy)
- **Area:** copy / practice
- **User scenario:** a user taps *Needs work* on mobile and the write fails.
- **What happened (live):** the new toast reads *"Couldn't save that flag / Something went wrong saving your Favorite / Needs work. Please try again."* The title is direct and correct; the body opens with *"Something went wrong"* — explicitly on Prepio's copy avoid-list — and names both flag types regardless of which one the user actually toggled.
- **Why it matters:** the toast is a genuine improvement, but its body reads generic where Prepio's copy standard is specific. Naming both flags is mildly confusing when only one was tapped.
- **Recommended fix:** tighten to the specific action, e.g. *"Couldn't save your Needs-work mark. Try again — your answer is safe."* Interpolate the actual flag label; drop *"Something went wrong."*
- **Evidence:** mobile 390×844, `/practice`, [`62-m-flag-needswork.png`](./assets/2026-08-09/62-m-flag-needswork.png). New GitHub-ready ticket #5 (file to Quality & Maintenance).

## Notable live observations (not top-5)

### Positives — holding & new

- **NEW — [PREPIO-127](https://linear.app/qiuyue/issue/PREPIO-127) shipped & live:** the `/interviews` card counter now reads *"OpenAI · Solutions Architect · 5 of 40 answered · 13%"* — relabeled from the misleading *"practiced."* [`31-d-interviews.png`](./assets/2026-08-09/31-d-interviews.png). Closes run-#12 issue #4's chosen fix.
- **NEW — [PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125) shipped & live:** the flag-write failure now surfaces a toast instead of only a `console.error` (issue #2). Closes run-#12 issue #2's frontend half.
- **Landing hero + static example** unchanged and strong — [`01-d-landing.png`](./assets/2026-08-09/01-d-landing.png). Hero: *"Research-first interview prep / Walk into your next interview knowing exactly what to expect."* Static example: *"Stripe · Senior Product Manager"* with stage/difficulty/why-it-matters. Honest sub-copy *"No resume needed. No account needed for preview."*
- **Skip-to-main works** — first Tab on the logged-out landing lands on `A[href="#main-content"]`. Tenth confirmation.
- **Q1 is a clean question-as-hero** — [`60-m-q1.png`](./assets/2026-08-09/60-m-q1.png): *Q1/10*, timer, *Behavioral Round / Medium* badges, question in large type, *Recommended — Aim for 1-2 min*, flags, *Record answer* (primary), *Notes*, *Quick notes*, *Skip / Save & Continue* pinned at the bottom.
- **Answer save works server-side** — typing an answer and *Save & Continue* → `POST …/rest/v1/practice_answers → 201`, advanced Q1→Q2. Save path healthy (only the *flag* write is broken).
- **Autosave copy honest** — Q1 shows *"Quick notes / Saved on this device while you practice"* and *"Draft kept in this tab"*; on save the label flips to *"Saving draft…"*.
- **Touch targets all ≥44px on mobile Q1** — measured: Back 44×44, Practice-actions 44×44, *Favorite* 112×44, *Needs work* 138×44, *Answer guide* 126×44, *Record answer* 217×48, *Notes* 103×48, *Skip* 173×48, *Save & Continue* 173×48.
- **Pricing copy honest** — *"Research, prep plans, and practice stay free. Paid subscriptions unlock AI feedback on saved practice answers…"* three cadences (monthly/quarterly/annual). Logged-out *Choose monthly* routes to `/auth` with no console error ([`11-d-checkout-attempt.png`](./assets/2026-08-09/11-d-checkout-attempt.png)).
- **`/dashboard` logged-out → `/auth`** with redirect context *"Continue to Dashboard."* — protected-route redirect correct.
- **Profile memory intact** — `/profile` shows *"Current source: Qiuyue_ZHANG_CV_2026_Sharpa.pdf"*, *"We prefilled this profile from the last parsed resume."*, Free-plan subscription block, *Profile completeness 20%*. [`33-d-profile.png`](./assets/2026-08-09/33-d-profile.png).

### Tracked repeats confirmed live

- **Nav has no "Interviews" item** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) — logged-in nav verbatim: `Prepio · Home · Dashboard · Practice · Practice History · Pricing · Profile`. **12th audit.**
- **`/history` still shows the empty state for an in-progress session** — card claims *13% answered* while `/history` renders *"Ready to start practicing / Your first practice session will appear here…"* ([`32-d-history.png`](./assets/2026-08-09/32-d-history.png)). PREPIO-127 made the *counter* honest but History still only surfaces *completed* sessions, so the resume-from-History gap persists (broader fix tracked in [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) / [PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99)). The card's *Continue practice* remains the only working resume affordance.
- **`/history` "Go to Dashboard" CTA** still points to `/dashboard` (which redirects to `/interviews`). Component of PREPIO-101.

## Journey scorecard

Rows marked **↑** improved since run #12, **=** unchanged, **↓** worse. Cells marked **(live)** are live-verified this run.

| Area | Run #12 | Run #13 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong; guest preview broken seventh week (issue #1). |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` task header assumed live (PREPIO-111 Done); guest preview still 404s. |
| Research progress/loading | — | — | = | Not scored — guest preview 404s and no fresh authenticated research run kicked off (cost-incurring; practiced the existing OpenAI SA interview). Tenth owed cycle. |
| Generated output clarity | 4 | 4 | = | **(live)** Q1 (Behavioral Round, Medium) is a clean question-as-hero; 40 questions / 4 stages. |
| Practice mode | 2 | 3 | ↑ | **(live)** Flag write still 400s, but the failure is now honest (toast shipped, PREPIO-125) rather than silent; save path works (201); interstitial still gates Q1 (issue #3). Up one on the honesty fix. |
| Mobile usability | 3 | 3 | = | **(live)** Clean question-as-hero, all touch targets ≥44px; flag write still broken but now visibly so. |
| Resume/profile trust | 4 | 4 | = | **(live)** `/profile` shows CV source + prefill + Free-plan block; profile memory intact. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter now honest (*"answered"*, PREPIO-127 ↑) but History still empty for the in-progress session (net flat). |
| Error/empty states | 2 | 3 | ↑ | **(live)** Flag failure now raises a toast (PREPIO-125); guest-preview banner honest. Up one; History empty-state-vs-active-session still weak. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main + ≥44px targets confirmed; `aria-pressed` correctly tracks flag state; `autocomplete=null` unfixed (issue #4). Real SR pass still owed. |
| Copy quality | 4 | 4 | = | **(live)** Hero, autosave, pricing copy honest; new flag toast body uses *"Something went wrong"* (issue #5). "Cycle 1 of 3" interstitial still reads as from a different app. |

**Composite trend: +2 vs run #12 (Practice mode 2→3, Error/empty 2→3).** The
two shipped frontend fixes lift the honesty of the practice surface for the
first time in several runs. The scores are still capped below 4 on those
rows because the *underlying* flag write and guest preview remain broken
pending the issue-#1 deploy.

## Regression check

| Item | State | Note |
|------|-------|------|
| Production backend frozen at 2026-05-15 | **Still frozen — unchanged from run #12** | 7 pending migrations + 7 undeployed functions, byte-identical `list_migrations`/`list_edge_functions`. **P0**, [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124). |
| Guest "Preview my prep" broken | **Still broken — seventh consecutive week** | `research-preview` CORS/404. Part of issue #1. |
| Practice flag write broken (`400 / 42P10`) | **Still broken — but now honest** ✅ | Every click 400s; a toast now surfaces the failure (PREPIO-125 shipped, verified live). Write recovery still needs the deploy. |
| Flag failure silent (no toast) | **FIXED** ✅ | [PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125) Done + live-verified. |
| Interviews counter mislabeled "practiced" | **FIXED** ✅ | [PREPIO-127](https://linear.app/qiuyue/issue/PREPIO-127) Done; card now reads *"5 of 40 answered · 13%"*. |
| Breathing interstitial before Q1 | **Still live — sixth consecutive week** | `main`-branch issue. [PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126), In Progress. Issue #3. |
| Interviews counter vs History mismatch | **Partially addressed** | Counter now honest (PREPIO-127); History still empty for in-progress session ([PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)/[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99)). |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) | **12th audit unshipped.** |
| `/auth` autocomplete missing | **Still unfixed in `main`** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | 9th audit. #244 never merged. Issue #4. |
| Save & Continue writes answer (201) | **Holding** ✅ | `practice_answers` POST → 201; Q1→Q2 advanced. |
| Touch targets ≥44px on mobile Q1 | **Holding** ✅ | All 9 measured controls ≥44px. |
| Skip-to-main + landing hero + static example | **Holding** ✅ | Unchanged. |
| Logged-out checkout → `/auth` | **Holding** ✅ | Clean redirect, no console error. |

**Net: two long-running P1/P2 findings shipped to production this week
(PREPIO-125, PREPIO-127) — the first user-facing regressions-to-green in
several runs. No new regressions. The dominant fact is still that the P0
backend deploy has not landed in ~3 months, so the flows those two fixes
touch are honest but not yet functional.**

## Recommended tickets

The Linear workspace is **no longer at the free-issue cap** assumed by runs
#9–#12 — the backlog now runs through PREPIO-135, and every top finding is
already tracked. This run **updates** the existing issues rather than
re-filing, and files **one** genuinely new ticket (#5).

1. **[P0] Deploy the production backend to parity with `main` and add a drift guard** — reconcile the divergent migration history, `db:push` (7 pending), `functions:deploy` (7 missing incl. `research-preview`, `stripe-webhook`, `profile-import`), smoke-test guest preview + checkout→`stripe-webhook`→entitlement + flag toggle persistence + transcription + answer feedback, add a deploy-parity health check. → **Update [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (done this run; 7th-week re-verification). Consider bumping visibility given it's now the sole blocker while frontend fixes ship around it.
2. **[P1] Remove the breathing interstitial from the default practice start** (opt-in off by default, or invert "Don't show again" + cap the gate at ≤5s and auto-advance). → **Update [PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126)** (In Progress; 6th-week live confirmation added).
3. **[P2] Ship `autocomplete` on `/auth`** — `email` / `current-password` / `new-password`. PR #244 already implements it; rebase-and-merge or re-implement. → **Update [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (still `null` live).
4. **[P2] Surface in-progress sessions in `/history`** so the resume surface stops reading empty while the card shows 13% — render an "In progress · resume" row. → Tracked under [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) / [PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99); no new issue needed.
5. **[P3 · NEW] Tighten the flag-failure toast copy** — drop "Something went wrong", interpolate the actual flag label, don't name both flags. *Type: Improvement · area:practice.* File to Quality & Maintenance.

## Next-run focus

1. **Re-verify the backend deploy** ([PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)): guest-preview OPTIONS→200 + POST; authenticated *Choose monthly* → Stripe redirect **and** a webhook→entitlement update; flag toggle persists and `aria-pressed` flips (and the toast *stops* firing).
2. **Confirm the interstitial fix** ([PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126)) once it lands — practice should drop straight to Q1 by default.
3. **Budget a real authenticated research run end-to-end** — tenth audit owed. Rotate to a fresh company (Palantir, Amazon, Vitol).
4. **Real keyboard-only + screen-reader pass** — still owed; pair with the `aria-pressed`, `autocomplete`, and focus-visibility checks.

`Capability: live browser verified`
