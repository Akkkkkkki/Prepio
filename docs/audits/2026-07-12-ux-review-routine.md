# Prepio UI/UX Review — 2026-07-12 (recurring routine, run #6)

Sixth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by
[`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- **Live-app reachability: PASS** — `curl` returns 200; Chromium reaches
  the live app with the run-#4 workarounds (`--ssl-version-max=tls1.2`,
  `--ignore-certificate-errors`, explicit `proxy.server`).

Two new script gotchas for future runs:

- The landing "Company" input has placeholder text `"e.g. Stripe, OpenAI, Ramp"` —
  a substring selector on `"company"` misses it. Use
  `input[placeholder*="Stripe"]` or select by adjacent `label:has-text("Company")`.
- On mobile, the primary practice entry from `/interviews` is
  `a:has-text("Continue practice")` (the tester has an in-progress
  interview). The desktop `nav a:has-text("Practice")` is hidden below
  the mobile hamburger and Playwright's `.first()` picks the hidden one,
  timing out on click. Use viewport-scoped selectors or filter by
  visibility.

## Overall product judgment

**Four of the last five audit-cycle findings shipped this week —
the highest close-rate the routine has ever measured.** In-session
"Needs work" toggle ([PREPIO-120](https://linear.app/qiuyue/issue/PREPIO-120))
is live and hits the 44px touch bar; the mobile hamburger touch target
([PREPIO-122](https://linear.app/qiuyue/issue/PREPIO-122)) is now exactly
44×44 (measured); the "New interview" / "Start a new research run"
copy split ([PREPIO-121](https://linear.app/qiuyue/issue/PREPIO-121))
is unified to *"Prep a new interview"* everywhere I looked
(`/interviews` header, `/new-interview` card title, `/history` empty state,
Dashboard fallback CTA); and the multi-flag coexistence fix
(PR [#233](https://github.com/Akkkkkkki/Prepio/pull/233)) is in code.

**But a new P1 surfaced that outranks any repeat: the landing page's
own "Preview my prep" button is broken.** Filling Anthropic + Product
Manager and clicking *Preview my prep* returns the red error
*"We couldn't build the preview. Try again, or sign in to run the full
research workflow."* while the right column still reads *"Your Anthropic
preview will appear here."* The landing copy directly under the button
promises *"No resume needed. No account needed for preview."* — that
promise is not being kept. This is the single most credibility-damaging
state a first-time user can hit, because it's the exact action the page
invites them to take before any signup ask.

**The two sixth-audit repeats are still open** —
[PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) (marketing hero
on `/new-interview` — verbatim *"Prepio / Get insider insights on any
company's interview process. Tailored prep for you and your friends."*
above the form) and
[PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) (nav still
`Prepio · Home · Dashboard · Practice · Practice History · Pricing ·
Profile`, no "Interviews"). Ownership escalation flagged again.

The biggest user-facing risk this week is **the guest preview failure
above all else**. Everything downstream of the landing-page hero — the
Stripe SPM static example, the "How it works" section, the sign-in
handoff — assumes the "Preview my prep" click succeeds. It doesn't.

## Top issues

### 1. **NEW P1 — Guest "Preview my prep" is broken on the landing page**

- **Severity:** P1 (P0 candidate if this has been broken since the
  landing redesign shipped)
- **Area:** landing / conversion
- **User scenario:** logged-out first-time visitor lands on `/`, sees
  the "Preview my prep" CTA and the promise *"No account needed for
  preview."*, fills Company=`Anthropic`, Role=`Product Manager`, and
  clicks the button.
- **What actually renders (live, desktop, 1440×900):** the submit
  button enters a loading spinner state, then a red error banner
  appears under the form: *"We couldn't build the preview. Try again,
  or sign in to run the full research workflow."* The right column
  never updates — it still reads *"Tailored preview / Your Anthropic
  preview will appear here / Select 'Preview my prep' to research
  likely stages and questions for this company and the Product Manager
  role."* Screenshot: [`assets/2026-07-12/72-d-post-preview.png`](./assets/2026-07-12/72-d-post-preview.png).
  Filled-form screenshot: [`assets/2026-07-12/71-d-landing-filled.png`](./assets/2026-07-12/71-d-landing-filled.png).
- **Why it matters:** the entire logged-out landing redesign that
  shipped this cycle (run #5's headline win) is anchored on this
  preview flow. The first-time user's decision to sign up depends on
  seeing evidence that Prepio produces something better than ChatGPT.
  The current failure state tells them *"sign in to run the full
  research workflow"* — exactly the *"blocked form"* pattern the
  routine's guidance warns against, and it directly contradicts the
  *"No account needed for preview"* microcopy one line above it. This
  is a conversion-critical trust break.
- **Why it's more than "an outage this hour":** the routine's Script A
  (guest preview end-to-end) has been the "next-run focus" ask for two
  cycles in a row — first time it was actually exercised, it failed.
  If this was intermittent, someone else would have caught it. It's
  worth escalating as "does anyone monitor the guest preview health?"
  as much as "fix this one call."
- **Recommended fix:**
  1. Wire an alarm on the guest-preview endpoint (a `pass:guest-preview`
     synthetic that pings the endpoint every 5 min and pages on error).
  2. When the preview fails, do NOT silently keep the right column on
     the pre-click empty-state copy — degrade gracefully to the *static*
     Stripe SPM example already on the page and say so honestly:
     *"Live preview didn't respond. Here's what a finished plan looks
     like for a similar role."*
  3. If the failure is caused by rate-limiting/cost-guarding of the
     guest endpoint, either remove the CTA and use the static example
     as the sole preview, or explain the limit honestly on the button
     click (*"Free previews reset hourly — try again in X minutes."*).
     Silently returning "sign in" is the worst of all options because
     it contradicts the copy right above it.
- **Tracking:** File as a new Linear issue this cycle. Suggested:
  `Type: Bug`, `area:landing`, P1, `project: Landing Page Framing`.
  Link from run #6.

### 2. `/new-interview` **desktop** still shows the marketing hero — SIXTH repeat

- **Severity:** P1 (repeat, sixth audit)
- **Area:** landing / research entry
- **User scenario:** signed in as the tester account, clicked
  *Prep a new interview* on `/interviews` (the CTA copy is now
  consistent — see finding #5).
- **What actually renders (live, desktop, 1440×900):** `/new-interview`
  still opens with a large centered `Prepio` wordmark hero and the copy
  *"Get insider insights on any company's interview process. Tailored
  prep for you and your friends."* directly above the *"Prep a new
  interview"* card. Screenshot:
  [`assets/2026-07-12/11-d-new-interview.png`](./assets/2026-07-12/11-d-new-interview.png).
  This is **verbatim** the copy runs #2, #3, #4, and #5 flagged.
- **What actually renders (live, mobile, 390×844):** `/new-interview`
  shows the redesigned three-step wizard (COMPANY → ROLE DETAILS →
  PERSONALIZE) below the same *"Move from company research to practice
  in three short steps, without the desktop-style sprawl."* meta-copy.
  Screenshot: [`assets/2026-07-12/32-m-new-interview.png`](./assets/2026-07-12/32-m-new-interview.png).
- **Why it matters:** unchanged from run #5. This is the *only* path a
  returning user takes to start fresh prep, and it still speaks past
  them on both viewports. The marketing hero is doing the work of
  first-time-user orientation for a user who has already signed in and
  reached step 3 of the funnel.
- **Recommended fix:** unchanged from prior runs — in `Home.tsx`, branch
  on `location.pathname === '/new-interview'` and render task-oriented
  copy (*"Tell us the company you're prepping for. Add the role and CV
  to sharpen the questions."*) with a back-to-Your-interviews link.
  Delete the *"desktop-style sprawl"* mobile subtitle — it's inside-baseball
  even for a technical audience.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  — filed 2026-06-25, still Backlog after six audits.
  **Escalate: ownership gap, not backlog priority.**

### 3. Nav still has no "Interviews" item — SIXTH repeat

- **Severity:** P1 (repeat, sixth audit)
- **Area:** navigation / consistency
- **What actually renders (live, desktop nav, 1440×900):** `Prepio ·
  Home · Dashboard · Practice · Practice History · Pricing · Profile`.
  No "Interviews" label. Screenshot:
  [`assets/2026-07-12/10-d-interviews.png`](./assets/2026-07-12/10-d-interviews.png).
- **Live-confirmed redirect collision (third audit):** navigating
  directly to `/dashboard` still redirects to `/interviews` — URL
  confirmed via `page.url()`. So "Home" and "Dashboard" remain two
  distinct nav items that both land on `/interviews` for a returning
  user with no active search selected. `_practice_observations.json`
  captured `url after direct nav: https://prepio.qiuyue.dev/interviews`.
- **Mobile menu (via hamburger)** shows the same six labels:
  `Prepio · Home · Dashboard · Practice · Practice History · Pricing ·
  Profile · Sign Out`. Screenshot:
  [`assets/2026-07-12/31-m-menu-open.png`](./assets/2026-07-12/31-m-menu-open.png).
- **New this run:** the `/history` empty state has a `Go to Dashboard`
  secondary CTA which also lands on `/interviews` — so the collision
  now surfaces on *three* nav paths, not two. Screenshot:
  [`assets/2026-07-12/12-d-history.png`](./assets/2026-07-12/12-d-history.png).
- **Why it matters:** unchanged from runs #2–#5. Sixth audit unshipped.
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, no landing PR after six audits.
  **Escalate: same ownership check as PREPIO-111.**

### 4. **NEW P2 — Interviews progress counter and History are inconsistent**

- **Severity:** P2
- **Area:** history / dashboard consistency
- **User scenario:** signed-in returning user opens `/interviews`, sees
  their OpenAI Solutions Architect card show *"1 of 40 practiced · 3%"*
  with a filled progress bar. They click *Practice History* in the nav
  expecting to see that one session.
- **What actually renders (live, desktop, 1440×900):** `/history`
  displays the empty state — *"Ready to start practicing / Your first
  practice session will appear here with answers, timing, and notes so
  you can track your preparation progress."* Two CTAs: `Prep a new
  interview` and `Go to Dashboard`. Screenshot:
  [`assets/2026-07-12/12-d-history.png`](./assets/2026-07-12/12-d-history.png).
- **Why it matters:** two of Prepio's own scoreboards disagree about
  whether the user has practiced anything. If "1 of 40 practiced"
  counts a saved answer, History should show it. If History defines
  "practice" as a completed session, the Interviews-card counter
  overstates progress. Either way, the returning-user resume experience
  reads as broken.
- **Likely cause (inferred from code, needs verification):** the
  Interviews-card "practiced" count almost certainly counts *any answer
  written* (including drafts and skips), while `/history` filters to
  completed sessions. The user has no vocabulary for that distinction.
- **Recommended fix:** align both surfaces on the same definition. Either:
  1. History renders in-progress sessions with a "*In progress · resume*"
     row (matches the Interviews card's *In progress* chip); or
  2. The Interviews-card counter changes to *"1 of 40 answered · 3%"*
     with a tooltip explaining answered vs. completed sessions.
  Option 1 is stronger — it converts History from a graveyard into a
  resume surface, consistent with the design principle *"dashboard/history
  should help users resume work, not admire charts."*
- **Tracking:** File as a new Linear issue this cycle. Suggested:
  `Type: Bug`, `area:practice` + `area:landing`, P2.

### 5. "Home" nav label + `/` collision are still confusing — reframed for run #6

- **Severity:** P2 (component of PREPIO-101, but calling out
  independently because the "Home" label deserves its own copy pass)
- **Area:** nav / copy
- **What actually renders:** the desktop nav's first item is "Home"
  and it links to `/interviews`. For a signed-in user, clicking "Home"
  from any deep page returns to *"Your interviews"* — which is not
  wrong, but the mental model gets fuzzy when the nav also has
  "Dashboard" (also `/interviews`) and there's a Prepio wordmark
  ($/$-linked) to the left of both.
- **Why it matters:** three labels (Prepio wordmark, Home, Dashboard)
  all lead to the same page. Two of the three are labeled for
  something they're not. This is a *"consistency and standards"*
  heuristic violation.
- **Recommended fix:** when PREPIO-101 lands, the nav should collapse
  to `Interviews · Practice · History · Profile · Pricing` (drop
  "Home" and "Dashboard" as labels, rename to what they are). The
  Prepio wordmark can keep its `$/$` link for muscle memory.

## Notable live observations (not top-5, but recorded)

### Positives shipped this week (live-verified)

- **PREPIO-120: in-session "Needs work" toggle is live and correct.**
  On the mobile practice question screen, the action rail now reads
  `Favorite · Needs work · Answer guide · Record answer · Notes · Skip ·
  Save & Continue`. Measured bboxes on Q1/10, iPhone 13 (390×844):
  Favorite `112×44`, Needs work `138×44`, Answer guide, Record answer
  (primary CTA), Notes, Skip, Save & Continue. All hit the 44px touch
  bar. Toggling `Needs work` changes the button visual to the "pressed"
  state. Screenshots:
  [`assets/2026-07-12/62-m-question-1.png`](./assets/2026-07-12/62-m-question-1.png),
  [`assets/2026-07-12/63-m-needs-work-on.png`](./assets/2026-07-12/63-m-needs-work-on.png).
  **Closes finding #4 from run #5.**
- **PREPIO-121: CTA copy unified.** The header CTA on `/interviews`
  reads *"Prep a new interview"*. The card title on `/new-interview`
  reads *"Prep a new interview"*. The `/history` empty state has a
  `Prep a new interview` primary CTA. All match. Confirms
  [PR #232](https://github.com/Akkkkkkki/Prepio/pull/232) shipped
  cleanly. **Closes finding #5 from run #5.**
- **PREPIO-122: hamburger touch target hit.** Live bbox on the mobile
  nav hamburger: `{x: 330, y: 10, width: 44, height: 44}`. Fourth
  audit-in-a-row measured; first one to meet the 44×44 bar. Confirms
  [PR #234](https://github.com/Akkkkkkki/Prepio/pull/234) shipped
  cleanly. **Closes finding #6 from run #5.**
- **Landing page hero unchanged, still strong.** Desktop still renders
  the run-#5 headline *"Walk into your next interview knowing exactly
  what to expect."*, the same two-column layout (preview form left,
  static Stripe SPM example right), the same three concrete tailored
  questions with stage/difficulty badges and *"Why it matters"* copy.
  Screenshot: [`assets/2026-07-12/01-d-landing.png`](./assets/2026-07-12/01-d-landing.png).
  Mobile keeps the same content stacked. Screenshot:
  [`assets/2026-07-12/20-m-landing.png`](./assets/2026-07-12/20-m-landing.png).
  This is what the top finding threatens if the guest preview outage
  continues — the hero promises something the page can't deliver.

### Areas re-audited this run — status unchanged

- **Autosave labels intact.** During mobile practice on Q1, the notes
  card cycled through *"Saving draft…"* → *"Draft kept in this tab"* —
  same as runs #4 and #5. Screenshots:
  [`assets/2026-07-12/62-m-question-1.png`](./assets/2026-07-12/62-m-question-1.png)
  and [`assets/2026-07-12/64-m-both-toggled.png`](./assets/2026-07-12/64-m-both-toggled.png).
  **PREPIO-108 still healthy — third live confirmation.**
- **Practice-mode question-as-hero layout intact.** Mobile Q1/10 shows
  the question in bold ~24px black text at the top of the card, above
  a two-row badge line (`Technical Round`, `Medium`), a right-aligned
  *"Recommended · Aim for 1-2 min"* line, and the flag/action rail.
  `Record answer` is the primary green CTA in the answer input area.
  Screenshot: [`assets/2026-07-12/62-m-question-1.png`](./assets/2026-07-12/62-m-question-1.png).
- **Practice setup screen unchanged and still good.** Mobile
  `/practice?searchId=…` before Q1 shows the same two-card layout
  (Quick start / Custom session) with a single 358×48 "Start practice"
  CTA. Honest, minimal. Screenshot:
  [`assets/2026-07-12/60-m-practice-setup.png`](./assets/2026-07-12/60-m-practice-setup.png).
- **Profile page and pricing page unchanged.** Same *"prefilled from
  parsed resume"* honesty banner, same Free/Monthly/Quarterly/Annual
  pricing table with plain-English discount language. Not re-audited
  in depth this run — no regressions apparent.
  Screenshots: [`13-d-profile.png`](./assets/2026-07-12/13-d-profile.png),
  [`14-d-pricing.png`](./assets/2026-07-12/14-d-pricing.png).

### Small things worth logging (not top-5)

- **PR #233 (question flags coexist): shipped in code, live behavior
  needs re-verification.** Sequence during this run: click `Needs work`
  → button gets pressed state → click `Favorite` → `Favorite` gets
  pressed state, `Needs work` visually returns to unpressed. That
  contradicts the intent of PR #233 (both flags should be able to
  coexist on the same question). **However**, the `aria-pressed`
  attribute stayed `"false"` throughout even when the button was
  visually filled — which suggests either a click-timing artifact in
  the Playwright script (fast successive clicks racing against the
  awaited `searchService.setQuestionFlag` round-trip) or an actual
  regression in either the visual pressed state or `aria-pressed`
  wiring. **Filing this as a needs-verification item for run #7 rather
  than a confident finding** — the code at
  [`Practice.tsx:2694-2726`](../../src/pages/Practice.tsx) reads
  correctly for coexistence. Screenshot:
  [`assets/2026-07-12/64-m-both-toggled.png`](./assets/2026-07-12/64-m-both-toggled.png).
- **PREPIO-123 (password autocomplete) still open.**
  `input[type="email"].autocomplete = null`, `input[type="password"].autocomplete = null`
  on `/auth`. Small a11y / password-manager fix, still on the backlog.
- **`/dashboard` direct-URL redirect collision confirmed for the
  third audit.** Same behavior as runs #4 and #5. Filing under
  PREPIO-101 tracking.
- **`/history` empty-state CTAs are on-copy but its top-line status
  is wrong.** The primary CTA `Prep a new interview` is now consistent
  (finding #5 above). The secondary `Go to Dashboard` label lands on
  `/interviews` — same collision as finding #3.
- **Skip-to-main-content link works** on both the logged-out landing
  and the signed-in `/interviews` page — first Tab lands on it with a
  visible focus outline. Fourth live confirmation.

## Journey scorecard

Rows marked **↑** improved since run #5, **=** unchanged, **↓** worse.
Cells marked **(live)** are live-verified this run.

| Area | Run #5 | Run #6 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 5 | 3 | ↓↓ | **(live)** Landing hero and static example still excellent, but the "Preview my prep" CTA returns an error — the *"No account needed for preview"* promise is broken. Score drops until this stabilizes. |
| Research entry | 3 | 3 | = | **(live)** Desktop marketing hero and mobile "desktop-style sprawl" copy unchanged. PREPIO-111 still open. |
| Research progress/loading | — | — | = | Not reached — no fresh authenticated research run kicked off this cycle. Fourth "not-scored" cycle. Owed a real end-to-end. |
| Generated output clarity | 4 | 4 | = | **(live)** Reviewed via Interviews-card summary — 40 questions / 4 stages / OpenAI Solutions Architect. Plan page not re-audited this run. |
| Practice mode | 4 | 5 | **↑** | **(live)** PREPIO-120 in-session Needs work shipped, coexists with Favorite in the UI. Question-as-hero layout still excellent, controls all 44px+, autosave copy still honest. Back to 5 with the completion-state ratings still in place. |
| Mobile usability | 4 | 4 | = | **(live)** Hamburger now 44×44 (PREPIO-122 shipped ✓). `/new-interview` mobile still leads with "desktop-style sprawl" meta-copy. Overall stable. |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile page renders with honest *"prefilled from parsed resume — save once to make canonical"* copy. Privacy/upload copy not re-audited in depth this run. |
| Dashboard/history/resume | 5 | 3 | ↓↓ | **(live)** New consistency bug (finding #4): Interviews card shows "1 of 40 practiced · 3%" but History shows empty state. Two truth surfaces disagreeing pulls the score down two points. |
| Error/empty states | 4 | 3 | ↓ | **(live)** Guest preview error banner is honest but silently keeps the right column in the pre-click empty state — that's dishonest by omission. `/history` empty state copy is fine but its `Go to Dashboard` CTA lands on `/interviews`. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main and focus outlines confirmed again. `aria-pressed` on practice flags read `"false"` even when visually pressed — either a script artifact or an actual bug; deferred to run #7. Hamburger 44×44 ✓. |
| Copy quality | 4 | 4 | = | **(live)** CTA copy unification (PREPIO-121) is a real win — same phrase in four places now. Landing hero copy still strong. `/new-interview` "desktop-style sprawl" mobile subtitle unchanged (PREPIO-111). |

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | Sixth audit unshipped, live-confirmed for the third time. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | Sixth audit unshipped, live-confirmed for the third time. In Progress since 2026-06-24 with no landing PR. |
| In-session Needs work absent | **Resolved** ✅ | Shipped via [PR #231](https://github.com/Akkkkkkki/Prepio/pull/231) / [PREPIO-120](https://linear.app/qiuyue/issue/PREPIO-120). Live-confirmed on mobile Q1/10 at 138×44. |
| "New interview" / "Start a new research run" split | **Resolved** ✅ | Shipped via [PR #232](https://github.com/Akkkkkkki/Prepio/pull/232) / [PREPIO-121](https://linear.app/qiuyue/issue/PREPIO-121). Verified four places: `/interviews` header, `/new-interview` card title, `/history` empty CTA, and Practice UI wording. |
| Mobile hamburger 42×36 touch target | **Resolved** ✅ | Shipped via [PR #234](https://github.com/Akkkkkkki/Prepio/pull/234) / [PREPIO-122](https://linear.app/qiuyue/issue/PREPIO-122). Live-measured `{44, 44}`. |
| Multi-flag coexistence | **Shipped in code, needs live re-verification** | [PR #233](https://github.com/Akkkkkkki/Prepio/pull/233). Live sequence appeared to mutually exclude Favorite and Needs work — likely a click-timing artifact but keep on run #7's checklist. |
| Password autocomplete missing | **Still open** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | Still `null` on both email and password inputs. |
| **NEW:** Guest "Preview my prep" fails | **New P1 finding** | See top issue #1. Contradicts landing copy promise. |
| **NEW:** Interviews progress vs History disagree | **New P2 finding** | See top issue #4. Counter says 3% practiced, History empty. |
| **NEW:** `/history` "Go to Dashboard" CTA lands on `/interviews` | **New minor** | Same collision as PREPIO-101, third surface. |

**Four run-#5 findings shipped and closed cleanly.** Two sixth-audit
repeats remain. Two new P1/P2 findings surfaced (guest preview outage,
history-vs-interviews mismatch).

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | **NEW:** Guest "Preview my prep" returns error and silently keeps right column in pre-click empty state (see top issue #1) | **File this cycle.** `Type: Bug`, `area:landing`, P1, `project: Landing Page Framing`. Also worth adding a synthetic health check. |
| 2 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` on **both** desktop and mobile | **Escalate.** Sixth audit repeat. Ownership check. |
| 3 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Dashboard → Plan / Interviews, drop "Home" and "Dashboard" if they both redirect to `/interviews` | **Escalate.** Sixth audit repeat. In Progress since 2026-06-24 with no PR; ownership check. Now surfaces on three CTAs (nav Home, nav Dashboard, `/history` "Go to Dashboard"). |
| 4 | **NEW:** Align `/interviews` "practiced" counter with `/history`. Either History should render in-progress sessions, or the counter should read "answered" instead of "practiced" (see top issue #4). | **File this cycle.** `Type: Bug`, `area:practice`, P2, `project: Quality & Maintenance`. |
| 5 | [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) — add `autocomplete` attributes to email + password inputs on `/auth` | Still open. Small fix. |
| 6 | **NEW (needs-verification):** re-verify PR #233 multi-flag coexistence on the live app with explicit `waitForResponse` between Favorite and Needs work clicks. If the two flags still mutually exclude visually, file as a coexistence regression. | **Defer to run #7 as a targeted probe.** No Linear ticket yet. |

## Next-run focus

1. **Fix / monitor the guest preview flow.** Landing hero and static
   example are only valuable if the "Preview my prep" CTA succeeds.
   This is the top find of run #6.
2. **Follow up on PREPIO-111 / PREPIO-101.** Both are six-audit
   repeats now. If they don't move this week, treat as a Linear
   ownership escalation, not just a re-log.
3. **Budget one real end-to-end research run** — company + role →
   loading state → generated stages → Plan page → practice → session
   completion. This has been the "next-run focus" for FOUR cycles now
   (runs #3, #4, #5, and #6). Costs a paid OpenAI/Tavily call; fold
   it in this cycle even if the top-two P1s still haven't landed.
   The "research progress/loading" scorecard row has been un-scored
   for four runs.
4. **Re-verify PR #233 multi-flag coexistence** with an explicit
   response-waiting Playwright sequence. If the mutual exclusion is
   real, file as a regression against the fix.
5. **First real keyboard-only + screen-reader pass** on the full
   returning-user path (auth → interviews → plan → practice → save).
   Owed since run #5. `aria-pressed` behavior on the practice flags
   should be part of that pass — this run's readings suggest a wiring
   issue worth verifying.
6. **Investigate the Interviews-vs-History progress mismatch** and
   either fix the counter or fix History. Do not paper over with copy.
7. **Empty-state coverage** — tester account still has one existing
   interview so the true empty `/interviews` state is still not
   reachable. Next run should either use a fresh test account or
   temporarily archive the tester's one interview.

`Capability: live browser verified`
