# Prepio UI/UX Review — 2026-07-09 (recurring routine, run #5)

Fifth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md),
[`2026-06-25-ux-review-routine.md`](./2026-06-25-ux-review-routine.md),
[`2026-07-02-ux-review-routine.md`](./2026-07-02-ux-review-routine.md),
[`2026-07-05-ux-review-routine.md`](./2026-07-05-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by the routine's capability contract
([`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md)) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- **Live-app reachability: PASS** — `curl` returns 200; Chromium reaches
  the live app after applying the two run-#4 workarounds (`--ssl-version-max=tls1.2`
  and `--ignore-certificate-errors`, plus explicit `proxy.server` in
  `chromium.launch`).

One new gotcha for the routine's Playwright script this run: the auth
page has two elements labelled "Sign In" — the tab button (`button[0]`)
and the submit button (`button[2] type=submit`). A `button:has-text("Sign in")`
selector matches the tab first and the login form never submits. Use
`button[type="submit"]` explicitly. Adding this to the next-run notes.

## Overall product judgment

**The product experience improved substantially this week — the biggest
positive shift in five runs of this routine.** The logged-out landing
page is fundamentally redesigned around a live preview form (Company +
Role → "Preview my prep") sitting next to a concrete static example
("How Stripe Senior Product Manager questions look in Prepio" — three
real questions with stage/difficulty badges and "Why it matters" copy).
That is exactly the "landing must show product output" ask this routine
has been repeating since run #1, and it is now live and honest.

Against that win, **the same two P1 findings — [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
(marketing hero on `/new-interview`) and [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
(no "Interviews" nav item) — remain unshipped for a fifth audit in a row.**
Both were live-verified again on production: signed-in `/new-interview`
still opens with "Prepio / Get insider insights on any company's
interview process. Tailored prep for you and your friends." above the
form, and the top nav still labels the interviews home as "Home" +
"Dashboard" (both silently redirect to `/interviews`).

**The biggest user-facing risk this week has changed shape.** The
landing page no longer speaks past first-time users. The returning-user
paths — new-interview entry and top nav — still do. And a new practice-mode
gap surfaced this run: **there is no "Needs work" control anywhere in
practice**. The audit routine's own test script asks the reviewer to
mark one question as needs-work, and CLAUDE.md talks about needs-work
as a filterable state, but the only per-question rating action live is
"Favorite." That is a coverage gap the previous four routine runs did
not catch because none of them completed a full practice cycle.

## Top issues

### 1. New landing page is a **major win** — worth calling out first

- **Severity:** N/A (positive)
- **Area:** landing / conversion
- **What actually renders (live, desktop, 1440×900):** headline
  *"Walk into your next interview knowing exactly what to expect."*
  Sub: *"Tell us the company. We research the stages, the likely
  questions, and how your background maps to them — so you practice
  the right things, not a generic question bank."* Left column is a
  functional preview form (Company + Role) with a "Preview my prep"
  submit and honest microcopy: *"No resume needed. No account needed
  for preview."* Right column is a **live static example**: *"How
  Stripe Senior Product Manager questions look in Prepio"* — three
  real-looking questions with stage badges (Hiring manager, Product
  deep dive, Panel / leadership), difficulty badges (Medium / Hard /
  Medium), and a one-sentence *"Why it matters"* rationale under each
  one. Below the fold, a *"How it works"* three-step section:
  Share the company → Unlock the full brief → Practice from the research.
  Screenshot: [`assets/2026-07-09/01-desktop-landing.png`](./assets/2026-07-09/01-desktop-landing.png).
- **Why it matters:** the audit routine has been calling for this since
  run #1. It closes the "landing does not show enough of the product
  output" finding cleanly.
- **Regression risk to watch:** the "Preview my prep" flow was reachable
  but its output not driven this run — next audit should exercise the
  guest preview end-to-end.

### 2. `/new-interview` **desktop** still shows the marketing hero — fifth repeat

- **Severity:** P1 (repeat, fifth audit)
- **Area:** landing / research entry
- **User scenario:** signed in as the tester account, clicked "New
  interview" on `/interviews`.
- **What actually renders (live, desktop, 1440×900):** `/new-interview`
  still opens with a large `Prepio` wordmark hero and the copy
  *"Get insider insights on any company's interview process. Tailored
  prep for you and your friends."* directly above the "Start a new
  research run" card. Screenshot:
  [`assets/2026-07-09/11-d-new-interview.png`](./assets/2026-07-09/11-d-new-interview.png).
  This is **verbatim** the copy runs #2, #3, and #4 flagged.
- **What actually renders (live, mobile, 390×844):** `/new-interview` shows
  a redesigned three-step wizard (COMPANY → ROLE DETAILS → PERSONALIZE) —
  a real UX improvement over the old marketing hero. But the *header
  copy* under the Prepio wordmark still reads: *"Move from company research
  to practice in three short steps, without the desktop-style sprawl."* —
  meta-copy about Prepio's own UX philosophy, not the user's task.
  Screenshot: [`assets/2026-07-09/31-m-new-interview.png`](./assets/2026-07-09/31-m-new-interview.png).
- **Why it matters:** unchanged. This is the *only* path a returning user
  takes to start fresh prep, and it still speaks past them on both
  viewports.
- **Recommended fix:** unchanged from prior runs — in `Home.tsx`, branch
  on `location.pathname === '/new-interview'` and render task-oriented
  copy ("Tell us the company you're prepping for. Add the role and CV
  to sharpen the questions.") with a back-to-Your-interviews link.
  Delete the "desktop-style sprawl" mobile subtitle — it's inside-baseball.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  — filed 2026-06-25, still Backlog after five audits.
  **Escalate: ownership gap, not backlog priority.**

### 3. Nav still has no "Interviews" item — fifth repeat

- **Severity:** P1 (repeat, fifth audit)
- **Area:** navigation / consistency
- **What actually renders (live, desktop nav, 1440×900):** `Prepio ·
  Home · Dashboard · Practice · Practice History · Pricing · Profile`.
  No "Interviews" label. Screenshot:
  [`assets/2026-07-09/10-d-interviews.png`](./assets/2026-07-09/10-d-interviews.png).
- **Live-confirmed redirect collision (again):** navigating directly to
  `/dashboard` with no `searchId` redirects to `/interviews` — URL
  confirmed via `page.url()` after navigation. So "Home" and "Dashboard"
  are two distinct nav items that both land on `/interviews` for a
  returning user with no active search selected.
- **Mobile menu (via hamburger)** shows the same six labels:
  `Prepio · Home · Dashboard · Practice · Practice History · Pricing ·
  Profile · Sign Out`. Screenshot:
  [`assets/2026-07-09/32-m-menu-open.png`](./assets/2026-07-09/32-m-menu-open.png).
- **Why it matters:** unchanged from runs #2–#4. The nav item every
  returning user needs most isn't labeled for what it does. Two nav
  items collapse to the same page. Fifth audit unshipped.
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, no landing PR after five audits.
  **Escalate: same ownership check as PREPIO-111.**

### 4. **No "Needs work" control anywhere in practice** — new, live-confirmed

- **Severity:** P2
- **Area:** practice
- **User scenario:** signed-in tester on iPhone 13 viewport (390×844)
  entered practice via *Interviews → Start practice → Start practice
  (Quick start, 10 questions) → dismissed breathing modal → Question
  1 of 10.*
- **What was measured live:** the question-screen action rail is
  `Favorite · Answer guide · Record answer · Notes · Skip · Save & Continue`.
  The overflow menu behind the "Practice actions" (aria-label) button
  contains only three items: `Reset timer · Change setup · Exit practice`.
  Screenshots: [`assets/2026-07-09/63-question-screen.png`](./assets/2026-07-09/63-question-screen.png)
  and [`assets/2026-07-09/64-typed-answer.png`](./assets/2026-07-09/64-typed-answer.png).
  Clicking `Save & Continue` moves the user straight to Q2/10 — **there
  is no rating or needs-work step between questions.**
- **What the routine expects:** the recurring test script explicitly
  asks the reviewer to *"Mark one question as needs work"* on both
  desktop and mobile. CLAUDE.md talks about needs-work as a filterable
  state in the dashboard/history surface. Neither survives contact with
  the live product.
- **Why it matters:** the user can currently favorite a question, but
  cannot flag one to come back to. This weakens the "practice feels
  like progress" principle — a user who bombed Q3/10 has no way to mark
  it for a targeted second pass. It also breaks the routine's own
  test-script assumptions.
- **Recommended fix (pick one):**
  1. Add a "Needs work" toggle alongside "Favorite" on the question
     screen (simplest — matches existing patterns).
  2. Add a lightweight post-answer rating step ("How did that feel?
     Nailed it / Solid / Needs work") after `Save & Continue` before
     the next question.
  3. Or: remove the needs-work language from CLAUDE.md and the routine
     script if the product decided against this feature.
- **Tracking:** file this cycle. `Type: Bug` if the intent was that
  the control ships and it regressed, `Type: Feature` if it never
  shipped. Assumed Feature until product confirms. Area
  `area:practice`, P2.

### 5. "New interview" vs "Start a new research run" copy — third audit, still not fixed

- **Severity:** P2 (repeat from runs #3 and #4)
- **Area:** copy / consistency
- **Live-confirmed on two production pages this run:** the `/interviews`
  header CTA reads **"New interview"** ([`10-d-interviews.png`](./assets/2026-07-09/10-d-interviews.png)),
  clicking through lands on `/new-interview` where the card is titled
  **"Start a new research run"** ([`11-d-new-interview.png`](./assets/2026-07-09/11-d-new-interview.png)).
  Two labels for the same action, one tap apart.
- **Not observable this run:** the true empty-state ("Prep a new
  interview" per `Interviews.tsx:193`) and the Dashboard fallback CTA
  weren't reachable — the tester account has one existing interview
  so the empty state never renders.
- **Recommended fix:** unchanged — pick one label and use it everywhere.
  Suggest "Prep a new interview" (matches the routine's copy standard
  and doesn't overload "research" as a noun for users).
- **Tracking:** unfiled after runs #3 and #4 — file this cycle.
  `Type: Improvement`, `area:landing`, P2.

## Notable live observations (not top-5, but worth recording)

- **Practice mode is genuinely excellent.** The question is
  unambiguously the visual hero (large bold text at the top of the
  question card, above the stage/difficulty badges), `Record answer`
  is the primary CTA, all secondary actions (Favorite 112×44,
  Answer guide 126×44, Notes 103×48, Skip 173×48, Save & Continue
  173×48) hit the 44px touch-target bar, and the autosave copy is
  honest: *"Saved on this device while you practice."* transitions
  through *"Saving draft…"* → *"Draft kept in this tab."* This is the
  second live confirmation of the PREPIO-108 fix from run #1.
  Screenshot: [`assets/2026-07-09/64-typed-answer.png`](./assets/2026-07-09/64-typed-answer.png).
- **Practice setup screen (`/practice?searchId=…` before question 1)
  is a good pre-practice surface**: two clear cards — *"Quick start:
  Jump in with 10 shuffled questions across your selected stages"* and
  *"Custom session: Pick stages, tune difficulty, and keep the setup
  light"* — with a single 358×48 "Start practice" CTA at the bottom.
  Honest, minimal, doesn't hide the primary action.
- **Plan page is a strong resume surface.** For the tester's OpenAI
  Solutions Architect interview: header shows role + country + status
  chips (Ready / medium confidence / tech / mid), a "prep summary" card
  with "You're set up with 40 questions across 4 stages" and a
  right-aligned green "Start practice · 40" CTA. Stage roadmap below
  labels Stage 1 with "Start here · highest-leverage round" — an
  opinionated recommendation that respects the "make the next best
  action obvious" principle. Screenshot:
  [`assets/2026-07-09/16-d-plan.png`](./assets/2026-07-09/16-d-plan.png).
- **Pricing copy is honest and specific.** *"Add AI feedback when
  practice needs a sharper coach. Research, prep plans, and practice
  stay free. Paid subscriptions unlock AI feedback on saved practice
  answers, so you can see what to tighten before the real interview."*
  Three tiers (Monthly / Quarterly / Annual) with plain-English
  discount language (*"About 50% off rolling monthly"*, *"About 70%
  off rolling monthly"*) and identical feature bullets across tiers —
  no dark patterns, no fake urgency. Screenshot:
  [`assets/2026-07-09/15-d-pricing-auth.png`](./assets/2026-07-09/15-d-pricing-auth.png).
- **Breathing Break modal appears on Quick Start** with buttons
  *"Don't show again"* and *"Skip"*. Dismissable in one tap with
  persistence. Not filing an issue — matches the "practice should feel
  safe" principle and the dismissal cost is bounded. Flag: an *automated*
  reviewer needs to key on *"Cycle X of 3"* / *"Don't show again"* to
  detect this modal, not the word "breathing" — this run's script
  originally missed the dismiss because it keyed on "breath".
- **Mobile hamburger touch target is still 42×36px.** Unchanged from
  run #4's live measurement (also 42×36). Every other measured mobile
  control this run met the 44px bar (New interview 358×48, Start
  practice 308×44, all practice controls 44px+). This is a single-line
  padding fix in the `Navigation` component.
- **Console warning across the site:** password inputs are missing
  `autocomplete="current-password"` / `autocomplete="new-password"` —
  Chromium logs this as a verbose warning on `/auth` and any signed-in
  page that shells past the auth check. Not blocking, but the fix is
  a two-attribute change and removes a real annoyance for password
  managers.
- **Skip-to-main-content link works** on both the logged-out landing
  and the signed-in `/interviews` page — first Tab lands on it with a
  visible focus outline. Confirmed via keyboard walk.
- **Sign-in submit selector gotcha (for the routine's automation):**
  the auth page has a tab named "Sign In" and a submit button also
  labelled "Sign In". Use `button[type="submit"]` to click the submit,
  not `button:has-text("Sign in")` — otherwise the login tab is
  re-clicked and the form never submits. Noting in the routine's script
  memory.

## Journey scorecard

Rows marked **↑** improved since run #4, **=** unchanged, **↓** worse.
Cells marked **(live)** are live-verified this run.

| Area | Run #4 | Run #5 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 5 | **↑↑** | **(live)** New landing shows preview form + static Stripe SPM example with three concrete questions. Longest-standing audit finding closed. |
| Research entry | 3 | 3 | = | **(live)** Desktop marketing hero and mobile "desktop-style sprawl" copy unchanged. PREPIO-111 still open. |
| Research progress/loading | — | — | = | Not reached — no fresh research run kicked off this cycle. Same as run #4; still owed a real end-to-end. |
| Generated output clarity | 4 | 4 | = | **(live)** Plan page renders cleanly with stage roadmap, prep summary, and prominent Start-practice CTA. Adequate; no regressions. |
| Practice mode | 5 | 4 | ↓ | **(live)** Question-as-hero layout still excellent, controls sized correctly, autosave honest. **Downgraded from 5 → 4** because no needs-work control (new finding #4). |
| Mobile usability | 3 | 4 | ↑ | **(live)** New `/new-interview` 3-step wizard is a real improvement over the old marketing hero. Hamburger still 42×36 — one open item. |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile page renders with honest "prefilled from parsed resume — save once to make canonical" copy; last resume version dated 5/17/2026. Privacy copy not re-audited this run. |
| Dashboard/history/resume | 5 | 5 | = | **(live)** "Your interviews" resume card unchanged and still strong: progress bar, Plan-ready badge, one-tap Start practice. History page shows honest empty state. |
| Error/empty states | 4 | 4 | = | **(live)** Practice/history empty states honest and actionable. Interviews empty state still not reached (tester has history). |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main and focus outlines confirmed. One console warning (missing `autocomplete` on password), one touch-target miss (hamburger 42×36). No full screen-reader pass this run. |
| Copy quality | 3 | 4 | ↑ | **(live)** New landing copy is direct and specific ("Walk into your next interview knowing exactly what to expect."). Pricing copy is honest. `/new-interview` copy and label mismatch drag this from 5 to 4. |

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | Fifth audit unshipped, live-confirmed for the second time. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | Fifth audit unshipped, live-confirmed for the second time. In Progress since 2026-06-24 with no landing PR. |
| CLAUDE.md Routes stale | **Resolved** ✅ | [PR #227 / PREPIO-118](https://linear.app/qiuyue/issue/PREPIO-118) merged 2026-07-09 — Routes table and Primary user flow now match the shipped router. |
| Landing page proof of output | **Resolved** ✅ | New logged-out `/` shows a preview form and a static Stripe SPM example with three concrete tailored questions and "Why it matters" copy. First landing pass since routine started. |
| "New interview" ↔ "Start a new research run" copy | **Still open** | Third audit — file this cycle. |
| Mobile hamburger 42×36 touch target | **Still open** | Unchanged from run #4 measurement. |
| PREPIO-108 autosave label | **Confirmed intact** | Second live confirmation. "Saving draft…" → "Draft kept in this tab" works as designed. |
| **NEW:** No needs-work control in practice | **New finding** | See top issue #4. |

No previously-fixed regressions returned. **One long-standing landing
finding shipped this week** (proof-of-output on `/`).

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` on **both** desktop and mobile | **Escalate.** Fifth audit repeat. Move to Todo/In Progress this cycle. |
| 2 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Dashboard → Plan, add "Interviews" | **Escalate.** Fifth audit repeat. In Progress since 2026-06-24 with no PR; ownership check. |
| 3 | [PREPIO-120](https://linear.app/qiuyue/issue/PREPIO-120) — Add "Needs work" per-question control (or a lightweight post-answer rating step) in practice | **Filed.** `Type: Feature`, `area:practice`, Medium. Confirmed absent live this run. |
| 4 | [PREPIO-121](https://linear.app/qiuyue/issue/PREPIO-121) — Unify "start a new prep" CTA copy across Interviews and `/new-interview` | **Filed.** `Type: Improvement`, `area:landing`, Medium. Third audit repeat. |
| 5 | [PREPIO-122](https://linear.app/qiuyue/issue/PREPIO-122) — Increase mobile nav hamburger button touch target from 42×36 to at least 44×44 | **Filed.** `Type: Bug`, `area:landing` (shared chrome), Low. Live-measured twice now. |
| 6 | [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) — Add `autocomplete` attributes to email + password inputs on `/auth` | **Filed.** `Type: Improvement`, `area:auth`, Low. Small fix, resolves a Chromium verbose warning and helps password managers. |

## Next-run focus

1. **Budget one real end-to-end research run** (company + role →
   loading state → generated stages → Plan page → practice → session
   completion). This has been "next run's focus" for three cycles now
   — costs a paid OpenAI/Tavily call. Fold it in even if the top-two
   P1s still haven't landed; the "research progress/loading" scorecard
   row has been un-scored for three runs.
2. **Follow up on PREPIO-111 / PREPIO-101.** Both are five-audit
   repeats now. If they don't move this week, treat as a Linear ownership
   escalation, not just a re-log.
3. **First real keyboard-only + screen-reader pass** on the full
   returning-user path (auth → interviews → plan → practice → save).
   Basic focus and skip-to-main are confirmed working this run; the
   next-level questions are focus order after modal dismiss, whether
   the autosave-state transition is announced, and whether the
   breathing modal traps focus correctly.
4. **Guest-preview end-to-end.** New landing has a "Preview my prep"
   button — the routine should exercise the full guest preview flow
   (submit → receive preview → convert to signed-in flow) to confirm
   the promise on the landing page matches what the guest actually
   sees.
5. **Empty-state coverage.** Tester account has one existing interview
   so the true empty `/interviews` state is still not reachable. Next
   run should either use a fresh test account or temporarily delete
   the tester's one interview to catch the empty-state copy drift
   ("Prep a new interview" per code).

`Capability: live browser verified`
