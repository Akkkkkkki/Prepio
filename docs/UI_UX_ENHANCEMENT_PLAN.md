# UI/UX Enhancement Plan

**Date:** March 29, 2026  
**Prepared by:** AI Assistant  
**Scope:** All UI/UX feedback to-date for the Prepio interview preparation tool.

> For the active mobile practice redesign, use [`docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./MOBILE_PRACTICE_UX_EXECUTION_PLAN.md) as the source of truth. This document remains the broader UX backlog.

## Latest Gap Review — March 29, 2026

| # | Theme | Gap & Evidence | Impact | Fast Fix |
| --- | --- | --- | --- | --- |
| 1 | Guest onboarding | The home screen now shows an inline sign-in warning and swaps the primary CTA to “Sign In to Start Research”, but guests can still type into the full form and the logged-out shell is still sparse. | The failure is earlier and clearer than before, but the public-first experience still feels half-finished. | Gate the form behind a lighter guest CTA card, add a small public nav, and preserve intent when redirecting to auth. |
| 2 | File upload messaging | Home and Profile now disable PDF upload with explicit “Coming Soon” copy, which is much more honest, but there is still no resumable file flow. | Trust is better because the UI no longer lies, but the product still needs a real file pipeline. | Keep the buttons disabled until upload ships, and document pasted CV text as the supported path. |
| 3 | Auth flow clarity | Auth now keeps sign-in and sign-up state separate and shows a redirect banner like “Sign in to continue to Practice”, but recovery affordances are still missing. | Tab switching no longer leaks passwords across forms, though users still lack obvious recovery links. | Add `Forgot password` and `Resend verification`, and keep route-context copy visible. |
| 4 | Research history affordances | History is now exposed from authenticated navigation and the selector label now reads “Active Research”, but helper copy is still thin. | Returning users can reopen past runs without dead-end TODO buttons. | Add helper text and empty-state explanation around the selector so users understand what it controls. |
| 5 | Dashboard credibility | “Interview Process Overview” cards display hard-coded placeholders instead of deriving values from `searchData` (`src/pages/Dashboard.tsx`, lines 349-378). | Static “3–4 weeks / Technical + Behavioral” blurs the line between actual intelligence and filler, reducing perceived value. | Show only metrics returned from Supabase (stage count, detected regions, etc.) and hide tiles without real data. |
| 6 | Profile data management | Profile no longer pretends to delete stored data. The action is now framed as “Clear Editor”, but server-backed CV deletion still does not exist. | Privacy expectations are clearer, but true data deletion remains a missing capability. | Ship a real delete endpoint or continue to keep the copy explicitly local-only. |

---

## Inputs & Approach

Themes were clustered, conflicting recommendations were resolved using standard product heuristics (Nielsen-Molich, WCAG 2.1 AA, and common SaaS onboarding patterns), and resulting actions were sized with the “small team, limited audience” constraint in mind.

---

## Experience Themes & Recommended Actions

### 1. Access, Onboarding & Communication
- **Prepio landing still needs a true guest mode:** the page now explains sign-in earlier and uses a sign-in CTA for logged-out users, but the full form remains visible to guests.  
  _Action:_ Replace the full guest form with a compact CTA + sample-output preview once we are ready to polish the public landing experience.
- **Navigation disappears for logged-out visitors:** Users lose the ability to reach docs/support once redirected to `/auth`.  
  _Action:_ Always render a lightweight navigation bar (logo + Docs + Support + Sign in) regardless of auth state.
- **Deep-link redirects were opaque, now partially fixed:** visiting `/dashboard`, `/practice`, or `/profile` now surfaces a banner on `/auth`, but the public shell still feels abrupt.  
  _Action:_ Keep the redirect-aware banner and add a lightweight logged-out nav so the auth page feels less dead-ended.
- **Onboarding void:** No first-time guidance, presets, or empty-state education.  
  _Action:_ Add a three-step “How it works” strip on the home page and contextual empty states that describe the next action.

### 2. Copy, Typography & Form Inputs
- **Global glyph bug:** The letter “s/S” fails to render, making every string look corrupted.  
  _Action:_ Revert to the default font stack (Tailwind `font-sans`) until the custom font subset is fixed; regression-test Prepio auth copy.
- **Form bloat and unclear optionality:** Long research form overwhelms users and hides validation.  
  _Action:_ Split into “Required info” and “Advanced options” accordions, add inline validation + character counters, and highlight optional fields.
- **CV upload UX gaps:** The product now disables upload buttons and says “Coming Soon,” which is the right honesty bar until processing exists.  
  _Action:_ Keep the disabled state and make pasted CV text the default documented flow everywhere.
- **Auth recovery still shallow:** Separate tab state is now fixed, but the screen still needs recovery links and a clearer path back to the product.  
  _Action:_ Add “Forgot password”, “Resend verification”, and “Back to product” links.

### 3. Navigation & Information Architecture
- **Search selector purpose still needs polish:** It is now labeled “Active Research”, which is clearer, but it still lacks helper text and stronger empty-state guidance.  
  _Action:_ Add tooltip/helper copy and an inline empty state (“Run your first research to see it here”).
- **History access was inconsistent, now materially better:** Dashboard no longer points to a dead TODO path and navigation exposes history across the authenticated app.  
  _Action:_ Keep the shared history entry point and improve copy around what users should expect there.
- **Dashboard density:** Stage cards mix durations, guidance, and questions without hierarchy.  
  _Action:_ Collapse secondary details behind accordions and keep primary metrics (stage name, status, recommended action) visible.

### 4. Practice Experience

> Mobile practice now has a dedicated execution plan in [`docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./MOBILE_PRACTICE_UX_EXECUTION_PLAN.md). The items below are backlog context unless that document says otherwise.

