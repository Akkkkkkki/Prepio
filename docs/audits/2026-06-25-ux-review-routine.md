# Prepio UI/UX Review — 2026-06-25 (recurring routine, run #2)

Second run of the recurring weekly UX-review routine. Baseline:
[`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md).
Cadence: one routine run per week.

## Method limitation (carried over from run #1)

The remote execution environment still blocks egress to
`prepio.qiuyue.dev` and `cdn.playwright.dev` at the agent proxy
(`HTTP 403 connect_rejected — gateway policy denial`). Playwright
Chromium is pre-installed locally (`/opt/pw-browsers/chromium-1194`), so
the constraint is the *destination*, not the browser. As before, no
real browser was driven against the live app — no screenshots, no
mobile-viewport check, no slow-network simulation, no keyboard/focus
walk. Findings are code-level only against the diff `1581426..HEAD`
(everything since run #1).

Each finding includes file:line evidence so a live-capable run can
confirm in seconds. Local `npm run build` succeeds; `npm test` shows
332 passing tests across 43 files.

## Overall product judgment

Big delivery week, mostly in the right direction. Four of the eight
[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99) restructure
children have landed — [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100)
(Your interviews home), [PREPIO-102](https://linear.app/qiuyue/issue/PREPIO-102)
(removed the Active-research + History switchers),
[PREPIO-104](https://linear.app/qiuyue/issue/PREPIO-104) (Start-here
stage marker), plus the routine-filed
[PREPIO-108](https://linear.app/qiuyue/issue/PREPIO-108) (autosave
label split). The autosave-label fix is exactly the right shape — the
green check now only follows a server save, "Draft kept in this tab"
is honest about what sessionStorage gets you, and trust state is no
longer conflated.

The downside is **the half-shipped restructure has created a confusing
mid-state.** [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100)
shipped a new post-login landing at `/interviews`, but
[PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) (collapse the
nav, rename Dashboard → Plan, add the Plan/Practice/Review header) is
still In Progress and not yet landed. Three concrete regressions follow
from that mid-state:

1. **`Navigation.tsx` has no "Interviews" link** — the marquee shipped
   feature is invisible in the nav. The "Home" tab points to `/`,
   which now redirects logged-in users to `/interviews` — the label
   doesn't match the destination.
2. **Clicking "Prep a new interview" lands users on the old marketing
   Home page** ("Prepio · Get insider insights … for you and your
   friends") because `/new-interview` mounts `Home`. This is the *only*
   path for a logged-in user starting fresh prep after
   [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100), so every
   returning user gets a marketing hero where they expected a focused
   form.
3. **The "research started" toast still says "from the dashboard,"**
   pointing to a noun that no longer appears in the nav.

[PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) fixes (1)
when it ships; (2) and (3) are new tickets filed this run
([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111),
[PREPIO-112](https://linear.app/qiuyue/issue/PREPIO-112)).

## Top issues

### 1. New "Your interviews" home is invisible in the nav; the "Home" tab silently redirects there

- **Severity:** P1 (regression created by 2026-06-22 to 2026-06-24
  ships)
- **Area:** navigation / landing
- **User scenario:** A returning user lands on `/interviews` after
  login (good), then clicks any other nav item (Practice, Profile,
  Pricing) and now wants to come back.
- **What happens:** There is no nav item that says "Interviews" or
  "Your interviews" — the page does not appear in
  `Navigation.tsx:35-42`. The only way back is the Prepio logo (links
  to `/`, redirects to `/interviews`) or the "Home" nav tab (also
  links to `/`). "Home" therefore now means "Your interviews," which
  is exactly the labelling pattern
  [`DESIGN_PRINCIPLES.md`](../DESIGN_PRINCIPLES.md) warns against
  ("each screen answers what do I do now? with a single primary
  button" — implies labels should match destinations).
- **Why it matters:** Returning users lose track of where they are.
  The single most important post-login surface that
  [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100) just
  shipped has no nav representation.
- **Recommended fix:** Land [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  ("Collapse nav to Interviews + account menu; rename Dashboard →
  Plan"). The fix is already specified there and is In Progress.
- **Evidence:** `src/components/Navigation.tsx:35-42` (nav items list);
  `src/App.tsx:70-77` (root redirect); `src/App.tsx:94-102`
  (`/interviews` route definition).
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  (In Progress, Urgent). Routine recommendation: prioritize the
  ship; PREPIO-100 shipping without it produced this regression.

### 2. Logged-in `/new-interview` shows the marketing Home hero

- **Severity:** P1
- **Area:** landing / practice
- **User scenario:** A returning user with an empty or partial
  interview list clicks "Prep a new interview" from
  [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100)'s home.
- **What happens:** `/new-interview` mounts the existing `Home`
  component (`App.tsx:104-112`). The logged-in branch of `Home.tsx`
  renders a giant "Prepio" wordmark followed by "Get insider insights
  on any company's interview process. Tailored prep for you and your
  friends." A user expected a focused new-interview wizard and got the
  public marketing landing instead. Mobile is worse: an even bigger
  "Prepio" header, plus a meta-copy line that explains the product's
  design philosophy ("…without the desktop-style sprawl") rather than
  the user's task.
- **Why it matters:** This is now the **only** entry to start fresh
  prep for a logged-in user. Every returning user sees this every
  time. "for you and your friends" specifically reads casual /
  off-brand for a stressed mid-senior job seeker, and the marketing
  hero adds a full screen of scroll before the wizard.
  [PREPIO-34](https://linear.app/qiuyue/issue/PREPIO-34) (canceled
  2026-06-21 as "superseded by PREPIO-99") was the previous tracker
  for this copy — but PREPIO-99 doesn't itself replace this hero;
  PREPIO-100 shipping made the surface *more* visible, not less.
- **Recommended fix:** When `user && location.pathname ===
  '/new-interview'`, render a task-oriented header ("Prep a new
  interview" or "Start a new prep plan"), drop the marketing
  paragraph, drop the mobile "without the desktop-style sprawl"
  metacopy. Provide a back-to-Your-interviews affordance.
- **Evidence:** Route mount `src/App.tsx:104-112`; entry points
  `src/pages/Interviews.tsx:145, 178` and `src/pages/Dashboard.tsx:967`
  (error fallback); desktop hero `src/pages/Home.tsx:1543-1556`;
  mobile hero `src/pages/Home.tsx:1428-1434`.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  (filed this run, Backlog, P1).

### 3. "Research started" toast tells users to monitor "from the dashboard"

- **Severity:** P2
- **Area:** copy / landing
- **User scenario:** A user fills the research form on
  `/new-interview` and submits.
- **What happens:** `Home.tsx:520-523` toasts "Your research is
  queued. You can leave this screen and keep an eye on progress from
  the dashboard." But after [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100)/102:
  `/dashboard` without a `searchId` redirects to `/interviews`
  (`Dashboard.tsx:936-938`), and the word "dashboard" no longer
  appears in the nav.
- **Why it matters:** Sending users to a noun that's no longer
  surfaced in the UI weakens an already-fragile reassurance moment —
  the user has just kicked off long-running work and is being told
  where to watch progress.
- **Recommended fix:** Replace "from the dashboard" with "from Your
  interviews" (re-verify after [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  lands a final name).
- **Evidence:** `src/pages/Home.tsx:521-522`.
- **Tracking:** [PREPIO-112](https://linear.app/qiuyue/issue/PREPIO-112)
  (filed this run, Backlog, P2).

### 4. Dashboard breadcrumb labels "Home" but goes to /interviews

- **Severity:** P3
- **Area:** practice / nav
- **User scenario:** Desktop user on a prep plan page clicks the
  breadcrumb to step back.
- **What happens:** `Dashboard.tsx:1019-1023` renders `Home › Company
  Prep Plan`, with `<Link to="/">`. The redirect to `/interviews`
  fires correctly, but the label says "Home" when the destination is
  "Your interviews."
- **Why it matters:** Small label-vs-destination dishonesty that adds
  to the same set of issues as (1).
- **Recommended fix:** Rename the breadcrumb label to "Your
  interviews" and link directly to `/interviews` to skip the redirect
  hop.
- **Evidence:** `src/pages/Dashboard.tsx:1019-1023`;
  `src/App.tsx:70-77` (redirect).
- **Tracking:** [PREPIO-113](https://linear.app/qiuyue/issue/PREPIO-113)
  (filed this run, Backlog, P3).

### 5 – n. (Not added)

The PREPIO-104 "Start here · highest-leverage round" badge
(`Dashboard.tsx:722-726`, `MobileStageCard.tsx:75-81`) lands cleanly —
single specific badge, only on the top-priority stage, copy gives the
user a reason. No tactical issue to file.

The PREPIO-108 autosave fix is correct: green-check + "Answer saved"
only on `serverSaved`; "Draft kept in this tab" + neutral colour on
local autosave; "Saving draft…" while typing; "Autosave ready" before
any input (`Practice.tsx:255, 858, 1392, 1517-1525, 2733, 3116`). No
follow-up.

Preview expiry copy (`InterviewBriefPreview.tsx:131`) still shows
only a date (`toLocaleDateString()`) without a time. Borderline trust
hit if a guest sees "expires Dec 25" at 11pm and assumes they have
all day. Deferring rather than filing — confidence is low without a
live check.

## Journey scorecard

Code-level only; no live checks. Same scoring rubric (1–5). Rows
marked **↑** improved since run #1; **=** unchanged; **↓** worse.

| Area | Run #1 | Run #2 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | Guest landing unchanged. |
| Research entry | 4 | 3 | ↓ | Form itself unchanged, but `/new-interview` hero is now the marketing copy (PREPIO-111). |
| Research progress/loading | — | — | = | Still not assessable without live testing. |
| Generated output clarity | 3 | 3 | = | Start-here badge helps; density (PREPIO-103) still open. |
| Practice mode | 3 | 4 | ↑ | PREPIO-108 fix lands; autosave trust state is now honest. |
| Mobile usability | — | — | = | Safe-area, footer-height hooks intact; reachability needs a real device. |
| Resume/profile trust | 4 | 4 | = | Unchanged. |
| Dashboard/history/resume | 2 | 3 | ↑ | The new Your-interviews home is the right shape; nav doesn't surface it yet (PREPIO-101). |
| Error/empty states | 3 | 4 | ↑ | Empty Dashboard cleanly `Navigate`s to /interviews; old "Open the History menu" copy removed (Dashboard.tsx:936-938). |
| Accessibility | — | — | = | Skip-to-main link confirmed (`App.tsx:85-87`); full audit still needs keyboard/focus walk. |
| Copy quality | 4 | 3 | ↓ | "Saved locally" is fixed, but the marketing hero on `/new-interview` (PREPIO-111) and "from the dashboard" toast (PREPIO-112) lower the average. |

## Regression check

| Item | Detected | Tracking | Note |
|------|----------|----------|------|
| Nav has no "Interviews" link; "Home" silently redirects to /interviews | run #2 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) (In Progress) | Mid-state created by shipping PREPIO-100 before PREPIO-101. |
| `/new-interview` shows the marketing-style Home hero to signed-in users | run #2 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) | PREPIO-34 was canceled on 2026-06-21; PREPIO-100 made the surface more visible. |
| "Research started" toast points to "the dashboard" | run #2 | [PREPIO-112](https://linear.app/qiuyue/issue/PREPIO-112) | Trivial copy edit; do at the same time as PREPIO-101 nav rename. |
| Dashboard breadcrumb labels parent "Home" but lands on /interviews | run #2 | [PREPIO-113](https://linear.app/qiuyue/issue/PREPIO-113) | Trivial label edit. |

No previously-flagged regressions returned. PREPIO-108 (run #1
finding) confirmed fixed.

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — Logged-in /new-interview still shows marketing-style Home hero | Filed this run (P1) |
| 2 | [PREPIO-112](https://linear.app/qiuyue/issue/PREPIO-112) — Post-research-start toast points users to "the dashboard" | Filed this run (P2) |
| 3 | [PREPIO-113](https://linear.app/qiuyue/issue/PREPIO-113) — Dashboard breadcrumb "Home" misleads — now goes to /interviews | Filed this run (P3) |

Existing-but-now-more-urgent:

| # | Ticket | Note |
|---|--------|------|
| 4 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) | Already In Progress. Routine recommends prioritising the ship since shipping PREPIO-100 without it created the nav-stale regression flagged in finding #1. |

## Next-run focus

1. **Confirm PREPIO-111/112/113 in a real browser** if egress to
   `prepio.qiuyue.dev` opens up. All three are static code findings;
   visual confirmation should be a few seconds each.
2. **Re-check the nav after PREPIO-101 ships.** Verify "Interviews"
   appears, that "Home"/"Dashboard" are gone (or renamed), that
   `/new-interview` has a back-to-Interviews affordance, and that
   the "from the dashboard" toast copy lands as part of the same PR.
3. **Watch PREPIO-103** (de-densify the Plan) — Dashboard is still
   six stacked panels (Hero, Strip, Roadmap, HighLeverage, DeepDive,
   completion banner). When that ships, re-score "Generated output
   clarity."
4. **Tactical deferred items** — preview expiry copy precision,
   recording-time aria-live announcement, focus management on
   question advance. Pick up on the first run with live-browser
   capability.
