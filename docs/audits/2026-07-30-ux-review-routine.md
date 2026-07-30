# Prepio UI/UX Review — 2026-07-30 (recurring routine, run #10)

Tenth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-19`](./2026-07-19-ux-review-routine.md),
[`2026-07-23`](./2026-07-23-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` still required; standing run-#8 gotcha).
- **Live-app reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the standing workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server` from `HTTPS_PROXY`).

Coverage this run: logged-out landing + guest preview (desktop 1440×900);
`/auth`, `/new-interview`, `/dashboard` redirect, `/pricing` **+ live
checkout POST** (desktop); logged-in `/interviews`, `/history`, full
practice flow through Q1 with a **clean flag-toggle network probe** and the
Save & Continue disabled-on-empty check (mobile 390×844). Backend state
cross-checked directly against the production Supabase project
(`vjwrirrqprjzdorignlz`) via `list_migrations` / `list_edge_functions` /
`execute_sql`. Screenshots under [`assets/2026-07-30/`](./assets/2026-07-30/).

## Overall product judgment

**This run turns three separate "still broken" mysteries into one root
cause: the production *backend* has been frozen since 2026-05-15.** The
production Supabase project's applied-migration history ends at
`20260515171733`, and only the 5 original research edge functions are
deployed. Seven newer migration files and **seven of the twelve** edge
functions that shipped to `main` over the last ~2.5 months **have never
reached production** — and two *already-applied* migrations were
re-timestamped in the repo, so the histories are divergent and `db:push`
needs reconciliation first, not a blind run. That single fact explains the
guest-preview outage (now five weeks; `research-preview` undeployed), and
it newly explains the practice **Favorite / Needs-work flags being broken
in production** — every click returns `400 / 42P10` because the
`(user_id, question_id, flag_type)` unique constraint from migration
`20260710203000` was never applied; the frontend code and its
`aria-pressed` binding are correct in `main` (#231/#233), so run #9's
"aria-pressed=false" is the flag *write* failing, not a stale bundle.
**A new, worse discovery: paid checkout is dead** — *Choose monthly* on
`/pricing` fails because `create-checkout-session` is undeployed, and
`stripe-webhook` is undeployed too, so even a working redirect would never
sync entitlements. **Correction to the frontend half of the story
(surfaced by this PR's automated review):** the frontend (Vercel,
auto-deployed per-branch) tracks `main` and is *not* stale — so the
marketing hero, missing "Interviews" nav item, and missing `/auth`
autocomplete are genuinely **unfixed in `main`** (PREPIO-111/101 *In
Progress*; #244 reviewed as an open bot PR but never merged), i.e. ordinary
dev work, not deploy lag. **The highest-value action, by a wide margin, is
a backend deploy-and-verify (after reconciling the migration history) — it
recovers guest conversion, monetization, transcription, answer feedback,
and the practice flags at once. It is intentionally not performed by this
unattended review job.**

## Top 5 issues

### 1. **P0 (new root cause, supersedes run #9's #1) — Production backend frozen at 2026-05-15: 7 pending migrations (2 divergently re-timestamped) + 7 undeployed edge functions**

- **Severity:** P0 (breaks guest conversion, monetization, and a core practice action simultaneously; ~2.5-month drift)
- **Area:** infra / deployment (fans out to landing, billing, practice)
- **What happened (verified against prod project `vjwrirrqprjzdorignlz`):**
  - `list_migrations` → newest applied is `20260515171733_security_hardening_and_resume_rpc`. Repo has **7 newer, never-applied** migration files: `20260516120000_billing_event_ordering`, `20260516232408_research_preview_cache`, `20260524140500_answer_feedback`, `20260525120000_answer_feedback`, `20260528000000_billing_cancel_ordering`, `20260623210533_answer_feedback_atomic_rpc`, `20260710203000_question_flags_per_type`. **Divergence caveat (raised in this PR's review — verified):** two *already-applied* migrations were re-timestamped in the repo — `billing_v1` is `20260514000000` locally vs `20260515131539` in prod, and `security_hardening_and_resume_rpc` is `20260515150000` locally vs `20260515171733` in prod. The histories therefore diverge; a blind `npm run db:push` can stop on the unmatched remote version or treat the local security migration as separate. Reconcile the history (e.g. `supabase migration repair`) before pushing.
  - `list_edge_functions` → only `interview-research, cv-analysis, company-research, interview-question-generator, job-analysis` deployed. The repo has **12** function dirs, so **7 are undeployed** (corrected from 5 during review): `research-preview`, `answer-feedback`, `create-checkout-session`, `create-portal-session`, `practice-audio-transcribe`, **`profile-import`**, **`stripe-webhook`**. `stripe-webhook` is the path that syncs Stripe subscription state, so a working checkout redirect *alone* would still leave paid entitlements never updating.
- **User-facing breakage confirmed live this run:**
  1. **Guest preview** (`/`, desktop): *Preview my prep* → console `CORS … research-preview … preflight … does not have HTTP ok status` → red banner *"We couldn't build the preview…"*; right column stays *"Your Palantir preview will appear here"* (no fallback). [`02-d-landing-post-preview.png`](./assets/2026-07-30/02-d-landing-post-preview.png). **Fifth consecutive week.**
  2. **Paid checkout** (`/pricing`, desktop): *Choose monthly* → console `CORS … create-checkout-session … preflight …`; stays on `/pricing`. [`15-d-checkout-attempt.png`](./assets/2026-07-30/15-d-checkout-attempt.png). **New this run.** And because `stripe-webhook` is also undeployed, deploying only `create-checkout-session` would let a redirect succeed while entitlements silently never update — the smoke test must cover the full webhook round-trip.
  3. **Practice flags** (see issue #2).
- **Why it matters:** the two revenue-and-growth-critical funnels (guest→signup, free→paid) are both dead in production, plus a core practice action. Every "still not shipped" *backend* finding since run #6 has a common cause nobody had named until now.
- **Recommended fix (maintainer, attended):** (a) reconcile the divergent migration history (`billing_v1` / `security_hardening_and_resume_rpc` version mismatch) and pre-check for duplicate `(user_id, question_id, flag_type)` rows before applying `20260710203000`; (b) `npm run db:push` (7 pending migrations); (c) `npm run functions:deploy` (7 missing functions, verifying `verify_jwt=false` on `research-preview`); (d) smoke-test each recovered surface — including a real Stripe checkout→`stripe-webhook`→entitlement round-trip, not just the redirect; (e) **add a deploy-parity/health check** so drift can't silently persist again. The frontend already tracks `main` via Vercel — no frontend redeploy needed.
- **Tracking:** **Could not file — Linear at free-issue cap** (run #9 issue, still live; see below). GitHub-ready ticket #1.
- **Not performed by the review job** — cost-incurring, guest-facing, unattended.

### 2. **P1 (new) — Practice Favorite / Needs-work flags fail on every click in production (`400 / 42P10`)**

- **Severity:** P1 (a labeled core practice action silently fails with no user-facing error; curation data is lost)
- **Area:** practice
- **What happened (live, mobile 390×844, Q1):** clicking *Favorite* then *Needs work* produced, in the console:
  ```
  POST …/rest/v1/user_question_flags?on_conflict=user_id,question_id,flag_type → 400
  Error setting question flag: {code: 42P10, message: "there is no unique or
  exclusion constraint matching the ON CONFLICT specification"}
  ```
  `aria-pressed` stayed `"false"` on both buttons before *and* after each click; neither flag visually latched. [`62-m-flags.png`](./assets/2026-07-30/62-m-flags.png).
- **Root cause (verified via `execute_sql` on prod):** `user_question_flags` still carries the **old** `UNIQUE (user_id, question_id)` constraint. Migration `20260710203000_question_flags_per_type.sql` (shipped in PR #233, 2026-07-10, with tests — retro-audited clean per the 2026-07-11 hygiene review) drops it and adds `UNIQUE (user_id, question_id, flag_type)`, which is exactly what the frontend upserts on (`searchService.ts:1719`). The migration was never applied, so the upsert 400s.
- **Why it matters:** this is the *real* explanation for run #9's `aria-pressed=false` reading — not a cosmetic stale bundle. `main` already binds `aria-pressed={favoriteActive}` / `={needsWorkActive}` and renders the active copy *"Favorited"* / *"Needs work flagged"* (`Practice.tsx:2699/2708/2716/2725`, PR #231/#233), and the frontend serving that code is current — so `false` and the inactive copy live can only mean `favoriteActive`/`needsWorkActive` never flip, because the write itself 400s. Users think they've favorited/flagged a question; nothing persists, and there is no error surfaced.
- **Recommended fix:** covered by issue #1 step (a)+(b). No code change needed — the code is correct and tested; only the migration must be applied (after the duplicate-row pre-check). Consider surfacing a toast on flag-write failure so a future outage isn't silent.
- **Tracking:** Could not file (Linear cap). Folded into GitHub-ready ticket #1.

### 3. **REPEAT P1 (fourth consecutive week) — Practice launches into a "Breathe in… / Cycle 1 of 3" breathing interstitial before Q1**

- **Severity:** P1 (held; this is a `main`-branch issue, not a deployment gap)
- **Area:** practice / core flow
- **What happened (live, mobile):** after *Continue practice* → *Start practice*, a full-screen breathing loop gates Q1. `innerText` at t+0.5/1.5/2.5s all `Breathe in... | Cycle 1 of 3 | Don't show again | Skip`; t+3.5/4.5/5.5s `Hold... | Cycle 1 of 3 | …` — still Cycle 1 at t+5.5s; only *Skip* exits. [`50-m-interstitial.png`](./assets/2026-07-30/50-m-interstitial.png). Q1 past the gate: [`60-m-q1.png`](./assets/2026-07-30/60-m-q1.png).
- **Why it matters:** violates *"the current practice question is the hero"* and *"time-to-value beats feature count."* Three gates to the first question.
- **Recommended fix (unchanged):** move the interstitial behind an opt-in (off by default), or invert *"Don't show again"* to on, or cap the gate at ≤5s and auto-advance.
- **Tracking:** Could not file (Linear cap). GitHub-ready ticket #3.

### 4. **REPEAT P2 (fifth consecutive week) — Interviews card counter and History disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What happened (live):** `/interviews` card reads *"In progress · OpenAI · Solutions Architect · 3 of 40 practiced · 8%"* while `/history` renders the empty state *"Ready to start practicing / Your first practice session will appear here…"* ([`35-m-history.png`](./assets/2026-07-30/35-m-history.png)). Two surfaces disagree about whether the user has practiced anything. The card's *Continue practice* is the only working resume affordance; History (the intended resume surface) reads empty.
- **Why it matters:** History is where a returning user is told to resume, yet it looks untouched while the card claims 8%.
- **Recommended fix (unchanged, option 1 preferred):** render in-progress sessions as an *"In progress · resume"* row in `/history`; or relabel the card counter from *"practiced"* to *"answered"* with a tooltip.
- **Tracking:** Could not file (Linear cap). GitHub-ready ticket #4.

### 5. **P1 (process, carried from run #9) — Linear workspace is at its free-issue cap; no new tracking issues can be filed**

- **Severity:** P1 (blocks the team's entire audit→backlog intake path)
- **Area:** infra / process
- **What happened (this run):** filing the run #10 production-parity P0 returned `invalid_request: "You've exceeded the free issue limit for this workspace…"` (requestId `a2345d364d2f7ce5`). Same block run #9 hit. **Note:** *updating* existing issues still works — only creation is capped.
- **Why it matters:** CLAUDE.md makes Linear the source of truth and directs every >30-min audit finding to be filed there. With creation capped, that workflow is dead — the new P0, the broken-flags P1, the interstitial, and the counter mismatch all have no home. This is the fifth straight review that recommends issues it cannot create.
- **Recommended fix:** upgrade the Linear workspace / start the free trial / prune archived-duplicate issues to get back under the cap. Until then this report's ticket list is the interim backlog.
- **Tracking:** self-referential — cannot be filed. GitHub-ready ticket #5.

## Notable live observations (not top-5)

### Positives — holding

- **Landing hero + static Stripe example** unchanged and strong — [`01-d-landing.png`](./assets/2026-07-30/01-d-landing.png). Carrying the funnel while the live preview 404s. Verbatim hero: *"Research-first interview prep / Walk into your next interview knowing exactly what to expect."*
- **Skip-to-main works** — first Tab on the logged-out landing lands on `A[href="#main-content"]`. Eighth confirmation.
- **Save & Continue genuinely disabled on empty answer** — `button.disabled === true` on Q1 with an empty answer. Second consecutive confirmation (resolved run #9).
- **Autosave copy honest** — Q1 shows *"Saving draft…"* next to *"Quick notes / Saved on this device while you practice."* PREPIO-108 healthy.
- **Pricing copy honest** — *"Research, prep plans, and practice stay free. Paid subscriptions unlock AI feedback on saved practice answers…"* ([`14-d-pricing.png`](./assets/2026-07-30/14-d-pricing.png)). (The copy is honest; the checkout button behind it is dead — issue #1.)

### Tracked repeats confirmed live (regression table below)

- **`/new-interview` marketing hero** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111), *In Progress*) — still *"Prepio · Get insider insights on any company's interview process. Tailored prep for you and your friends."* **Tenth audit.** [`11-d-new-interview.png`](./assets/2026-07-30/11-d-new-interview.png).
- **Nav has no "Interviews" item** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), *In Progress*) — desktop nav verbatim `Prepio · Home · Dashboard · Practice · Practice History · Pricing · Profile`. **Tenth audit.**
- **`/dashboard` redirect collision** — direct nav to `/dashboard` resolved to `/interviews` (seventh consecutive confirmation). Component of PREPIO-101.
- **`/history` "Go to Dashboard" CTA** points to `/dashboard` (which redirects to `/interviews`) — fifth consecutive audit. Component of PREPIO-101.
- **`/auth` autocomplete still `null`** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123), *Backlog*) — both `#signin-email` and `#signin-password` return `null`; Chromium itself logged the *"Input elements should have autocomplete attributes"* warning. **Seventh audit. Correction to run #9's read (raised in this PR's review, verified against source): PR #244 was only *reviewed* as an open bot PR, never merged — `src/pages/Auth.tsx` in `main` has zero `autoComplete` attributes — so production matches `main`. This is a genuine unfixed bug, not a deploy-lag symptom.**
- **Mobile-only: still no typed *answer* surface distinct from device-local notes on Q1.** The only textarea on Q1 is *Quick notes* (placeholder *"Jot the beats you want to hit…"*, labeled *"Saved on this device while you practice"*). *Record answer* is the primary answer path. Carried from runs #7–#9; still a product decision worth making.

