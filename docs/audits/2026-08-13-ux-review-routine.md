# Prepio UI/UX Review — 2026-08-13 (recurring routine, run #15)

Fifteenth run of the recurring weekly UX-review routine. Baselines:
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
[`2026-08-02`](./2026-08-02-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-09`](./2026-08-09-ux-review-routine.md).

> Numbering note: both the `2026-08-06` and `2026-08-09` docs are headed "run #13"
> — a slip in the earlier docs. Counting the fourteen baselines above, the true
> sequence is `2026-08-06` = #13 and `2026-08-09` = #14 (mislabelled #13), so this
> run is **#15**. Scorecard columns below reference the prior run by date
> (`2026-08-09`) rather than number to avoid inheriting that ambiguity.

## Capability check — live browser verified

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` still required; standing gotcha).
- **Live-app reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the standing workarounds (`--ssl-version-max=tls1.2`,
  `--ignore-certificate-errors`, explicit `proxy.server` from `HTTPS_PROXY`).

Coverage this run: logged-out landing + guest-preview POST (Anthropic / Product
Manager, desktop 1440×900); `/auth` autocomplete probe + real login; logged-in
`/interviews`, `/history`, `/profile`, `/dashboard` redirect, `/pricing`,
`/new-interview` (desktop); full mobile practice flow *Continue practice → Q1*
with a live flag-toggle network+toast probe, a real answer save (Q1→Q2), and a
touch-target sweep (mobile 390×844, `isMobile`+`hasTouch`); logged-out landing
keyboard tab-order pass. **Backend deploy state directly probed this run** — the
Supabase `list_migrations`/`list_edge_functions` MCP tools were **not available**
(only `query_logs`, which returned backend errors on every filtered query), so in
their place each edge function was hit with a CORS **OPTIONS preflight** (200/204 =
deployed, 404 = not deployed; preflight only, no business logic invoked, no cost).
The raw `curl -i` output distinguishes a *gateway* absence from a handler-level
404: deployed functions return `200` with an `x-deno-execution-id` header (the
Deno handler ran), while the 7 undeployed ones return `404` with
`sb-error-code: NOT_FOUND`, body `{"code":"NOT_FOUND","message":"Requested
function was not found"}`, and **no** `x-deno-execution-id` — i.e. the Supabase
gateway reports the function absent, which rules out a deployed-but-OPTIONS-404
handler.
Results in [`edge-function-options-probe.txt`](./assets/2026-08-13/edge-function-options-probe.txt):
**5 deployed** (`interview-research`, `company-research`, `cv-analysis`,
`job-analysis`, `interview-question-generator` → 200) and **7 undeployed**
(`research-preview`, `answer-feedback`, `create-checkout-session`,
`create-portal-session`, `practice-audio-transcribe`, `profile-import`,
`stripe-webhook` → 404) — exactly the split the 2026-08-09 run read from a direct
`list_edge_functions`. The *migration* layer is verified only for
`20260710203000` (via the live `42P10` on the flag write); the other pending
migrations were not directly listed this run. Screenshots under
[`assets/2026-08-13/`](./assets/2026-08-13/).

## Overall product judgment

