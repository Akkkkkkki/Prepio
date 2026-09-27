# Prepio UI/UX Review — 2026-09-27 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Immediate baseline:
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20). Earlier baselines:
[`2026-08-30`](./2026-08-30-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review. Playwright Chromium drove the live app end-to-end:
logged-out landing + guest sample, `/auth`, a real login with the tester account, `/interviews`,
a **real practice session** (question hero, live Favorite-flag write, live text-answer save),
`/history`, `/new-interview`, and keyboard-focus + mobile passes. It was **not** a fresh-research
pass — no new research run was submitted (that spends real OpenAI/Tavily budget and takes minutes),
so the research **form** was inspected live but the async progress modal is carried from prior runs.

- **Playwright Chromium: PASS — no MITM shim needed this session.** Unlike run #20 (which required a
  local MITM proxy to get past a TLS reset), a plain `chromium.launch({ proxy: { server: $HTTPS_PROXY },
  args: ['--ignore-certificate-errors'] })` loaded every HTTPS host cleanly. The one gotcha: the
  session-preinstalled Chromium is build **1194** while `playwright@1.61.1` expects 1228, so launch with
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` (do **not** run
  `playwright install`). Carry both facts forward.
- **Frontend (Vercel): PASS** — `curl https://prepio.qiuyue.dev/` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`. **The deployed JS bundle contains the #354 frozen-core
  strings** (`View sample plan`, `Free · Invite-only`, `Illustrative sample`, `Payments company`) and
  **no longer contains** the pre-freeze strings (`Preview my prep`, `research-preview`, `Choose
  monthly`) — i.e. **the freeze surface-lock is live in production, not just merged to `main`.**
- **Backend (Supabase): PASS** — login with the tester account succeeded (`POST /auth/v1/token` →
  `200`, Enter-submit → redirect to `/interviews`). A **text-answer save persisted live** (`POST
  /rest/v1/practice_answers` → `201`). The **Favorite flag write failed live** (`POST
  /rest/v1/user_question_flags` → `400 / 42P10`) — unchanged from run #20.

Screenshots under [`assets/2026-09-27/`](./assets/2026-09-27/). **No `/profile` capture exists** — the
route now returns 404 under the freeze (profile is frozen off), and the tester account has **no CV
loaded** (the `/new-interview` CV textarea was empty: `cvTextareaHasContent === false`), so this run's
screenshots carry no résumé PII.

## The headline this week: run #20's P0 shipped — the freeze surface-lock is live

The single biggest change since the last review is **`9d9b711` / #354 — "lock Prepio to the
invite-only frozen core"** (PREPIO-27). Every item the run #20 P0 asked for is now **live in
production**, verified this run:

