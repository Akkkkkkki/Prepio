# Prepio UI/UX Review — 2026-08-06 (recurring routine, run #13)

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

Coverage this run: logged-out landing + guest-preview POST (desktop
1440×900, rotated to **Amazon / Product Manager**); `/pricing`, `/auth`
(autocomplete probe), `/dashboard` logged-out redirect; logged-in
`/interviews`, `/new-interview`, `/history` (desktop); full mobile practice
flow through Q1 — Continue practice → Quick start → **breathing
interstitial** → Q1, with a live flag-toggle network probe, a real answer
save (`practice_answers` POST → `201`), and a touch-target sweep (mobile
390×844). Backend state re-verified directly against the production
Supabase project (`vjwrirrqprjzdorignlz`) via `list_migrations` /
`list_edge_functions`, and issue state cross-checked against the live Linear
workspace. Screenshots under [`assets/2026-08-06/`](./assets/2026-08-06/).

## Overall product judgment

**Two real improvements shipped to production this week — the first forward
motion the live app has shown in the whole run history — but the dominant
fact is unchanged: the production backend is still frozen at 2026-05-15, so
every backend-dependent P0/P1 reproduces.** The wins are frontend-only and
Vercel-deployed: (1) **PREPIO-111 landed** — logged-in `/new-interview` now
opens with the honest task header *"Prep a new interview / All you need is
the company. Add role, CV, or job description below to sharpen the
questions"* and a *Your interviews › New interview* breadcrumb; the old
marketing hero (*"Get insider insights… for you and your friends"*) that had
been flagged for 11 straight audits is **gone live** (Linear PREPIO-111 =
Done). (2) **PREPIO-88 landed** — the logged-out landing now carries a
single header CTA (*"Sign in or create account"*), the duplicate
guest-conversion CTAs are collapsed. Against that, `list_migrations` still
ends at `20260515171733` and only the 5 original research edge functions are
deployed (byte-identical to run #12), so: guest *"Preview my prep"* is dead
for the **seventh** straight week (`research-preview` CORS/404), the practice
Favorite/Needs-work flags still `400 / 42P10` on every click — and still
**silently**, with no user-facing toast (migration `20260710203000`
unapplied *and* the toast fix from run #12 ticket #2 never shipped), and paid
checkout would still fail after sign-in (`create-checkout-session` /
`stripe-webhook` undeployed). The breathing interstitial still gates Q1 (6th
week) and `/auth` still ships no `autocomplete` (9th audit). The
highest-value action remains a single attended backend deploy — it recovers
guest conversion, monetization, transcription, answer feedback, and the
practice flags at once. It is intentionally not performed by this unattended
review job. The single most important tracking gap this run: **none of the
long-running P0/P1 breakages has a Linear issue** — this review files them
(see Recommended tickets).

## Top 5 issues

### 1. **P0 (carried, now 7th week of consequences) — Production backend still frozen at 2026-05-15: 7 pending migrations + 7 undeployed edge functions**

- **Severity:** P0 (breaks guest conversion, monetization, and a core practice action simultaneously; drift now ~2.8 months)
- **Area:** infra / deployment (fans out to landing, billing, practice)
- **What happened (re-verified against prod `vjwrirrqprjzdorignlz` this run):**
  - `list_migrations` → newest applied is still `20260515171733_security_hardening_and_resume_rpc`. The repo still has **7 newer, never-applied** migrations (`20260516120000` … `20260710203000_question_flags_per_type`). **Unchanged from run #12.** Standing divergence caveat still holds: `billing_v1` (`20260514000000` local vs `20260515131539` prod) and `security_hardening_and_resume_rpc` (`20260515150000` local vs `20260515171733` prod) are re-timestamped, so a blind `db:push` needs `supabase migration repair` first.
  - `list_edge_functions` → still only `interview-research, cv-analysis, company-research, interview-question-generator, job-analysis` (all `updated_at` unchanged since May). The repo has **12** functions, so **7 remain undeployed**: `research-preview`, `answer-feedback`, `create-checkout-session`, `create-portal-session`, `practice-audio-transcribe`, `profile-import`, `stripe-webhook`.
- **User-facing breakage confirmed live this run:**
  1. **Guest preview** (`/`, desktop, Amazon / Product Manager): *Preview my prep* → console `Access to fetch at '…/functions/v1/research-preview' … blocked by CORS policy … does not have HTTP ok status` + `Error creating research preview: FunctionsFetchError`; honest red banner *"We couldn't build the preview. Try again, or sign in to run the full research workflow."* [`03-d-guest-result.png`](./assets/2026-08-06/03-d-guest-result.png). **Seventh consecutive week.**
  2. **Practice flags** (see issue #2).
  3. **Paid checkout**: `create-checkout-session` / `stripe-webhook` remain undeployed → an authenticated checkout would still CORS/404.
- **Why it matters:** the two growth-and-revenue funnels (guest→signup, free→paid) plus a core practice action are all still dead in production. Seventh week for the guest funnel.
- **Recommended fix (maintainer, attended):** (a) reconcile the divergent migration history and pre-check for duplicate `(user_id, question_id, flag_type)` rows before applying `20260710203000`; (b) `npm run db:push` (7 pending); (c) `npm run functions:deploy` (7 missing, verify `verify_jwt=false` on `research-preview`); (d) smoke-test each recovered surface incl. a real checkout→`stripe-webhook`→entitlement round-trip; (e) add a deploy-parity/health check so drift can't silently persist again. Frontend tracks `main` via Vercel — PREPIO-111 and PREPIO-88 prove that pipeline is live and healthy; only the Supabase side is frozen.
- **Tracking:** **no Linear issue exists** — this review files GitHub-ready ticket #1 to **Quality & Maintenance**.
- **Not performed by the review job** — cost-incurring, guest-facing, unattended.

### 2. **P1 (carried, 7th week) — Practice Favorite / Needs-work still fail on every click (`400 / 42P10`), silently — no user-facing error**

- **Severity:** P1 (a labeled core action fails, the user gets no error, curation data is lost)
- **Area:** practice
- **What happened (live, mobile 390×844, Q1 "Discuss how you manage continuous learning and skill enhancement in the rapidly evolving field of AI"):** clicking *Favorite* then *Needs work* produced two `POST …/rest/v1/user_question_flags?on_conflict=user_id,question_id,flag_type → 400` with console `Error setting question flag: {code: 42P10, message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"}` (both times). Both `aria-pressed` stayed `"false"` — the React state correctly reflects an inactive (failed) flag; nothing persists and the user sees **no error**. [`62-m-flags.png`](./assets/2026-08-06/62-m-flags.png).
  - **Screenshot caveat (standing from run #12):** the dark-green fill on *Needs work* in that screenshot is a sticky `hover:bg-accent` artifact of the synthetic tap, **not** a latched active state. `handleToggleFlag` (`Practice.tsx:1308–1352`) updates `questionFlags` only after `result.success`, so there is no optimistic-latch mismatch in real use.
- **Root cause (unchanged, DB-verified):** `user_question_flags` still carries the old `UNIQUE (user_id, question_id)`; migration `20260710203000_question_flags_per_type` (drops it, adds `(user_id, question_id, flag_type)`) is one of the 7 unapplied migrations from issue #1. `searchService.setQuestionFlag` upserts on the new tuple, so the upsert 400s.
- **The frontend half is still unshipped:** run #12 ticket #2 recommended a toast on flag-write failure. **It has not shipped** — `handleToggleFlag` (`Practice.tsx:1346`, `1350`) still only `console.error`s the failure. This is a frontend-only fix that does **not** depend on the deploy, and it remains outstanding.
- **Why it matters:** a user who taps *Needs work* to mark a question for another pass gets no confirmation and no error; the flag never persists and the curation is silently lost.
- **Recommended fix:** the *write* recovers via issue #1's migration; independently, surface a toast on flag-write failure (`handleToggleFlag`), and optionally guard the flag buttons' hover styling behind `@media (hover: hover)` so a mobile tap doesn't leave a sticky accent fill.
- **Tracking:** **no Linear issue exists** — files GitHub-ready ticket #2.

### 3. **P1 (6th consecutive week) — Practice launches into a "Breathe in… / Cycle 1 of 3" breathing interstitial before Q1**

- **Severity:** P1 (held; a `main`-branch issue, not a deploy gap)
- **Area:** practice / core flow
- **What happened (live, mobile):** *Continue practice* → *Quick start* → *Start practice* opens a full-screen breathing loop that gates Q1. Verbatim: *"Breathe in… | Cycle 1 of 3 | Don't show again | Skip."* Only *Skip* exits to Q1. [`52-m-breathing.png`](./assets/2026-08-06/52-m-breathing.png); Q1 past the gate: [`60-m-q1.png`](./assets/2026-08-06/60-m-q1.png).
- **Why it matters:** violates *"the current practice question is the hero"* and *"time-to-value beats feature count."* Three taps and a timed interstitial stand between *Continue practice* and the first question.
- **Recommended fix (unchanged):** move the interstitial behind an opt-in (off by default), or invert *"Don't show again"* to pre-checked, or cap the gate at ≤5s and auto-advance.
- **Tracking:** **no Linear issue exists** — files GitHub-ready ticket #3.

### 4. **P2 (7th consecutive week) — Interviews card counter and History disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What happened (live):** `/interviews` card reads *"In progress · OpenAI · Solutions Architect · 4 of 40 practiced · 10%"*, while `/history` still renders the empty state *"Ready to start practicing / Your first practice session will appear here…"* ([`35-d-history.png`](./assets/2026-08-06/35-d-history.png)). Two surfaces disagree about whether the user has practiced anything.
- **Why it matters:** History is the surface the app tells a returning user to resume from, yet it looks untouched while the card claims 10%. The card's *Continue practice* is the only working resume affordance.
- **Recommended fix (unchanged, option 1 preferred):** render in-progress sessions as an *"In progress · resume"* row in `/history`; or relabel the card counter from *"practiced"* to *"answered"* with a tooltip.
- **Tracking:** **no Linear issue exists** — files GitHub-ready ticket #4. (Adjacent but distinct from PREPIO-107, which is about the card/Review tab, not the History empty state.)

### 5. **P2 (9th audit) — `/auth` sign-in fields still have no `autocomplete` attributes**

- **Severity:** P2 (held; genuine unfixed bug in `main`, not deploy lag)
- **Area:** auth / accessibility
- **What happened (live, desktop `/auth`):** both `#signin-email` and `#signin-password` return `autocomplete = null`. Fields *are* real-labelled (`<label for>` present), so this is narrowly the autofill/password-manager hint. [`20-d-auth.png`](./assets/2026-08-06/20-d-auth.png).
- **Why it matters:** browsers and password managers can't reliably offer credential autofill; WCAG 1.3.5 (Identify Input Purpose) / OWASP ASVS V2.1.9. A returning user under time pressure has to type both fields by hand.
- **Recommended fix:** add `autocomplete="email"` / `autocomplete="current-password"` to the sign-in fields (and `new-password` on sign-up). PR #244 did exactly this but was never merged.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) exists (Backlog) — updated with a fresh reproduction this run, not re-filed.

## Notable live observations (not top-5)

### Positives — shipped this week ✅

- **PREPIO-111 landed live** — logged-in `/new-interview` now reads *"Your interviews › New interview / Prep a new interview / All you need is the company. Add role, CV, or job description below to sharpen the questions."* The marketing hero flagged for 11 audits is gone. [`11-d-new-interview.png`](./assets/2026-08-06/11-d-new-interview.png). Linear PREPIO-111 = Done.
- **PREPIO-88 landed live** — logged-out landing carries a single header CTA *"Sign in or create account"*; duplicate guest-conversion CTAs collapsed. [`01-d-landing.png`](./assets/2026-08-06/01-d-landing.png). Linear PREPIO-88 = Done.

### Positives — holding

- **Landing hero + static example strong** — [`01-d-landing.png`](./assets/2026-08-06/01-d-landing.png). Hero: *"Research-first interview prep / Walk into your next interview knowing exactly what to expect."* Right column *Static example · Stripe · Senior Product Manager* shows 3 real tailored questions each with a *"Why it matters"* rationale (Glassdoor reviews, Stripe values), footer *"Generated from public signals · Glassdoor, LinkedIn, engineering blogs, and company values."* Honest sub-copy *"No resume needed. No account needed for preview."* This carries the funnel while the interactive preview 404s.
- **Skip-to-main works** — first Tab on the logged-out landing lands on `A[href="#main-content"]`. Tenth confirmation.
- **Q1 is a clean question-as-hero** — [`60-m-q1.png`](./assets/2026-08-06/60-m-q1.png): *Q1/10*, timer, *Final Round / Easy* badges, the question in large type, *Recommended — Aim for 1-2 min*, then flags, *Record answer* (primary), *Notes*, *Quick notes*, and *Skip / Save & Continue* pinned at the bottom.
- **Answer save works server-side** — typing an answer and *Save & Continue* → `POST …/rest/v1/practice_answers → 201`. Only the *flag* write is broken.
- **Autosave copy honest (PREPIO-108)** — Q1 shows *"Quick notes / Saved on this device while you practice"* and *"Draft kept in this tab."*
- **Touch targets all ≥44px on mobile Q1** — measured: Back 44×44, Practice-actions 44×44, *Favorite* 112×44, *Needs work* 138×44, *Answer guide* 126×44, *Record answer* 217×48, *Notes* 103×48, *Skip* 173×48, *Save & Continue* 173×48. (Only the 1×1 visually-hidden skip link is sub-44, by design.)
- **Pricing copy honest** — free vs paid split intact; *"…feedback when practice needs a sharper coach."* ([`14-d-pricing.png`](./assets/2026-08-06/14-d-pricing.png)).
- **`/dashboard` logged-out → `/auth`** — protected-route redirect correct.

### Tracked repeats confirmed live

- **Nav still has no "Interviews" item** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress, Urgent) — logged-in nav verbatim: `Prepio · Home · Dashboard · Practice · Practice History · Pricing · Profile`. **12th audit.** `/history`'s *"Go to Dashboard"* CTA (→ `/dashboard` → redirects to `/interviews`) is a component of the same issue.

## Journey scorecard

Rows marked **↑** improved since run #12, **=** unchanged, **↓** worse. Cells marked **(live)** are live-verified this run.

| Area | Run #12 | Run #13 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong; PREPIO-88 collapsed the duplicate CTA; guest preview still 404s seventh week (issue #1). |
| Research entry | 3 | 4 | ↑ | **(live)** PREPIO-111 shipped — `/new-interview` marketing hero replaced by an honest task header + breadcrumb. The one drag on this row is gone. |
| Research progress/loading | — | — | = | Not scored — guest preview 404s and no fresh authenticated research run kicked off (practiced the existing OpenAI SA interview to avoid cost). Tenth owed cycle. |
| Generated output clarity | 4 | 4 | = | **(live)** Q1 (Final Round, Easy) is a clean question-as-hero; 40 questions / 4 stages. |
| Practice mode | 2 | 2 | = | **(live)** Interstitial still gates Q1 (6th wk) and flags still 400 — silently, no toast (issue #2). Save path works (201). Held at the run-#11 low. |
| Mobile usability | 3 | 3 | = | **(live)** Clean question-as-hero, all touch targets ≥44px; undercut by the two silently-broken flag buttons on that same screen. |
| Resume/profile trust | 4 | 4 | = | Not re-audited in depth (tester PII); `/new-interview` shows *"CV added (6,434 chars). Personalizes every question… Last updated 5/17/2026"* — profile memory intact. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (10% vs empty), seventh week. |
| Error/empty states | 2 | 2 | = | **(live)** Guest-preview error banner honest but right column stays silently pre-click; flag failure is silent — no toast (issue #2). Held at low. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main + ≥44px targets confirmed; `aria-pressed` correctly tracks flag state; `autocomplete=null` unfixed (issue #5). Real SR pass still owed. |
| Copy quality | 4 | 4 | = | **(live)** Hero, autosave, pricing, and the new `/new-interview` task-header copy all honest. "Cycle 1 of 3" interstitial still reads as from a different app. |

**Composite trend: +1 net (Research entry 3→4) vs run #12 — the first
score improvement since run #9.** The backend freeze holds the
backend-dependent rows at their lows, but the frontend pipeline shipped two
real fixes and one of them lifts a score.

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero | **FIXED — shipped live** ✅ | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) = Done; task header now renders live. 12-audit finding closed. |
| Duplicate guest-conversion CTAs | **FIXED — shipped live** ✅ | [PREPIO-88](https://linear.app/qiuyue/issue/PREPIO-88) = Done; single header CTA on landing. |
| Production backend frozen at 2026-05-15 | **Still frozen — unchanged from run #12** | 7 pending migrations + 7 undeployed functions, byte-identical `list_migrations`/`list_edge_functions`. **P0.** |
| Guest "Preview my prep" broken | **Still broken — seventh consecutive week** | `research-preview` CORS/404. Part of issue #1. |
| Practice flags broken (`400 / 42P10`) | **Still broken — silent (no toast)** | Every click 400s; `aria-pressed` correctly stays inactive; the toast fix from run #12 never shipped. **P1**, issue #2. |
| Breathing interstitial before Q1 | **Still present — sixth consecutive week** | `main`-branch issue. Issue #3. |
| Interviews counter vs History mismatch | **Still broken — seventh consecutive week** | 10% vs empty. Issue #4. |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) | **12th audit unshipped.** |
| `/auth` autocomplete missing | **Still unfixed in `main`** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | 9th audit. #244 never merged. Issue #5. |
| Save & Continue writes answer (201) | **Holding** ✅ | `practice_answers` POST → 201 this run. |
| Touch targets ≥44px on mobile Q1 | **Holding** ✅ | All 9 measured controls ≥44px. |
| Skip-to-main + landing hero + static example | **Holding** ✅ | Unchanged. |

**Nothing regressed. Two long-standing findings shipped fixes to production
(PREPIO-111, PREPIO-88). The rest of the P0/P1 backlog holds because the
Supabase backend has not been deployed in ~2.8 months.**

## Recommended tickets

Filed to Linear this run (prior runs' "free-issue cap" assumption is
**disproven** — the workspace is actively creating/editing issues and the
create tools work). All land in **Quality & Maintenance** unless noted, with
`Bug` + the matching Area label, cross-linked to this audit. Issues filed:
[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124),
[PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125),
[PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126),
[PREPIO-127](https://linear.app/qiuyue/issue/PREPIO-127); [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) updated.

1. **[[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)] [P0] Deploy the production backend to parity with `main` and add a drift guard.** Reconcile the divergent migration history (`billing_v1`, `security_hardening_and_resume_rpc`) and pre-check for duplicate `(user_id, question_id, flag_type)` rows; then `npm run db:push` (7 pending) and `npm run functions:deploy` (7 missing incl. `research-preview`, `stripe-webhook`, `profile-import`; verify `verify_jwt=false` on `research-preview`). Smoke-test guest preview, a real checkout→`stripe-webhook`→entitlement round-trip, flag toggle (+`aria-pressed`), transcription, and answer feedback. Add a deploy-parity CI/health check. *Type: Bug · area:infra.*
2. **[[PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125)] [P1] Surface a toast when a practice flag write fails** (frontend-only, independent of the deploy). `handleToggleFlag` (`Practice.tsx:1346,1350`) only `console.error`s on a `user_question_flags` write error — show a toast. Optionally guard the flag buttons' hover styling behind `@media (hover: hover)`. *Type: Bug · area:practice.*
3. **[[PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126)] [P1] Remove the breathing interstitial from the default practice start** (opt-in off by default, or invert "Don't show again" + cap the gate at ≤5s and auto-advance). *Type: Bug · area:practice.*
4. **[[PREPIO-127](https://linear.app/qiuyue/issue/PREPIO-127)] [P2] Reconcile the Interviews "practiced" counter with History** — render in-progress sessions as a resume row in `/history` (preferred), or relabel the counter to "answered" with a tooltip. *Type: Bug · area:practice.*
5. **[[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)] [P2] Ship `autocomplete` on `/auth`** — add `email` / `current-password` / `new-password`. PR #244 already implements it. *Existing issue — updated with a fresh reproduction, not re-filed. Type: Improvement · area:auth.*

## Next-run focus

1. **Re-verify the backend deploy** (ticket 1): guest-preview OPTIONS→200 + POST; authenticated *Choose monthly* → Stripe redirect **and** webhook→entitlement update; flag toggle persists and `aria-pressed` flips.
2. **Re-test the flag failure toast** (ticket 2) — a frontend-only change; check it lands even before the deploy.
3. **Budget a real authenticated research run end-to-end** — tenth audit owed. Rotate to a fresh company (Palantir, Amazon).
4. **Real keyboard-only + screen-reader pass** — still owed; pair it with the `aria-pressed` and `autocomplete` checks.
5. **Confirm PREPIO-101 (nav collapse)** — track whether the "Interviews" nav item + Dashboard→Plan rename ships.

`Capability: live browser verified`
