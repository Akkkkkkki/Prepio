# Prepio UI/UX Review — 2026-07-16 (recurring routine, run #7)

Seventh run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by
[`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- **Live-app reachability: PASS** — `curl https://prepio.qiuyue.dev/` → HTTP/2 200.
  Chromium reaches the live app with the run-#4 workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server`).

Script gotchas for future runs (adding to the run-#6 list):

- The auth form has a "Sign In" **tab** and a "Sign In" **submit
  button**. A `button:has-text("Sign In")` locator picks the tab and
  silently no-ops. Use `form button[type="submit"]` instead — reproduced
  during this run's first pass, and it took a re-run to notice sign-in
  never happened.
- Starting practice on mobile lands on an **interstitial "Hold… / Cycle
  1 of 3" breathing screen** before Q1 (see finding #1). Locators for
  the practice action rail (`Favorite`, `Needs work`, …) return
  `not_found` on the interstitial and only appear from Q2 onward.
  Playwright scripts must click through this or check `Don't show again`
  first.

## Overall product judgment

**Regression week.** Four run-#5 findings shipped and one holiday of
mostly-clean maintenance ended abruptly this cycle: a new pre-Q1
breathing interstitial ("Hold… / Cycle 1 of 3") landed in the practice
flow and it directly contradicts the design principle *"the current
practice question is the hero"*. First-time practice now begins with a
mystery meditation circle instead of an interview question. Combined
with the guest preview outage — now confirmed for the **second week
running** — the two most credibility-critical moments in the funnel
(land → convert; convert → practice) both greet the user with something
that isn't the thing they came for.

**The two long-running P1 repeats did not move.**
[PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) (marketing
hero on `/new-interview`) is now on its **seventh** audit unshipped —
verbatim *"Prepio / Get insider insights on any company's interview
process. Tailored prep for you and your friends."* still above the
form. [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) (nav
still `Prepio · Home · Dashboard · Practice · Practice History ·
Pricing · Profile`, no "Interviews") is also on its **seventh** audit,
and `/dashboard` still silently redirects to `/interviews` (fourth
audit-in-a-row confirmation). If run #6 called for ownership
escalation, run #7 calls for that plus a hard question: are these
issues assigned to anyone at all?

**The `/interviews` counter vs `/history` empty-state mismatch also
persists.** `/interviews` now reads *"2 of 40 practiced · 5%"* (up from
last week's *"1 of 40 · 3%"*), while `/history` still renders *"Ready
to start practicing"* with no rows. Two of Prepio's own scoreboards
have now disagreed about whether the user has practiced anything for
two audits in a row.

**The biggest user-facing risk this week is the practice interstitial
above all else.** Guest preview is a first-visit trust break; the
interstitial is a break for every practice session on every device by
every existing user. It's live for the tester account right now.

## Top issues

### 1. **NEW P1 — Practice launches into a "Hold… / Cycle 1 of 3" breathing interstitial before Q1**

- **Severity:** P1
- **Area:** practice / core flow
- **User scenario:** signed-in user clicks *Continue practice* on
  `/interviews`, then *Start practice* on the Practice setup screen —
  the deliberate two-click path into a real prep session.
- **What actually renders (live, mobile 390×844):** immediately after
  *Start practice*, the app renders a nearly-empty screen with a pale
  green ring at the vertical center, the word *"Hold…"* below it, and
  *"Cycle 1 of 3"* beneath that. At the bottom of the screen: an
  unchecked *"Don't show again"* checkbox and a *"Skip"* button. The
  interview question is not visible. Screenshot:
  [`assets/2026-07-16/61-m-practice-q1.png`](./assets/2026-07-16/61-m-practice-q1.png).
  The user has to either wait through what appears to be a 3-cycle
  breathing exercise, tap *Don't show again*, or tap *Skip* before Q1
  appears. Once past it, Q2/10 renders normally with the expected
  action rail (screenshot:
  [`assets/2026-07-16/66-m-after-save-continue.png`](./assets/2026-07-16/66-m-after-save-continue.png)).
- **Why it matters:** the design principles are explicit —
  *"the current practice question is the hero. Notes, metadata, timers,
  coaching, ratings, and navigation should support the question, not
  compete with it."* A meditation interstitial is not just competing
  with the question — it is *replacing* the question as the first
  screen the user sees. It also violates *"time-to-value beats feature
  count"*: the tester account had to tap through **three** discrete
  gates (Continue practice → Start practice → Skip breathing) to reach
  the first prep question. The routine's Script C explicitly asks
  *"Can the user start answering quickly?"* — the honest answer this
  week is "no, they have to bypass a breathing exercise first."
- **Additional friction:** *"Don't show again"* is default-off. Every
  session starts here until the user manually checks it. That's the
  wrong default for anything a returning user sees more than twice.
  If a breathing exercise stays in the product, it belongs at the end
  of a session ("nice work, breathe out") or gated behind an *"Open
  breathing tool"* button — not in the critical path.
- **Recommended fix (in order of decreasing scope):**
  1. Remove the interstitial from the default start-practice flow.
     Move it behind an optional entry point (`Practice setup → Add a
     breathing warm-up` toggle, off by default).
  2. If it stays in the default flow, invert the *"Don't show again"*
     default to on (i.e., show it only the first time the user reaches
     Practice, then never again unless re-enabled from Settings).
  3. Cap the total gate at ≤ 5 seconds and auto-advance — never
     require an interaction to leave a meditation screen a user did
     not opt into.
- **Tracking:** File a new Linear issue this cycle. Suggested:
  `Type: Bug`, `area:practice`, P1, `project: Quality & Maintenance`.
  Cross-link this audit.

### 2. **REPEAT P1 (second consecutive week) — Guest "Preview my prep" is still broken**

- **Severity:** P1 (still holding P1; if a synthetic monitor is not
  in place this week, promote to P0 next audit)
- **Area:** landing / conversion
- **User scenario:** identical to run #6, rotated inputs — logged-out
  visitor lands on `/`, fills Company=`Vitol`, Role=`AI Product
  Manager`, clicks *Preview my prep*.
- **What actually renders (live, desktop 1440×900):** submit button
  loads briefly, then a red error banner reads *"We couldn't build the
  preview. Try again, or sign in to run the full research workflow."*
  The right column still reads *"Tailored preview / Your Vitol preview
  will appear here / Select 'Preview my prep' to research likely stages
  and questions for this company and the AI Product Manager role."*
  Screenshots:
  [`assets/2026-07-16/02-d-landing-filled.png`](./assets/2026-07-16/02-d-landing-filled.png),
  [`assets/2026-07-16/03-d-landing-post-preview.png`](./assets/2026-07-16/03-d-landing-post-preview.png).
- **Why it matters (unchanged from run #6):** the microcopy directly
  under the button still reads *"No resume needed. No account needed
  for preview."* That promise is being violated for the second week in
  a row. The static Stripe SPM example on the right (screenshot:
  [`assets/2026-07-16/01-d-landing.png`](./assets/2026-07-16/01-d-landing.png))
  is genuinely strong and could carry the page if the live-preview CTA
  were removed — but as-is, the CTA fails silently for anyone who
  actually tries it, and only the static example on the same page
  shows any evidence that Prepio produces real questions.
- **What's new this run:** we can no longer explain this away as a
  transient outage. Two audits, two different companies (`Anthropic`
  last week, `Vitol` this week), same failure. If this were
  intermittent, one of the two attempts would have succeeded.
- **Recommended fix (same as run #6, still unshipped):**
  1. Wire an alarm on the guest-preview endpoint. A synthetic that
     pings once every 5 minutes and pages on error would have caught
     this a week ago.
  2. Fall back to the static Stripe SPM example on the right column
     with honest copy: *"Live preview didn't respond. Here's what a
     finished plan looks like for a similar role."* — not the
     unchanged pre-click empty state.
  3. If the endpoint is being cost-guarded, either remove the CTA and
     lead with the static example, or say so on click:
     *"Free previews reset hourly — try again in X minutes."*
- **Tracking:** No Linear issue was filed after run #6 despite the
  recommendation. **File this cycle** as `Type: Bug`, `area:landing`,
  P1, `project: Landing Page Framing`. Reference this audit and run
  #6's top issue.

### 3. `/new-interview` **desktop** still shows the marketing hero — SEVENTH repeat

- **Severity:** P1 (repeat, seventh audit)
- **Area:** landing / research entry
- **User scenario:** signed in as the tester, clicked *Prep a new
  interview* on `/interviews`. Standard path for a returning user
  starting a fresh prep.
- **What actually renders (live, desktop 1440×900):** unchanged from
  run #6. `/new-interview` opens with a large centered `Prepio`
  wordmark hero and the copy *"Get insider insights on any company's
  interview process. Tailored prep for you and your friends."*
  verbatim above the *"Prep a new interview"* card. Screenshot:
  [`assets/2026-07-16/11-d-new-interview.png`](./assets/2026-07-16/11-d-new-interview.png).
  This is verbatim the copy runs #2 through #6 flagged.
- **What actually renders (live, mobile 390×844):** the redesigned
  three-step wizard (COMPANY → ROLE DETAILS → PERSONALIZE) below
  *"Move from company research to practice in three short steps,
  without the desktop-style sprawl."* — screenshot:
  [`assets/2026-07-16/32-m-new-interview.png`](./assets/2026-07-16/32-m-new-interview.png).
  The *"desktop-style sprawl"* subtitle is inside-baseball copy that
  reads as a maintenance note leaked into the product, and it's still
  there.
- **Why it matters (unchanged from prior six audits):** the only path a
  returning user takes to start fresh prep still opens with a
  first-time-visitor pitch.
- **Recommended fix (unchanged from prior runs):** in `Home.tsx`,
  branch on `location.pathname === '/new-interview'` and render
  task-oriented copy. Delete the *"desktop-style sprawl"* mobile
  subtitle.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  — filed 2026-06-25, **Backlog after seven audits**.
  **Escalate: no assignee visible after two escalation calls
  (runs #6 and #7).**

### 4. Nav still has no "Interviews" item — SEVENTH repeat

- **Severity:** P1 (repeat, seventh audit)
- **Area:** navigation / consistency
- **What actually renders (live, desktop nav, captured verbatim from
  the DOM):** `Prepio · Home · Dashboard · Practice · Practice History
  · Pricing · Profile`. No "Interviews" label. Screenshot:
  [`assets/2026-07-16/10-d-interviews.png`](./assets/2026-07-16/10-d-interviews.png).
- **Live-confirmed `/dashboard` collision (fourth audit-in-a-row):**
  direct nav to `/dashboard` still resolves to `/interviews` — captured
  during this run's Script B. So "Home" and "Dashboard" remain two
  distinct nav labels that both land on the same page for a returning
  user, alongside the Prepio wordmark (also `/`-→`/interviews`).
- **Mobile:** the hamburger menu opens the same seven items (`Home,
  Dashboard, Practice, Practice History, Pricing, Profile, Sign Out`).
  Screenshot:
  [`assets/2026-07-16/31-m-menu-open.png`](./assets/2026-07-16/31-m-menu-open.png).
- **Third-surface collision (holdover from run #6):** `/history`'s
  empty-state secondary CTA `Go to Dashboard` still routes to
  `/interviews`. Screenshot:
  [`assets/2026-07-16/12-d-history.png`](./assets/2026-07-16/12-d-history.png).
  So the collision now surfaces on **three** paths: nav Home, nav
  Dashboard, and the `/history` empty-state CTA.
- **Why it matters (unchanged):** three labels leading to the same
  page, two of them named for something they're not. *"Consistency and
  standards"* heuristic violation.
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, **no landing PR after seven audits**.
  **Escalate: same ownership question as PREPIO-111.**

### 5. **REPEAT P2 (second consecutive week) — Interviews progress counter and History still disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What actually renders:** `/interviews` now shows the OpenAI
  Solutions Architect card as *"In progress / OpenAI · Solutions
  Architect / 2 of 40 practiced · 5%"* — up from *"1 of 40 · 3%"* last
  week. Screenshot (mobile):
  [`assets/2026-07-16/30-m-interviews.png`](./assets/2026-07-16/30-m-interviews.png).
  Meanwhile `/history` still renders the empty state — *"Ready to
  start practicing / Your first practice session will appear here with
  answers, timing, and notes so you can track your preparation
  progress."* — with `Prep a new interview` and `Go to Dashboard`
  CTAs. Screenshot:
  [`assets/2026-07-16/12-d-history.png`](./assets/2026-07-16/12-d-history.png).
- **New this run — the counter incremented but History stayed empty.**
  During this run I clicked through *Continue practice → Start practice
  → Skip breathing → typed a Quick note → Save & Continue* to advance
  Q1 → Q2. That's exactly the sequence a real user runs. The
  Interviews-card counter moved from *"1 of 40 practiced"* (run #6) to
  *"2 of 40 practiced"* (this run) after those actions. History
  gained zero rows.
- **Why it matters:** this is now a **confirmed** counter-vs-record
  mismatch, not an inferred one. The Interviews counter treats *"user
  advanced past a question"* as a practice event, while History filters
  to something stricter (probably a completed session with an audio
  clip or a submitted answer). Two truth surfaces still disagreeing.
- **Recommended fix (unchanged from run #6):** either
  (1) History renders in-progress sessions with a *"In progress ·
       resume"* row — converts History from graveyard to resume surface;
  or (2) change the counter copy from *"practiced"* to *"answered"*
       and add a tooltip. Option 1 is stronger.
- **Tracking:** No Linear issue filed after run #6. **File this
  cycle** as `Type: Bug`, `area:practice`, P2,
  `project: Quality & Maintenance`.

## Notable live observations (not top-5, but recorded)

### Positives from last cycle — all holding

- **Mobile hamburger 44×44** ([PREPIO-122](https://linear.app/qiuyue/issue/PREPIO-122)):
  live-measured `{x: 330, y: 10, width: 44, height: 44}` — same as
  run #6. Screenshot:
  [`assets/2026-07-16/30-m-interviews.png`](./assets/2026-07-16/30-m-interviews.png).
- **Unified "Prep a new interview" copy**
  ([PREPIO-121](https://linear.app/qiuyue/issue/PREPIO-121)): live
  confirmed on four surfaces — the `/interviews` header CTA
  (screenshot:
  [`assets/2026-07-16/10-d-interviews.png`](./assets/2026-07-16/10-d-interviews.png)),
  the `/new-interview` card title
  ([`11-d-new-interview.png`](./assets/2026-07-16/11-d-new-interview.png)),
  the `/history` empty-state primary CTA
  ([`12-d-history.png`](./assets/2026-07-16/12-d-history.png)), and
  the mobile `/interviews` header
  ([`30-m-interviews.png`](./assets/2026-07-16/30-m-interviews.png)).
  Still shipping cleanly.
- **In-session "Needs work" toggle**
  ([PREPIO-120](https://linear.app/qiuyue/issue/PREPIO-120)):
  present in the Q2 action rail —
  screenshot [`66-m-after-save-continue.png`](./assets/2026-07-16/66-m-after-save-continue.png)
  shows `Favorite · Needs work · Answer guide · Record answer · Notes ·
  Skip · Save & Continue`. Not re-measured for bbox this run —
  interstitial finding #1 ate the time budget.
- **Skip-to-main link works** on the logged-out landing — first Tab
  focus lands on `A[href="#main-content"]` with visible outline.
  Fifth live confirmation. Screenshot:
  [`assets/2026-07-16/41-d-landing-firsttab.png`](./assets/2026-07-16/41-d-landing-firsttab.png).
- **Landing hero unchanged, still strong.** Headline *"Walk into your
  next interview knowing exactly what to expect."* still rendering,
  Stripe SPM static example intact — screenshot
  [`01-d-landing.png`](./assets/2026-07-16/01-d-landing.png). This is
  the page that's still doing conversion work despite the broken CTA.
- **Autosave copy healthy on mobile.** During Q2, the Quick notes card
  rendered *"Saving draft…"* while I typed — visible in
  [`66-m-after-save-continue.png`](./assets/2026-07-16/66-m-after-save-continue.png)
  next to the "Quick notes / Saved on this device while you practice."
  panel. PREPIO-108 still healthy — fourth live confirmation.

### Small things worth logging

- **`/auth` autocomplete attributes still `null`** on both email and
  password inputs ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)).
  Verified this run via `getAttribute('autocomplete')` returning `null`
  on both inputs. Screenshot:
  [`assets/2026-07-16/40-d-auth.png`](./assets/2026-07-16/40-d-auth.png).
  Small a11y / password-manager fix, still open.
- **"Save & Continue" copy is misleading when the answer input is
  empty.** On Q2 with nothing typed into Quick notes and no recording
  captured, tapping *Save & Continue* silently advances to Q3 without
  saving anything — but the counter still increments *"practiced"*.
  Suggest either disabling the button until something is saved, or
  renaming it to *"Next question"* when nothing has been captured.
  Not a top-5 finding on its own, but it's part of the same
  counter-honesty problem as finding #5.
- **Mobile-only: no obvious "type an answer" surface on the practice
  question card.** The visible options on Q2 are *Record answer*
  (primary green pill, opens the audio flow) and *Notes* (secondary
  outline pill, opens a `Jot the beats you want to hit…` textarea
  labeled *"Quick notes / Saved on this device while you practice."*).
  Notes are explicitly device-only drafts, not answers — so a user who
  wants to type a full answer instead of recording one has no obvious
  path from this screen. Filed as a needs-verification item because I
  didn't confirm whether the Answer-guide drawer contains a typed-answer
  input or whether that's desktop-only.
- **Multi-flag coexistence (PR #233): still not confidently
  live-verified.** This run's clicks landed on the pre-Q1 breathing
  interstitial's Skip button rather than the action-rail flag buttons,
  so `aria-pressed` readings from that pass are not valid evidence.
  Roll this forward again to run #8 as a targeted probe. Third
  audit-in-a-row where I've failed to get clean readings.
- **`/pricing` and `/profile` unchanged.** No visual regressions
  spotted. Profile still opens with the honest *"We prefilled this
  profile from the last parsed resume. Save once to make it your
  editable canonical version."* banner
  ([`13-d-profile.png`](./assets/2026-07-16/13-d-profile.png)),
  pricing table still lists Free/Monthly/Quarterly/Annual with
  plain-English discount language
  ([`14-d-pricing.png`](./assets/2026-07-16/14-d-pricing.png)).

## Journey scorecard

Rows marked **↑** improved since run #6, **=** unchanged, **↓** worse.
Cells marked **(live)** are live-verified this run.

| Area | Run #6 | Run #7 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static Stripe example still strong, but the "Preview my prep" CTA is still broken (second consecutive week). Score won't recover until the CTA works or the CTA is removed. |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` desktop marketing hero and mobile "desktop-style sprawl" subtitle both unchanged for seventh audit. |
| Research progress/loading | — | — | = | Not reached — still no fresh authenticated research run kicked off (fifth "not-scored" cycle). Owed. |
| Generated output clarity | 4 | 4 | = | **(live)** Reviewed via the Interviews-card summary — 40 questions across 4 stages for OpenAI Solutions Architect. Plan page not re-audited this run. |
| Practice mode | 5 | 3 | **↓↓** | **(live)** New breathing interstitial blocks Q1 on every session. Q2 onward is fine (question-as-hero layout intact, autosave copy still healthy, all action-rail buttons visible). But "first practice question" is the moment that matters most and it's been paved over. |
| Mobile usability | 4 | 3 | ↓ | **(live)** Hamburger 44×44 still shipping. But the new breathing interstitial ships on mobile too and is the first-touch experience of practice on the device the design principles say matters most. |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile page copy unchanged, banner still honest, source file still shown. Not re-audited in depth. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (finding #5), now empirically confirmed after this run's Save & Continue click bumped the counter but not History. Third audit in a row this surface reads as broken. |
| Error/empty states | 3 | 3 | = | **(live)** Guest preview error banner still honest but silent about the right column. `/history` empty state still fine but its "Go to Dashboard" CTA still lands on `/interviews`. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main and hamburger 44×44 confirmed again. `/auth` autocomplete=null still open. `aria-pressed` on practice flags not cleanly re-verified this run — deferred. Owed: real keyboard-only + screen-reader pass (five audits owed). |
| Copy quality | 4 | 4 | = | **(live)** Landing hero still strong, unified CTA copy still shipping, honest autosave copy still shipping. But new *"Hold… / Cycle 1 of 3"* copy on the practice interstitial reads as if it wandered in from a different app. And "Save & Continue" advancing an empty answer is dishonest copy (see small things). |

**Composite trend: −4 net (three drops of 1 or 2 points, no rises).**
First unambiguously negative composite since the run-#5 spike.

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | Seventh audit unshipped. Escalate. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | Seventh audit unshipped. In Progress since 2026-06-24, no landing PR. Escalate. |
| Guest "Preview my prep" broken | **Still broken — second consecutive week** | Never had a Linear issue filed after run #6; file this cycle. |
| Interviews-vs-History counter mismatch | **Still broken — second consecutive week** | Never had a Linear issue filed after run #6; file this cycle. Now empirically reproducible (counter bumped by tester actions, History stayed empty). |
| `/dashboard` direct-URL redirect collision | **Fourth consecutive live confirmation** | Filed under PREPIO-101 tracking. |
| `/history` "Go to Dashboard" CTA lands on `/interviews` | **Still open** (component of PREPIO-101) | Second consecutive audit surfacing this. |
| Password autocomplete missing on `/auth` | **Still open** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | Small fix. |
| **NEW:** Practice starts with a "Hold… / Cycle 1 of 3" breathing interstitial before Q1 | **New P1 finding** | See top issue #1. |
| **NEW (small):** "Save & Continue" advances Q1→Q2 with no captured answer, but the "practiced" counter increments | **New minor** | Part of the same honesty problem as finding #5. |
| Mobile hamburger 44×44 | **Holding** ✅ | Verified this run. |
| Unified "Prep a new interview" copy | **Holding** ✅ | Verified on 4 surfaces. |
| In-session "Needs work" toggle | **Holding** ✅ | Present in Q2 action rail. |
| Autosave "Saving draft… / Draft kept in this tab" copy | **Holding** ✅ | Visible on Q2 during typing. |
| Skip-to-main + focus outline | **Holding** ✅ | Fifth confirmation. |
| Landing hero + static Stripe example | **Holding** ✅ | Unchanged, still strong. |

**Zero new fixes shipped this cycle.** Two long-running P1s did not
move, two new-in-run-#6 P1/P2s stayed open, and one new P1 landed.

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | **NEW P1:** Remove the "Hold… / Cycle 1 of 3" breathing interstitial from the default start-practice flow (or invert "Don't show again" default). See top issue #1. | **File this cycle.** `Type: Bug`, `area:practice`, P1, `project: Quality & Maintenance`. Cross-link this audit. |
| 2 | **STILL NOT FILED — file this cycle:** Guest "Preview my prep" returns error and silently keeps the right column in pre-click empty state (top issue #2). | **File this cycle.** `Type: Bug`, `area:landing`, P1, `project: Landing Page Framing`. Also worth wiring a synthetic health check. |
| 3 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` (both viewports); delete the *"desktop-style sprawl"* mobile subtitle. | **Escalate.** Seventh audit repeat. Ownership check. |
| 4 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Home & Dashboard, drop the third-surface `/history` "Go to Dashboard" CTA. | **Escalate.** Seventh audit repeat. In Progress since 2026-06-24 with no PR. Ownership check. |
| 5 | **STILL NOT FILED — file this cycle:** Align `/interviews` "practiced" counter with `/history` (top issue #5). Prefer option 1 — render in-progress sessions in `/history`. | **File this cycle.** `Type: Bug`, `area:practice`, P2, `project: Quality & Maintenance`. |
| 6 | [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) — add `autocomplete` attributes to email + password inputs on `/auth`. | Still open. Small fix. |
| 7 | **Needs-verification for run #8:** PR #233 multi-flag coexistence — third audit failing to get clean live evidence. Get past the breathing interstitial by pre-checking "Don't show again" once, then run the Favorite + Needs work sequence with `waitForResponse` between clicks. | **Defer to run #8 as a targeted probe.** No Linear ticket yet. |
| 8 | **Needs-verification for run #8:** On the mobile practice question card, is there a typed-answer input path that isn't the notes drawer? (Answer guide? Long-press? Desktop only?). | **Defer to run #8.** If the answer is "voice-first only on mobile," flag as an intentional design choice; if the answer is "yes but hidden," file as UX friction. |

## Next-run focus

1. **The breathing interstitial (finding #1)** is the single fix that
   would recover the most journey-scorecard ground in run #8. Fix it
   or move it out of the critical path.
2. **File the two never-filed Linear issues** from run #6 (guest
   preview outage; counter-vs-history mismatch). This should happen
   this cycle, not next.
3. **Ownership escalation on PREPIO-111 and PREPIO-101** — both are
   at seven audit repeats. If they don't move this week either,
   consider re-scoping them (are they blocked on a bigger nav
   redesign that's not on any roadmap?).
4. **Budget a real research-run end-to-end** — company + role →
   loading state → generated stages → Plan page → practice → session
   completion. Five audits owed now.
5. **Real keyboard-only + screen-reader pass** — five audits owed.
   Include `aria-pressed` behavior on practice flags in that pass.
6. **Re-verify PR #233 multi-flag coexistence** after skipping past
   the breathing interstitial. Third audit failing to get clean
   evidence.
7. **Empty-state coverage** — tester account still has one interview
   so the true empty `/interviews` state is unreachable. Use a fresh
   test account or temporarily archive the tester's OpenAI SA
   interview to reach the truly-empty state.

`Capability: live browser verified`