| Freeze requirement (PREPIO-27) | Live status this run | Evidence |
|---|---|---|
| Guest action makes **no** Edge Function / provider call | ✅ **Zero** network calls when expanding the sample | `netCallsDuringExpand === []` |
| Guest preview replaced by a deterministic static sample | ✅ "Payments company · Product Manager", 3 fictional stages, offline | [`02-d-guest-sample.png`](./assets/2026-09-27/02-d-guest-sample.png) |
| Invite-only sign-up (no public Sign Up) | ✅ No Sign Up tab; copy "free and invite-only… Ask the person who invited you" | [`03-d-auth.png`](./assets/2026-09-27/03-d-auth.png) |
| Hide checkout / paid controls | ✅ `/pricing` → **404** | console: "non-existent route: /pricing" |
| Hide profile/settings | ✅ `/profile` → **404** | console: "non-existent route: /profile" |
| Disable PDF/file upload | ✅ `/new-interview` has **no** `input[type=file]`, no upload copy | `hasFileUpload === false` |
| Hide voice recording control | ✅ No Record button among practice controls | control audit (below) |
| Strip copy promising unavailable features | ✅ mostly — one stale hint remains (issue #4) | practice coach hint |

The four-month "why is half the app dark" tension is resolved on the surface a real user sees: the
guest funnel is honest and self-contained, and there are no controls pointing at undeployed functions.

## Overall product judgment

**This is the strongest week in this review's recent history: run #20's top-of-funnel P0 is fully
shipped and live-verified, with zero code regressions.** A logged-out visitor now meets an honest,
self-contained surface — a clear "Prepare for your next interview" hero, a "Free · Invite-only" badge,
and a **static sample plan that opens with no network call at all** — instead of the old doomed
"Preview my prep" CTA that blanked the page. Sign-up is invite-only, `/pricing` and `/profile` are
gone (404), and file-upload/voice controls are removed, so the app no longer shows anything it can't
do. The authenticated core is solid: login works, the practice question is the unambiguous `<h1>` hero
on **both** desktop and mobile, controls are ≥44px, and a **text-answer save persists (`201`)**. **The
one live defect that still matters is the Favorite / Needs-work flag write, which still returns
`400 / 42P10` on every tap** — the fixing migration (`20260710203000_question_flags_per_type.sql`)
exists, is authorized for the freeze window, and is simply unapplied in production (PREPIO-170). The
highest-value next action is no longer a frontend task at all: it is the **attended freeze deploy that
applies that one migration** (PREPIO-124 + PREPIO-170).

## Top 5 issues

### 1. **P1 (live-confirmed, REPEAT) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration exists and is unapplied**

- **Severity:** P1 — a core practice-triage affordance in the *frozen* product scope fails 100% of the
  time. It is the top live-facing defect now that the P0 surface-lock has shipped.
- **Area:** practice
- **User scenario:** during practice a user taps the ☆ **Favorite** (or **Needs work**) icon under the
  question to mark what to revisit.
- **What happened (live, real `/practice` session this run):** the icon fills optimistically, then
  `POST /rest/v1/user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`** with
  body `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`. Console logs `Error setting question flag: {code: 42P10 …}` and `Failed to set
  flag`. The flag never persists. (No error toast was re-observed within the capture window this run —
  in run #20 a red "Couldn't save your Favorite flag" toast appeared; if the failure is now silent that
  is a small *regression* in error visibility, but I could not re-confirm the toast either way, so I am
  not asserting it — see Regression check.)
- **Root cause (unchanged):** the upsert at `src/services/searchService.ts:1762` targets a
  `(user_id, question_id, flag_type)` unique constraint that does not exist in production. #354 did
  **not** touch this upsert; it is frontend-only. The fix is the already-merged migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql`, which has never been applied.
  This is a **schema deploy inside the freeze scope**, not a code change.
- **Why it matters:** Favorite / Needs-work is explicitly in the frozen product boundary, and it is how
  a time-pressured user decides what to practice next. A promised, visible control that never persists
  erodes trust in whether anything they do persists. (Text-answer save, by contrast, is `201` —
  verified live.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze
  window (pre-check/dedupe any conflicting `(user_id, question_id, flag_type)` rows first per
  FREEZE_RELEASE §2.5), then verify all three flag entry points persist across a reload on desktop and
  mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent) — confirmed live
  2026-09-27. Evidence: [`10-d-practice-flag.png`](./assets/2026-09-27/10-d-practice-flag.png) +
  the `400/42P10` network body above.

### 2. **P2 (live-confirmed, REPEAT — 16th audit) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** the email and password inputs both return `autocomplete === null`
  (measured directly this run). The email field **is** properly `<label>`-associated
  (`labels.length === 1`), so this is narrowly the autofill / password-manager hint.
- **Why it matters:** browsers and password managers can't reliably offer credential autofill, so an
  invited user under time pressure retypes both fields. Sign-in stays fully in scope under the freeze,
  so this remains worth fixing.
- **Recommended fix:** add `autocomplete="email"` and `autocomplete="current-password"` to the sign-in
  inputs. One small PR. (The public sign-up form is gone, so no `new-password` variant is needed now.)
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog) — confirmed
  live 2026-09-27. Evidence: [`03-d-auth.png`](./assets/2026-09-27/03-d-auth.png).

### 3. **P2 (live-confirmed, REPEAT) — `/history` shows the empty state despite real in-progress practice and a just-saved answer**

- **Severity:** P2 (visibility-of-status / trust; reads as a bug to a returning user). Nudged up from
  P3 because this run proved the disconnect is stark: I saved an answer (`201`) minutes before loading
  `/history`, and it still said "Ready to start practicing."
- **Area:** history / dashboard
- **What happened (live):** `/interviews` shows two in-progress interviews ("Stripe · Data Product
  Manager · 5 of 10 answered · 50%", "OpenAI · Solutions Architect · 8 of 40 answered · 20%") and a
  text answer persisted live this run, yet `/history` renders *"Ready to start practicing / Your first
  practice session will appear here with answers, timing, and notes…"* Defensible if history is scoped
  to *completed* sessions only, but the disconnect reads as a data-loss bug to a user who has answered
  ten-plus questions.
- **Why it matters:** the returning-user "what did I do / what's left" surface tells them they've done
  nothing when they've done real, saved work. Squarely in the frozen authenticated core.
- **Recommended fix:** either surface in-progress sessions on `/history`, or make the empty-state copy
  explicit that it lists *completed* sessions and point to `/interviews` for in-progress work
  ("You have 2 interviews in progress — continue them from Your interviews.").
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (In Progress) — confirmed live
  2026-09-27. Evidence: [`11-d-history.png`](./assets/2026-09-27/11-d-history.png).

### 4. **P3 (live-confirmed, NEW) — Practice coach hint still says "Record for a full answer" though voice/recording is removed under the freeze**

- **Severity:** P3 (stale copy promising a control that no longer exists — a Conventions "align copy to
  reality" / "disable unwired controls" violation)
- **Area:** practice / copy
- **What happened (live, desktop `/practice`):** the practice-tools onboarding hint reads *"Record for
  a full answer · Notes for quick bullets · Skip if you want a fresh question · Swipe left to skip,
  right to favorite."* But the **Record button is gone** (the frozen build removed the voice control:
  the only practice buttons measured were Favorite, Needs work, Skip, Save & Continue), so the hint
  points at an affordance that isn't there.
- **Why it matters:** it's the first instruction a user reads on the practice screen, and it promises a
  recording feature the frozen product doesn't offer — exactly the "don't promise features that don't
  exist" trap the freeze scope is trying to close. Low impact, but it's the one copy inconsistency left
  on the core screen after #354's otherwise-clean sweep.
- **Recommended fix:** drop the "Record for a full answer" clause from the practice coach hint (and any
  swipe/gesture copy that assumes a record affordance), leaving "Notes for quick bullets · Skip if you
  want a fresh question." Small copy-only change in `src/pages/Practice.tsx`.
- **Tracking:** below the >30-min Linear threshold — recorded here as a report note; fold into the next
  practice-copy touch. Evidence: [`09-d-practice-real.png`](./assets/2026-09-27/09-d-practice-real.png).

### 5. **P3 (live-confirmed) — Pre-signup proof is thinner than it was: the sample is one click behind a button and is a generic fictional example; landing/auth targets are still <44px**

- **Severity:** P3 (time-to-value / personalization proof; plus a carried a11y ergonomic note)
- **Area:** landing / first-time understanding / accessibility
- **What happened (live):** the frozen guest surface is honest and safe, but two things trade against
  first-30-seconds value:
  1. The sample plan is hidden behind a **"View sample plan"** click, and its content is a **generic
     "Payments company · Product Manager"** fictional example. Run #20's surface, by contrast, showed a
     **rich, company-specific** example ("How Stripe Senior Product Manager questions look in Prepio")
     inline. The freeze correctly removed the *broken* live preview, but the static replacement proves
     personalization ("this isn't a generic ChatGPT wrapper") less vividly and one interaction later.
  2. Mobile landing/auth chrome is still under the 44px comfort baseline — "Sign in" measured
     **71×36** (practice-mode controls, by contrast, are all ≥44px: Favorite 112×44, Needs work
     138×44, Skip/Save 173×48).
- **Why it matters:** the guest funnel is the entire top-of-funnel for an invite-only product deciding
  whether to accept an invite; a default-visible, more concrete sample would raise time-to-value at no
  trust cost, and a 36px tap target is small for a one-handed first touch.
- **Recommended fix:** consider rendering the sample plan **open by default** (it's static, so there's
  no cost), and make the sample copy carry one concrete company/role detail so it reads as tailored,
  not generic. Bump landing/auth nav controls to ≥44px min-height. Both fold into any future landing
  touch. Below the ticketing threshold; report note.
- **Evidence:** [`01-d-landing.png`](./assets/2026-09-27/01-d-landing.png),
  [`02-d-guest-sample.png`](./assets/2026-09-27/02-d-guest-sample.png),
  [`07-m-landing.png`](./assets/2026-09-27/07-m-landing.png).

## Notable live observations (not top-5)

### Positives — live-verified this run

- **The whole freeze surface-lock is live** (see the headline table). Guest sample opens with **zero**
  network calls; sign-up is invite-only; `/pricing` and `/profile` 404; no file-upload or voice
  controls; copy is honest.
- **Practice question is a proper `<h1>` on desktop *and* mobile** (desktop: `H1:"How do you
  prioritize your roadmap for data product features?"`, sole heading with the coach panel collapsed;
  mobile: `H1:"How do you handle data security concerns when designing products?"`). The question is
  the unambiguous hero. [`08-m-practice.png`](./assets/2026-09-27/08-m-practice.png)