> **Status update (Dec 6, 2025):** Desktop practice now uses a two-column layout with a fixed insights rail, compact progress ribbon, and a single sticky CTA footer. The helper drawer was rewritten to focus on “Voice preview” + “Quick notes” with tooltip guidance, and a new Question Insights panel surfaces depth labels, interviewer signals, red flags, and outline guidance sourced from the refreshed question-generation pipeline.
- **Swipe gestures conflict with scrolling & hints clash with content:** Users trigger actions accidentally and hints overlap.  
  _Action:_ Increase swipe threshold, ignore swipes when vertical scroll > certain delta, and move hints into a dismissible banner shown on the first card only.
- **Bottom navigation overlays question cards on mobile:** Sticky bar hides input fields.  
  _Action:_ Add `pb-24` to the scroll container, make the nav non-sticky below `md`, and enlarge question dots to ≥ 12px touch targets.
- **Setup wizard overwhelm:** Filters, stages, and difficulties all appear simultaneously.  
  _Action:_ Convert to a stepper (Goal → Stages → Filters → Review) with presets (“Quick practice”, “Deep dive”) and remembered defaults. _(Shipped Nov 23, 2025)_
- **Voice recording + guidance honesty:** UI implies saving audio and always exposes detailed rationale.  
  _Action:_ Label recording as “Local preview only” until upload works and collapse rationale/company context behind a “Show details” toggle. _(Shipped Nov 23, 2025)_

#### 4.1 Current State & Pain Points Recap
- **What already shipped:** Stepper-style setup presets, swipe guards, safe-area padding, nav dots, compact hint strip, and “local preview” messaging went live on Nov 23 and are stable.
- **Remaining friction:** Users still mis-trigger swipes when scrolling long prompts, the sticky bottom nav obscures answer fields on smaller devices, hints feel noisy after the first question, and guidance around saving notes/voice is unclear.
- **Impact radius:** High-volume practice users lose confidence when accidental navigation wipes answers; first-time users disengage because onboarding + gestures lack clear instructions.
- **Ops considerations:** QA reported regressions whenever gesture thresholds changed; engineering flagged the practice stack as brittle because layout tweaks are scattered across cards, sheets, and the nav bar.

