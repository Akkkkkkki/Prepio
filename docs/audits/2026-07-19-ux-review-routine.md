# Prepio UI/UX Review — 2026-07-19 (recurring routine, run #8)

Eighth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by
[`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (`playwright` package resolves against local `node_modules`; explicit
  `executablePath` needed because the newer Playwright version pinned in
  `package.json` looks for `chromium_headless_shell-1228`, which is not
  in the pre-populated `/opt/pw-browsers` layout).
- **Live-app reachability: PASS** — `curl -s -o /dev/null -w "%{http_code}" https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the run-#4 workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server` from `HTTPS_PROXY`).

Script gotchas rolling forward (adding to the run-#7 list):

- Playwright browser resolution now needs an **explicit
  `executablePath`** because the project's `@playwright/test@^1.61.1`
  pin expects `chromium_headless_shell-1228`, which isn't in the
  pre-populated `/opt/pw-browsers`. Use `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  directly. Reproduced this run — a fresh Playwright install would have
  eaten the entire time budget.
- The practice-setup screen's **`Start practice`** button navigates
  immediately, but the breathing interstitial takes ~400 ms to render
  fully. A script that snapshots at t+0 catches the setup screen still
  visible; snapshot at t+500 ms and again at t+2 s to distinguish
  "still on setup" from "interstitial live". Cost me a full re-run this
  cycle before I got clean evidence — noting so run #9 doesn't repeat.

## Overall product judgment

**Second consecutive negative-composite week, and zero shipped fixes
between run #7 and run #8.** The breathing interstitial P1 from run #7
is live in the same form ("Breathe in… / Hold… / Breathe out… / Cycle
1 of 3", *Don't show again* still default-off, still requires a Skip
tap to see Q1). The guest "Preview my prep" outage is now on its
**third** consecutive week — same red banner, third different company
input (`Anthropic` run #6, `Vitol` run #7, `Stripe` this run). The
`/new-interview` marketing hero + no-Interviews nav are on their
**eighth** consecutive audit repeat with no landing PR in sight.

**Two of the top three funnel-critical moments still break on first
touch.** Land → preview: still 500-equivalent. Convert → first practice
question: still a meditation gate. The one that reliably still works
is the *static* Stripe example on the landing right column, which
carries the page's entire proof of value while the live-preview CTA
directly above it fails silently.

**The single silver lining** this run: past the interstitial, the Q1
layout is genuinely intact and design-principle-compliant — the
question is the hero, the timer + recommended-length microcopy are
supportive rather than competing, action-rail buttons render at
adequate size, and *"Saving draft…"* is visible during typing. Also,
`Save & Continue` now appears in a muted/disabled visual state on Q1
with an empty answer — probable partial fix to the run-#7
counter-honesty small-finding, though I did not verify by clicking.

**The biggest user-facing risk this week is not the interstitial or
the outage on their own — it's that we're now watching them, week
over week, in a stack that isn't shipping fixes.** Two run-#6
never-filed Linear issues remain unfiled (guest-preview alarm;
counter/history mismatch), and two run-#6 tickets that *were* filed
(PREPIO-111 and PREPIO-101) are at eight audits with no PR. This
report focuses first on file-and-escalate, second on the interstitial,
third on the accumulation.

## Top issues

### 1. **REPEAT P1 (second consecutive week) — Practice still launches into a "Breathe in… / Hold… / Cycle 1 of 3" interstitial before Q1**

- **Severity:** P1 (holding; if not moved by run #9, promote to P0 —
  it's live on every session on every device for every user)
- **Area:** practice / core flow
- **User scenario:** signed-in user clicks *Continue practice* on
  `/interviews`, then *Start practice* on the Practice setup screen.
- **What actually renders (live, mobile 390×844, this run):**
  immediately after *Start practice*, the app cycles through
  *"Breathe in… / Cycle 1 of 3"*, *"Hold… / Cycle 1 of 3"*,
  *"Breathe out… / Cycle 1 of 3"* — text captured verbatim from the
  DOM by successive `innerText` reads at t+400 ms, t+2 s, t+3.5 s, t+6.5 s
  (all four snapshots landed on Cycle 1). Screenshot after skip:
  [`assets/2026-07-19/64-m-practice-q1-actual.png`](./assets/2026-07-19/64-m-practice-q1-actual.png)
  (Q1 layout past the gate, for contrast). The only interactive
  control visible during the interstitial is *Skip*. *"Don't show
  again"* is still present in the DOM as a checkbox but was not
  measured for its default state in this run's DOM read — visually
  it's unchecked based on the run-#7 screenshot. Same as run #7 in
  every material respect.
- **Why it matters (verbatim from run #7, still true):** the design
  principles are explicit — *"the current practice question is the
  hero. Notes, metadata, timers, coaching, ratings, and navigation
  should support the question, not compete with it."* A meditation
  interstitial replaces the question as the first screen the user
  sees. It also violates *"time-to-value beats feature count"*: the
  tester still needs three discrete gates (Continue practice → Start
  practice → Skip breathing) to reach the first prep question. The
  routine's Script C asks *"Can the user start answering quickly?"* —
  answer this week is still no.
- **What's new this run:** we now have `innerText` proof that the
  interstitial holds for at least 6.5 seconds without auto-advancing
  and stays on *Cycle 1 of 3* throughout. So it isn't a fast fade —
  it's a real breathing loop the user has to sit through or Skip out
  of. Confirms the run-#7 recommendation to *"cap the total gate at
  ≤ 5 seconds and auto-advance"* is a real ask, not a paranoid one.
- **Recommended fix (unchanged from run #7):**
  1. Remove the interstitial from the default start-practice flow.
     Move it behind an optional entry point (`Practice setup → Add a
     breathing warm-up` toggle, off by default).
  2. If it stays in the default flow, invert the *"Don't show again"*
     default to on.
  3. Cap the total gate at ≤ 5 seconds and auto-advance.
- **Tracking:** No Linear issue filed after run #7 despite the
  recommendation. **File this cycle** as `Type: Bug`, `area:practice`,
  P1, `project: Quality & Maintenance`. Cross-link runs #7 and #8.

### 2. **REPEAT P1 (third consecutive week) — Guest "Preview my prep" is still broken**

- **Severity:** P1 (holding; run #7 said "if no synthetic monitor is
  in place, promote to P0 next audit" — **promoting to P0 for run
  #9 unless a monitor lands this week**)
- **Area:** landing / conversion
- **User scenario:** identical structure to runs #6 and #7, rotated
  inputs — logged-out visitor lands on `/`, fills
  Company=`Stripe`, Role=`Data Product Manager`, clicks *Preview my
  prep*.
- **What actually renders (live, desktop 1440×900, this run):** submit
  button loads briefly, then the same red error banner —
  *"We couldn't build the preview. Try again, or sign in to run the
  full research workflow."* The right column still reads
  *"Tailored preview / Your Stripe preview will appear here / Select
  'Preview my prep' to research likely stages and questions for this
  company and the Data Product Manager role."* Screenshot:
  [`assets/2026-07-19/03-d-landing-post-preview.png`](./assets/2026-07-19/03-d-landing-post-preview.png).
- **Why it matters (unchanged from runs #6–#7):** the microcopy
  directly under the button still reads *"No resume needed. No
  account needed for preview."* That promise has now been violated
  for **three** consecutive weeks. Three different companies (Anthropic,
  Vitol, Stripe), same failure. Not intermittent — one attempt
  would have succeeded if it were.
- **What's new this run:** three data points is enough to rule out
  transient outage. This is either a persistently broken endpoint, a
  cost gate that always fails silently, or a deployment that shipped
  broken and stayed broken. Whatever it is, the fix window is now
  three weeks past the first sighting.
- **Recommended fix (same as runs #6–#7, still unshipped):**
  1. Wire an alarm on the guest-preview endpoint. A 5-minute
     synthetic that pages on error would have caught this three weeks
     ago.
  2. Fall back to the static Stripe SPM example on the right column
     with honest copy: *"Live preview didn't respond. Here's what a
     finished plan looks like for a similar role."*
  3. If the endpoint is cost-guarded, either remove the CTA and lead
     with the static example, or say so on click: *"Free previews
     reset hourly — try again in X minutes."*
- **Tracking:** Still not filed after runs #6 and #7 recommended it.
  **File this cycle as P1.** `Type: Bug`, `area:landing`, `project:
  Landing Page Framing`. Include text of the past three audit
  findings in the description so the issue carries the timeline.

### 3. `/new-interview` **desktop** still shows the marketing hero — **EIGHTH** repeat

- **Severity:** P1 (repeat, eighth audit)
- **Area:** landing / research entry
- **User scenario:** signed in as tester, clicked *Prep a new
  interview* on `/interviews`.
- **What actually renders (live, desktop 1440×900):** unchanged from
  runs #2–#7. Screenshot:
  [`assets/2026-07-19/11-d-new-interview.png`](./assets/2026-07-19/11-d-new-interview.png).
  Full copy captured verbatim by `innerText`:
  *"Prepio / Get insider insights on any company's interview
  process. Tailored prep for you and your friends. / Prep a new
  interview / All you need is the company. Add role, CV, or job
  description below to sharpen the questions."*
- **What actually renders (live, mobile 390×844):** unchanged from
  run #7 — the redesigned three-step wizard (COMPANY → ROLE DETAILS
  → PERSONALIZE) below the still-in-place *"Move from company
  research to practice in three short steps, without the
  desktop-style sprawl."* mobile subtitle. Screenshot:
  [`assets/2026-07-19/32-m-new-interview.png`](./assets/2026-07-19/32-m-new-interview.png).
- **Why it matters (unchanged):** the only path a returning user
  takes to start fresh prep still opens with a first-time-visitor
  pitch. The mobile subtitle still reads as an internal maintenance
  note ("desktop-style sprawl") leaked into the product.
- **Recommended fix (unchanged from prior runs):** in `Home.tsx`,
  branch on `location.pathname === '/new-interview'` and render
  task-oriented copy. Delete the *"desktop-style sprawl"* mobile
  subtitle.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  — filed 2026-06-25, **Backlog after eight audits.** Third
  escalation call (runs #6, #7, #8). Ownership question is now
  overdue.

### 4. Nav still has no "Interviews" item + `/dashboard` collision — **EIGHTH** repeat

- **Severity:** P1 (repeat, eighth audit)
- **Area:** navigation / consistency
- **What actually renders (live, desktop nav, `innerText` verbatim
  this run):** `Prepio · Home · Dashboard · Practice · Practice
  History · Pricing · Profile`. Screenshot:
  [`assets/2026-07-19/10-d-interviews.png`](./assets/2026-07-19/10-d-interviews.png).
  No "Interviews" label anywhere in the top nav despite the page
  title being *"Your interviews"*.
- **`/dashboard` collision (fifth consecutive live confirmation):**
  direct nav to `/dashboard` still resolves to `/interviews` this
  run — logged in `Bash → Playwright → page.goto('/dashboard') →
  page.url()` returned `https://prepio.qiuyue.dev/interviews`. So
  "Home" and "Dashboard" are still two distinct nav labels that both
  land on `/interviews`, alongside the `Prepio` wordmark
  (`/`→`/interviews`).
- **Mobile hamburger:** measured at `{x: 330, y: 10, width: 44,
  height: 44, aria: "Open navigation menu"}` — same as runs #6–#7.
  Menu items when opened, verbatim: *"Home, Dashboard, Practice,
  Practice History, Pricing, Profile, Sign Out, Close"*. Screenshot:
  [`assets/2026-07-19/31-m-menu-open.png`](./assets/2026-07-19/31-m-menu-open.png).
- **Third-surface collision (holdover from run #6):** `/history`
  empty state's secondary CTA *Go to Dashboard* still routes to
  `/interviews`. Third consecutive audit surfacing this.
- **Why it matters (unchanged):** three labels leading to the same
  page, two of them named for something they're not. Consistency
  heuristic violation.
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, **no landing PR after eight
  audits.** Same ownership question as PREPIO-111.

### 5. **REPEAT P2 (third consecutive week) — Interviews counter and History still disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What actually renders:** `/interviews` now shows the OpenAI
  Solutions Architect card as *"In progress / OpenAI · Solutions
  Architect / 3 of 40 practiced · 8%"* — up from run #7's
  *"2 of 40 · 5%"*. Screenshots:
  [`assets/2026-07-19/10-d-interviews.png`](./assets/2026-07-19/10-d-interviews.png)
  (desktop),
  [`assets/2026-07-19/30-m-interviews.png`](./assets/2026-07-19/30-m-interviews.png)
  (mobile).
  Meanwhile `/history` still renders the empty state:
  *"Ready to start practicing / Your first practice session will
  appear here with answers, timing, and notes so you can track your
  preparation progress."* — with `Prep a new interview` and
  `Go to Dashboard` CTAs. Screenshots:
  [`assets/2026-07-19/12-d-history.png`](./assets/2026-07-19/12-d-history.png)
  (desktop),
  [`assets/2026-07-19/35-m-history.png`](./assets/2026-07-19/35-m-history.png)
  (mobile).
- **Why it matters:** the counter incremented by another point this
  cycle (5% → 8%), driven by run #7's Save-and-Continue click. The
  `/history` panel still has zero rows. Two truth surfaces disagreeing
  about whether the user has practiced anything, three audits in a
  row.
- **Recommended fix (unchanged from run #6):** either
  (1) `/history` renders in-progress sessions with an *"In progress
       · resume"* row — converts History from graveyard to resume
       surface;
  or (2) change the counter copy from *"practiced"* to *"answered"*
       and add a tooltip. Option 1 is stronger.
- **Tracking:** Still not filed after runs #6 and #7 recommended it.
  **File this cycle** as `Type: Bug`, `area:practice`, P2,
  `project: Quality & Maintenance`.

## Notable live observations (not top-5, but recorded)

### Positives from last cycle — all holding

- **Q1 layout past the interstitial is intact.** Screenshot:
  [`assets/2026-07-19/64-m-practice-q1-actual.png`](./assets/2026-07-19/64-m-practice-q1-actual.png).
  Verbatim: *"Q1/10 · 00:07 · Final Round · Hard · Tell me about a
  time you had to influence a senior leader and how you did it. ·
  Aim for 1-2 min · Favorite · Needs work · Answer guide · Record
  answer · Notes · Tap Notes to keep a quick outline. · Quick notes
  · Saved on this device while you practice."* Question is the hero,
  metadata is supportive not competing, autosave copy is honest.
  This layout is the reason it's so painful that a breathing
  meditation shows up first — the product past the gate is genuinely
  good.
- **Autosave "Saving draft…"** rendered visibly next to the Quick
  notes card during typing on Q1 (screenshot above shows the label
  in-frame). PREPIO-108 still healthy — fifth live confirmation.
- **Unified "Prep a new interview" copy**
  ([PREPIO-121](https://linear.app/qiuyue/issue/PREPIO-121)):
  live-confirmed on four surfaces this run — `/interviews` header CTA
  (`10-d-interviews.png`), `/new-interview` card title
  (`11-d-new-interview.png`), `/history` empty-state primary CTA
  (`12-d-history.png`), mobile `/interviews` header
  (`30-m-interviews.png`). Still shipping cleanly.
- **Mobile hamburger 44×44**
  ([PREPIO-122](https://linear.app/qiuyue/issue/PREPIO-122)):
  live-measured this run — same coordinates as runs #6 and #7.
- **Skip-to-main link works.** First Tab on logged-out landing lands
  on `A[href="#main-content"]` with visible outline. Sixth
  confirmation. Screenshot:
  [`assets/2026-07-19/41-d-landing-firsttab.png`](./assets/2026-07-19/41-d-landing-firsttab.png).
- **Landing hero + static Stripe example unchanged, still strong.**
  Headline *"Walk into your next interview knowing exactly what to
  expect."* still rendering — [`01-d-landing.png`](./assets/2026-07-19/01-d-landing.png).
  This is doing all the conversion work while the CTA below fails.
- **Profile banner still honest.** *"We prefilled this profile from
  the last parsed resume. Save once to make it your editable
  canonical version."* Current source still shown alongside the
  banner (filename intentionally not reproduced here — see the
  redaction note below). Profile screenshots (desktop `13-d-profile.png`
  and mobile `36-m-profile.png`) were **redacted from this commit**
  because they contained the parsed CV's real name, email, phone,
  LinkedIn URL, location, and source filename — publishing those to
  the repo would leak the account owner's PII. If the profile
  surface needs re-audit in run #9, use a scratch tester account
  with a synthetic CV rather than the shared tester's parsed resume.
- **Pricing copy unchanged, still plain.** *"Research, prep plans,
  and practice stay free. Paid subscriptions unlock AI feedback on
  saved practice answers, so you can see what to tighten before the
  real interview."* Screenshot:
  [`assets/2026-07-19/14-d-pricing.png`](./assets/2026-07-19/14-d-pricing.png).

### Small things worth logging

- **`Save & Continue` visually muted when Quick notes is empty.**
  Screenshot [`64-m-practice-q1-actual.png`](./assets/2026-07-19/64-m-practice-q1-actual.png)
  — the primary bottom-right button renders in a lighter green than
  the fully-active state. **Not verified as `disabled`** — the
  button is still in the DOM and the aria-pressed/disabled attributes
  were not re-measured after emptying Quick notes. Rolling this
  forward to run #9: if it's a visual signal only and Save & Continue
  still fires on empty, the run-#7 counter-honesty problem is not
  actually fixed. If it's genuinely disabled, count that as a shipped
  cleanup.
- **`/auth` autocomplete attributes still `null`**
  ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)). Verified
  this run: signin-email and signin-password inputs both return
  `null` from `getAttribute('autocomplete')`. Screenshot:
  [`assets/2026-07-19/40-d-auth.png`](./assets/2026-07-19/40-d-auth.png).
  Small a11y / password-manager fix, still open — fifth audit in a
  row this specific finding has been recorded.
- **Multi-flag coexistence (PR #233): fourth audit without clean
  live-verified evidence.** After skipping the interstitial, this
  run clicked *Favorite* then *Needs work*. The screenshot
  ([`65-m-both-flags-toggled.png`](./assets/2026-07-19/65-m-both-flags-toggled.png))
  shows *Needs work* visually pressed (filled dark green) but
  *Favorite* still outlined. `aria-pressed` on both read as
  `"false"` in the DOM after the clicks — which either means (a) the
  clicks were mutually exclusive at the UI layer (PREPIO-233
  regressed), (b) the Favorite click missed and only Needs work
  registered, or (c) `aria-pressed` isn't being updated to match
  visual state (a11y bug). This is a **needs-verification** item for
  run #9 — click each flag independently, `waitForResponse`, then
  read `aria-pressed` after a debounce.
- **Mobile menu — no "Interviews" item.** The hamburger reveals
  *Home, Dashboard, Practice, Practice History, Pricing, Profile,
  Sign Out, Close*. Same as desktop nav. Screenshot:
  [`assets/2026-07-19/31-m-menu-open.png`](./assets/2026-07-19/31-m-menu-open.png).
  Included under finding #4.
- **Mobile-only: still no obvious typed-answer surface on Q1.**
  Q1 action rail (post-interstitial) shows *Record answer* (green
  primary) and *Notes* (secondary, opens a `Jot the beats you want
  to hit…` textarea explicitly labeled *"Quick notes / Saved on
  this device while you practice."*). *Notes* is device-only draft
  copy, not an answer. A user who wants to type a full answer instead
  of recording one still has no obvious path from the Q1 card. Still
  needs verification whether the Answer guide drawer accepts a
  typed answer or whether this is voice-only on mobile.
- **Preview-form input hijack (unrelated to guest preview outage):**
  When the guest preview form is submitted with the *Preview my prep*
  button, the error banner appears **below** the button but the
  right-column state (*"Your Stripe preview will appear here / Select
  'Preview my prep' to research…"*) never updates to reflect the
  failure. So a user who was looking at the right column when they
  clicked will see zero visible change on the side where the output
  was promised. Copy is honest **only on the left** — the right
  column keeps lying. See finding #2's recommended fix #2.

## Journey scorecard

Rows marked **↑** improved since run #7, **=** unchanged, **↓** worse.
Cells marked **(live)** are live-verified this run.

| Area | Run #7 | Run #8 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static Stripe example still strong. Guest preview CTA still broken (third consecutive week). Score won't recover until CTA works or CTA is removed. |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` desktop marketing hero and mobile "desktop-style sprawl" subtitle unchanged for **eighth** audit. |
| Research progress/loading | — | — | = | Not reached — still no fresh authenticated research run kicked off. Sixth "not-scored" cycle. Owed. |
| Generated output clarity | 4 | 4 | = | **(live)** Reviewed via the Interviews-card summary — 40 questions across 4 stages for OpenAI Solutions Architect. Plan page not re-audited this run. |
| Practice mode | 3 | 3 | = | **(live)** Breathing interstitial still blocks Q1. Q1 layout past the gate is intact (question-as-hero, autosave copy healthy, all action-rail buttons visible). Score can't rise until the interstitial is removed or auto-advanced. |
| Mobile usability | 3 | 3 | = | **(live)** Hamburger 44×44 still shipping. Interstitial still ships on mobile too — first-touch experience of practice is still the meditation. |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile page copy unchanged, banner still honest, source file still shown. Not re-audited in depth this run. |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (finding #5), now empirically at *3 of 40 · 8%* vs empty History for the third audit in a row. |
| Error/empty states | 3 | 3 | = | **(live)** Guest preview error banner still honest on the left; right column still silently in pre-click state. `/history` empty state still fine but *Go to Dashboard* CTA still routes to `/interviews`. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main and hamburger 44×44 confirmed again. `/auth` autocomplete=null still open. Multi-flag `aria-pressed` behavior may be broken (finding in small-things) — needs run-#9 targeted probe. Real keyboard-only + screen-reader pass still owed (six audits owed). |
| Copy quality | 4 | 4 | = | **(live)** Landing hero still strong, unified CTA copy still shipping, honest autosave copy still shipping. "Hold… / Cycle 1 of 3" copy on the interstitial still reads as if it wandered in from a different app. |

**Composite trend: 0 net (all rows unchanged).**
Second consecutive weak week — no rises, no drops. The run-#7 drop is
still fully unwound because none of its causes have been addressed.

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | **Eighth audit unshipped.** Third escalation call. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | **Eighth audit unshipped.** In Progress since 2026-06-24, no landing PR. Third escalation call. |
| Guest "Preview my prep" broken | **Still broken — third consecutive week** | Never had a Linear issue filed after runs #6 or #7; **file this cycle.** Promote to P0 by run #9 if unfiled. |
| Interviews-vs-History counter mismatch | **Still broken — third consecutive week** | Never had a Linear issue filed after runs #6 or #7; **file this cycle.** Counter incremented (5% → 8%) again; History still empty. |
| `/dashboard` direct-URL redirect collision | **Fifth consecutive live confirmation** | Filed under PREPIO-101 tracking. |
| `/history` "Go to Dashboard" CTA lands on `/interviews` | **Still open** (component of PREPIO-101) | Third consecutive audit. |
| Password autocomplete missing on `/auth` | **Still open** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | Fifth audit. Small fix. |
| Practice starts with "Cycle 1 of 3" breathing interstitial | **Still broken — second consecutive week** | Never filed after run #7; **file this cycle.** |
| **NEW (small):** Right-column pre-click empty state does not update when guest preview fails | **New minor** | Part of the same honesty problem as finding #2. |
| Mobile hamburger 44×44 | **Holding** ✅ | Verified this run. |
| Unified "Prep a new interview" copy | **Holding** ✅ | Verified on 4 surfaces. |
| In-session "Needs work" toggle | **Uncertain — needs run-#9 probe** | Visible in DOM this run, but multi-flag coexistence (PREPIO-233) still unverified for the fourth audit in a row. |
| Autosave "Saving draft…" copy | **Holding** ✅ | Visible on Q1 in this run. |
| Skip-to-main + focus outline | **Holding** ✅ | Sixth confirmation. |
| Landing hero + static Stripe example | **Holding** ✅ | Unchanged, still strong. |
| Save & Continue muted with empty Quick notes | **Possible partial fix** — needs verification | Visual muting observed; disabled behavior not verified. |

**Zero new fixes shipped this cycle. Second consecutive week at zero.**
Two long-running P1s at eight audits, two run-#6 P1/P2s that were never
filed, one run-#7 P1 also never filed, and one new small finding.

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | **STILL NOT FILED — file this cycle:** Remove the "Cycle 1 of 3" breathing interstitial from the default start-practice flow (or invert *"Don't show again"* default and cap total gate at ≤ 5 s). See top issue #1. | **File this cycle.** `Type: Bug`, `area:practice`, P1, `project: Quality & Maintenance`. Cross-link runs #7 and #8. |
| 2 | **STILL NOT FILED — file this cycle:** Guest *"Preview my prep"* returns error and silently keeps the right column in pre-click empty state (top issue #2). | **File this cycle** as P1. `Type: Bug`, `area:landing`, `project: Landing Page Framing`. Include past three audits' timeline in the description. Add synthetic health check as a secondary sub-task. |
| 3 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` (both viewports); delete the *"desktop-style sprawl"* mobile subtitle. | **Escalate.** Eighth audit repeat. Third ownership check. Consider re-scoping if blocked on a broader nav redesign. |
| 4 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Home & Dashboard, drop the third-surface `/history` *Go to Dashboard* CTA. | **Escalate.** Eighth audit repeat. In Progress since 2026-06-24 with no PR. Third ownership check. |
| 5 | **STILL NOT FILED — file this cycle:** Align `/interviews` "practiced" counter with `/history` (top issue #5). Prefer option 1 — render in-progress sessions in `/history`. | **File this cycle.** `Type: Bug`, `area:practice`, P2, `project: Quality & Maintenance`. |
| 6 | [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) — add `autocomplete` attributes to email + password inputs on `/auth`. | Still open. Small fix. Fifth audit repeat. |
| 7 | **Needs-verification for run #9:** PR #233 multi-flag coexistence — **fourth** audit failing to get clean live evidence. Next run: click each flag independently with `waitForResponse` between, then read `aria-pressed` after a 500 ms debounce. Also click both in sequence to see whether Favorite deselects when Needs work is set. | **Defer to run #9 as a targeted probe.** File a Linear issue only if run #9 confirms regression. |
| 8 | **Needs-verification for run #9:** Does `Save & Continue` on Q1 with empty Quick notes still advance and still increment the counter? If yes, the run-#7 counter-honesty small finding is not fixed. If no (button is genuinely disabled), count as a shipped cleanup. | **Defer to run #9.** No Linear ticket yet — outcome-dependent. |
| 9 | **Needs-verification for run #9:** On the mobile practice question card, is there a typed-answer input path that isn't the notes drawer? (Answer guide? Long-press? Desktop only?) — same as run #7's needs-verification, still open. | **Defer to run #9.** |

## Next-run focus

1. **File the four Linear issues that runs #6, #7, and #8 have all
   recommended and none of which have been filed:**
   guest-preview outage, counter/history mismatch, breathing
   interstitial, and *"Save & Continue" muted state verification*.
   All four should be filed this cycle, not next.
2. **Ownership escalation on PREPIO-111 and PREPIO-101** — both at
   eight audits. If they don't move this cycle, re-scope: are they
   blocked on a bigger redesign that's not on any roadmap? If so, do
   that redesign or downgrade the tickets and stop escalating what
   nobody owns.
3. **The breathing interstitial fix (finding #1)** is the single
   change that would recover the most first-touch trust in run #9.
   Even the smallest version — invert the *"Don't show again"*
   default — is a one-line fix.
4. **Budget a real research-run end-to-end** — six audits owed now.
   Company + role → loading state → generated stages → Plan page →
   practice → session completion. Rotate to a company we haven't
   used (Meta, Palantir, Amazon).
5. **Real keyboard-only + screen-reader pass** — six audits owed.
   Include `aria-pressed` behavior on practice flags (run #9's
   ticket #7 probe) and `autocomplete` (ticket #6) in that pass.
6. **Empty-state coverage** — tester account still has one interview
   so the true empty `/interviews` state is unreachable. Use a fresh
   test account or temporarily archive the tester's OpenAI SA
   interview to reach the truly-empty state.

`Capability: live browser verified`