- **Text-answer save persists** (`POST /rest/v1/practice_answers` → `201`, row returned).
  **Save & Continue is disabled until text is entered** (error prevention).
- **`/interviews` resumes cleanly** — cards show state + progress ("5 of 10 answered · 50%") with
  **Continue practice** and **Plan** one click away; **Prep a new interview** prominent.
  [`05-d-interviews.png`](./assets/2026-09-27/05-d-interviews.png)
- **`/new-interview` is honest and low-friction** — "All you need is the company. Add role, CV, or job
  description below to sharpen the questions", with CV as an optional paste box ("Optional.
  Personalizes questions to your background."). No upload, no voice, no profile admin.
  [`12-d-new-interview.png`](./assets/2026-09-27/12-d-new-interview.png)
- **Keyboard focus is visible.** Landing Tab order: Skip-link → Prepio → Sign in (2px solid focus ring)
  → View sample plan (2px solid) — each interactive control has a visible outline.
- **No horizontal overflow** on mobile landing or mobile practice (`scrollWidth <= innerWidth`).

## Journey scorecard

Full authenticated live pass this run. One user-facing product commit (#354) shipped since
`2026-09-03`. The score mover is **First-time understanding (3 → 4)** — the top-of-funnel is no longer
broken. Rows tagged **(live)** were exercised this run.

| Area | 2026-09-03 | 2026-09-27 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | **4** | **▲** | **(live)** Honest, self-contained guest surface; static sample opens with **zero** network calls; no doomed CTA blanking the page. Held from 5 by the sample being one click behind a button and generic (issue #5). |
| Research entry | 4 | 4 | = | **(live)** Form inspected live: company-only minimum, optional CV paste, optional role/JD — honest and progressive. Async modal carried (not re-submitted). |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged in code; not re-triggered (real budget). |
| Generated output clarity | 5 | 5 | = | **(live)** Question + stage/difficulty badges + practice-tools structure clear; coach panel collapses when a question has no guidance (#338). |
| Practice mode | 4 | 4 | = | **(live)** Question is `<h1>` hero desktop + mobile, save persists (`201`), Save gated on non-empty — but Favorite/Needs-work is 100% broken (P1 #1), holding the score. |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px controls, fixed bottom bar, question dominates. Landing/auth targets still <44px (P3 #5). |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile route is frozen off (404); CV is an optional paste box with honest "personalizes your questions" copy. No upload/import surface to distrust. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** `/interviews` resumes well, but `/history` empty despite in-progress work + a just-saved answer (P2 #3). |
| Error/empty states | 4 | 4 | = | **(live)** Guest surface no longer blanks; `/history` and `/new-interview` states honest. Held at 4 by the flag failure (and its possibly-now-silent error surfacing, P1 #1). |
| Accessibility | 4 | 4 | = | **(live)** Question `<h1>` both breakpoints, visible focus rings, clean mobile reflow. Remaining: `/auth` autocomplete null (P2 #2, 16th audit), sub-44px landing/auth targets (P3 #5). |
| Copy quality | 4 | 4 | = | **(live)** Materially more honest after #354 (no unavailable-feature promises across landing/auth/pricing-gone). Held from 5 by the stale "Record for a full answer" practice hint (P3 #4). |

**Composite: up one, on First-time understanding.** The deployed core is at its best level in this
review's history; the only remaining live defect that matters is the flag-write migration
(PREPIO-170), which is a backend deploy, not a frontend fix.

## Regression check

One user-facing product commit merged to `main` since the last review (`9d9b711` / #354; plus
security/dep/docs chores) — a large **improvement**, no code regressions found live:

| Item | State | Note |
|------|-------|------|
| Guest surface (was run #20 P0) | **Fixed** ✅ | Static sample, **zero** network calls on expand; no doomed CTA. (PREPIO-27 / #354) |
| Public sign-up → invite-only | **Fixed** ✅ | No Sign Up tab; honest invite-only copy. |
| `/pricing`, `/profile` dead surfaces | **Fixed** ✅ | Both 404 under the freeze. |
| File upload / voice controls | **Removed** ✅ | No `input[type=file]`; no Record button in practice. |
| Practice question-as-`<h1>` (desktop + mobile) | **Holding** ✅ | Sole `<h1>` on both; coach panel collapses when no guidance. |
| Text-answer save | **Holding** ✅ | `201`; row returned live. |
| Protected-route redirect / focus rings | **Holding** ✅ | Visible focus outlines; redirect context preserved (carried). |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10`; migration exists, unapplied. (P1 #1, PREPIO-170) |
| Flag-failure error toast | **Unverified this run** ⚠️ | run #20 showed a red toast; not re-observed this run. If the failure is now silent that is a minor error-visibility regression — needs a targeted check, not asserted here. |
| `/auth` autocomplete | **Still unfixed — 16th audit** ⚠️ | `null`. (P2 #2, PREPIO-123) |
| `/history` vs in-progress parity | **Still open** ⚠️ | Empty state despite "5 of 10 answered" + a live-saved answer. (P2 #3, PREPIO-107) |
| Practice "Record for a full answer" hint | **New nit** ⚠️ | Copy promises a removed control. (P3 #4) |

**Net: one large improvement (the entire freeze surface-lock), zero code regressions.** One item to
double-check next run: whether the flag-write failure still surfaces a user-visible toast, since it
was not observed this run.

## Recommended tickets

All substantive findings map to existing open Linear issues; **no new Linear issue is warranted this
run** (the two new items — the stale practice hint and the sample-default/touch-target notes — are
each below the >30-min ticketing threshold and are recorded here for the next relevant touch).

> **Linear note:** the Linear MCP connector is unauthenticated in this session, so no Linear comments
> or status changes could be posted this run. The live-confirmation notes below should be mirrored onto
> the referenced issues when Linear access is available.

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the attended freeze window so the
   Favorite/Needs-work upsert stops returning `42P10`; dedupe conflicting rows first, then verify all
   three entry points persist across reload on desktop + mobile. →
   **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent; confirmed live 2026-09-27) —
   ships inside **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (attended freeze deploy).
2. **[P2] Add `autocomplete="email"` / `current-password` to the `/auth` sign-in inputs.** →
   **[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (existing; confirmed live, 16th audit).
3. **[P2] Surface in-progress work on `/history`, or make the empty-state copy scope-explicit** and
   point to `/interviews`. → **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (In Progress;
   confirmed live 2026-09-27).
4. **[P3, report note] Remove the stale "Record for a full answer" clause** from the practice coach
   hint in `src/pages/Practice.tsx` (voice is frozen off; the Record control is already gone). Below
   the Linear threshold — fold into the next practice-copy change.
5. **[P3, report note] Consider rendering the guest sample open by default and adding one concrete
   company/role detail** to make it read as tailored; bump landing/auth nav controls to ≥44px. Below
   the Linear threshold — fold into any future landing touch.

### Deferred items (per CLAUDE.md hygiene convention)

- **No new Linear issues filed this run.** All P1/P2 findings map to existing open issues (PREPIO-170,
  -123, -107). The two P3 items are below the >30-min threshold and are report notes, per the same
  convention that governed run #20.
- [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (surface-lock) is **shipped and live-verified**
  this run — it should move to Done and drop off the standing carry list once Linear access is restored.

---

Capability: live browser verified
