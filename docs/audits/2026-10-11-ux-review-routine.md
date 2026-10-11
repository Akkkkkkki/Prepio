# Prepio UI/UX Review — 2026-10-11 (recurring routine, run #21)

Twenty-first run of the recurring UX-review routine. Baselines:
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md),
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20, the immediate baseline).

## Capability check — PARTIAL LIVE (logged-out surface live; authenticated surface static)

- **Playwright Chromium: PASS.** The pre-installed browser is build 1194 while the pinned
  Playwright driver expects 1228, so the bundled `chrome-headless-shell` is absent. Worked around
  by launching the headful binary directly: `executablePath: "/opt/pw-browsers/chromium"`,
  `headless: true`. **Carry this forward** — a default `chromium.launch()` fails with
  *"Executable doesn't exist … chrome-headless-shell-1228"*.
- **Egress to the app: PASS via the standard agent proxy.** Chromium was pointed straight at
  `$HTTPS_PROXY` (`proxy: { server: HTTPS_PROXY }`); the browser NSS store already trusts the proxy
  CA (`/root/.ccr/ca-bundle.crt`), so no TLS shim was needed this run. (Prior runs' MITM-shim
  workaround is no longer required and should not be reintroduced — re-wrapping the egress proxy is
  flagged as a containment escape in this environment.)
- **Frontend (Vercel): PASS** — `curl … /` → `200`; Chromium load → `200`, title
  *"Prepio - Interview Prep Tool"* on desktop (1440×900) and mobile (390×844).
- **Backend (Supabase): NOT exercised, by policy.** The authenticated research→practice loop was
  **not** logged into this run. The only tester credentials on hand are the historical
  `test@test.com` account, which [FREEZE_RELEASE.md §1 / PREPIO-168](../FREEZE_RELEASE.md) marks as
  an **exposed credential to rotate** and explicitly says *"Do not try the exposed password."* A
  scheduled, unattended run is not fresh consent to use it, so the authenticated surface
  (practice, flag write, `/history` with data, `/profile`) is a **static code review** this week.
  All future acceptance must use synthetic invited accounts (PREPIO-30).

**Live-verified this run (logged-out only):** landing (desktop + mobile), the guest "View sample
plan" expansion **and its network trace**, `/auth` (invite-only state + autocomplete + input
labels), and the old `/pricing` / `/profile` routes. Screenshots under
[`assets/2026-10-11/`](./assets/2026-10-11/). No CV-bearing surface was opened, so no PII-redaction
step was needed (routine contract §"Captured evidence must not leak PII").

## The headline: the frozen-surface lock has landed — run #20's standing P0 is closed, live

Five weeks and ~20 commits since run #20. Two of them reframe this entire report:

1. **`9d9b711` / #354 — "lock Prepio to the invite-only frozen core" (PREPIO-27).** This is the
   surface-lock that every prior review treated as the standing P0. It adds a static
   `GuestSample.tsx` (no API/provider/clock/user input), a hard non-overridable
   `src/lib/frozenProduct.ts` flag set (`billing/answerFeedback/voice/profile/resumeUpload = false`),
   strips the guest `research-preview` network path and the public sign-up tab, and unroutes
   billing/profile.
2. **`bccb67c` / #360 — "close freeze gaps found by the final audit and UX reviews."** Adds
   `autocomplete` hints to the auth inputs, fixes an invite/recovery-link hardening regression #354
   introduced, removes copy pointing at frozen voice/upload features, rewrites the `/history`
   empty state, and redacts a provider-text log.

**Every top *frontend* finding from run #20 is now resolved, and the three that are observable
logged-out were confirmed live this run.** What remains open is the single **backend** item
(flag-write `42P10`), which is a deploy gate, not a code gap — see below.

### Guest surface makes zero backend calls — live-confirmed (the PREPIO-27 acceptance criterion)

Across the full logged-out sweep (landing → open sample → `/auth` → `/pricing` → `/profile`, both
breakpoints), **102 requests were captured and not one hit an Edge Function, Supabase, OpenAI,
Tavily, Stripe, or the removed `research-preview`/`answer-feedback`/`create-checkout` paths.** The
guest sample is a hand-written fictional plan rendered entirely client-side. This is exactly the
"a guest action must make no Edge Function / OpenAI / Tavily call" requirement that run #20 (and
every run before it) flagged as unmet. It is met.