#### 4.2 Experience Principles & Flow
1. **Gesture safety first:** Any horizontal action should require intentional movement and respect vertical scroll context.  
2. **Progressive disclosure:** Show only the inputs and helpers needed for the current step; advanced controls stay tucked behind accordions.  
3. **Responsive guardrails:** All controls remain reachable inside device safe areas with ≥44px touch targets and consistent padding.  
4. **Honest guidance:** Voice and hint copy must reflect actual capabilities (“Preview only”, “Hints improve with more context”).  
5. **Single source of layout truth:** Shared primitives (QuestionFrame, BottomPracticeNav, HintBanner) own spacing so downstream screens stay maintainable.

**Refreshed flow:**  
`Setup presets → Context confirmation → Question cards w/ hint banner → Voice / notes helpers → Wrap-up summary + next steps`. Each phase communicates success/error states inline (no modal detours) and reuses the same progress pill + CTA stack.

#### 4.3 Component-Level Enhancements
- **Swipe + scroll logic:** Raise the horizontal swipe threshold from 35px to ~60px and cancel swipes when vertical delta > 12px inside the same gesture. Provide a subtle “Swipe to jump ahead” affordance that disappears after the first successful swipe to reduce noise.
- **Hint banner behavior:** Replace inline hint overlays with a dismissible banner anchored at the top of the first card. Persist dismissal for the current session via local state or sessionStorage so returning users aren’t re-prompted mid-run.
- **Question layout:** Encapsulate question content inside `QuestionFrame` with built-in `pb-24 md:pb-32` so the sticky nav never overlaps fields. Move dot navigation into `BottomPracticeNav`, enlarge dots to 12px with `focus-visible:ring`, and expose stage labels on hover/long-press for accessibility.
- **Helper stack:** Consolidate voice recorder, note-taking, and reference material into a collapsible helper drawer beneath each card. The drawer defaults open on the first card only, reminding users that recordings are local previews and notes auto-save every 5s.
- **Insights rail:** Add a dedicated `QuestionInsightsPanel` in the right-hand column (or below helpers on mobile) that highlights depth labels, “great answers include” bullets, red flags, seniority expectations, and a sample outline pulled from the revamped question-generation prompt.
- **Session wrap-up:** After the final question, show a summary card with ✔ Saved answers status, recommended next actions (“Retry stage 2”, “Share with mentor”), and a CTA to jump straight into research or dashboard review, keeping users inside the ecosystem.

#### 4.4 Developer Implementation Notes
- **Component reuse:** Build `QuestionFrame`, `BottomPracticeNav`, and `HintBanner` as standalone components under `components/practice/` with Storybook examples; import Tailwind presets via utility classes instead of bespoke CSS.
- **Rubric data plumbing:** Extend `interview_questions` with `depth_label`, `good_answer_signals`, `weak_answer_signals`, `seniority_expectation`, and `sample_answer_outline`, and update the OpenAI prompt to always return those fields so the insights panel stays populated even when rationale text is short.
- **Configuration & feature flags:** Gate the new helper drawer and swipe thresholds behind a `practice_v2` flag so rollout can be staged without branching the entire page.
- **Testing matrix:** Snapshot + interaction tests covering iPhone SE, iPhone 14 Pro, Pixel 7, and desktop breakpoints. Unit-test swipe util to ensure vertical delta short-circuits horizontal actions.
- **Telemetry hooks:** Fire analytics events (`practice_hint_dismissed`, `practice_swipe_blocked`, `practice_helper_toggle`) to validate that UX changes reduce accidental swipes and repeated hint dismissals.
- **Documentation & handoff:** Update this doc plus `docs/TESTING.md` with the new matrix once the implementation lands; link component props in Storybook to keep design + dev in sync.

