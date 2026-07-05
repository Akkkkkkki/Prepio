# Prepio UI/UX Review — 2026-07-05 (recurring routine, run #4)

Fourth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md),
[`2026-06-25-ux-review-routine.md`](./2026-06-25-ux-review-routine.md),
[`2026-07-02-ux-review-routine.md`](./2026-07-02-ux-review-routine.md).

## Method limitation — live egress still blocked (fourth run running)

Per the routine's capability contract
([`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md)):

- **Playwright Chromium check: PASS.** Binary present at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `playwright`
  loads from `node_modules/playwright`.
- **Live-app reachability check: FAIL.** Both `curl` and Playwright hit
  `HTTP/1.1 403 Forbidden` on CONNECT to `prepio.qiuyue.dev:443`; the
  agent proxy's `__agentproxy/status` endpoint logs the CONNECT
  rejection as `gateway answered 403 to CONNECT (policy denial or
  upstream failure)`. Supabase (`*.supabase.co`) is blocked too, so a
  local `npm run dev` fallback also can't reach real data.

Per contract, findings this run are **code and change-diff review
only** against `origin/main` at
[`8f99103`](https://github.com/Akkkkkkki/Prepio/commit/8f99103). No
screenshots, no rendered-layout claims, no mobile-viewport check, no
touch-target measurement, no keyboard/focus walk, no slow-network
observation.

This is the **fourth consecutive routine run** in which the Playwright
+ mobile + accessibility scripts could not execute. The three
previously flagged fixes (allowlist `prepio.qiuyue.dev`, or rewire
routine against `npm run dev`, or accept the reduced scope in the
contract) still haven't produced a `Q&M / area:infra` ticket in Linear.
The routine [`fix: scope ux review routine
honestly`](https://github.com/Akkkkkkki/Prepio/commit/38deb55) landed
this week — that formalises the *static-only* fallback, which is
useful, but it isn't a fix for the underlying gap.

## Meta-finding: two of the last three audits' top-priority items are still open

Product-source diff since last routine
([`f73b3f4..HEAD`](https://github.com/Akkkkkkki/Prepio/compare/f73b3f4...HEAD)):

- [`cedf338`](https://github.com/Akkkkkkki/Prepio/commit/cedf338) — React 18 → 19 upgrade (deps only, no UX-visible change expected).

Everything else since 2026-07-02 is docs, tests, dep bumps, or the
routine-scope fix. **No `src/` change addresses PREPIO-111 or
PREPIO-101.** Both were run #2's and run #3's top-priority repeat
findings. Both are now three-audit repeats.

The team is shipping quality changes (see the four PREPIO wins listed
in run #3), but the two most-flagged structural fixes keep sliding.
Recommend they enter the next cycle with the highest priority and
"do not slide again" framing.

## Overall product judgment

Product-visible surface is effectively unchanged since 2026-07-02. The
positive infra changes this week are React 19 and a formal *static-
only routine contract*; neither moves the user experience. The two
open P1s from the last two audits — the marketing hero on
`/new-interview` and the missing "Interviews" nav item — are exactly
the same, and both are directly on the returning-user daily path.
Weekly experience is not measurably easier or more compelling than
last week's review found it to be. **The biggest user-facing risk
remains the same as last run:** a logged-in user starting fresh prep
lands on a marketing-tone page that speaks past them, and the top-nav
label they most need ("Your interviews") is not in the top nav.

## Top issues

### 1. `/new-interview` still shows the marketing Home hero (third repeat)

- **Severity:** P1 (repeat, third audit)
- **Area:** landing / research entry
- **User scenario (inferred from code):** A returning logged-in user
  taps the header "New interview" CTA on `/interviews`
  ([`Interviews.tsx:161`](../../src/pages/Interviews.tsx)) or the
  empty-state "Prep a new interview" CTA
  ([`Interviews.tsx:193`](../../src/pages/Interviews.tsx)). They land
  on `/new-interview`, which mounts `Home.tsx`
  ([`App.tsx:104-112`](../../src/App.tsx)).
- **What the code renders (inferred, needs live-browser confirmation):**
  Mobile shows a giant `Prepio` wordmark and *"Move from company
  research to practice in three short steps, without the desktop-
  style sprawl."*
  ([`Home.tsx:1428-1434`](../../src/pages/Home.tsx)) — Prepio-about-
  Prepio meta-copy. Desktop shows the same wordmark and *"Get insider
  insights on any company's interview process. Tailored prep for you
  and your friends."*
  ([`Home.tsx:1546-1551`](../../src/pages/Home.tsx)) — marketing
  language. Neither branch checks `location.pathname`, so the copy is
  identical for logged-out landing and logged-in "start a new prep."
- **Why it matters:** After [PREPIO-100](https://linear.app/qiuyue/issue/PREPIO-100)
  moved returning users to `/interviews`, this is the *only* path to
  start a fresh prep. Every returning user goes through it every time.
  The routine's own copy standard says copy should be "direct,
  specific, calm, honest"; the current copy is neither direct nor
  specific to the user's task.
- **Recommended fix:** Branch on `location.pathname === '/new-interview'`
  in `Home.tsx` and render a task-oriented header ("Prep a new
  interview" / "Which role are you preparing for?") plus a back-to-
  Your-interviews link. Drop the "desktop-style sprawl" mobile line
  and the "you and your friends" desktop line.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) —
  filed 2026-06-25, still Backlog. **Escalate to Todo/In Progress
  this cycle.**

### 2. Nav still hides "Your interviews," and the redirect chain is unchanged (third repeat)

- **Severity:** P1 (repeat, third audit)
- **Area:** navigation / consistency
- **User scenario (inferred from code):** A returning user needs to
  get back to their prep list after visiting Practice or Profile.
- **What the code shows:** Top-nav items are still `Home / Dashboard /
  Practice / Practice History / Pricing / Profile`
  ([`Navigation.tsx:35-42`](../../src/components/Navigation.tsx)) — no
  "Interviews" item. The "Home" tab silently means "Your interviews"
  because `RootRoute` redirects any logged-in user hitting `/` to
  `/interviews` ([`App.tsx:70-77`](../../src/App.tsx)). "Dashboard"
  without a `searchId` also redirects into the same page (per run
  #3's Dashboard.tsx:902 note), so **two top-nav items now silently
  route to the same destination via a redirect hop.**
- **Why it matters:** NN/g heuristic 4 ("consistency and standards")
  and the routine's own recognition-vs-recall principle: nav labels
  must match destinations. Two labels for one destination fails
  recognition. This has now been flagged in three consecutive audits
  and is the tracked issue's second cycle "In Progress" without a
  landing PR.
- **Recommended fix:** Land [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101).
  Collapse nav to `Interviews` (default), `Practice`, `Profile`;
  rename `Dashboard` → `Plan` inside a prep run; move `Pricing` and
  `Practice History` under a dropdown / account menu.
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, no landing PR yet. **Escalate.**

### 3. Four different labels for "start a new prep" now coexist (grows every audit)

- **Severity:** P2 (up from P3 in run #3 — surface has broadened)
- **Area:** copy / consistency
- **User scenario (inferred from code):** A user starts fresh prep from
  wherever they happen to be — the Interviews home, the Interviews
  empty state, the guest Home form, or the old Dashboard fallback.
- **What the code shows — four labels for the same action:**
  - `Interviews.tsx:161` — **"New interview"** (populated header CTA)
  - `Interviews.tsx:193` — **"Prep a new interview"** (empty-state CTA)
  - `Home.tsx:1004` (desktop guest form title) — **"Start a new
    research run"**
  - Dashboard fallback (per run #3's `Dashboard.tsx:1004` note) —
    **"Start a new research run"**
  Related: `Interviews.tsx:152` renders an h1 *"Your interviews"* on
  the page *and* the empty-state card carries a second CardTitle
  *"Prepare for your next interview"* (line 182). Two competing
  headings on the same view.
- **Why it matters:** The empty-state → populated-state transition
  should feel like the same product. Right now the primary "start"
  action changes name at least three times as the user moves through
  Prepio. NN/g heuristic 4. Run #3 filed this as P3 for the two
  Interviews.tsx labels; another two locations have surfaced since.
- **Recommended fix:** Pick one label and use it on every "start a
  new prep" surface. **"Prep a new interview"** fits the routine's
  copy standard best and pairs cleanly with the Interviews home
  header. Bonus: drop the redundant `CardTitle` on the empty-state
  card so the page h1 stays the anchor.
- **Tracking:** file this cycle. Suggested title: *"Unify 'start a
  new prep' CTA copy across Interviews, Home, and Dashboard"*.
  `Type: Improvement`, `area:landing`, P2.

### 4. CLAUDE.md Routes table is out of date with the shipped nav

- **Severity:** P2 (new)
- **Area:** docs / DX
- **User scenario:** A new contributor (or agent) reads
  [`CLAUDE.md`](../../CLAUDE.md) to learn what routes exist. They
  see `/`, `/auth`, `/pricing`, `/dashboard`, `/search/:searchId`,
  `/practice`, `/history`, `/profile/*`, `/billing/return`. They
  don't see `/interviews` or `/new-interview`, which are now the
  *primary* logged-in home and start-fresh routes
  ([`App.tsx:93-112`](../../src/App.tsx)).
- **Why it matters:** The CLAUDE.md route table is the first
  reference every agent-driven change reads. It now describes an
  older topology than what ships, which is exactly how the run
  #2/#3/#4 nav confusion keeps compounding — one silent redirect,
  one mismatched doc, and the "primary user flow" section
  ([`CLAUDE.md#project-summary`](../../CLAUDE.md)) still calls the
  step-2 page `Dashboard.tsx` when the effective home is
  `Interviews.tsx`.
- **Recommended fix:** Update the Routes table to include the two
  new routes and mark `Dashboard` as "prep-run view" rather than
  the landing surface. Update *Primary user flow* step 2 to point
  to `Interviews.tsx` (or clarify that Dashboard is scoped to one
  prep run). Cross-link the PREPIO-101 nav-collapse in the same
  edit so the docs land the day the nav does.
- **Evidence:** [`CLAUDE.md#routes`](../../CLAUDE.md);
  [`App.tsx:93-112`](../../src/App.tsx).
- **Tracking:** file this cycle. `Type: Docs`, `area:landing`, P2.

### 5. Mobile / accessibility surface — still deferred, fourth run running

- **Severity:** Deferred (cannot assess without live testing)
- **Area:** mobile / accessibility
- **What we can say from code:** Skip-to-main link is still wired
  ([`App.tsx:85-87`](../../src/App.tsx)). Practice mode still uses
  the `data-mobile-home-footer` fixed bottom bar and the
  `MobileFooter*` clearance hooks
  ([`Home.tsx:1497-1541`](../../src/pages/Home.tsx),
  `Practice.tsx` header imports at
  [`Practice.tsx:47-49`](../../src/pages/Practice.tsx)).
- **What we still cannot say:** whether the bottom bar sits inside
  the iPhone safe area, whether touch targets meet ~44pt on a real
  device, whether the "Saved just now" affordance is visible under
  real network jitter, whether screen readers announce the answer-
  save state change, whether Tab order matches visual order across
  the landing → auth → interviews → practice walk. These require
  live testing.
- **Blocker:** the same egress restriction as the meta-finding.
  This has now been deferred four routines in a row.

## Journey scorecard

Code-level only, per the [routine's static-only
contract](./UX_REVIEW_ROUTINE.md). Rows marked **↑** improved since
run #3, **=** unchanged, **↓** worse.

| Area | Run #3 | Run #4 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | Guest landing unchanged. |
| Research entry | 3 | 3 | = | `/new-interview` marketing hero still there (PREPIO-111 unshipped). |
| Research progress/loading | — | — | = | Not assessable without live testing. |
| Generated output clarity | 4 | 4 | = | Plan-page density gains from run #3 hold. |
| Practice mode | 4 | 4 | = | No source changes since run #3. |
| Mobile usability | — | — | = | Deferred, fourth run running. |
| Resume/profile trust | 4 | 4 | = | Unchanged. |
| Dashboard/history/resume | 4 | 4 | = | PREPIO-114 gains from run #3 hold. |
| Error/empty states | 4 | 3 | ↓ | Interviews empty-state has two competing headings + a CTA-label that disagrees with its populated-state twin. Newly-noticed this run. |
| Accessibility | — | — | = | Skip-to-main confirmed. Full walk still deferred. |
| Copy quality | 4 | 3 | ↓ | Four labels for "start a new prep" is the surface that grew this week. |

Two rows moved down this run because a closer look at Interviews.tsx
and the copy landscape surfaced consistency debt that runs #2 and #3
had only partly flagged. No rows moved up — no product-source
improvements landed since run #3.

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero for logged-in users | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | Third audit unshipped. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | Third audit unshipped. In Progress since 2026-06-24 with no landing PR. |
| Live-app egress blocked | **Still open** | Fourth audit in a row. Static-only contract landed but that isn't a fix. |
| Interviews.tsx "New interview" ↔ "Prep a new interview" | **Broader than filed** | Run #3 called P3 on two locations; this run finds four across the codebase. Reclassified P2. |
| Empty-state has two competing headings | **New** | `Interviews.tsx:152` h1 + `Interviews.tsx:182` CardTitle. |
| CLAUDE.md Routes stale vs `App.tsx` | **New** | Missing `/interviews`, `/new-interview`. |

No previously-fixed regressions returned. The three carryover items
are all label/copy/nav structure, not runtime regressions.

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` | **Escalate.** Third audit repeat. Move to Todo/In Progress this cycle. |
| 2 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Dashboard → Plan | **Escalate.** Third audit repeat. In Progress since 2026-06-24 with no PR; needs an owner check-in. |
| 3 | *New* — Unify "start a new prep" CTA copy across Interviews, Home, and Dashboard | **File.** `Type: Improvement`, `area:landing`, P2. Cover the two `Interviews.tsx` labels, the desktop `Home.tsx:1004` title, and the `Dashboard.tsx` fallback. Also drop the redundant `CardTitle` "Prepare for your next interview" on the empty state so the h1 stays the anchor. |
| 4 | *New* — Refresh CLAUDE.md Routes and Primary-user-flow tables to match shipped `/interviews`, `/new-interview` topology | **File.** `Type: Docs`, `area:landing`, P2. Land in the same PR as PREPIO-101 if that ships this week. |
| 5 | *New* — File the deferred `area:infra` chore that runs #2 and #3 recommended | **File.** `Type: Chore`, `area:infra`, project **Quality & Maintenance**. Title: *"Restore live-app egress for the recurring UX-review routine (allowlist `prepio.qiuyue.dev` or rewire against local `npm run dev`)"*. Reference this audit + the last three. |

## Next-run focus

1. **PREPIO-111 and PREPIO-101 landing check.** If either lands, verify
   the copy/nav change on the day it ships. If both slide again, treat
   the fourth-repeat pattern as an ownership issue and raise in the
   Prepio Linear team, not just the audit.
2. **First run with live browser access:** run the deferred mobile
   safe-area + touch-target + keyboard-focus scripts from
   [`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md).
3. **Copy consistency sweep after the label unification (#3 above)**
   ships: audit toast copy, breadcrumb copy, and every "start a new
   prep" call-site in the same review.
4. **Recording aria-live** and **question-advance focus management**
   remain deferred from run #2. Escalate to filed issues only after
   they can be verified live.

`Capability: static code/change-diff review only`
