# Prepio UI/UX Review — 2026-07-02 (recurring routine, run #3)

Third run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md),
[`2026-06-25-ux-review-routine.md`](./2026-06-25-ux-review-routine.md).

## Method limitation (now recurring for a third run)

The remote execution environment still blocks egress to
`prepio.qiuyue.dev` at the agent proxy: `HTTP 403 connect_rejected —
gateway policy denial` on every CONNECT attempt from Playwright and
from `curl`. Playwright Chromium is pre-installed at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, so the constraint
is the *destination host*, not the browser.

No real browser was driven against the live app this run — no
screenshots, no mobile-viewport check, no slow-network simulation, no
keyboard/focus walk, no touch-target measurement. This is now the
third consecutive routine run in which the stated Playwright + mobile
+ accessibility scripts could not execute. **The routine's egress
policy needs an intervention**; see "Meta-finding" below.

Findings this run are code-level only against `origin/main` at
[`e119be4`](https://github.com/Akkkkkkki/Prepio/commit/e119be4), plus
the diff `61c5078..HEAD` (everything since 2026-06-25 run #2).

## Meta-finding: the routine has now been blind for three runs

- **Severity:** the routine cannot fulfil its stated purpose
  (Playwright test scripts A–E in
  [`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md)
  and in the routine prompt). Two runs' worth of live-app checks —
  mobile safe-area, keyboard focus, real touch targets, slow-network
  research loading — are now overdue.
- **Two viable fixes (pick one this week):**
  1. Add `prepio.qiuyue.dev` to the environment's egress allowlist so
     the pre-installed Playwright can reach the live app. This is the
     lower-effort fix.
  2. Rewire the routine to run against a local preview from inside the
     sandbox (`npm run dev` on port 5173 is already whitelisted by
     `no_proxy=localhost,127.0.0.1`). This costs a script change but
     removes the external-egress dependency permanently. It won't
     cover the real deployed build, so route (1) is still nicer.
- **Filing recommended:** a `PREPIO-*` chore in **Quality & Maintenance**
  titled *"Restore live-app egress for the recurring UX-review
  routine"*, area `area:infra`, linking this section and the two prior
  audits.

## Overall product judgment

The mid-state confusion flagged in run #2 has *partially* been paid
down. **Three of the four run #2 tickets shipped this week:**

- **[PREPIO-112](https://linear.app/qiuyue/issue/PREPIO-112)** — the
  research toast now correctly says "from Your interviews"
  ([`Home.tsx:521`](../../src/pages/Home.tsx),
  [`ProgressDialog.tsx:250`](../../src/components/ProgressDialog.tsx)).
- **[PREPIO-113](https://linear.app/qiuyue/issue/PREPIO-113)** — the
  Dashboard breadcrumb now reads *"Your interviews › Company Prep
  Plan"* and links to `/interviews`
  ([`Dashboard.tsx:985-988`](../../src/pages/Dashboard.tsx)). No
  redirect hop.
- **[PREPIO-103](https://linear.app/qiuyue/issue/PREPIO-103)** — Plan
  page density is down; the duplicated priority strip and leverage
  card were removed, and the "Start here · highest-leverage round"
  marker is the single anchor
  ([`Dashboard.tsx:668`](../../src/pages/Dashboard.tsx)).
- **[PREPIO-114](https://linear.app/qiuyue/issue/PREPIO-114)** — the
  interview card's "N questions still need work" line is now a
  Practice CTA ([`Interviews.tsx:69-87`](../../src/pages/Interviews.tsx)),
  a real "next best action" tighten.

**The two P1 items are still unlanded:**

- **[PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)** —
  nav-collapse has not shipped. `Navigation.tsx:35-41` still lists
  `Home / Dashboard / Practice / Practice History / Pricing / Profile`.
  The word "Interviews" appears nowhere in the nav. "Home" still
  routes to `/` and silently redirects to `/interviews`
  ([`App.tsx:74`](../../src/App.tsx)). This has been the top-priority
  fix for two consecutive audits.
- **[PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)** —
  `/new-interview` still shows the marketing "Prepio" hero and *"Get
  insider insights on any company's interview process. Tailored prep
  for you and your friends."* to logged-in users
  ([`Home.tsx:1546-1551`](../../src/pages/Home.tsx)), and the mobile
  branch still emits *"…without the desktop-style sprawl"*
  ([`Home.tsx:1428-1434`](../../src/pages/Home.tsx)). This is still the
  **only** path for a logged-in user to start fresh prep from the new
  `/interviews` home ([`Interviews.tsx:159, 191`](../../src/pages/Interviews.tsx)).

Direction is right, velocity is fine. The concern is that the two
regressions the previous audit filed as *"biggest risk of the mid-state"*
are the two that didn't ship. Recommend prioritising them this week
before the ROADMAP moves on.

## Top issues

### 1. `/new-interview` still shows the marketing Home hero (unchanged since 2026-06-25)

- **Severity:** P1 (repeat)
- **Area:** landing / research entry
- **User scenario:** A returning user with an empty or partial
  interview list clicks "Prep a new interview" on `/interviews`.
- **What happens:** They land on `/new-interview`, which mounts
  `Home.tsx`. Desktop shows a giant `Prepio` wordmark plus *"Get
  insider insights on any company's interview process. Tailored prep
  for you and your friends."* — the exact marketing-tone hero the
  logged-out landing uses. Mobile is worse: even bigger `Prepio`
  header, plus *"Move from company research to practice in three
  short steps, without the desktop-style sprawl."* — meta-copy about
  Prepio's own UX philosophy rather than the user's task.
- **Why it matters:** This is the sole starting point for a logged-in
  user opening a new prep after
  [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100) shipped.
  Every returning user hits it every time they start fresh prep.
  Mid-senior job seekers under time pressure do not benefit from
  seeing marketing copy about the product they have already bought
  into.
- **Recommended fix:** When `user && location.pathname ===
  '/new-interview'`, render a task-oriented header ("Prep a new
  interview") and drop both the marketing paragraph and the "desktop-
  style sprawl" mobile meta-copy. Add a back-to-Your-interviews link.
- **Evidence:** [`Home.tsx:1428-1434`](../../src/pages/Home.tsx)
  (mobile hero); [`Home.tsx:1546-1551`](../../src/pages/Home.tsx)
  (desktop hero); [`App.tsx:104-112`](../../src/App.tsx) (route
  mount).
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  — filed 2026-06-25, still Backlog per repo state. Escalate.

### 2. Nav still hides the new "Your interviews" home (unchanged since 2026-06-25)

- **Severity:** P1 (repeat)
- **Area:** navigation / landing
- **User scenario:** A returning user lands on `/interviews` after
  login, moves to Practice or Profile, then wants to come back.
- **What happens:** No nav item says "Interviews" or "Your interviews"
  ([`Navigation.tsx:35-41`](../../src/components/Navigation.tsx)). The
  only paths back are the Prepio logo (`/` → redirect to `/interviews`)
  or the "Home" tab (same redirect). The label "Home" therefore silently
  means "Your interviews," and "Dashboard" (still in the nav) has no
  useful landing — `/dashboard` without a `searchId` also redirects to
  `/interviews`
  ([`Dashboard.tsx:902`](../../src/pages/Dashboard.tsx)).
- **Why it matters:** Two nav items in the top bar now route to the
  same destination via a redirect hop. `DESIGN_PRINCIPLES.md` and the
  routine's own copy standards both say labels should match
  destinations. This has been the top-scored fix for two consecutive
  audits and is still open.
- **Recommended fix:** Ship
  [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse
  nav to `Interviews` (default), `Practice`, `Profile` and rename
  `Dashboard` → `Plan` inside a prep run. Move `Pricing` and `Practice
  History` under a dropdown / account menu.
- **Evidence:** [`Navigation.tsx:35-41`](../../src/components/Navigation.tsx);
  [`App.tsx:74`](../../src/App.tsx) (root redirect);
  [`Dashboard.tsx:902`](../../src/pages/Dashboard.tsx) (dashboard
  redirect).
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, no landing PR yet.

### 3. `Interviews.tsx` empty-state / with-items CTAs are label-inconsistent

- **Severity:** P3 (new)
- **Area:** landing / consistency
- **User scenario:** A brand-new logged-in user sees the empty
  Interviews page; later, after adding one interview, they see the
  populated page.
- **What happens:** The empty-state CTA reads *"Prep a new interview"*
  ([`Interviews.tsx:193`](../../src/pages/Interviews.tsx)); the
  populated header CTA reads *"New interview"*
  ([`Interviews.tsx:161`](../../src/pages/Interviews.tsx)). Two
  different labels for the same action, both on the same route.
- **Why it matters:** Small consistency slip, but this is a new,
  post-restructure surface — the copy standard should be set once and
  reused. NN/g heuristic 4 ("consistency and standards").
- **Recommended fix:** Use one label everywhere. *"Prep a new
  interview"* fits the routine's "direct, specific, calm" copy
  standard better than the terser *"New interview,"* and matches the
  same CTA on `Dashboard.tsx:1004` ("Start a new research run" →
  consider unifying too).
- **Evidence:** [`Interviews.tsx:161`](../../src/pages/Interviews.tsx)
  vs [`Interviews.tsx:193`](../../src/pages/Interviews.tsx).
- **Tracking:** filing recommended (Backlog, P3, `Type: Improvement`,
  `area:landing`).

### 4. Mobile bottom-nav pattern deferred yet again — still can't verify

- **Severity:** Deferred — cannot assess without live testing
- **Area:** mobile / practice
- **What we can say from code:** Practice mode still uses the
  `data-mobile-home-footer` fixed bottom bar
  ([`Home.tsx:1497-1541`](../../src/pages/Home.tsx),
  [`Practice.tsx`](../../src/pages/Practice.tsx) uses the same
  `MobileFooter*` clearance hooks) and the autosave state machine
  correctly distinguishes `idle | saving | draft | serverSaved`
  ([`Practice.tsx:258`](../../src/pages/Practice.tsx)). PREPIO-108
  looks intact.
- **What we cannot say:** whether the bottom nav sits inside the
  iPhone safe area, whether touch targets meet ~44pt, whether the
  save-confirm indicator is visible to the eye. These need a real
  device or an emulator with an actual load of the deployed build.
- **Blocker:** the same egress restriction as the meta-finding.

## Journey scorecard

Code-level only; no live checks (same as runs #1 and #2). Rows marked
**↑** improved since run #2; **=** unchanged; **↓** worse.

| Area | Run #2 | Run #3 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | Guest landing unchanged. |
| Research entry | 3 | 3 | = | PREPIO-111 still open — `/new-interview` still marketing hero. |
| Research progress/loading | — | — | = | Not assessable without live testing. |
| Generated output clarity | 3 | 4 | ↑ | PREPIO-103 removed the priority-strip / leverage-card duplication; Plan page is meaningfully thinner. |
| Practice mode | 4 | 4 | = | PREPIO-108 intact. No new regressions in code. |
| Mobile usability | — | — | = | Deferred, third run in a row. |
| Resume/profile trust | 4 | 4 | = | Unchanged. |
| Dashboard/history/resume | 3 | 4 | ↑ | PREPIO-114 makes needs-work a CTA — a real "next best action" tighten on the Interviews home. |
| Error/empty states | 4 | 4 | = | Interviews empty state present and clean; minor copy-consistency slip is P3. |
| Accessibility | — | — | = | Skip-to-main confirmed at [`App.tsx:86`](../../src/App.tsx); full keyboard/focus walk still deferred. |
| Copy quality | 3 | 4 | ↑ | "from Your interviews" landed; Dashboard breadcrumb fixed; marketing hero on `/new-interview` still drags the score. |

Two upward moves this week (Generated output clarity, Dashboard/history,
Copy quality) driven by the four PREPIO shipments. No downward moves.
Two blocked rows (Research loading, Mobile usability, Accessibility)
because live testing hasn't run for three routines running.

## Regression check

| Item | State | Note |
|------|-------|------|
| Research toast "from the dashboard" | **Fixed** ([PREPIO-112](https://linear.app/qiuyue/issue/PREPIO-112)) | Now says "from Your interviews." |
| Dashboard breadcrumb labels "Home" | **Fixed** ([PREPIO-113](https://linear.app/qiuyue/issue/PREPIO-113)) | Now "Your interviews." |
| Plan page density (duplicated priority strip / leverage card) | **Fixed** ([PREPIO-103](https://linear.app/qiuyue/issue/PREPIO-103)) | |
| `/new-interview` marketing hero for logged-in users | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | Two audits, no ship. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | Two audits, In Progress, no ship. |
| Live-app egress blocked | **Still open** | Now recurring for three audits. Meta-finding above. |

No previously-fixed regressions returned. Progress is real; the
remaining backlog is well-defined.

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` | **Bump** — escalate from Backlog to Todo/In Progress this week. |
| 2 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Dashboard → Plan | **Bump** — In Progress since 2026-06-24. Land this week; unblocks fixing #3 and the "Practice History" naming. |
| 3 | *New* — restore live-app egress for the routine (Q&M chore, `area:infra`) | **File** — this run |
| 4 | *New* — unify "New interview" ↔ "Prep a new interview" copy on `Interviews.tsx` | **File** — this run (Improvement, P3, `area:landing`) |

## Next-run focus

1. **Re-run live checks the first week egress opens**, or the first
   run after the routine is rewired against a local preview. Priorities:
   mobile bottom-nav safe area on iPhone 13 viewport; keyboard-only walk
   through landing → auth → dashboard → practice; slow-network research
   loading state; real touch-target sizing on the Practice screen.
2. **Confirm PREPIO-111 and PREPIO-101** the moment they land — both
   are structural, both change nav copy, and both were flagged in run
   #2 and again in run #3.
3. **Copy consistency sweep after PREPIO-101** ships: the nav rename
   will change several labels and route names at once; audit
   breadcrumb copy, toast copy, and empty-state CTAs in the same
   review.
4. **Recording aria-live** and **question-advance focus management**
   remain deferred from run #2. Escalate to a filed issue only after
   they can be verified live.