**The strongest forward-motion week this routine has recorded in months —
three tracked findings shipped and verified live — but the P0 backend deploy is
still frozen at 2026-05-15, now the eighth consecutive week.** The headline is
that the **breathing interstitial is gone**: *Continue practice* now drops
straight to Q1 with no timed meditation gate ([PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126),
Done, PR #280) — closing the run-#13 P1 that had repeated for six weeks. Combined
with one-tap *Continue practice* ([PREPIO-105](https://linear.app/qiuyue/issue/PREPIO-105)),
practice is now a **single tap from the interview card to the first question**.
Two more shipped and live-verified: the flag-failure toast copy is tightened to
*"Couldn't save your Needs work flag / Try again in a moment."*
([PREPIO-136](https://linear.app/qiuyue/issue/PREPIO-136), Done, PR #288 —
drops "Something went wrong," names only the toggled flag), and the
`/new-interview` marketing-hero regression is finally resolved in production —
it now shows a proper *"Prep a new interview"* task header with a
*"Your interviews › New interview"* breadcrumb ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)).
Profile also reframes completeness as a next action (*"Next: Add your most
recent role — Research positions you against real experience, not role norms"*,
[PREPIO-59](https://linear.app/qiuyue/issue/PREPIO-59), live).

**But the underlying backend is unchanged.** Guest "Preview my prep" still
`research-preview` CORS/404s (**8th consecutive week**), the practice flag write
still `400 / 42P10`s on every tap (migration `20260710203000` unapplied — the
honest toast fires but nothing persists), and the checkout functions remain
undeployed. The frontend team is now clearly outpacing the deploy pipeline —
four user-facing fixes landed in two weeks while the one blocking infra step
sits in Backlog. The highest-value action is unchanged and now overdue: **one
attended backend deploy** recovers guest conversion, monetization,
transcription, answer feedback, and the practice flag write at once.

## Top 5 issues

### 1. **P0 (carried, 8th week) — Production backend still frozen at 2026-05-15**

- **Severity:** P0 (breaks guest conversion, monetization, and the practice flag write simultaneously; drift now ~3 months)
- **Area:** infra / deployment (fans out to landing, billing, practice)
- **What happened (live this run):**
  - **Guest preview** (`/`, desktop): filled *Anthropic / Product Manager* → *Preview my prep* → console `Access to fetch at '…/functions/v1/research-preview' … blocked by CORS policy … does not have HTTP ok status` + `Error creating research preview: FunctionsFetchError`; red banner *"We couldn't build the preview. Try again, or sign in to run the full research workflow."*; right column stays on its pre-click *"Your Anthropic preview will appear here."* [`03-d-guest-result.png`](./assets/2026-08-13/03-d-guest-result.png). **Eighth consecutive week.**
  - **Practice flag write** (mobile, Q1): every *Favorite* / *Needs work* tap → `POST …/rest/v1/user_question_flags?on_conflict=user_id,question_id,flag_type → 400` with console `code: 42P10, message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"`. The `(user_id, question_id, flag_type)` unique key from migration `20260710203000` is still unapplied in prod.
  - **Paid checkout**: `create-checkout-session` and `stripe-webhook` both return **404 on an OPTIONS preflight** this run — directly confirmed undeployed (no authed checkout triggered, so no cost/side effect). `create-portal-session`, `answer-feedback`, `practice-audio-transcribe`, and `profile-import` are also 404. See [`edge-function-options-probe.txt`](./assets/2026-08-13/edge-function-options-probe.txt).
- **Note on evidence (scope of the verdict):** the direct `list_migrations`/`list_edge_functions` tools were unavailable this run, so this verdict is built from what was actually probed, not assumed:
  - **Directly verified this run:** the *edge-function* layer — a CORS OPTIONS preflight to all 12 functions returned **5 × 200 (deployed, `x-deno-execution-id` present)** and **7 × 404 (undeployed, gateway `sb-error-code: NOT_FOUND` / no handler)**, matching the 2026-08-09 direct listing exactly. The gateway signature rules out a deployed-but-OPTIONS-404 handler. And migration `20260710203000` is unapplied (live `42P10`).
  - **Not re-verified this run (carried from 2026-08-09's direct listing):** the state of the other 6 pending migrations, i.e. whether any migration *other than* `20260710203000` landed. A partial migration deploy that left `20260710203000` off would produce the same `42P10`; the function-layer probe rules out a partial *function* deploy, but not a partial *migration* deploy.
  - Net: the "frozen" characterization is solid for the function layer and for the flag-write migration; treat the full 7-migration freeze as carried-forward until a direct `list_migrations` diff is available again.
- **Why it matters:** the two growth-and-revenue funnels (guest→signup, free→paid) plus a core practice action are all still dead in production, for the eighth week, while four *frontend* fixes shipped around it. The deploy step is the sole bottleneck.
- **Recommended fix (maintainer, attended):** (a) reconcile the divergent migration history and pre-check for duplicate `(user_id, question_id, flag_type)` rows before applying `20260710203000`; (b) `npm run db:push`; (c) `npm run functions:deploy` (verify `verify_jwt` intent on `research-preview`); (d) smoke-test each recovered surface incl. a real checkout→`stripe-webhook`→entitlement round-trip; (e) add a deploy-parity/health check so drift can't silently persist again.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Backlog). Updated this run with the 8th-week re-verification.
- **Not performed by the review job** — cost-incurring, guest-facing, unattended.

### 2. **P1 (carried) — Practice Favorite/Needs-work write still `400 / 42P10`; the failure is honest, but the flag never persists**

- **Severity:** P1 (a labeled core action still fails and persists nothing; user-harm reduced because the failure is now visible)
- **Area:** practice
- **What happened (live, mobile 390×844, Q1 "How do you prioritize which AI features to implement given multiple stakeholders' inputs?"):** *Favorite* then *Needs work* each produced a `400 / 42P10`. `aria-pressed` correctly stayed `false→false` for both. The now-tightened toast fires: *"Couldn't save your Needs work flag / Try again in a moment."* [`62-m-flag-needswork.png`](./assets/2026-08-13/62-m-flag-needswork.png).
- **Root cause (unchanged):** `user_question_flags` still carries the old `UNIQUE (user_id, question_id)`; migration `20260710203000_question_flags_per_type` is one of issue #1's unapplied migrations.
- **Why it matters:** a user who taps *Needs work* still cannot mark a question for another pass — the curation write only recovers via issue #1's deploy. This is the second user-facing action gated purely on the deploy.
- **Tracking:** the toast (PREPIO-125) and its copy (PREPIO-136) are both Done + live-verified; the write recovery is [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (issue #1).

### 3. **REPEAT P2 — `/history` still shows the empty state while the interview card shows an in-progress session**

- **Severity:** P2 (now the most prominent *frontend* gap in the core loop, since the interstitial P1 is resolved)
- **Area:** history / dashboard
- **What happened (live, desktop):** the `/interviews` card reads *"OpenAI · Solutions Architect · 6 of 40 answered · 15%"*, but `/history` renders *"Ready to start practicing / Your first practice session will appear here…"* [`32-d-history.png`](./assets/2026-08-13/32-d-history.png). History still surfaces only *completed* sessions, so the in-progress session is invisible there.
- **Why it matters:** the two surfaces disagree about whether the user has practiced. A returning user who opens History to resume sees "nothing here" and has to route back through the interview card's *Continue practice* — the only working resume affordance.
- **Recommended fix:** render an *"In progress · resume"* row in `/history` (and/or the needs-work/progress line on the interview card) sourced from the same data the counter uses.
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) / [PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99) (In Progress). No new issue needed.

### 4. **REPEAT P2 (10th audit) — `/auth` sign-in fields still have no `autocomplete` attributes**

- **Severity:** P2 (held; genuine unfixed bug in `main`, not deploy lag)
- **Area:** auth / accessibility
- **What happened (live, desktop `/auth`):** both `#signin-email` and `#signin-password` return `autocomplete = null` (measured directly this run). Fields *are* real-labelled and login works, so this is narrowly the autofill/password-manager hint. [`20-d-auth.png`](./assets/2026-08-13/20-d-auth.png).
- **Why it matters:** browsers and password managers can't reliably offer credential autofill; WCAG 1.3.5 (Identify Input Purpose) / OWASP ASVS V2.1.9. A returning user under time pressure types both fields by hand.
- **Recommended fix:** add `autocomplete="email"` / `autocomplete="current-password"` to the sign-in fields (and `new-password` on sign-up). PR #244 already implements this but was never merged.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog). Updated this run.

### 5. **REPEAT P2/P3 (13th audit) — Nav has no "Interviews" item and `/dashboard` silently redirects to it**

- **Severity:** P3 (long-running IA gap; the flows still work, they just don't match the model)
- **Area:** navigation / IA
- **What happened (live):** logged-in nav reads `Prepio · Home · Dashboard · Practice · Practice History · Pricing · Profile` — no "Interviews" item, even though `/interviews` is the signed-in home. `/dashboard` redirects to `/interviews`, and `/history`'s "Go to Dashboard" CTA points at the redirecting `/dashboard`. [`31-d-interviews.png`](./assets/2026-08-13/31-d-interviews.png).
- **Why it matters:** the primary object of the app (an interview) has no nav destination named after it; "Dashboard" is a stale label for a page that no longer exists as such.
- **Recommended fix:** the full [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) restructure (collapse nav to *Interviews* + account menu, add a Plan/Practice/Review header, rename Dashboard → Plan).
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) (Urgent, In Progress, parent [PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99)). Updated this run.

## Notable live observations (not top-5)

### Positives — new & shipped this run

- **NEW — [PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126) shipped & live:** *Continue practice* → **Q1 directly**, no breathing interstitial. Verified live on mobile — the flow lands on *"Q1/10 · Technical Round · Medium"* with no `Cycle N of` / `Hold…` / `Don't show again` gate. [`50-m-after-continue.png`](./assets/2026-08-13/50-m-after-continue.png). Closes the 2026-08-09 run's issue #3 (a 6-week repeat P1).
- **NEW — [PREPIO-136](https://linear.app/qiuyue/issue/PREPIO-136) shipped & live:** flag-failure toast now reads *"Couldn't save your Needs work flag / Try again in a moment."* — names only the toggled flag, drops "Something went wrong." Closes the 2026-08-09 run's issue #5. [`62-m-flag-needswork.png`](./assets/2026-08-13/62-m-flag-needswork.png).
- **NEW — [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) deploy-verified:** `/new-interview` shows *"Prep a new interview / All you need is the company…"* with a *"Your interviews › New interview"* breadcrumb, the active resume version (*"CV added (6,434 chars)"*), role/JD and research-notes fields, and *Start Research*. The marketing hero that repeated for 11 audits is gone in production. (Screenshot omitted — it rendered production CV data.)
- **NEW — [PREPIO-59](https://linear.app/qiuyue/issue/PREPIO-59) live:** `/profile` reframes completeness as a next action — *"Profile completeness 20% · Next: Add your most recent role · Research positions you against real experience, not role norms."* (Screenshot omitted — the profile page rendered production CV data.)

### Positives — holding

- **Landing hero + static example** unchanged and strong — *"Research-first interview prep / Walk into your next interview knowing exactly what to expect."* + *"Stripe · Senior Product Manager"* static example with stage/difficulty/why-it-matters, and honest sub-copy *"No resume needed. No account needed for preview."* [`01-d-landing.png`](./assets/2026-08-13/01-d-landing.png).
- **Q1 is a clean question-as-hero** — timer, *Technical Round / Medium* badges, question in large type, *Recommended — Aim for 1-2 min*, flags, *Record answer* (primary), *Notes*, *Quick notes*, *Skip / Save & Continue*.
- **Answer save works** — typing an answer + *Save & Continue* advanced Q1→Q2 with no console/network error. (Server `201` not directly captured this run — the harness only logs ≥400 — but the advance confirms the save path.)
- **Touch targets ≥44px on mobile Q1** — *Favorite* 112×44, *Needs work* 138×44, *Answer guide* 126×44, *Record answer* 217×48, *Notes* 103×48, *Save & Continue* 173×48. (*Skip* measured 1×1 — a detached-element measurement artifact after the save advanced the question, not a real regression; it rendered full-width in the earlier screenshot.)
- **Autosave copy honest** — *"Quick notes / Saved on this device while you practice"*, *"Draft kept in this tab"*, flips to *"Saving draft…"* on save.
- **Skip-to-main + landing tab order healthy** — first Tab lands on `A[href="#main-content"]`; tab order is skip-link → logo → Pricing → Sign in → guest-company → guest-role, matching visual order.
- **Pricing copy honest** — three cadences (monthly/quarterly/annual); *"Research, prep plans, and practice stay free. Paid subscriptions unlock AI feedback on saved practice answers…"* [`35-d-pricing.png`](./assets/2026-08-13/35-d-pricing.png).
- **`/dashboard` logged-out → `/auth`** with redirect context; profile memory intact (*"Current source: &lt;résumé filename&gt;"* — the parsed résumé, filename redacted — plus the Free-plan block).

### Lower-confidence observation (carried, not re-filed)

- On mobile, tapping *Needs work* leaves the button in a **filled dark-green state** while the failure toast shows — visually reading as "selected" even though the write failed. `aria-pressed` correctly stays `false`, and run #12 explicitly **corrected an earlier draft** that mis-read this fill as an optimistic-state bug (it is the tap's `:active`/`:focus` styling, which sticks post-tap on touch with no hover-off). Noting it again only because the sticky fill + red "couldn't save" toast is a mildly contradictory pairing on touch; not filed as a new issue pending a CSS-level confirmation that focus styling ≠ selected styling.

## Journey scorecard

Rows marked **↑** improved since the 2026-08-09 run, **=** unchanged. Cells marked **(live)** are live-verified this run.

| Area | 2026-08-09 | 2026-08-13 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong; guest preview broken 8th week (issue #1). |
| Research entry | 3 | 4 | ↑ | **(live)** `/new-interview` task header + breadcrumb + CV context now live (PREPIO-111 deploy-verified); rich, honest form. Guest preview still 404s. |
| Research progress/loading | — | — | = | Not scored — guest preview 404s and no cost-incurring authed run kicked off. Eleventh owed cycle (PREPIO-40 async-research UI unverified). |
| Generated output clarity | 4 | 4 | = | **(live)** Q1 (Technical Round, Medium) is a clean question-as-hero; 40 questions / 4 stages. |
| Practice mode | 3 | 4 | ↑ | **(live)** Breathing gate removed (PREPIO-126) — one tap card→Q1; save advances Q1→Q2; flag write still 400s but honest via toast. Up one on the interstitial removal. |
| Mobile usability | 3 | 4 | ↑ | **(live)** One-tap to Q1, clean question-as-hero, all touch targets ≥44px. Up one. |
| Resume/profile trust | 4 | 4 | = | **(live)** Completeness reframed as next action (PREPIO-59); CV source + Free-plan block intact. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter honest + one-tap Continue practice, but History still empty for the in-progress session (issue #3). |
| Error/empty states | 3 | 3 | = | **(live)** Flag toast honest + tightened (PREPIO-136); guest-preview banner honest; History empty-vs-active still weak. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main + tab order + ≥44px confirmed; `aria-pressed` tracks flag state; `autocomplete=null` unfixed (issue #4, 10th audit). Real SR pass still owed. |
| Copy quality | 4 | 4 | = | **(live)** Toast copy fixed, off-key "Cycle 1 of 3" interstitial gone, landing/pricing/autosave honest. |

**Composite trend: +3 vs the 2026-08-09 run (Research entry 3→4, Practice 3→4, Mobile 3→4)** — the best single-run lift the routine has measured. The scores on the practice rows are capped below 5 only because the flag *write* and guest preview remain gated on the issue-#1 deploy.

## Regression check

| Item | State | Note |
|------|-------|------|
| Breathing interstitial before Q1 | **FIXED** ✅ | [PREPIO-126](https://linear.app/qiuyue/issue/PREPIO-126) Done (PR #280); *Continue practice* → Q1 directly, live-verified. |
| Flag-failure toast copy ("Something went wrong" + both flags) | **FIXED** ✅ | [PREPIO-136](https://linear.app/qiuyue/issue/PREPIO-136) Done (PR #288); now *"Couldn't save your Needs work flag / Try again in a moment."* |
| `/new-interview` marketing hero | **FIXED (deploy-verified)** ✅ | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111); task header + breadcrumb live. |
| Profile completeness as next action | **SHIPPED** ✅ | [PREPIO-59](https://linear.app/qiuyue/issue/PREPIO-59) live. |
| Production backend frozen at 2026-05-15 | **Still frozen — 8th week** | Guest preview `research-preview` CORS/404 + flag write `400/42P10`. **P0**, [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124). |
| Practice flag write broken (`400 / 42P10`) | **Still broken — honest via toast** | Every tap 400s; write recovery needs the deploy. |
| `/history` empty vs in-progress card | **Still open** | Card 15% vs History "your first session will appear here." [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)/[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99). |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open — 13th audit** | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress. |
| `/auth` autocomplete missing | **Still unfixed — 10th audit** | [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123). #244 never merged. |
| Save & Continue advances Q1→Q2 | **Holding** ✅ | No console/network error; question advanced. |
| Touch targets ≥44px on mobile Q1 | **Holding** ✅ | All measured controls ≥44px. |
| Skip-to-main + landing hero + tab order | **Holding** ✅ | Unchanged. |

**Net: three tracked findings shipped to production this run (PREPIO-126, -136,
and PREPIO-111 deploy-verified), plus PREPIO-59 live — no new regressions. The
dominant unresolved fact is still the P0 backend deploy, un-landed for ~3 months,
so guest preview and the flag write remain honest but non-functional.**

## Recommended tickets

Every top finding is already tracked; this run **updates** existing issues
rather than filing new ones.

1. **[P0] Deploy the production backend to parity with `main` and add a drift guard** → **Update [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (8th-week re-verification; now the sole blocker while four frontend fixes shipped around it — consider bumping visibility).
2. **[P1] Flag write recovery** rides on ticket 1 (the toast half is Done via PREPIO-125/136). No separate issue.
3. **[P2] Surface in-progress sessions in `/history`** → tracked under [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) / [PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99); no new issue.
4. **[P2] Ship `autocomplete` on `/auth`** — PR #244 already implements it → **Update [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (still `null` live, 10th audit).
5. **[P3] Nav "Interviews" item + Dashboard→Plan** → **Update [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)** (13th audit).

## Next-run focus

1. **Re-verify the backend deploy** ([PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)) — guest-preview OPTIONS→200 + POST; authed *Choose monthly* → Stripe redirect + webhook→entitlement; flag toggle persists, `aria-pressed` flips, and the toast *stops* firing. Use the `list_migrations`/`list_edge_functions` tools if they're back.
2. **Budget a real authenticated research run end-to-end** — 11th owed cycle, and now doubly worth it to exercise the new **PREPIO-40 async background-job** research UI (progress/loading states unverified). Rotate to a fresh company (Palantir, Amazon, Vitol).
3. **Real keyboard-only + screen-reader pass** — still owed; pair with the `aria-pressed`, `autocomplete`, and focus-visibility checks.

`Capability: live browser verified`
