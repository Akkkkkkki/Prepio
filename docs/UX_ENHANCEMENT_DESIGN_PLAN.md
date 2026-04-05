# Prepio UX Enhancement Design Plan

**Date:** April 5, 2026
**Scope:** Full product user journey audit and enhancement design for professional job seekers in tech, consulting, and finance
**Methodology:** Page-by-page code audit, cross-referenced against Apple HIG, Material Design 3, SaaS onboarding research, and job-seeker UX studies
**Supersedes:** `docs/UI_UX_ENHANCEMENT_PLAN.md` (March 29, 2026) — that document contains several stale entries; this plan reflects current shipped state

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Profile and Journey Map](#2-user-profile-and-journey-map)
3. [Design Principles for Prepio](#3-design-principles-for-prepio)
4. [Page-by-Page Audit](#4-page-by-page-audit)
   - 4.1 [Home (Research Entry)](#41-home-research-entry)
   - 4.2 [Auth (Sign In / Sign Up)](#42-auth-sign-in--sign-up)
   - 4.3 [Dashboard (Research Results)](#43-dashboard-research-results)
   - 4.4 [Practice (Question Sessions)](#44-practice-question-sessions)
   - 4.5 [History (Session Review)](#45-history-session-review)
   - 4.6 [Profile (Resume & Settings)](#46-profile-resume--settings)
5. [Cross-Cutting Issues](#5-cross-cutting-issues)
6. [Enhancement Roadmap](#6-enhancement-roadmap)
7. [Design Specifications](#7-design-specifications)

---

## 1. Executive Summary

Prepio's core value proposition — generating tailored interview questions from company research — is strong and differentiated. The research pipeline, structured question output, and practice flow form a coherent product loop. However, the current user experience has friction across every stage of the journey that prevents the product from reaching its potential.

**The fundamental problem:** Prepio asks too much before it delivers value, and then under-celebrates when it does. A professional job seeker evaluating interview prep tools will form an opinion within 60 seconds. Currently, Prepio's first 60 seconds present a form — not a reason to trust the product.

### Key findings

| Area | Current State | Target State |
|------|--------------|--------------|
| **Time to value** | User must sign up + fill form + wait for research before seeing any output | User sees example output on landing; first research completes with engaging progress |
| **Emotional tone** | Functional and neutral; no motivational design | Encouraging, judgment-free, progress-oriented |
| **Mobile experience** | Mobile practice redesigned (good); other pages responsive but not mobile-native | All pages optimized for thumb-zone, single-task-per-screen mobile patterns |
| **Information density** | Dashboard and Profile overwhelm with flat hierarchy | Progressive disclosure with clear primary/secondary layers |
| **Loading perception** | Mix of spinners, skeletons, and raw "Loading..." text | Consistent skeleton screens and stage-based progress throughout |
| **Navigation clarity** | Five top-level items (good); active research selector confusing for new users | Same five items with better labeling, breadcrumbs on detail views, progress pipeline |
| **Trust and credibility** | No social proof, no data transparency, footer terms link is a placeholder | Specific trust signals near CTAs, transparent AI methodology, real legal links |

---

## 2. User Profile and Journey Map

### Primary persona: The professional candidate

- **Industries:** Tech (SWE, PM, data), consulting (strategy, management), finance (IB, PE, corporate finance)
- **Context:** Actively preparing for interviews at specific companies; may be juggling multiple processes
- **Emotional state:** Anxious, time-pressured, seeking structure and confidence
- **Device split:** 89% of job seekers use mobile for job search activities; laptop for deep practice sessions
- **What they need:** Tailored, company-specific preparation that feels more valuable than generic question banks

### Journey stages and current friction

```
┌─────────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│  1. DISCOVER │───▸│ 2. SETUP │───▸│ 3. WAIT   │───▸│ 4. REVIEW│───▸│ 5. PRACTICE│
│  (Home)      │    │ (Home)   │    │ (Home)    │    │(Dashboard│    │(Practice) │
│              │    │          │    │           │    │          │    │           │
│ ⚠ No proof  │    │ ⚠ Form   │    │ ✓ Progress│    │ ⚠ Dense  │    │ ✓ Mobile  │
│ ⚠ No preview│    │   bloat  │    │   dialog  │    │ ⚠ No next│    │   redesign│
│ ⚠ Guest UX  │    │ ⚠ Mobile │    │   works   │    │   steps  │    │ ⚠ Setup   │
│   is half-  │    │   wizard │    │           │    │          │    │   complex │
│   finished  │    │   labels │    │           │    │          │    │           │
└─────────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
                                                                         │
                                                          ┌──────────┐   │
                                                          │ 6. REVIEW│◂──┘
                                                          │(History) │
                                                          │          │
                                                          │ ⚠ Dual   │
                                                          │   stats  │
                                                          │ ⚠ Thin   │
                                                          │   empty  │
                                                          │   states │
                                                          └──────────┘
```

---

## 3. Design Principles for Prepio

Derived from Apple HIG, Material Design 3, and the specific needs of professional job seekers.

### P1. Show value before asking for investment
Every screen should answer "why should I care?" before asking "what do you want?" This is the single most impactful principle for Prepio — job seekers are evaluating tools quickly and will abandon anything that doesn't prove relevance fast.

### P2. One screen, one job
Each view should have one clear primary action. Secondary actions exist but are visually subordinate. On mobile, this is non-negotiable.

### P3. Progressive disclosure over information dump
Lead with essentials; let users pull detail on demand. This applies to the research form, dashboard stage cards, practice setup, and profile editing.

### P4. Encourage, don't evaluate
Job seekers are already anxious. Prepio's tone should frame practice as growth ("Build confidence") not testing ("Test yourself"). Copy, animations, and feedback should reduce anxiety.

### P5. Consistent feedback for every action
Every interaction gets visible acknowledgment within 100ms. Long operations show stage-by-stage progress. Success at milestones gets micro-celebrations.

### P6. Professional credibility in every pixel
For candidates targeting top-tier companies, the tool itself signals preparation quality. Inconsistent spacing, broken states, or placeholder copy undermines trust. The design should feel as polished as the companies users are interviewing at.

---

## 4. Page-by-Page Audit

### 4.1 Home (Research Entry)

The Home page serves dual duty: marketing landing page for guests and research entry form for signed-in users. Currently, neither role is executed well.

#### Current state

**Guest experience:**
- Full research form is visible but non-functional — guests can type into fields, only to be redirected to auth
- A "sample stages" card on the side provides some preview, but it's static and generic
- "How it works" steps exist but are buried below the fold
- No social proof, testimonials, or credibility signals
- No preview of actual generated output quality

**Signed-in desktop:**
- Single card with company (required), optional role/country/seniority, CV upload + paste, job links
- Submit creates research and opens `ProgressDialog` — this is well-executed with stage indicators, time estimates, and stall detection
- Form has no progressive disclosure — all fields visible simultaneously

**Signed-in mobile:**
- 3-step wizard (company → details → tailoring) with step indicator and fixed bottom bar
- **Issue:** Step labels in the progress indicator use raw keys (`company`, `details`, `tailoring`) instead of human-readable labels
- **Issue:** The mobile wizard is the right pattern but arrives at the wrong moment — new users get the wizard before understanding what Prepio does

#### Issues mapped to design principles

| Issue | Principle Violated | Severity |
|-------|-------------------|----------|
| No output preview for guests | P1 (Show value first) | **Critical** |
| Form shows all fields at once (desktop) | P3 (Progressive disclosure) | High |
| No social proof or trust signals | P6 (Professional credibility) | High |
| Mobile step labels are raw keys | P6 (Professional credibility) | Medium |
| Guest can fill form but can't submit | P1 (Show value first) | High |
| "How it works" buried below fold | P1 (Show value first) | Medium |
| Suggested company chips have no explanation | P3 (Progressive disclosure) | Low |
| No personalization question (industry/goal) | P1 (Show value first) | Medium |

#### Enhancement design

**E1.1 — Value-first landing page (guest)**

Replace the current guest experience with a structured landing flow:

1. **Hero section:** Headline emphasizing company-specific preparation + a single compelling example output. Show 3-4 real-looking question cards from a well-known company (e.g., "Here's what Prepio generates for a PM role at Google"). This is the "show, don't tell" principle — let the output quality sell the product.

2. **How it works:** Three-step visual (Research → Review → Practice) moved above the fold, using icons and minimal copy. This sets the mental model before asking for input.

3. **Social proof strip:** Specific usage metrics positioned near the CTA. Even early-stage products can use authenticity: "Built by interview coaches" or "Questions modeled on real interview reports from [industries]."

4. **Simplified entry:** A single compact input ("Which company are you preparing for?") that leads into auth. This is the minimum viable interaction — one field, one action, maximum psychological commitment before asking for sign-up.

5. **Footer:** Real terms and privacy policy links (currently placeholder "terms and privacy policy" text with no links).

**E1.2 — Progressive disclosure form (signed-in desktop)**

Restructure the signed-in form into two tiers:

- **Tier 1 (always visible):** Company name (required), job title/role (optional but encouraged)
- **Tier 2 (expandable "Customize your research"):** Country, seniority, CV upload, job posting links

This matches the progressive disclosure variant "conditional disclosure" — advanced options appear when the user actively wants them. The "Start Research" CTA should be actionable from Tier 1 alone.

**E1.3 — Mobile wizard label fix**

Replace raw step keys with human labels:

| Current | Proposed |
|---------|----------|
| `company` | Company |
| `details` | Role Details |
| `tailoring` | Personalize |

**E1.4 — Research draft persistence improvement**

Currently, `researchDraft.ts` persists drafts to `localStorage`, which is good. Enhance by:
- Showing a subtle "Draft saved" indicator when fields are auto-saved
- On return, display a "Continue where you left off" prompt instead of silently restoring

---

### 4.2 Auth (Sign In / Sign Up)

The auth page is functional but misses opportunities to maintain momentum and trust.

#### Current state

- Tabbed sign-in / sign-up with separate field state (good — prevents password leaks between tabs)
- Redirect banner shows context ("Sign in to continue to Practice") when user was bounced from a protected route
- Recovery flows: forgot password, resend verification, set new password — all present and working
- Centered card layout with `PublicHeader` (back to home)

#### Issues

| Issue | Principle Violated | Severity |
|-------|-------------------|----------|
| Footer says "terms and privacy policy" with no actual links | P6 (Professional credibility) | High |
| No social proof or value reminder on auth page | P1 (Show value first) | Medium |
| Sign-up requires no context about what happens next | P4 (Encourage) | Medium |
| No visual brand continuity with the landing experience | P6 (Professional credibility) | Low |
| Offline blocks all auth with no queued retry | P5 (Consistent feedback) | Low |

#### Enhancement design

**E2.1 — Auth page with value context**

Add a sidebar (desktop) or header section (mobile) showing:
- Brief value statement: "Company-specific interview prep, tailored to your role"
- One example question card from generated output
- User count or trust signal if available

This maintains momentum — the user remembers why they're signing up.

**E2.2 — Functional legal links**

Replace the placeholder "terms and privacy policy" text with actual links. For an early-stage product, even a simple privacy policy page builds trust. For professional candidates in finance and consulting, data handling transparency is table stakes.

**E2.3 — Post-signup orientation**

After first sign-up, instead of dropping the user at the home form:
- Show a brief (2-3 screen) onboarding: "What industry are you preparing for?" → "Upload your resume or skip for now" → "Let's research your first company"
- This sets context and personalizes the downstream experience

---

### 4.3 Dashboard (Research Results)

The dashboard is where Prepio delivers on its promise — generated stages and questions from company research. It needs to feel like a discovery moment, not a data dump.

#### Current state

**Loading/polling:** When research is in progress, shows a centered card with a progress bar and status copy. Progress increments are simulated locally (not from real server progress). Polls every 3 seconds.

**Completed research — desktop:** Header row with "Start Practice" CTA, "Research overview" metrics card (stage count, question count), "Preparation Roadmap" with checkboxes and 3-column detail per stage.

**Completed research — mobile:** Header, 2-up metric cards, list of `MobileStageCard` components, fixed bottom summary + CTA with safe-area padding.

**Empty state:** Card with CTA to home; mentions history in copy.

**Error state:** Card with retry + new search; offline note.

#### Issues

| Issue | Principle Violated | Severity |
|-------|-------------------|----------|
| No celebration or framing when research completes | P4 (Encourage) | High |
| All stages displayed with equal visual weight | P3 (Progressive disclosure) | High |
| `enhancedQuestions` read from results but never populated (dead code path) | P6 (Professional credibility) | Medium |
| `/search/:id` and `/dashboard?searchId=` both resolve to same view (URL confusion) | P2 (One screen, one job) | Low |
| `#main-content` landmark missing on several branches (mobile, in-progress, error) | Accessibility | Medium |
| Desktop checkboxes for stage selection lack clear purpose until user knows about Practice | P3 (Progressive disclosure) | Medium |
| Simulated progress bar increments can feel dishonest if research stalls | P5 (Consistent feedback) | Medium |
| No breadcrumb or context for which company/role this research is about (other than header) | P2 (One screen, one job) | Medium |
| Metrics card shows counts but no actionable context ("12 questions" — so what?) | P1 (Show value first) | Medium |

#### Enhancement design

**E3.1 — Research completion moment**

When research transitions from "processing" to "completed," introduce a brief celebration state:
- Fade-in animation for the results
- Summary headline: "Your preparation plan for [Company] is ready"
- Key stat callout: "We generated [N] questions across [N] categories tailored to [Role]"
- Primary CTA: "Start Practicing" with encouraging copy: "You're already ahead of most candidates"

This transforms a data-loading event into an achievement moment, leveraging the goal-gradient effect.

**E3.2 — Stage cards with progressive disclosure**

Restructure stage cards to show:
- **Default visible:** Stage name, question count, a one-line description, and the "Include in practice" toggle
- **Expandable:** Full stage content (guidance, question previews, detailed breakdown)

Currently, desktop stage cards show everything at once in a 3-column layout. This overwhelms users who just want to scan what was generated. The accordion pattern already exists on mobile `MobileStageCard` — bring consistent progressive disclosure to desktop.

**E3.3 — Action-oriented metrics**

Replace raw counts with contextual metrics:

| Current | Proposed |
|---------|----------|
| "5 stages" | "5 interview stages identified" |
| "23 questions" | "23 tailored questions ready to practice" |
| (none) | "Estimated preparation: 2-3 practice sessions" |

Every metric should suggest a next action or provide interpretation.

**E3.4 — Research context bar**

Add a persistent context strip at the top of the dashboard:
- Company name + role + when research was run
- Breadcrumb: "Home > [Company] Research"
- Link to re-run or start new research

This ensures users always know which research they're viewing, especially when navigating from history or deep links.

**E3.5 — Clean up dead data path**

Remove the `enhancedQuestions` state and related code from `Dashboard.tsx` since `getSearchResults` never populates this field. Dead code paths erode developer confidence and can cause confusing behavior.

---

### 4.4 Practice (Question Sessions)

Practice is Prepio's highest-engagement surface. The mobile redesign (documented in `MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`) addressed the most critical mobile issues. This audit focuses on remaining friction points.

#### Current state

**Setup flow:**
- Desktop: 4-step card (goal/sample size → stages → filters → review) with presets (Quick / Deep)
- Mobile: Simplified quick vs custom setup with sticky mini-header

**Active practice:**
- Question carousel with timer, notes, local voice preview, swipe navigation (mobile), keyboard shortcuts (desktop)
- Autosave to `sessionStorage`, question flags (favorite / needs_work / skipped) via API
- `CompletionCheckmark` flash on save
- `BreathingBreak` optional interstitial (skippable, persisted to `localStorage`)

**Completion:** `SessionSummary` with stats grid, optional notes, CTAs to history/new session/dashboard

#### Issues

| Issue | Principle Violated | Severity |
|-------|-------------------|----------|
| Setup wizard (desktop) shows 4 steps for what could be 2 | P3 (Progressive disclosure) | Medium |
| `shuffle` uses `sort(() => Math.random() - 0.5)` — biased randomization | P6 (Professional credibility) | Medium |
| Keyboard shortcuts (←, →, s) have no discoverability | P3 (Progressive disclosure) | Medium |
| `playRecording` creates `Audio(URL.createObjectURL(blob))` without revoking — memory leak | Technical debt | Low |
| Session summary is functional but not celebratory | P4 (Encourage) | High |
| No suggested "what to practice next" based on performance | P1 (Show value first) | Medium |
| Voice recording labeled "local preview only" but framing is still confusing | P5 (Consistent feedback) | Medium |
| Practice timer lacks context — does ticking up help or stress? | P4 (Encourage) | Medium |
| No concept of "readiness" or preparation coverage across sessions | P1 (Show value first) | High |

#### Enhancement design

**E4.1 — Simplified setup with smart defaults**

Reduce desktop setup to 2 steps:
1. **Choose mode:** Quick (preset questions), Custom (choose stages/filters/count)
2. **Review & start:** Summary of selection with "Start Practice" CTA

Custom mode can expand into the current 4-step flow for users who want fine control. This matches the "staged disclosure" progressive disclosure variant — simple path for most users, detailed path for power users.

**E4.2 — Fix biased shuffle**

Replace `sort(() => Math.random() - 0.5)` with a Fisher-Yates shuffle:

```typescript
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

This is a correctness issue, not just polish. Biased shuffles create predictable question ordering that degrades practice quality.

**E4.3 — Keyboard shortcut discoverability**

Add a small, dismissible "Keyboard shortcuts" indicator on first desktop practice session:
- Show on the first question of the first-ever session
- Display: "Tip: Use ← → to navigate, S to skip"
- Dismiss after first use or explicit close
- Persist dismissal in `localStorage`

**E4.4 — Celebratory session completion**

Enhance `SessionSummary` with:
- Brief completion animation (expand the existing `CompletionCheckmark` pattern)
- Encouraging headline based on performance: "Solid session — you covered [N] questions" or "Great depth — you spent quality time on each answer"
- Progress toward coverage: "You've now practiced [X]% of questions for [Company]"
- Suggested next action: "Try the [Stage] questions next" or "Review your flagged questions"

**E4.5 — Preparation readiness indicator**

Introduce a lightweight "coverage" concept:
- Track which questions have been practiced across sessions (data already exists in `practice_answers`)
- Show a readiness bar on the dashboard and practice setup: "You've covered 40% of your preparation plan"
- This creates the goal-gradient effect — users are motivated as they approach completion

**E4.6 — Timer UX improvement**

Make the practice timer opt-in rather than always-on:
- Default: Hidden (reduces anxiety)
- Option to enable per-session with a toggle in setup
- When enabled, show elapsed time per question with no alarm or pressure indicators
- Frame as "tracking your pace" not "counting down"

---

### 4.5 History (Session Review)

History provides the review loop that turns one-off practice into structured preparation. Currently functional but under-designed.

#### Current state

- Loads all practice sessions + question flags
- Computes fallback stats locally, then fetches server stats (filtered by `searchId` when set)
- `SearchFilter` drives URL param; `SessionList` renders sessions in accordion
- Skeletons while loading; error card; empty states for no sessions / no sessions for filter

#### Issues

| Issue | Principle Violated | Severity |
|-------|-------------------|----------|
| Dual stats path (fallback vs server) can briefly show different numbers | P5 (Consistent feedback) | Medium |
| Empty state is descriptive but not actionable enough | P4 (Encourage) | Medium |
| No visualization of progress over time | P1 (Show value first) | High |
| Sessions listed chronologically with no performance trend | P3 (Progressive disclosure) | Medium |
| Accordion-based session detail requires many clicks to review | P2 (One screen, one job) | Medium |
| No ability to compare sessions for the same research run | P1 (Show value first) | Low |
| "Refreshing overview totals…" flicker between fallback and server stats | P5 (Consistent feedback) | Medium |

#### Enhancement design

**E5.1 — Progress visualization**

Add a simple visual at the top of History:
- Questions practiced over time (line or bar chart)
- Coverage by topic/stage (horizontal bars)
- Practice frequency (streak-style indicator)

This transforms History from "a list of past sessions" to "evidence of your preparation progress" — a powerful motivational tool for anxious candidates.

**E5.2 — Unified stats loading**

Eliminate the dual stats path by:
- Loading server stats first (they're authoritative)
- Showing skeleton during initial load
- Never showing the fallback "Refreshing overview totals…" state to users

**E5.3 — Richer empty states**

| Scenario | Current | Proposed |
|----------|---------|----------|
| No sessions at all | "You haven't practiced yet" + links | "You have [N] questions ready to practice. Start your first session to build confidence." + prominent CTA |
| No sessions for filter | "No sessions for this research" | "You haven't practiced [Company] questions yet. Your preparation plan has [N] questions ready." + CTA |

**E5.4 — Quick-resume practice**

Add a "Continue practicing" CTA to the History page that:
- For a filtered view: starts a practice session with the filtered research run, selecting un-practiced questions
- For the unfiltered view: suggests the research run with the most un-practiced questions

---

### 4.6 Profile (Resume & Settings)

Profile is the most complex page and the least structured. It handles resume management, professional profile editing, import/merge review, and account settings — all in a single long-scrolling view.

#### Current state

- Loads profile, candidate profile, resume versions, latest import in parallel
- Three summary cards at top (completeness, resume source, downstream badges)
- Two-column XL grid: main editorial fields vs sidebar (resume import, import review, versions, notes, seniority)
- Heavy use of `Accordion` for experiences/projects
- Resume deletion uses `window.confirm` — no custom dialog
- Merge review for imported resumes uses `Select` per suggestion

#### Issues

| Issue | Principle Violated | Severity |
|-------|-------------------|----------|
| Page is extremely long with no in-page navigation | P3 (Progressive disclosure) | High |
| Card title says "Account setting" (singular) — copy bug | P6 (Professional credibility) | Low |
| Resume deletion uses `window.confirm` instead of custom dialog | P5 (Consistent feedback) | Medium |
| No section anchoring or sticky section nav for the long form | P2 (One screen, one job) | High |
| Merge review is complex but presented inline without enough context | P3 (Progressive disclosure) | Medium |
| Experience/project editing is deeply nested (bullets inside accordions) | P3 (Progressive disclosure) | Medium |
| No explanation of why profile completeness matters | P4 (Encourage) | Medium |
| Import alerts at the top can be missed on return visits | P5 (Consistent feedback) | Low |

#### Enhancement design

**E6.1 — Tabbed or sectioned profile**

Replace the single long-scroll page with a tabbed interface or sticky section navigation:

**Option A — Tabs:**
- Resume & Import
- Professional Profile (experiences, projects, skills)
- Account Settings (seniority, preferences)

**Option B — Sticky section nav:**
- Fixed left sidebar (desktop) or top pill bar (mobile) with section links
- Scroll-spy highlighting for current section
- "Jump to" quick nav

Either approach reduces cognitive load by applying the "one screen, one job" principle.

**E6.2 — Profile completeness with motivation**

Enhance the completeness card with:
- Explanation of benefit: "A complete profile helps Prepio tailor questions to your experience"
- Specific missing-item callouts: "Add your work experience to get personalized behavioral questions"
- Progress bar with percentage

This creates a feedback loop — users understand why completing their profile improves their practice quality.

**E6.3 — Custom deletion dialog**

Replace `window.confirm` for resume deletion with a proper dialog component (using the existing `AlertDialog` from shadcn/ui):
- Clear description of consequences: "This will remove your resume and all imported profile data"
- Destructive-styled confirm button
- Easy cancel path

**E6.4 — Fix "Account setting" copy**

Change "Account setting" → "Account Settings" in the card title.

---

## 5. Cross-Cutting Issues

These issues affect multiple pages and should be addressed as system-level improvements.

### 5.1 Dual toast systems

**Finding:** Both Radix/hook toaster (`src/hooks/use-toast.ts`, `src/components/ui/toaster.tsx`) and Sonner (`src/components/ui/sonner.tsx`) are mounted in `App.tsx`. Only the Radix/hook system is used by page components. Sonner imports `useTheme` from `next-themes` but no `ThemeProvider` exists.

**Impact:** Dead code, potential confusion, wasted bundle size.

**Action:** Remove Sonner and its mounting from `App.tsx`. Standardize on the Radix/hook toast system that is already in use.

### 5.2 Inconsistent `#main-content` landmarks

**Finding:** The skip link target `#main-content` is defined on some layout branches but not others. Missing on: History page, several Dashboard branches (mobile, in-progress, error), Practice mobile/setup/completion, NotFound page.

**Impact:** Skip-link navigation is broken on these views for keyboard and screen reader users.

**Action:** Ensure every page wraps its main content region in `<main id="main-content">`. This is a small change per page with disproportionate accessibility impact.

### 5.3 `ProtectedRoute` loading state

**Finding:** `ProtectedRoute` shows the string `"Loading..."` on a centered div while auth state resolves. Every other loading state uses skeletons or spinners.

**Impact:** Jarring visual inconsistency on every protected page load.

**Action:** Replace with the existing `RouteFallback` skeleton component already used by `Suspense`.

### 5.4 Navigation history items are divs, not buttons

**Finding:** In `Navigation.tsx`, the history list renders clickable `div` elements instead of `<button>` or `<Link>`. This breaks keyboard navigation and screen reader semantics.

**Action:** Replace `<div onClick={...}>` with `<button>` elements or React Router `<Link>` components.

### 5.5 Dead `Index.tsx` page

**Finding:** `src/pages/Index.tsx` exists with placeholder "Welcome to Your Blank App" content but is not routed in `App.tsx`.

**Action:** Delete the file. Dead code in the pages directory confuses contributors.

### 5.6 `NotFound` page uses `<a>` instead of router `<Link>`

**Finding:** The 404 page uses a plain `<a href="/">` which causes a full page reload instead of client-side navigation.

**Action:** Replace with `<Link to="/">` from React Router.

### 5.7 Unused `App.css`

**Finding:** `src/App.css` contains Vite starter styles (`#root` max-width, `.logo` hover spin) but is not imported by any file.

**Action:** Delete the file.

### 5.8 Inconsistent color token usage

**Finding:** The design system defines CSS variables `--success`, `--warning`, `--info` in `index.css`, but many components use Tailwind color classes directly (e.g., `text-green-600 bg-green-100` for success states, `text-amber-700` for warnings).

**Impact:** Color inconsistency across the app; harder to maintain theme coherence.

**Action:** Create Tailwind color aliases for `success`, `warning`, `info` that map to the CSS variables (similar to how `primary`, `destructive`, `muted` are already mapped). Then migrate direct color references to semantic tokens.

### 5.9 Card radius inconsistency

**Finding:** Two card dialects coexist: shadcn default `rounded-lg` on standard cards and product-specific `rounded-2xl` / `rounded-3xl` / `rounded-[28px]` on practice/mobile cards.

**Impact:** Visual inconsistency — some cards feel like a design system, others feel bespoke.

**Action:** Define 2-3 explicit card radius tiers in the design system (e.g., `card-sm: rounded-lg`, `card-md: rounded-xl`, `card-lg: rounded-2xl`) and apply consistently. The "soft mobile" aesthetic is good — codify it rather than leaving it ad hoc.

### 5.10 TanStack Query underutilization

**Finding:** Only `useSearchProgress` uses TanStack Query. All other data fetching uses imperative `useEffect` + `useState` patterns, losing benefits of caching, deduplication, background refetch, and stale-while-revalidate.

**Impact:** Navigation between pages triggers redundant fetches. No shared cache means the same search history is re-fetched when moving between Dashboard, Practice, and Navigation.

**Action:** Migrate core data fetching to TanStack Query hooks:
- `useSearchResults(searchId)` — used by Dashboard and Practice
- `useSearchHistory()` — used by Navigation and History
- `usePracticeSessions(searchId?)` — used by History
- `useCandidateProfile()` — used by Profile and Home

This is a medium-effort refactor with high impact on perceived performance (instant page transitions for previously-loaded data).

---

## 6. Enhancement Roadmap

### Tier 1 — Quick wins (high impact, low effort)

These can be implemented independently and each improves the product noticeably.

| ID | Enhancement | Pages Affected | Effort |
|----|-------------|----------------|--------|
| E1.3 | Fix mobile wizard step labels | Home | Trivial |
| E6.4 | Fix "Account setting" copy | Profile | Trivial |
| 5.5 | Delete dead `Index.tsx` | Global | Trivial |
| 5.7 | Delete unused `App.css` | Global | Trivial |
| 5.6 | Fix NotFound `<a>` → `<Link>` | NotFound | Trivial |
| 5.3 | Replace `ProtectedRoute` "Loading..." with skeleton | Global | Small |
| 5.4 | Fix nav history items to use `<button>` | Navigation | Small |
| E4.2 | Fix biased shuffle algorithm | Practice | Small |
| E6.3 | Replace `window.confirm` with AlertDialog for resume deletion | Profile | Small |
| 5.2 | Add `#main-content` to all page branches | All pages | Small |
| E3.5 | Remove dead `enhancedQuestions` code path | Dashboard | Small |

### Tier 2 — Core experience improvements (high impact, moderate effort)

These address the most significant UX gaps identified in the audit.

| ID | Enhancement | Pages Affected | Effort |
|----|-------------|----------------|--------|
| E1.1 | Value-first landing page (guest) | Home | Moderate |
| E1.2 | Progressive disclosure form (signed-in) | Home | Moderate |
| E3.1 | Research completion celebration | Dashboard | Moderate |
| E3.2 | Stage cards with progressive disclosure (desktop) | Dashboard | Moderate |
| E4.4 | Celebratory session completion | Practice | Moderate |
| E5.3 | Richer empty states across History | History | Small-moderate |
| 5.1 | Remove Sonner; standardize on Radix toasts | Global | Small |
| 5.8 | Semantic color tokens for success/warning/info | Global | Moderate |
| E2.2 | Functional legal links on auth | Auth | Small |

### Tier 3 — Structural improvements (high impact, significant effort)

These are larger refactors that significantly improve the product architecture and experience.

| ID | Enhancement | Pages Affected | Effort |
|----|-------------|----------------|--------|
| E6.1 | Tabbed or sectioned Profile page | Profile | Significant |
| E4.1 | Simplified practice setup with smart defaults | Practice | Moderate-significant |
| E3.3 | Action-oriented metrics on dashboard | Dashboard | Moderate |
| E3.4 | Research context bar with breadcrumbs | Dashboard | Moderate |
| 5.10 | Migrate core fetching to TanStack Query | All pages | Significant |
| E5.1 | Progress visualization in History | History | Moderate-significant |
| E4.5 | Preparation readiness indicator | Dashboard, Practice | Significant |
| E2.3 | Post-signup onboarding flow | Auth, Home | Significant |
| E2.1 | Auth page with value context | Auth | Moderate |

### Tier 4 — Polish and optimization

| ID | Enhancement | Pages Affected | Effort |
|----|-------------|----------------|--------|
| E4.3 | Keyboard shortcut discoverability | Practice | Small |
| E4.6 | Timer UX improvement (opt-in) | Practice | Small-moderate |
| E5.2 | Unified stats loading in History | History | Small-moderate |
| E5.4 | Quick-resume practice from History | History | Moderate |
| E6.2 | Profile completeness with motivation copy | Profile | Small-moderate |
| 5.9 | Card radius standardization | Global | Moderate |
| E1.4 | Draft persistence UX (saved indicator) | Home | Small |

---

## 7. Design Specifications

### 7.1 Color system (current → proposed additions)

The existing sage/warm palette is well-chosen for a professional tool. Additions needed:

```css
/* Add to tailwind.config.ts color mapping */
success: "hsl(var(--success))",
warning: "hsl(var(--warning))",
info: "hsl(var(--info))",
```

### 7.2 Card radius tiers

```css
/* Standardize in tailwind.config.ts */
--radius-card-sm: 0.5rem;   /* 8px — small inline cards, badges */
--radius-card-md: 0.75rem;  /* 12px — standard content cards */
--radius-card-lg: 1rem;     /* 16px — feature cards, mobile primary cards */
```

### 7.3 Motion principles (already partially implemented)

The existing motion system (`--motion-duration-*`, `--motion-ease-*`, `prefers-reduced-motion` overrides) is well-designed. Ensure consistent application:

- **Entrance animations:** `motion-fade-in` for content appearing after load
- **CTA feedback:** `motion-cta` on all primary buttons (currently missing on some variants)
- **Celebration moments:** Brief scale + opacity animation for completion states
- **Reduced motion:** All animations respect `prefers-reduced-motion` (currently handled in CSS)

### 7.4 Empty state template

Every empty state should follow this structure:

```
[Relevant illustration or icon]
[Clear headline — what's missing]
[One-line explanation — why and what to do]
[Primary CTA — the next action]
[Optional secondary link]
```

### 7.5 Loading state hierarchy

| Duration | Pattern | Component |
|----------|---------|-----------|
| < 300ms | No indicator | — |
| 300ms–2s | Spinner on trigger element | `Loader2` from lucide-react |
| 2–10s | Skeleton matching target layout | `Skeleton` + page-specific layout |
| 10s–2min | Stage-based progress dialog | `ProgressDialog` (already exists) |

### 7.6 Typography hierarchy (current, for reference)

```
Body: 18px / 1.6 (set in index.css — larger than typical, good for readability)
Controls: text-sm (14px via Tailwind)
Micro-labels: text-[11px] uppercase tracking-[0.18em]
Headings: text-xl to text-2xl (page titles)
```

### 7.7 Touch target requirements

- **Primary actions:** 48px minimum height/width
- **Secondary actions:** 44px minimum
- **Spacing between targets:** 8px minimum
- **Mobile safe area:** `env(safe-area-inset-bottom)` on all fixed-bottom elements (currently applied in Practice; extend to all pages with bottom CTAs)

---

## Appendix A: Comparison with Existing Documentation

### What changed since the March 29 UI_UX_ENHANCEMENT_PLAN.md

| Item from Old Plan | Current Status |
|----|-----|
| "Missing glyph bug" (P0 Critical) | Not reproducible in current code; likely resolved by font stack change |
| "Gate form behind auth-aware CTA" (P0) | Partially addressed — inline sign-in warning exists but form is still fully visible |
| "Auth recovery links missing" (P1) | **Resolved** — forgot password, resend verification, and set new password all shipped |
| "File upload disabled with Coming Soon" | **Resolved** — PDF and DOCX upload fully functional |
| "Practice setup wizard" (P2) | **Shipped** Nov 23, 2025 — presets and stepper in place |
| "Voice recording labeling" (P2) | **Shipped** Nov 23, 2025 — labeled "local preview only" |
| "`practice_v2` feature flag" (Section 4.4) | **Not implemented** — referenced only in docs, not in code |
| "Telemetry hooks" (Section 4.4) | **Not implemented** — analytics events not wired |

### What this plan adds

- Systematic audit against industry best practices (Apple HIG, MD3, SaaS research)
- Focus on emotional design and motivational UX for job-seeker audience
- Progressive disclosure analysis per page
- Time-to-value optimization for the landing/onboarding flow
- Preparation readiness concept (coverage tracking across sessions)
- Cross-cutting technical debt items (dual toasts, TanStack Query, dead code)
- Explicit design specifications (color tokens, radius tiers, loading hierarchy)

---

## Appendix B: Research Sources

| Source | Application |
|--------|------------|
| Apple Human Interface Guidelines (2025-2026) | Touch targets (44pt), tab bar limits (5 items), clarity/deference/depth principles |
| Google Material Design 3 Expressive | Emotion-driven UX, dynamic color, motion physics, design tokens |
| SaaS Product Design Trends (2026) | Time-to-value economics, onboarding frameworks, 40-60% first-session abandonment |
| Job Seeker App UX Research | 89% mobile usage, application transparency, reduced-friction entry |
| Interview Prep App Patterns | STAR scaffolding, voice practice, judgment-free environments, multi-dimensional feedback |
| Progressive Disclosure Research | 4 variants (conditional, contextual, progressive enabling, staged), 300% form completion lift |
| SaaS Onboarding Best Practices | 3-phase framework (Orient/Activate/Reinforce), intent routing, habit formation |
| Mobile-First Design Principles | Thumb zone, 48px targets, performance budgets, content-first prioritization |
| Form UX Best Practices | Top-aligned labels, inline validation, smart defaults, field width communication |
| Dashboard Design Best Practices | 5-second test, F-pattern layout, 5-9 visualizations max, context for every metric |
| Emotional Design & Gamification | Goal-gradient effect, micro-celebrations, streak motivation, language as architecture |
| Trust & Credibility Signals | Specificity over vagueness, decision-point placement, AI transparency |
| Loading & Performance Perception | Skeleton screens 30% faster perceived, stage-based progress, optimistic UI |
| Error Handling & Recovery | Prevention-first, inline positioning, preserve effort, solution-focused tone |

Detailed research findings are in [`docs/UX_DESIGN_RESEARCH_REPORT.md`](./UX_DESIGN_RESEARCH_REPORT.md).