### 5. Accessibility & Responsiveness
- **Keyboard, ARIA, and contrast gaps:** Icon-only buttons lack labels, focus states are subtle, and muted text may fail WCAG.  
  _Action:_ Add `aria-label`s, increase focus ring contrast, and audit `text-muted-foreground` against WCAG 2.1 AA (4.5:1).  
- **Touch target sizing & safe areas:** Multiple controls (< 44px) and sticky elements ignore notches.  
  _Action:_ Enforce min 44x44px targets, add `pb-[env(safe-area-inset-bottom)]`, and test on iPhone SE + 14 Pro + Android mid-range.
- **Component overlap:** Navigation (`z-50`) competes with dialogs/sheets; progress dialog lacks scroll lock.  
  _Action:_ Define a z-index scale (`nav=40`, `dialog=80`, `toast=100`) and apply `overflow-hidden` to `<body>` while dialogs are open.

### 6. Feedback & Status Communication
- **Progress dialog & loading states inconsistent:** Some flows show basic spinners; others have no messaging.  
  _Action:_ Create a shared loading pattern (skeletons for content, progress dialog with “What’s happening” log, estimated time) and reuse everywhere.
- **Errors lack recovery paths:** Messages like “Please sign in to continue” appear only after time investment.  
  _Action:_ Pair each error with a clear CTA (“Sign in”), describe remediation steps, and log for support when retries fail.
- **Saved answers & notes uncertainty:** Users cannot tell when answers or session notes persist or how to edit them.  
  _Action:_ Provide inline success states (“Saved · 2:14 PM”), allow edits until session completion, and autosave notes with debounce.

### 7. Motion & Micro-interactions
- **Unified motion system with accessibility guardrails:** Introduce three motion tokens (`fast 120ms`, `base 180ms`, `slow 240ms`) plus easing presets (`ease-out` for entrances, `ease-in-out` for navigation). Wrap animations in `motion-safe` and honor `prefers-reduced-motion`; add a toggle that falls back to opacity-only changes.  
  _Action:_ Centralize tokens in `styles/motion.css` or `lib/motion.ts` and expose helpers/HOCs so components stay consistent and maintainable.
- **Route/page transitions feel hard-cut:** Route changes currently swap DOM nodes with no easing.  
  _Action:_ Wrap the router outlet in a shared fade + slight slide transition (`base` timing). Fade out the previous view, keep skeletons visible during fetch, and fade in the next view. Move focus to the page heading after transition and announce via `aria-live`.
- **Primary CTAs lack affordance:** Buttons such as “Start Research”, “Start Practice”, and “Save Answer” stay flat on hover/tap.  
  _Action:_ Add a 120–200 ms scale + shadow lift (`hover:scale-103`, `active:scale-97`) with a strong focus ring. For reduced motion, fall back to color/outline only.
- **Loading states pop in abruptly:** Cards appear fully rendered once data arrives, which breaks perceived performance.  
  _Action:_ Standardize a shimmer skeleton component for dashboard cards, practice questions, and profile panels with consistent heights to avoid layout shift. Apply a brief opacity-in when replacing skeletons with live content.
- **Dialogs and overlays feel disconnected:** The progress dialog and sheets simply appear/disappear.  
  _Action:_ Animate `scale-95 → scale-100` with backdrop fade on open/close (`base` timing), enforce scroll lock on the body, and align with the z-index scale (nav 40, dialog 80+).
- **Practice experience polish:** Question frames, helper drawers, nav dots, and hint banners animate inconsistently and sometimes conflict with gestures.  
  _Action:_ Give `QuestionFrame` built-in bottom padding and optional first-load fade (disabled during swipes), animate `BottomPracticeNav` dots with slide/scale, let `HintBanner` fade/slide in once then collapse height on dismiss, and animate `PracticeHelperDrawer` height/opacity with a reduced-motion fallback. Persist helper/hint dismissal per session.