## Overall product judgment

**This is the best state the logged-out product has been in across this review's history, and the
most honest.** The four-month tension — half the app pointed at undeployed functions, a guest CTA
that failed with a CORS error and *blanked* the page's best asset, a `/pricing` page selling a
checkout that 404'd — is gone. A logged-out visitor now lands on a single clear `<h1>` ("Prepare
for your next interview"), an honest "Free · Invite-only" frame, and a one-click **static** sample
that explicitly says *"These are practice prompts, not verified questions from a particular
employer. No live research runs when you open this sample."* `/auth` is invite-only with proper
autocomplete; the dead billing/profile routes now 404 cleanly. The one genuine **regression risk**
is not a bug but a wedge tradeoff: the pre-freeze static example named a real company (Stripe) with
company-specific questions, whereas the frozen sample is deliberately generic ("Payments company ·
Product Manager"). It proves *structure* honestly but no longer proves *company-specific
personalization* — the product's core differentiator — to a first-timer, and it is collapsed behind
a button by default. That is the right call under the freeze (don't imply verified employer data
that isn't there), but it is the thing to re-strengthen the moment the freeze lifts. The only
carried defect is the **Favorite / Needs-work flag write (`42P10`)**, which is a one-migration
backend deploy already written and authorized for the freeze window (PREPIO-170), still unapplied
because the attended production deploy (PREPIO-124) has not run.

## Top issues

Only one defect-class issue is still open; the rest of this list records the run #20 items now
**closed** (with live evidence where observable) plus two freeze-tradeoff notes, so the trend is
legible against the baseline.

### 1. **P1 (carried, NOT re-verified this run) — Favorite / Needs-work flag write returns `400 / 42P10` until the freeze migration is applied**

- **Severity:** P1 — a core practice triage affordance; 100% failure when exercised (last live-seen run #20).
- **Area:** practice (backend deploy gate)
- **Status this run:** **not re-exercised** — requires an authenticated session, and the only
  credential available is the exposed one the security gate forbids using. Confirmed still-pending
  by code + release state, not by a live probe.
- **What's true in code:** the upsert still targets `onConflict: 'user_id,question_id,flag_type'`
  (`src/services/searchService.ts:1762`); the fixing migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` is present in the repo but,
  per [FREEZE_RELEASE.md](../FREEZE_RELEASE.md) ("Live baseline checked 2026-09-21"),
  `user_question_flags` in production still carries `UNIQUE(user_id, question_id)`, not the
  three-column key. So the `42P10` path is unchanged in production.
- **Why it matters:** a visible, promised control that never persists erodes trust in whether
  anything persists. (Text-answer save was `201` last time it was exercised — the gap is specific.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` inside the PREPIO-124
  freeze window (pre-check/dedupe conflicting rows first), then verify all three flag entry points
  persist across a reload on desktop and mobile with a **synthetic** invited account.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo) —
  gated behind [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (attended deploy).

### 2. **CLOSED — Frozen guest/billing/auth surface lock (was run #20 P0 #1)** ✅ live-confirmed

- Guest sample is static with **zero** backend calls (network trace above); `/auth` has **no public
  Sign Up tab** (`"Sign Up" present: false`, both breakpoints); `/pricing` and `/profile` return the
  **404** page ("Oops! Page not found / Return to Home") instead of live checkout/profile controls.
  Landed in #354. → [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27).

### 3. **CLOSED — `/auth` autocomplete attributes (was run #20 P2 #3, a 15-audit repeat)** ✅ live-confirmed

- `#signin-email` → `autocomplete="email"`, `#signin-password` → `autocomplete="current-password"`,
  each with one associated `<label>`. Measured directly this run on desktop and mobile. Landed in
  #360. → [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123).

### 4. **CLOSED (copy) — `/history` empty state (was run #20 P3 #4)** ✅ code-confirmed

- Now reads *"No finished sessions yet / Finished practice sessions appear here with answers,
  timing, and notes. Answers you save in an unfinished session stay on that interview in Your
  interviews."* with two CTAs (`src/pages/History.tsx:316`). Directly resolves the "empty despite
  real in-progress work" disconnect. Landed in #360. Not re-verified with live data (no login).
  → [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (still open for the richer
  in-progress-surfacing direction).

### 5. **P3 (note, carried) — Generic guest sample under-sells personalization; sample collapsed by default**

- **Area:** landing / first-time understanding
- **What happened (live):** the sample names "Payments company · Product Manager", not a real
  company, and is hidden behind **View sample plan** by default — a 30-second first-timer sees only
  the hero + one button. The questions themselves are strong and well-structured (stage label +
  question + focus), but nothing on the default view demonstrates *company-and-role-specific* output.
- **Why it matters:** "show personalization, don't just claim it" is a stated review principle and
  the core wedge vs. a generic ChatGPT prompt. The generic sample is the **correct** freeze choice
  (no implying verified employer data) — this is a note for the freeze-exit landing pass, not a
  freeze-window fix.
- **Recommended fix (post-freeze):** when real research is live again, make the default landing
  example show one concrete company-specific question, or expand the sample by default.
- **Tracking:** below the >30-min threshold during freeze; folded into the PREPIO-27 landing
  direction for freeze exit.

### 6. **P3 (a11y, carried) — A few sub-44px touch targets on landing/auth chrome**

- **What happened (live, 390×844):** nav **Sign in** 71×36, **Forgot password** 308×36, **Resend
  verification** 308×36 are under the 44px comfort baseline. The **primary** CTAs are now fine —
  **View sample plan** 149×**44**, auth **Sign In** 308×**44** (an improvement over run #20, where
  the landing CTAs were 36px). WCAG 2.5.8 AA (24px) passes throughout; this is the external 44px
  ergonomic recommendation only.
- **Recommended fix:** bump the secondary/nav controls to ≥44px min-height. Cosmetic; below the
  ticketing threshold, flagged into the freeze-exit landing pass.

## Journey scorecard

Scores for **live-observed** rows reflect this run; authenticated rows marked **(static)** are
code-confirmed against #354/#360 and **not** re-exercised (no login). The movers are all the
freeze-lock landing.

| Area | 2026-09-03 | 2026-10-11 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | **4** | ▲ | **(live)** Clear `<h1>`, honest "Free · Invite-only" frame, static sample makes **zero** backend calls and no longer blanks on a failed CTA. Held below 5 only by the generic sample / collapsed-by-default under-selling personalization (note #5). |
| Research entry | 4 | 4 | = | **(static)** Authenticated research form unchanged in code; not exercised. |
| Research progress/loading | 5 | 5 | = | **(static)** Async modal unchanged in code; not re-triggered. |
| Generated output clarity | 5 | 5 | = | **(static)** Plan/stage/question + answer-guide structure unchanged. Guest sample mirrors the structure cleanly. |
| Practice mode | 4 | 4 | = | **(static)** Question-as-`<h1>` and text-save held from #329; Favorite/Needs-work still blocked by the `42P10` deploy gate (#1). HintBanner no longer promises voice (#360). |
| Mobile usability | 4 | 4 | = | **(live, logged-out)** Landing/sample/auth reflow cleanly at 390px, no overflow; primary CTAs now ≥44px. A few secondary targets still 36px (#6). |
| Resume/profile trust | 4 | 4 | = | **(static)** `/profile` is unrouted (404) under the freeze by design; resume upload frozen. Not a trust regression. |
| Dashboard/history/resume | 3 | 3 | = | **(static)** `/history` copy now honest about finished-vs-unfinished (#360); the richer in-progress-surfacing (PREPIO-107) is still open. |
| Error/empty states | 4 | **5** | ▲ | **(live)** Dead routes 404 cleanly; guest sample carries an honest "not verified questions / no live research" disclaimer; history empty state now guides to where unfinished answers live. The guest-preview blanking that held this at 4 is gone. |
| Accessibility | 4 | 4 | = | **(live)** Autocomplete now present on sign-in (#3 closed); focus rings + skip link intact; landing `<h1>` present. Remaining: a few sub-44px secondary targets (#6). Held at 4 (not 5) pending an authenticated keyboard/SR pass, which needs a synthetic login. |
| Copy quality | 4 | **5** | ▲ | **(live + code)** Copy no longer promises any frozen feature — voice line removed from HintBanner, offline-research alert no longer promises local parsing, history/guest copy honest and specific. |

**Composite: up ~4 points (First-time +1, Error/empty +1, Copy +1), zero regressions.** The frozen
logged-out product is now strong and honest end-to-end; the remaining ceiling is behind the login
(the flag-write deploy gate and an authenticated a11y pass), both of which need the attended freeze
deploy and a synthetic account.

## Regression check

Since run #20: #354, #360, #357 (routing test), plus security/dep chores (#350 pdfjs 6, #353
react-router 7, #337 search ownership, #344/#340/#335/#333 log redaction & classification). **All
user-facing movement is improvement; no code regressions survive to `main`.** #360 explicitly fixed
the only two regressions #354 briefly introduced (an invite/recovery link that could show a
password form for the wrong session; a set-state-in-effect lint error) before this run.

| Item | State | Note |
|------|-------|------|
| Guest surface (static, zero backend calls) | **Fixed** ✅ | Live-confirmed 102 reqs, none to backend. (was P0 — #354) |
| `/pricing` / `/profile` dead routes | **Fixed** ✅ | Now 404; live checkout CTAs gone. (was P0 — #354) |
| Public sign-up on `/auth` | **Fixed** ✅ | Invite-only; no Sign Up tab. (was P0 — #354) |
| `/auth` autocomplete | **Fixed** ✅ | email / current-password present, live. (was P2, 15-audit repeat — #360) |
| `/history` empty-state honesty | **Fixed** ✅ | Finished-vs-unfinished copy. (was P3 — #360) |
| Copy promising frozen features | **Fixed** ✅ | Voice/upload promises removed. (#360) |
| Landing primary CTA touch targets | **Improved** ✅ | 36px → 44px. (was part of P3 #5) |
| Favorite/Needs-work flag write | **Still open** ⚠️ | `42P10`; backend migration written, unapplied in prod. (P1 #1, PREPIO-170/124) |
| Secondary landing/auth touch targets | **Still minor** ⚠️ | A few 36px controls. (P3 #6) |
| Guest sample personalization punch | **Freeze tradeoff** ⚠️ | Generic + collapsed by default. (P3 #5, freeze-exit) |

## Recommended tickets

**No new issue is filed this run** — consistent with the freeze posture
([CLAUDE.md](../../CLAUDE.md): *"Pause maintenance work; only security incidents and critical
breakages reopen it"*; *"Do not add features, recurring audits or routine dependency PRs"*) and with
run #20's precedent. Every finding maps to an existing open issue or is an intentional freeze
tradeoff below the >30-min threshold:

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the attended freeze window so the
   flag upsert stops returning `42P10`. → [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)
   (gated behind [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)).
2. **[closed, verify in prod] Surface lock, autocomplete, history copy** landed in #354/#360;
   confirm them again in the PREPIO-30 production acceptance pass with synthetic accounts. →
   [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27),
   [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123),
   [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107).
3. **[P3, freeze-exit] Re-strengthen the landing example** (company-specific, expanded by default)
   and bump secondary touch targets to ≥44px — fold into the PREPIO-27 landing direction when the
   freeze lifts. Not a freeze-window change.

### Deferred items (per CLAUDE.md hygiene convention)

- No new Linear issues filed. The two P3 notes (#5 generic sample, #6 secondary touch targets) are
  below the >30-min ticketing threshold and are flagged into the existing PREPIO-27 landing
  direction for freeze exit, not tracked separately.
- The authenticated flag-write verification and an authenticated keyboard/screen-reader pass are
  **owed to the PREPIO-30 production acceptance run** with synthetic invited accounts, not to this
  weekly routine (which must not use the exposed credential).

---

Capability: live browser verified (logged-out surface); authenticated surface static code/change-diff review only
