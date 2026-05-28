# Practice capability product review — 2026-05-28

Product review of the full practice loop (`src/pages/Practice.tsx`, the practice
service layer, `practice_answers` / `practice_sessions` / `answer_feedback`
schema, the `practice-audio-transcribe` and `answer-feedback` edge functions,
and `src/pages/History.tsx`), with prioritized enhancements.

> **Filing note.** These were intended for the **Prepio** Linear team but no
> Linear integration was reachable from the authoring session. They are captured
> here Linear-ready (title, project, labels, status, body) so they can be pasted
> into Linear directly, or auto-linked once a `PREPIO-NN` branch is opened per
> issue.

## What works today

The loop is solid and honest: setup wizard (goal → stages → filters → review)
with Quick/Deep presets, in-session text + voice answers, local autosave,
swipe/keyboard controls, offline guards, favorite/needs-work/skip flags,
self-rating, a completion summary, and a History surface with aggregate stats.
Voice answers upload to `practice-audio` and transcribe via
`practice-audio-transcribe`. The data model is well-built: `practice_answers`
dedupes per question, `answer_feedback` already supports supersession
(regenerate-without-losing-history), and entitlement is enforced at the edge.

## The core problem

Practice is currently a **"record and move on" loop with no feedback in the
moment.** The user answers, self-rates 1–5 with no rubric, and advances. The
richest assets the research pipeline produces — `evaluation_criteria`,
`good_answer_signals`, `weak_answer_signals`, `sample_answer_outline` — are
shown as reference *before* answering but never used to close the loop against
the user's actual answer. The user leaves a session not knowing how they did.

This is also roadmap Priority #1: the `answer-feedback` edge function, the
`answer_feedback` table, the entitlement gate, and the prompt are all built and
tested — but the UI is a stub. `SessionSummary.tsx:227` shows a "Get detailed
coaching" button that only toggles a notice and never calls the function. The
plumbing is done; the payoff is disconnected.

---

## Issues to raise

### 1. Wire up AI answer feedback UI (concise, information-dense)

- **Project:** AI Answer Feedback (Paid)
- **Type:** `Feature`  ·  **Area:** `area:practice`, `area:billing`
- **Status:** Todo  ·  **Priority:** High

**Context.** The `answer-feedback` edge function, `answer_feedback` table,
entitlement gate, and structured prompt already exist and are tested. The only
missing piece is the client call + render. `SessionSummary.tsx:227` has a
stubbed "Get detailed coaching" button that toggles a notice and never invokes
the function.

**Scope.**
- Call `invoke('answer-feedback')` behind the existing button for a saved answer.
- Render the structured response (`strengths`, `improvements`, `starBreakdown`,
  `nextAction`) in Session Summary, History, and per-question in Practice.
- Handle the three states the function already returns:
  - `paid_entitlement_required` (403) → upsell, no generation.
  - `feedback_already_exists` (409) → show cached feedback + offer regenerate
    (supersession is already supported server-side).
  - usable-text guard (<20 chars) → inline hint instead of a failed call.

**Presentation requirement (explicit).** Feedback must be **concise, straight to
the point, and information-dense** — not prose paragraphs. Target:
- Strengths / improvements as short scannable bullets (lead with the point, then
  brief evidence), capped (e.g. ≤3 each).
- STAR breakdown as compact labeled chips/row, not narrative.
- Exactly one `nextAction` — a single concrete next step.
- No filler or restating the question. Optimize for a 10-second read.

**Acceptance.**
- Paid user can generate, view, and regenerate feedback in all three surfaces.
- Free user sees the gated upsell, not a broken call.
- Rendered feedback is bulleted/chip-based and density-capped per above.

**Note.** Conversion depends on the billing surface (paid-gate UX, checkout) —
see Pricing & Monetization. Feedback can ship and be demoed against a paid test
account before checkout is live.

---

### 2. Post-answer rubric self-check (free tier)

- **Project:** Quality & Maintenance
- **Type:** `Improvement`  ·  **Area:** `area:practice`
- **Status:** Backlog

**Context.** The self-rating asks for confidence with no anchor. Each question
already carries `good_answer_signals` / `evaluation_criteria` shown *before*
answering only.

**Scope.** After an answer is saved, surface that question's own signals /
criteria as a self-check list so free users can grade against real criteria.
Keeps the free tier genuinely useful and makes paid AI feedback (#1) an obvious
upgrade rather than a paywall on the only feedback that exists.

**Acceptance.** After saving, the user sees the question's good/weak signals as a
check list; no new data or model calls required.

---

### 3. Make audio transcription non-blocking

- **Project:** Quality & Maintenance
- **Type:** `Improvement`  ·  **Area:** `area:practice`, `area:infra`
- **Status:** Backlog

**Context.** `handleSaveAnswer` (`Practice.tsx:1259`) uploads audio, then awaits
transcription, then saves — serially, inside the save path. A slow transcription
call stalls advancing to the next question.

**Scope.** Save the answer + audio path immediately and advance; transcribe
asynchronously and patch `transcript_text` when ready. Matters more once AI
feedback (#1) depends on the transcript.

**Acceptance.** Saving a voice answer advances without waiting on transcription;
`transcript_text` is populated when transcription completes; failure to
transcribe does not block the save.

---

### 4. History as a progress story + readiness scoring

- **Project:** Quality & Maintenance
- **Type:** `Feature`  ·  **Area:** `area:practice`
- **Status:** Backlog  ·  (Roadmap "Next" — gated on #1 shipping)

**Context.** History is currently session cards + four totals. Once feedback data
flows, it can become a progress narrative.

**Scope.** Trend views: improvement on repeated questions, recurring weak signals
across answers, and a readiness score derived from actual feedback. Make the
existing `focus=needs_work` practice mode launchable directly from History so
"needs work" becomes a practice queue.

**Acceptance.** History shows trend/readiness derived from feedback data and a
one-click launch into a needs-work practice session.

---

### 5. Follow-up question drilling ("interviewer mode")

- **Project:** Quality & Maintenance
- **Type:** `Feature`  ·  **Area:** `area:practice`
- **Status:** Backlog  ·  (Roadmap "Later")

**Context.** Each question already carries `follow_up_questions`, displayed only
as info today.

**Scope.** Opt-in mode where answering a question triggers one of its existing
follow-ups — the cheapest step toward eventual conversational mock interviews,
with no new data needed.

**Acceptance.** In interviewer mode, saving an answer presents a follow-up from
that question's `follow_up_questions` before advancing.
