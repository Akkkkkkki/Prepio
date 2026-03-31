# Mobile Practice UX Execution Plan

**Status:** Implemented on mobile, follow-up QA ongoing  
**Last updated:** March 31, 2026  
**Scope:** Mobile practice flow only, especially the active question experience on phones  
**Primary files impacted:** `src/pages/Practice.tsx`, `src/components/practice/BottomPracticeNav.tsx`, `src/components/practice/PracticeHelperDrawer.tsx`, `src/components/practice/QuestionInsightsPanel.tsx`, `src/components/Navigation.tsx`

## Why This Exists

The current mobile practice experience works on paper, but it does not feel good in-hand.

The page is too tall, the control hierarchy is crowded, the main task is split across too many regions, and full-card swipe competes with the natural vertical scroll behavior of a phone. Voice recording is also treated like a helper even though it is one of the main reasons a user enters practice mode.

This doc now records the shipped mobile direction and the remaining QA expectations without rewriting the whole product.

## Product Goal

On mobile, a user should be able to:

1. Open a practice question.
2. Read the prompt without hunting through stacked UI.
3. Record or jot notes immediately.
4. Save and move to the next question without awkward scrolling or accidental actions.

If the screen does not make that flow obvious in under a second, it failed.

## What Is Broken Today

### 1. The page is desktop-shaped, not phone-shaped
- The active practice screen stacks global nav, back button, progress card, question card, helper drawer, coaching panel, and sticky footer.
- On a phone this becomes a long scroll column, which forces the user to move up and down just to complete one answer cycle.

### 2. Too many actions have the same visual weight
- Back, skip, favorite, timer reset, swipe hint, helper drawer, coaching panel, notes, voice controls, dot nav, and save CTA all appear in the same session.
- The question is not clearly dominant.

### 3. Swipe is fighting the platform
- Full-card swipe is wired on the main question surface.
- Phones already use vertical motion for reading. Asking users to horizontally fling the same content block creates accidental triggers and trust issues.

### 4. Recording is misplaced
- Voice recording is inside "Practice tools", which frames it as secondary.
- On mobile it should be part of the core response composer.

### 5. Secondary guidance is always too visible
- Interviewer insights are valuable, but keeping them permanently on-screen below the main content makes the page feel dense.
- Coaching should be available on demand, not always in the reading path.

## Design Principles

### 1. One screen, one job
The main screen is for answering the current question. Everything else is secondary.

### 2. The question must dominate
The user should see the start of the question, the response controls, and the primary CTA in the first viewport.

### 3. Make recording first-class
If voice is important, it belongs in the main composer, not a drawer.

### 4. Demote optional guidance
Coaching, outlines, and follow-ups move into a dedicated mobile modal.

### 5. Prefer explicit controls over gestures
Use tap controls for the main path. Gestures can be added later if user testing proves they help.

## Mobile Information Architecture

The mobile practice screen should collapse into three permanent zones:

1. `Header`
   Back, progress position, timer, overflow menu.
2. `Question Area`
   Minimal metadata plus the current prompt.
3. `Sticky Composer + CTA`
   Recording, notes entry point, save/continue, skip.

Everything else becomes optional UI:

- Coaching and interviewer focus: full-screen modal
- Session details and timer reset: overflow menu
- Dot navigation: compact progress drawer or hidden behind overflow on mobile

## Screen Specs

### Setup State

Replace the current 4-step mobile setup wizard with a 2-path entry:

```text
[Top bar]
< Back            Practice setup

[Summary block]
Company / role
10 questions • 15 to 20 min

[Choice]
(•) Quick start
( ) Custom session

[If custom]
Question count
Stage chips
Difficulty chips
Shuffle toggle
Favorites-only toggle

[Primary CTA]
Start practice
```

#### Rules
- `Quick start` is default.
- `Custom session` expands in place instead of sending users through a long ceremony.
- Show estimated duration before the CTA.
- Keep the whole setup path above the fold on a typical phone.

### Active Question, Idle State

This is the default screen and the most important wireframe.

```text
[Sticky top bar, 56px]
<           Q3/10          00:42         ...

[Thin progress bar]
██████████░░░░░░░░

[Question card]
Behavioral   Medium
Can you provide an example of how you successfully
managed a cross-functional team...

[Tiny utility row]
Favorite      Coach notes

[Sticky composer]
[Mic button]    [Notes]
Optional note preview

[Sticky CTA row]
[Skip]                     [Save & Continue]
```

#### Rules
- Only two metadata chips stay visible by default: stage and difficulty.
- Favorite becomes a simple tap action in the utility row or header.
- `Coach notes` opens a full-screen modal and does not expand the page.
- The progress summary card disappears on mobile. Progress belongs in the header.

### Active Question, Recording State

Recording needs a clearer mode shift.

```text
[Sticky top bar]
<           Q3/10         REC 00:18       ...

[Question card]
Prompt text...

[Recording panel]
Recording
00:18
Simple level meter or pulse

[Secondary actions]
[Delete]      [Pause]

[Sticky CTA row]
[Stop recording]           [Save answer]
```

#### Rules
- While recording, de-emphasize nonessential controls.
- Notes stay accessible, but visually secondary.
- The recording state should be impossible to mistake for idle.
- First use must run a permission preflight before entering active recording UI.

### Active Question, Notes Expanded

Notes should feel fast, not like entering a second mode.

```text
[Sticky top bar]
<           Q3/10          00:42         ...

[Question card]
Prompt text...

[Notes composer]
Quick notes
[4 to 5 visible lines]
Saved locally

[Sticky CTA row]
[Skip]                     [Save & Continue]
```

