# Prepio UI/UX Review — 2026-11-19 (recurring routine)

Weekly run of the UX-review routine. Baseline:
[`2026-11-12`](./2026-11-12-ux-review-routine.md). Operating contract:
[`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md). Scope is the
[FREEZE_RELEASE](../FREEZE_RELEASE.md) product. Billing, profile, CV upload and
voice are out of scope and were checked only to confirm they stay unrouted.

Since the last run, one user-facing change has merged:
[#393](https://github.com/Akkkkkkki/Prepio/pull/393), which adds start dates to
interview cards. The other merges were telemetry, evaluation and docs changes.

## Capability check: live browser verified

- **Playwright Chromium: PASS.** It was pre-installed, and a plain
  `chromium.launch()` worked.
- **Live app: PASS.** `https://prepio.qiuyue.dev/` returned `200` and rendered.
  Sign-in, research, answer save and flag writes all reached the live backend.

**Coverage.** Desktop Chrome at 1280×900, plus emulated iPhone 13, Pixel 7 and
iPhone SE. I also tested iPhone 13 in landscape, offline mode (`setOffline`)
and a throttled network (400 ms latency, about 400 kbps).

I ran one **real research run** for **Vitol · AI Product Manager**. Last week's
run used Anthropic · Product Manager. From the run I tested:

- the full practice flow on desktop: answer, Favorite, Needs work, Skip, Back
  and reload
- mobile practice on all three devices, offline save and rotation
- `/history`, `/interviews`, the failed-research page and the guest redirects
- a keyboard, label and contrast pass

**Not covered.** No WebKit or Safari run (only Chromium is installed in this
environment) and no real devices. Mobile results come from Chromium device
emulation.

**PII.** I captured no CV content. The plan's "Why this plan → Sources" panel
showed a résumé summary taken from a stored CV (see issue 2). That panel was
not committed, and none of its text appears below. Evidence is in
[`assets/2026-11-19/`](./assets/2026-11-19/).

## Overall product judgment

The experience is **about the same as last week, and slightly worse on trust**.
The one shipped change (card start dates) helps: you can now tell apart two
interview cards with the same company and role. The surfaces that were strong
are still strong: the research form, the progress modal, the honest
"Best-guess plan" banner, the offline state and the empty history page.

But this run found two trust problems in the core flow that last week's report
missed:

- **Favorite and Needs work never save.** Every write returns `400 / 42P10`, so
  one of the freeze's named features has never worked in production.
- **Research can use a stored CV the user can't see.** If the "Add your CV" box
  is left empty, the backend falls back to a stored CV. The frozen UI gives the
  user no way to see, change or remove that CV.

The practice answer box is still labeled "Quick notes", and its two status
lines now visibly contradict each other.

The biggest user-facing risk is trust. A user who marks a question and gets an
error, or finds a CV they didn't provide listed under Sources, has a reason to
doubt everything else the product says.

## Top 5 issues

### 1. Favorite and Needs work fail on every attempt (`400 / 42P10`)
- **Severity:** P1. A core freeze feature does not work at all. It is not P0
  because practice and answer saving still work.
- **Area:** practice
- **User scenario:** In practice, a user marks a weak question as Needs work so
  they can come back to it before the interview.
- **What happened:** Both flags fail every time. Each tap sends
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type`, which
  returns **`400`**:
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT specification"}`.
  A red toast appears: *"Couldn't save your Needs work flag. Try again in a
  moment."* Trying again can never succeed. After reload both buttons are back
  in the off state. On mobile, swiping right to favorite (the hint banner suggests
  it) calls the same flag write, so it fails the same way. This is inferred
  from code and was not swiped live.
- **Why it matters:** The freeze scope lists "Favorite / Needs-work" by name as
  shipped. The toast blames a temporary problem, so users keep retrying. The
  card's "needs work" count can then only come from self-ratings.
- **Root cause:** This is the same defect reported in the
  [2026-11-05 run](./2026-11-05-ux-review-routine.md). Production still has
  `UNIQUE(user_id, question_id)` (see
  [FREEZE_RELEASE](../FREEZE_RELEASE.md), "Live baseline"). The fix is migration
  `20260710203000_question_flags_per_type.sql`
  ([PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)), which waits on the
  migration-history fix ([PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)).
- **Recommended fix:** Applying the migration is the real fix, but it is an
  owner-run deployment step. Until it lands, follow the CLAUDE.md rule "Disable
  unwired controls": hide or disable the two flag buttons and the swipe-right
  gesture, with honest copy such as *"Favorites aren't available yet. Your
  answers still save."* Change the toast so it no longer says "try again in a
  moment".
- **Evidence:** `assets/2026-11-19/05-practice-flag-save-error.png`; network
  log from the desktop practice run (two `400` responses, then
  `201 POST practice_answers`); `/practice?searchId=…`, Chrome desktop and
  iPhone 13.

### 2. Research uses a hidden stored CV when the CV box is empty
- **Severity:** P1. This is a trust and privacy issue in the research flow.
- **Area:** research / profile / trust
- **User scenario:** A user leaves "Add your CV (Optional)" empty and starts
  research. They expect a plan based only on the company and role.
- **What happened:** The Vitol run had an empty CV box (field length 0 when
  submitted). The finished plan still listed **"Your CV · First-party ·
  Candidate CV"** under *Why this plan → Sources*, with a one-line summary of
  someone's work history (redacted here). The *Your positioning* section
  ("Lean on… / Address… / Story gaps…") was also built from that CV.

  The code explains it. In
  `supabase/functions/interview-research/index.ts:1124-1134`, an empty `cv`
  falls back to `fetchStoredResumeContent()`, which reads the newest
  `resumes` row for the user. On the frontend, the notice that would explain
  this ("Using the active resume version from your interview profile") and the
  "Restore saved CV" button are hidden by `FROZEN_PRODUCT.profile = false`
  (`src/pages/Home.tsx:191, 637`). Profile and CV import are unrouted, so the
  user cannot see, change or remove the stored CV.
- **Why it matters:** The form promises *"Your CV text is saved privately with
  this prep plan and used to personalize your questions"* only for text the
  user pastes. Quietly using a CV the user can't see breaks "Show
  personalization, do not just claim it" in reverse: the user gets
  personalization they didn't ask for and can't check. It also conflicts with
  the freeze boundary ("optional pasted CV text"). Any account that existed
  before the freeze and has a stored résumé is affected.
- **Recommended fix:** Pick one (the second is closest to the freeze scope):
  - (a) Show the stored CV state on `/new-interview`, e.g. *"We'll use the CV
    saved to your account. Paste a different one or turn it off,"* with a
    toggle.
  - (b) While `FROZEN_PRODUCT.profile` is false, do the fallback only when the
    request explicitly opts in, so an empty box means no CV.
- **Evidence:** Vitol plan, *Why this plan → Sources* (not committed: it
  contains CV content); form state captured before submit (CV textarea length
  0); code references above.

### 3. The practice answer box is still "Quick notes", and its two save lines disagree
- **Severity:** P1. Repeat of last week's issue #1, with new detail.
- **Area:** practice / copy
- **User scenario:** A user types a full answer on their phone and wants to
  know whether it's safe.
- **What happened:** The only answer input is still headed **"Quick notes"**.
  Its placeholder is *"Jot the beats you want to hit…"* on mobile and
  *"Capture bullet points or timing cues…"* on desktop. It has no
  programmatic label, so screen readers announce it by its placeholder.

  New this week: two save lines appear together and contradict each other.
  - The caption says ***"Saved on this device while you practice."***
  - The status next to it changes from ***"Saving draft…"*** to ***"Draft kept
    in this tab."***

  The code backs the second line. Drafts go to `sessionStorage`
  (`Practice.tsx:936`), which is cleared when the tab closes, so "saved on this
  device" is wrong. The status also shows "Saving draft…" as soon as a question
  opens, before anything is typed, because the autosave effect runs on every
  question change (`Practice.tsx:929-940`).

  On desktop, **"Start answering"** still only dismisses the hint banner.
  Focus stays on `<body>`, and the answer box stays in the side panel.
- **Why it matters:** This is the core practice action. A box called "notes"
  makes users under-invest in their answer. Two contradictory save lines make
  them unsure whether their work is safe, which is exactly what the
  "Practice should feel safe" principle is meant to prevent.
- **Recommended fix:**
  - Rename the box to **"Your answer"** and connect a real `<label>` to it.
  - Replace the caption with one accurate line, e.g. *"Draft kept in this tab ·
    saved to your account when you tap Save & Continue."*
  - Show no status until the user types.
  - Make "Start answering" move focus into the answer box.
- **Evidence:** `assets/2026-11-19/06-practice-iphone13-quick-notes.png`,
  `05-practice-flag-save-error.png`. The accessibility tree reports the
  textarea's label as "(no label)".

### 4. On small and rotated phones, the answer panel hides the question and the flags
- **Severity:** P2
- **Area:** practice / mobile
- **User scenario:** A user practices on an iPhone SE, or turns their phone
  sideways to type more comfortably.
- **What happened:** The fixed bottom panel (answer box plus Skip and
  Save & Continue) takes up a fixed share of the screen.
  - On **iPhone SE** (568 px tall), **Favorite and Needs work start out
    underneath the answer box** (`elementFromPoint` returns the textarea). To
    reach them the user has to scroll the question card, which pushes the
    question itself off screen.
  - In **iPhone 13 landscape**, the panel covers the whole screen. The question
    is fully hidden behind the blurred backdrop.
  - Even in **iPhone 13 portrait**, a three-line question pushes the flag
    buttons under the top edge of the panel.

  This was measured without the on-screen keyboard. A real keyboard would
  leave even less room.
- **Why it matters:** "The question is the hero" and "Mobile is the product".
  You can't answer well when you can't see the question.
- **Recommended fix:**
  - Cap the panel's height (e.g. `max-h-[45dvh]` with an internal scroll).
  - In landscape, or when the screen is under about 600 px tall, collapse the
    panel to a single-line answer box that expands when focused.
  - Move Favorite and Needs work into the header next to `Q n/6`, or into the
    "…" menu, so they never sit underneath the panel.
- **Evidence:** `assets/2026-11-19/07-practice-iphonese-scrolled.png`,
  `08-practice-landscape-question-hidden.png`,
  `06-practice-iphone13-quick-notes.png` (flag buttons under the panel's top
  edge).

### 5. A low-evidence plan is thin and generic, and its question count differs by screen
- **Severity:** P2
- **Area:** output / research
- **User scenario:** A user researches a company with little public interview
  data (Vitol · AI Product Manager).
- **What happened:** Research finished quickly (about 45 s). It honestly
  labeled the result a **"Best-guess plan… leans on role norms"**, which is
  good. But the plan has only **6 questions across 4 stages**, and most are
  generic:
  - *"How do you keep up with advancements in AI technology?"*
  - *"What metrics do you consider key when managing an AI product?"*, tagged
    **Final Round · Easy**
  - *"Can you share a story of resolving a conflict within a cross-functional
    team?"*

  Only one question mentions the company, and it describes Vitol as having
  "financial products" (Vitol is an energy and commodities trader).

  Stage notes read like filler, e.g. *"Low confidence: Express alignment with
  company values."*

  The question count also differs by screen. The interview card says **"1 of 8
  answered"**, while the plan and practice say **6**. The card counts every
  question row for the run (`searchService.ts:326`), but the plan shows fewer.
- **Why it matters:** "Depth over breadth" only works if the questions are
  deep. Six generic questions look like what a user would get from ChatGPT,
  which undercuts Prepio's core claim. The 8 vs 6 mismatch makes progress
  numbers look unreliable.
- **Recommended fix:**
  - **(Small, now)** Make the card count the same set of questions as the plan
    and practice.
  - **(Product)** When evidence is thin, say what Prepio is doing about it,
    e.g. *"Few Vitol-specific reports found. These questions are based on AI
    PM interviews at trading firms."* Then ground the questions in the
    industry (commodities trading, risk, trader workflows) rather than generic
    AI PM prompts. That is pipeline work and needs a freeze exception.
- **Evidence:** `assets/2026-11-19/04-vitol-plan.png`,
  `02-interviews-with-dates.png`; `/dashboard?searchId=c2f6ab9f…`.

### Other findings (below the top 5)

| Sev | Area | Finding |
|---|---|---|
| P2 | error / copy | **Repeat (last week's issue #2).** The failed-run page still reads *"Error Loading Interview Research — Search processing failed. Please try again."* It doesn't name the run or say whether the user's details are kept. (`10-research-failed.png`) |
| P2 | accessibility | **Repeat (last week's issue #3).** 12 px muted helper text on `/new-interview` still measures **4.06:1**, including the CV privacy line. WCAG AA needs 4.5:1. |
| P3 | research | When research finishes, the modal title still says **"Research in progress"** above *"Research complete · Done"*. At 1280×900 the **View results** button is below the fold inside the modal, so the user has to scroll inside the dialog to find it. (`03-research-complete-modal.png`) |
| P3 | practice | Reloading during practice on desktop goes back to "Ready to practice? Quick Start". The user's place in the session is lost (the saved answer is kept). |
| P3 | practice | The desktop hint says *"Swipe left to skip, right to favorite"* to mouse users. On desktop the flags are 32×28 icon-only buttons, below the 44 px touch-target size. |
| P3 | dashboard | The new card date reads *"Started 2026-11-19 (UTC)"*. That's correct but reads like system output; *"Started 19 Nov"* would be friendlier. "Dashboard" in the nav still goes to the same page as `/interviews` (repeat of last week's issue #4). |
| P3 | landing | **Repeat (last week's issue #5).** The landing sample plan still starts collapsed, but the copy says "Explore a fixed example below". |
| P3 | auth | A wrong password shows Supabase's raw *"Invalid login credentials"*. Acceptable, but *"That email and password don't match. Try again or reset your password."* would be clearer. |

**What works well (keep):**
- The guest sample makes **no network calls** apart from Google Fonts.
- Signed-out visits to protected routes redirect with *"Continue to Practice"*,
  and signed-in visits to `/` go to `/interviews`.
- `/profile` and `/pricing` return 404, as the freeze requires.
- The research form disables Start until a company is entered, and the button
  updates to "Research Vitol →".
- The progress modal tells users it's safe to leave.
- The offline banner is clear and specific: *"Reconnect to start practice, save
  answers, or update favorites."* Save is disabled while offline and the draft
  is kept.
- Answer save works (`201`).
- On desktop practice, keyboard focus moves in a logical order, and an
  automated check found a focus style on all 22 elements tabbed through. The
  layout shift score was 0.08.
- On the throttled network, the page heading appears within 1.5 s and the
  cards appear at about 9 s, behind a skeleton.

## Journey scorecard

| Area | Score | Δ vs 11-12 | Notes |
|---|---:|:---:|---|
| First-time understanding | 4 | = | Honest, concrete sample, but still collapsed by default. |
| Research entry | 4 | = | Clean form with progressive disclosure. The empty-CV fallback (issue 2) is a backend trust problem, scored under profile trust. |
| Research progress/loading | 4 | = | Clear phases, ETA and "safe to leave" message. When finished, the title is wrong and the CTA is below the fold. |
| Generated output clarity | 3 | ▼ | Structure and honesty are good ("Best-guess plan"). A thin, generic 6-question plan and the 8 vs 6 count mismatch cost a point. |
| Practice mode | 2 | = | The question is the main focus, and answer save works. But flags fail on every attempt, the answer box is "Quick notes", and the save lines contradict each other. |
| Mobile usability | 3 | ▼ | Fine on iPhone 13 and Pixel 7 in portrait. On iPhone SE and in landscape, the answer panel hides the flags or the whole question. |
| Resume/profile trust | 2 | ▼ | A hidden stored CV is used without being shown. The good privacy copy only covers pasted text. |
| Dashboard/history/resume | 4 | = | Dates now tell same-company runs apart (▲). Dashboard/Interviews duplication and the count mismatch hold it at 4. |
| Error/empty states | 3 | = | Offline and empty-history states are excellent. The failed-run page is generic, and the flag toast falsely says the problem is temporary. |
| Accessibility | 3 | = | Focus rings, skip link, `<main>` and labeled auth fields are good. The answer box has no label, and 12 px helper text fails contrast. |
| Copy quality | 3 | = | Mostly direct and honest. "Quick notes", the contradictory save lines and the generic error copy pull it down. |

## Regression check

- **No code regressions found.** The only user-facing change (#393, card dates)
  is an improvement and closes half of last week's issue #4.
- **Not regressions, but missed last week:** the flag-write failure (issue 1)
  and the stored-CV fallback (issue 2) were already in production on 11-12.
  The flag failure was reported on 11-05 and dropped out of the 11-12 report.
  This run puts both back on record.
- **Scores went down** on output clarity, mobile and profile trust. That is
  because this run tested deeper (a low-evidence company, small and rotated
  phones, the Sources panel), not because the build got worse.

## Recommended tickets (ready to file, not filed automatically)

As in previous runs, I have not filed these automatically. This is an
unattended scheduled run, and the freeze ("do not add features") means a
person should triage them first. Each is small and can stand alone.

1. **Disable Favorite / Needs-work until PREPIO-170 is applied** (`area:practice`, Bug).
   Hide or disable the two flag buttons and the swipe-right-to-favorite gesture
   behind a feature flag, with the copy *"Favorites aren't available yet. Your
   answers still save."* Remove "Try again in a moment" from the flag-error
   toast. Turn them back on in the same change that applies the migration.
2. **Stop silently using a stored CV when the CV box is empty** (`area:research-pipeline`, Bug).
   In `interview-research`, only fall back to `fetchStoredResumeContent()` when
   the request includes an explicit `useStoredCv: true`. Alternatively, show the
   stored-CV state and an off switch on `/new-interview`. Add a test that an
   empty `cv` with no opt-in gives `cvSource = 'none'`.
3. **Rename the answer box to "Your answer" and make its save lines accurate** (`area:practice`, Improvement).
   Mobile and desktop changes:
   - change the heading and placeholder
   - connect a `<label htmlFor>` to the textarea
   - replace "Saved on this device while you practice." with *"Draft kept in
     this tab · saved to your account when you tap Save & Continue"*
   - don't show "Saving draft…" until the user has typed
   - make "Start answering" focus the textarea
4. **Cap the mobile answer panel's height and move the flags out from under it** (`area:practice`, Improvement).
   Add `max-h` of about 45 dvh with an internal scroll. Use a compact layout
   when the screen is under 600 px tall or in landscape. Move Favorite and
   Needs work into the header or the "…" menu. Check on iPhone SE, iPhone 13
   in landscape, and with the on-screen keyboard open.
5. **Make the interview card count the same questions as the plan** (`area:practice`, Bug).
   `buildInterviewSummaries` counts every `interview_questions` row (8), while
   the plan and practice show 6. Count the same set the plan uses, and add a
   test for it.
6. **Rewrite the failed-research page** (`area:research-pipeline`, Improvement). Repeat of last week's ticket 2.
   Name the run and confirm the user's inputs are kept, e.g. *"We couldn't
   finish researching OpenAI · Solutions Architect. Your details are saved:
   retry, or start a new prep."*
7. **Fix the finished state of the research modal** (`area:research-pipeline`, Improvement).
   Change the title to "Research complete" when finished. Pin the
   Close / View results buttons in a footer that stays visible instead of
   inside the scrolling area.
8. **Raise ≤14 px muted helper text to at least 4.5:1 contrast** (`area:landing`, Improvement). Repeat of last week's ticket 3.

---

Capability: live browser verified