- **Implementation cadence (low overhead):**  
  _Action:_ Week 1: add motion tokens/utilities, retrofit buttons/dialogs, skeleton component, and router transition. Week 2: apply practice-specific tweaks, reduced-motion guards, and focus management; add Storybook/interaction tests for motion presets and ARIA paths.  
  _Guardrails:_ Prefer transform/opacity over layout-changing properties, cap entrance animations to first render, avoid loops, and ensure every animated element retains keyboard/focus clarity.

---

## Component & Overlay Watchlist
- **Navigation vs. Dialog/Sheet:** Reduce nav z-index to 40 and bump modal overlays to at least 80 to avoid content peeking through.  
- **Practice swipe overlay:** Keep `pointer-events-none` but ensure overlay never exceeds card bounds on small screens.  
- **Progress dialog vs. header:** Increase dialog z-index to 90 and add backdrop blur plus scroll lock.  
- **Dashboard “Start Practice” CTA positioning:** Switch to flow layout on screens < 1024px to prevent clipping.  
- **Voice recording row:** Stack controls vertically below `md` to avoid collisions with note editor.

---

## Prioritized Backlog

| Priority | Theme | Key Fixes | Effort | Owner |
| --- | --- | --- | --- | --- |
| **P0** (Critical) | Rendering & Access | Fix missing glyph bug, gate Prepio form behind auth-aware CTA, always show navigation, add redirect context | 2-3 dev days | Frontend |
| **P0** (Critical) | Practice usability | Add content padding under sticky nav, raise swipe threshold, enlarge question dots, clarify swipe hints | 2 dev days | Frontend |
| **P1** (High) | Forms & Uploads | Progressive disclosure for research form, disable “Upload PDF” until ready, add validation feedback | 3 dev days | Frontend |
| **P1** (High) | History & IA | Ship cross-page history sheet, rename search selector, improve dashboard empty state | 3-4 dev days | Frontend |
| **P1** (High) | Accessibility | Define z-index scale, add ARIA labels and focus styles, enforce touch target sizing | 2 dev days | Frontend |
| **P2** (Medium) | Practice setup & guidance (✅ shipped Nov 23) | Introduce presets/stepper, clarify voice recording limitations, collapse rationale details | 1 week | Frontend + Design |
| **P2** (Medium) | Feedback consistency | Shared loading/success patterns, error recovery CTAs, autosave session notes | 1 week | Frontend |
| **P3** (Low) | Visual polish | Standardize spacing, button sizes, progress components, and status badges | Ongoing | Design System |

_Effort assumes two engineers sharing work without over-engineering; backlog can be sequenced sprint-by-sprint._

---

## Quick Wins (≤ 1 week)
- Re-enable default font stack and smoke-test Prepio auth screens.
- Render navigation for all users with Sign In / Docs / Support links.
- Gate Prepio form with inline auth prompt and add sample data card.
- Disable CV upload buttons with “Coming Soon” badge + privacy copy.
- Increase practice question nav dots to 12px and add bottom padding.
- Introduce redirect-aware banner on `/auth` (“Sign in to resume Practice”).

---

## Validation & Follow-Up
1. **UI verification:** Mobile Safari (iPhone SE + 14 Pro), Android Chrome, Desktop Chrome/Safari/Edge.  
2. **Accessibility:** Run axe DevTools + manual keyboard walkthrough for home, auth, dashboard, and practice.  
3. **Analytics hooks:** Track Prepio CTA clicks when unauthenticated to confirm gating reduces dead-end attempts.  
4. **User testing:** 3 returning users (practice heavy) + 2 new users (landing → auth → dashboard) to confirm improvements reduce confusion.  
5. **Documentation:** Update `docs/UI_UX_REVIEW*.md` summaries once remediation ships instead of generating new stand-alone reports.

---

Delivering on the P0/P1 items will unblock new users, restore trust in the marketing surface, and stabilize the practice workflow without over-building. Remaining items can be folded into routine polish cycles as the team’s capacity allows.