#### Rules
- Notes expand inline above the CTA row.
- The question should still remain at least partially visible.
- Autosave status stays quiet and local to the field.

### Coaching Modal

The current `QuestionInsightsPanel` content lives inside a mobile modal.

```text
[Full-screen modal]
Coach notes

What strong answers show
Short summary...

Great answers include
- ...

Watch out for
- ...

Suggested outline
...

They may ask
- ...
```

#### Rules
- Open from `Coach notes`.
- Open directly at full height with a visible close affordance.
- The modal should not push the main page longer.
- The user should be able to dismiss it and continue answering immediately.

### Session Complete State

Completion should stay simple.

```text
Practice complete

7 answered
3 skipped
14 min total
2 favorited

What felt weak today?
[Short notes field]

[Start another round]
[Back to dashboard]
```

#### Rules
- Show finished work first.
- Reflection is optional.
- Keep only two primary next steps.

## Interaction Model

### Remove full-card swipe from the primary mobile path

The current swipe implementation is clever but wrong for this screen.

For mobile:
- `Skip` is a button.
- `Favorite` is a tap.
- `Back` is a button.
- `Save & Continue` is the main CTA.

If gesture support remains, it should be:
- disabled by default on mobile, or
- limited to an explicit gesture mode later

### Use one sticky footer, not two competing anchors

The composer and primary CTA should be one footer system. The existing pattern of helper content plus a separate sticky bottom nav makes the screen feel split.

### Keep tertiary actions out of the main reading path

Move these into the overflow menu:
- Reset timer
- Session details
- Change setup
- Exit practice

## Content Hierarchy

### Always visible
- Back
- Question position
- Timer
- Question prompt
- Record / notes entry
- Skip
- Save & Continue

### Visible but light-weight
- Stage
- Difficulty
- Favorite
- Coach notes

### Hidden until requested
- Answer outline
- Good / weak signals
- Follow-up questions
- Timer reset
- Session details
- Filter summary

## Component Mapping

This is the lowest-risk implementation path.

### `src/pages/Practice.tsx`
- Split the mobile active session into a dedicated layout path instead of relying on the desktop grid collapsing naturally.
- Move progress summary into a compact mobile header.
- Replace full-card swipe as the default mobile navigation.
- Promote recording and notes into a shared sticky composer.

### `src/components/practice/BottomPracticeNav.tsx`
- Replace the current dots + CTA footer on mobile with a two-row composer/footer system.
- Keep the current desktop behavior if needed.
- If dots remain, hide them behind a sheet or condensed progress control on phones.

### `src/components/practice/PracticeHelperDrawer.tsx`
- Remove it from the main mobile practice surface.
- Either keep it desktop-only or repurpose it for advanced actions that are not part of the default mobile response flow.

### `src/components/practice/QuestionInsightsPanel.tsx`
- Preserve the content model.
- Rehost it in a full-screen mobile modal.
- Keep the desktop side panel if it remains useful there.

### `src/components/Navigation.tsx`
- In practice mode on mobile, switch to a compact practice-specific app bar.
- The full app navigation shell is too expensive vertically for this task.

## Phased Execution Plan

### Phase 1, Stabilize the core mobile path
- Introduce a dedicated mobile practice shell.
- Remove full-card swipe from default mobile behavior.
- Make recording and notes first-class controls.
- Collapse the progress card into the header.

### Phase 2, Re-home secondary guidance
- Move interviewer focus and related coaching content into a full-screen mobile modal.
- Remove permanent secondary panels from the mobile scroll path.

### Phase 3, Simplify setup
- Replace the 4-step mobile wizard with `Quick start` and `Custom session`.
- Preserve deeper filters without forcing everyone through them.

### Phase 4, Polish and validate
- Improve state transitions for recording, saving, and question completion.
- Run focused mobile QA and measure accidental navigation, scroll depth, and response completion rate.

## Acceptance Criteria

The redesign is ready when all of the following are true:

1. On a 390px-wide phone, the user can see the prompt start, response controls, and primary CTA without hunting.
2. The user can complete one question cycle without opening drawers or scrolling to find the save action.
3. Recording either starts cleanly or fails with a specific, actionable message.
4. Accidental skip/favorite behavior caused by scroll gestures is eliminated.
5. The coaching content is still accessible, but it no longer lengthens the default page or depends on swipe-up discovery.
6. The screen has one clear visual priority: answering the current question.

## QA Matrix

### Devices
- iPhone SE
- iPhone 14 Pro
- Pixel 7
- A mid-range Android device with a smaller viewport

### Scenarios
- Start practice from setup
- Read a long question without triggering a lateral action
- Start recording with fresh permissions
- Deny mic permissions and recover gracefully
- Type notes, background the tab, return, confirm local persistence
- Favorite and skip using explicit controls
- Open and close the coaching modal without losing current answer state
- Save the final question and reach completion cleanly

### Metrics to watch
- Scroll depth per question
- Mic-start success rate
- Save completion rate
- Abandonment before first answer
- Use of coaching modal
- Accidental navigation reports

## Non-Goals

This plan does not include:
- live AI interview
- audio upload or transcription
- a full desktop redesign
- a new design system across the whole app

## Source of Truth

For mobile practice execution, this document is the source of truth.

Supporting context still lives in:
- `docs/UI_UX_ENHANCEMENT_PLAN.md`
- `docs/TESTING.md`
- `README.md`
- `CLAUDE.md`
