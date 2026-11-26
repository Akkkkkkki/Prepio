# Prepio UI/UX Review — 2026-11-26 (recurring routine)

Weekly UX-review routine. Immediate baseline:
[`2026-11-12`](./2026-11-12-ux-review-routine.md). Operating contract:
[`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md).

## Capability check — live browser verified

- **Playwright Chromium: PASS** — pre-installed, plain `chromium.launch()`.
- **Live app: PASS** — `https://prepio.qiuyue.dev/` returned `200` and rendered; tester
  login succeeded; writes reached Supabase.

**Coverage:** desktop Chrome 1440×900; iPhone 13 (portrait and 844×390 landscape) and
Pixel 7 emulation; logged-out landing, guest sample, `/auth` (including a bad-password
error); direct links to protected routes; a **real research run** (McKinsey · AI
Consultant, with a short **synthetic** CV pasted); plan review; desktop practice (typed
answer, Save & Continue, Favorite, Needs work, Skip, refresh mid-session); mobile practice
(save, offline save, back online, rotation); `/history` and `/interviews` for a returning
user; throttled network (400 ms latency, 50 KB/s); keyboard Tab order and focus rings;
computed contrast; 720×450 viewport as an approximation of 200% zoom. Live data cross-checked
against the Data API with the tester's own session token.

**Not covered:** WebKit/Safari (only Chromium is installed in this environment), real
devices, screen readers, CV file upload (out of freeze scope). The tester CV box was empty
before this run. The only CV text in any capture is the fictional QA CV this run pasted.

**Side effects on the tester account:** one new research run (McKinsey · AI Consultant),
two saved practice answers, and several `practice_sessions` rows. Each visit to
`/practice?searchId=…` inserts a session row before the user answers anything.

Evidence: [`assets/2026-11-26/`](./assets/2026-11-26/).

## Overall product judgment

The product is **about the same as two weeks ago, with one newly found defect that matters**.
What worked before still works: research entry, the phased progress modal (about 70 s
end-to-end), the plan page, mobile portrait practice with a clear question and 48 px
controls, and an honest offline state. Interview cards now show `Started YYYY-MM-DD (UTC)`
(#393), which fixes the duplicate-card ambiguity raised last time. Personalization is
real: the McKinsey run turned the synthetic CV into questions about the "GenAI
document-processing pilot" and the "churn model for a telecom client". The biggest new risk
is that **every research run since at least 2026-11-12 saves 22–28% of its questions with
no stage**. Those questions never appear on the plan or in practice, but they still count
toward the interview card's total. The card says "0 of 40 answered" while the plan says
"29 questions", so progress can never reach 100%. Practice is still the weakest area.
Favorite and Needs work still fail on every write (PREPIO-170). The answer box is still
labelled "Quick notes" and shows "Saving draft…" even when it is empty. Refreshing
mid-session sends the user back to setup.

## Top 5 issues

### 1. A quarter of generated questions are orphaned: hidden from plan and practice, but counted on the card
- **Severity:** P1 (new finding; a regression since August)
- **Area:** output / history / research-pipeline
- **User scenario:** A user finishes research, sees "29 questions across 5 stages" on the
  plan, then returns to *Your interviews* and sees "0 of 40 answered".
- **What happened:** For the McKinsey run, 11 of 40 `interview_questions` rows have
  `stage_id = null`. The plan loads questions per stage (`searchService.ts:607-612`) and
  practice does the same (`Practice.tsx:~774`), so those 11 questions are unreachable. The
  card counts every question for the search (`searchService.ts:733-736`,
  `buildInterviewSummaries` at `:326`). Across the tester account:

  | Run | Total | Stageless |
  |---|---:|---:|
  | 2026-11-26 McKinsey · AI Consultant | 40 | **11** |
  | 2026-11-19 Vitol · AI Product Manager | 8 | **2** |
  | 2026-11-12 Anthropic · Product Manager | 40 | **9** |
  | 2026-08-23 Stripe · Data Product Manager | 10 | 0 |
  | 2026-06-01 OpenAI · Solutions Architect | 40 | 0 |

  Persistence maps `q.stageName` to a stage ID and falls back to `null`
  (`supabase/functions/interview-research/index.ts:1030`). `prep-plan-validation.ts:53-57`
  already describes this exact failure mode.
- **Why it matters:** Users lose 22–28% of the research they waited for, and progress can
  never finish: 29/40 = 73% at best. This is a trust bug in the core "depth over breadth"
  promise, and the 2026-11-12 run missed it because it trusted the card count.
- **Recommended fix:** In the pipeline, treat an unresolved `stageName` as a validation
  error to repair, not a silent `null`. Until then, either count only stage-linked
  questions on the card or show stageless questions in a visible "More questions" group.
  Backfill or reassign the existing orphan rows.
- **Evidence:** `assets/2026-11-26/07-interviews-desktop.png` (card: 40),
  `11-plan-desktop.png` (plan: 29); Data API counts above.

### 2. Favorite and Needs work still fail on every write
- **Severity:** P1 (repeat; release scope; tracked as
  [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170), status Todo)
- **Area:** practice
- **User scenario:** A user stars a question or marks it Needs work so they can come back
  to it.
- **What happened:** `POST user_question_flags?on_conflict=user_id,question_id,flag_type`
  returns `400` with `42P10` ("there is no unique or exclusion constraint matching the ON
  CONFLICT specification") for both flags. Only one toast appears: "Couldn't save your
  Needs work flag. Try again in a moment." The Favorite failure that happened just before
  it is not named. Retrying cannot work, so "Try again in a moment" is not honest.
- **Why it matters:** `FREEZE_RELEASE.md` lists flags in the active release scope, and this
  is the third straight live run that has found them broken. Users cannot build a review
  list.
- **Recommended fix:** Land PREPIO-170: apply `20260710203000_question_flags_per_type.sql`
  after the PREPIO-124 reconciliation. Until then, change the toast to say flags are
  temporarily unavailable, and stop suggesting a retry.
- **Evidence:** `assets/2026-11-26/16-practice-desktop-flags.png`; console:
  `Failed to set flag: {code: 42P10 …}`.

### 3. The answer box still looks like scratch notes, and its save status is wrong
- **Severity:** P1 (repeat of 2026-11-12 #1, plus new details)
- **Area:** practice / copy / accessibility
- **User scenario:** A user opens a question and starts typing their real answer.
- **What happened:** The label is still "Quick notes · Saved on this device while you
  practice" and the placeholder is still "Jot the beats you want to hit…"
  (`Practice.tsx:2916-2926`, `:3252-3275`). New details:
  - **"Saving draft…" shows as soon as a question opens, even when the box is empty**, and
    stays for the full 5 s debounce (`AUTOSAVE_DELAY_MS = 5000`, `:76`, `:931-937`).
  - **"Start answering" does not move focus to the box.** After the click, focus is on
    `BODY`.
  - **The desktop answer `<textarea>` has no accessible name**: no `<label>`,
    `aria-label` or `aria-labelledby`.
- **Why it matters:** The status says a save is happening when nothing is being saved, and
  it undersells the most important action in the product. Screen-reader users hear an
  unnamed edit field.
- **Recommended fix:** Label the box "Your answer". Show nothing until the user types, then
  "Draft kept in this tab", then "Answer saved". Focus the box when "Start answering" is
  pressed. Associate a real `<label>`.
- **Evidence:** `assets/2026-11-26/23-iphone-practice.png` (empty box, "Saving draft…"),
  `16-practice-desktop-flags.png`.

### 4. Refreshing mid-practice loses your place, and the plan page flashes a "Building" screen
- **Severity:** P2
- **Area:** practice / error-states
- **User scenario:** A user is partway through a session, their phone reloads the tab, or
  they come back to the plan.
- **What happened:**
  - **Practice refresh:** Before the refresh, the session was on Q1 of 10 with a typed
    draft. After it, the page is back on setup ("Ready to practice?"). Quick Start then
    reshuffles 10 questions, so the draft (kept in `sessionStorage` per question) only
    comes back if the same question happens to reappear. There is no `beforeunload` guard,
    and anything typed in the last 5 s is never stored.
  - **Plan page flash:** After `Back to dashboard`, the plan renders at about 2 s. At about
    5 s it is replaced by a full-page "Building Your Prep Plan · Research complete! · 100%
    complete" card, then the plan returns by about 10 s. The nav highlight also switches to
    "Dashboard".
- **Why it matters:** "Refresh during active practice" is in the routine's must-test list,
  and here the user's work is not safe. A completed plan flipping back to "Building" looks
  broken.
- **Recommended fix:** Save the active session (question order, index, drafts) and resume
  it on reload with a "Continue where you left off" prompt. On the plan page, stop
  replacing the content with the build interstitial once `status = completed`.
- **Evidence:** `assets/2026-11-26/20-practice-after-refresh.png`,
  `18-practice-after-reload.png`.

### 5. Practice in phone landscape switches to the desktop layout and pushes the question off-screen
- **Severity:** P2 (new coverage, not a regression)
- **Area:** mobile / practice
- **User scenario:** A user turns their phone sideways to type a longer answer.
- **What happened:** At iPhone 13 landscape (844×390) the page uses the desktop layout. The
  top nav, "Back to dashboard", the session-progress card and the keyboard-shortcut hint
  fill the whole viewport. The question is below the fold, and **Save & Continue sits at
  y≈1049 in a 390 px-tall viewport**. Portrait is good: question first, 48 px targets,
  safe-area padding, no horizontal scroll on Pixel 7.
- **Why it matters:** "Mobile is the product." Rotation is in Script C, and a hint about
  arrow keys on a touch device is noise.
- **Recommended fix:** Choose the practice layout from pointer type or viewport height, not
  width alone (for example, `(pointer: coarse)` or `max-height: 500px` → mobile layout).
  Hide the keyboard hint on touch devices.
- **Evidence:** `assets/2026-11-26/28-iphone-landscape.png`.

### Also observed (P3, not in the top 5)
- **Research ETA still jumps around:** "~33s remaining" at 10%, then "~43s" at 40% (repeat).
- **Realtime subscription error during research:** `Failed to set up Realtime subscription:
  cannot add postgres_changes callbacks … after subscribe()`. Progress still updated,
  apparently by polling.
- **When research finishes, the modal stays on "Research complete · View results"** and
  does not open the plan automatically. That is acceptable, but it adds an extra click.
- **Contrast:** 12 px helper text on `/new-interview` is still **4.06:1**, below AA (repeat).
  The 18 px subtitle is 4.42:1.
- **Landmarks:** The plan page and practice have no `<main>`; `#main-content` exists, so
  the skip link works. The `/auth` `<h1>` is still "Prepio" (repeat).
- **`/auth`:** "Invalid login credentials" is Supabase's wording and is not tied to the
  fields (`aria-describedby`). The "terms and privacy policy" line has no links.
- **Landing:** The sample plan is still collapsed by default, but the copy says "Explore a
  fixed example below" (repeat).
- **Inconsistent separators** between company and role: `·` (cards), `-` (practice setup,
  research modal), `—` (build card), `•` (practice header).
- **Generic questions remain:** Alongside strong CV-linked ones, the McKinsey plan includes
  generic prompts ("What recent AI trends do you find most interesting and why?", "How do
  you deal with ambiguity in client requests?").

## Journey scorecard

| Area | Score | Δ vs 11-12 | Notes |
|---|---:|:---:|---|
| First-time understanding | 4 | = | Honest, concrete sample; still collapsed behind a click. |
| Research entry | 4 | = | Company-only start, dynamic "Research McKinsey →" CTA, disabled until valid, labelled CV field, strong privacy copy. |
| Research progress/loading | 4 | = | Phased modal, ~70 s, "Safe to leave this screen". ETA jitter and a realtime console error. |
| Generated output clarity | 3 | ▼ | The plan page is strong, but 11 of 40 questions are silently missing and the counts disagree (#1). |
| Practice mode | 2 | = | Clear question; flags broken, answer box mislabelled, status wrong, refresh loses the session. |
| Mobile usability | 3 | ▼* | Portrait is excellent (48 px targets, safe area, honest offline). Landscape falls back to desktop layout. *New coverage, not a regression. |
| Resume/profile trust | 3 | = | CV text visibly shapes questions (a positive). Privacy copy is good but sub-AA contrast. No profile (freeze). |
| Dashboard/history/resume | 4 | = | Start dates fix duplicate cards (#393). Card totals are inflated by orphaned questions. |
| Error/empty states | 3 | = | Offline and empty History are excellent. The flag toast suggests a retry that cannot work, and refresh drops work. |
| Accessibility | 3 | = | Visible focus rings on every Tab stop; unlabelled practice textarea; no `<main>` on plan or practice; 4.06:1 helper text. |
| Copy quality | 3 | = | Mostly direct. Contradictions: "Quick notes" vs answer, "Saving draft…" on an empty box. |

## Regression check

- **New (regression):** stageless questions. The 2026-06-01 and 2026-08-23 runs have 0;
  every run from 2026-11-12 on has 22–28%. The 2026-11-12 report recorded "Plan ready · 40
  questions" without noticing that the plan showed fewer.
- **Unchanged and still broken:** Favorite/Needs-work writes (`400/42P10`, PREPIO-170);
  "Quick notes" answer label; 4.06:1 helper text; `/auth` h1; collapsed landing sample;
  ETA jitter.
- **Improved:** interview cards show `Started YYYY-MM-DD (UTC)`, so duplicate company/role
  cards can be told apart (#393, from 2026-11-12 #4).
- **Not regressions:** "Dashboard" in the nav still goes to the same surface as
  `/interviews`; PREPIO-101 (In Progress) covers it.

## Recommended tickets (ready to file, not auto-filed this run)

Not filed automatically because this is an unattended run and the freeze asks a human to
triage new work. PREPIO-170 already covers the flags failure. No duplicate was found in
Linear for the others.

1. **[Bug · area:research-pipeline] Never save questions with an unresolved stage.**
   Treat a `stageName` that does not match a stage as a repairable validation error in
   `prep-plan-validation.ts`, add a test with a near-miss stage name, and backfill existing
   `stage_id IS NULL` rows. *Acceptance:* a fresh run has 0 stageless questions.
2. **[Bug · area:practice] Make the interview card total match the plan.** Count only
   stage-linked questions in `buildInterviewSummaries`, or show stageless questions in the
   plan, so "N of M answered" and "M questions across K stages" always agree.
3. **[Improvement · area:practice] Make the answer box clearly the answer.** Label it "Your
   answer" with a real `<label>`. Show no status while the box is empty, "Draft kept in this
   tab" after typing, and "Answer saved" after a server save. Focus the box when "Start
   answering" is pressed.
4. **[Bug · area:practice] Resume the active practice session after a reload.** Save the
   question order, index and current draft. After a refresh, offer "Continue Q3 of 10"
   instead of the setup screen. Write the draft immediately on `pagehide`.
5. **[Bug · area:practice] Stop the plan page flipping to "Building Your Prep Plan" after
   load.** Once a search is `completed`, background refetches must not swap the plan for
   the build interstitial.
6. **[Improvement · area:practice] Use the mobile practice layout in phone landscape.**
   Choose the layout by `(pointer: coarse)` or height, and hide the arrow-key hint on touch
   devices. *Acceptance:* at 844×390 the question and Save & Continue are visible without
   scrolling.
7. **[Chore · area:research-pipeline] Fix the order of the research-progress realtime
   subscription.** Register `postgres_changes` handlers before `subscribe()` so the console
   error stops and progress does not depend on polling alone.
8. **[Improvement · area:practice] Make the flag failure message honest until PREPIO-170
   lands.** Name the flag that failed (Favorite or Needs work) and drop "Try again in a
   moment" while the failure cannot be retried.

---

Capability: live browser verified