## Journey scorecard

Rows marked **↑** improved since run #9, **=** unchanged, **↓** worse. Cells marked **(live)** are live-verified this run.

| Area | Run #9 | Run #10 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong; guest preview broken fifth week (root cause = issue #1). |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` marketing hero unchanged, tenth audit (PREPIO-111). |
| Research progress/loading | — | — | = | Not scored — no fresh authenticated research run kicked off (guest preview 404s; used the existing OpenAI SA interview for practice). Eighth owed cycle. |
| Generated output clarity | 4 | 4 | = | **(live)** Reviewed via Interviews card (40 questions / 4 stages) + Q1 (Technical Round, Easy, question-as-hero intact). |
| Practice mode | 3 | **2** | ↓ | **(live)** Breathing interstitial still gates Q1 (4th wk) **and** Favorite/Needs-work now confirmed broken at the DB layer (issue #2) — a core action silently fails. Down one. |
| Mobile usability | 3 | 3 | = | **(live)** Q1 layout is a clean question-as-hero screen; but the two flag buttons on it don't work (issue #2) and the interstitial still ships. |
| Resume/profile trust | 4 | 4 | = | Not re-audited in depth (tester PII); `/new-interview` shows *"CV added (6,434 chars)… Last updated 5/17/2026"* — profile memory intact. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (8% vs empty), fifth week. |
| Error/empty states | 3 | **2** | ↓ | **(live)** Two silent failures found this run: checkout click does nothing visible, flag click 400s with no user-facing message. Guest-preview error is honest but the right column stays silently pre-click. Down one. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main confirmed; `aria-pressed` reads `false` because the flag write fails (the binding *is* present in `main` — issue #2); `autocomplete=null` is unfixed in `main` (#244 never merged). Real keyboard-only + SR pass still owed (eight audits). |
| Copy quality | 4 | 4 | = | **(live)** Hero, autosave, pricing copy all honest. "Cycle 1 of 3" interstitial still reads as from a different app. |

**Composite trend: −2 (Practice mode and Error/empty states each down one).**
The drop is not new breakage that landed this week — it's the same
backend freeze finally being *measured* at the flag layer and the
checkout layer. The flag/checkout code on `main` is correct; the
production *backend* (Supabase migrations + edge functions) is what's
frozen. The frontend tracks `main`.

## Regression check

| Item | State | Note |
|------|-------|------|
| **NEW: Production backend frozen at 2026-05-15** | **New root cause** | 7 pending migrations (+2 already-applied ones divergently re-timestamped) + 7 undeployed functions. Unifies backend findings since run #6. **P0.** |
| **NEW: Paid checkout dead** (`create-checkout-session` undeployed) | **New** | *Choose monthly* on `/pricing` → CORS/404. `stripe-webhook` also undeployed → entitlements wouldn't sync even after a redirect fix. Monetization funnel dead. Part of issue #1. |
| **NEW: Practice flags broken** (`user_question_flags` 400 / 42P10) | **New root cause** | Migration `20260710203000` unapplied; every Favorite/Needs-work click fails. Reframes run #9's `aria-pressed=false`. **P1.** |
| Guest "Preview my prep" broken | **Still broken — fifth consecutive week** | `research-preview` still undeployed (`list_edge_functions` unchanged from run #9). Part of issue #1. |
| Linear workspace at free-issue cap | **Still blocked** | Confirmed again this run (requestId `a2345d364d2f7ce5`). Creation capped; updates still work. |
| Breathing interstitial before Q1 | **Still broken — fourth consecutive week** | `main`-branch issue. Could not file (cap). |
| Interviews counter vs History mismatch | **Still broken — fifth consecutive week** | 8% vs empty. Could not file (cap). |
| `/new-interview` marketing hero | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111), In Progress) | **Tenth audit unshipped.** |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) | **Tenth audit unshipped.** |
| `/history` "Go to Dashboard" → `/interviews` | **Still open** (part of PREPIO-101) | Fifth audit. |
| Password autocomplete missing on `/auth` | **Unfixed in `main` (#244 never merged) — prod matches `main`** | [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123). Seventh audit. Correction to run #9: a genuine unfixed bug, **not** a deploy-lag symptom. |
| Save & Continue disabled on empty answer | **Holding** ✅ | `disabled === true` verified again. |
| Skip-to-main + landing hero + static example | **Holding** ✅ | Unchanged. |
| Autosave "Saving draft…" | **Holding** ✅ | Visible on Q1. |

**Zero of the long-running P1/P2 findings shipped. The dominant fact of run
#10 is that the production *backend* (Supabase migrations + edge functions)
has not been deployed in ~2.5 months, which now provably breaks guest
preview, paid checkout (+ entitlement sync), practice flags, transcription,
and answer feedback. The frontend tracks `main` via Vercel, so the
hero / nav / autocomplete repeats are genuine unfixed dev work, not deploy
lag — a correction to run #9's stale-frontend framing, caught by this PR's
automated review.**

## Recommended tickets

Listed GitHub-ready because **the Linear workspace is at its free-issue cap
and no new issue could be created this run** (issue #5). Once the cap is
lifted, file these to Linear per CLAUDE.md conventions (Quality &
Maintenance unless noted).

1. **[P0] Deploy the production *backend* to parity with `main` and add a drift guard.** First reconcile the divergent migration history (`billing_v1` and `security_hardening_and_resume_rpc` are re-timestamped in the repo vs prod) and pre-check for duplicate `(user_id, question_id, flag_type)` rows; then `npm run db:push` (7 pending migrations) and `npm run functions:deploy` (7 missing functions incl. `research-preview`, `stripe-webhook`, `profile-import`; verify `verify_jwt=false` on `research-preview`). Smoke-test guest preview, a real checkout→`stripe-webhook`→entitlement round-trip (not just the redirect), flag toggle (+`aria-pressed`), transcription, and answer feedback. Add a deploy-parity CI check / synthetic health checks so `main`→prod drift can't silently persist again. The frontend already tracks `main` via Vercel — no redeploy needed. *Type: Bug · area:infra (touches landing, billing, practice).*
2. **[P1] Surface a user-facing error when a practice flag write fails.** Even after the migration lands, a future `user_question_flags` write failure should show a toast, not fail silently with `aria-pressed` stuck. *Type: Improvement · area:practice.*
3. **[P1] Remove the breathing interstitial from the default practice start** (or invert "Don't show again" + cap the gate at ≤5s and auto-advance). *Type: Bug · area:practice.*
4. **[P2] Reconcile the Interviews "practiced" counter with History** — render in-progress sessions as a resume row in `/history` (preferred), or relabel the counter to "answered" with a tooltip. *Type: Bug · area:practice.*
5. **[P1] Lift the Linear free-issue cap** (upgrade / trial / prune) so the audit→backlog workflow can function again. *Type: Chore · area:infra.*
6. **[P3] Keep PREPIO-111 (hero), PREPIO-101 (nav), and PREPIO-123 (autocomplete) as active *dev* work.** Correction to an earlier draft of this report (caught in review): none of the three is fixed in `main` — `Home.tsx` still renders the marketing hero, `Navigation.tsx` still lacks an Interviews item, and `Auth.tsx` still omits `autoComplete` (#244 was never merged). These are ordinary unshipped fixes, **not** post-deploy verification, and the ticket-1 deploy will not change them. *Existing issues; update, don't re-file.*

## Next-run focus

1. **Verify the backend deploy landed** (ticket 1) — re-run: guest-preview OPTIONS→200 + POST; `/pricing` *Choose monthly* → Stripe redirect **and** a webhook→entitlement update; practice flag toggle persists and `aria-pressed` flips. (The hero, nav, and autocomplete will *not* change from a deploy — they're unfixed in `main` and need dev work, ticket 6.)
2. **Confirm the Linear cap is lifted and file tickets 1–5.**
3. **Budget a real authenticated research run end-to-end** — eight audits owed. Rotate to a fresh company (Palantir, Amazon).
4. **Real keyboard-only + screen-reader pass** — eight audits owed.
5. **Empty-state coverage** — tester account has one interview; use a scratch account to reach the truly-empty `/interviews` state.

`Capability: live browser verified`
