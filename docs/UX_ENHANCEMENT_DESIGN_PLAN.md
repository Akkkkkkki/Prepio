# Prepio UX Enhancement Design Plan

**Date:** April 5, 2026
**Scope:** Full product user journey audit and enhancement design for professional job seekers in tech, consulting, and finance
**Methodology:** Page-by-page code audit, cross-referenced against Apple HIG, Material Design 3, SaaS onboarding research, and job-seeker UX studies
**Supersedes:** `docs/UI_UX_ENHANCEMENT_PLAN.md` (March 29, 2026) — that document contains several stale entries; this plan reflects current shipped state

**Last implementation pass:** April 5, 2026

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
│ ⚠ No proof  │    │ ⚠ Form   │    │ ✓ Progress│    │ ✓ Context│    │ ✓ Mobile  │
│ ⚠ No preview│    │   bloat  │    │   dialog  │    │ ✓ Metrics│    │   redesign│
│ ⚠ Guest UX  │    │ ⚠ Mobile │    │   works   │    │ ✓ Breadc.│    │ ✓ Keyboard│
│   is half-  │    │   wizard │    │           │    │          │    │   hints   │
│   finished  │    │   ✓ fixed│    │           │    │          │    │           │
└─────────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
                                                                         │
                                                          ┌──────────┐   │
                                                          │ 6. REVIEW│◂──┘
                                                          │(History) │
                                                          │          │
                                                          │ ✓ Empty  │
                                                          │   states │
                                                          │ ✓ Stats  │
                                                          │   flicker│
                                                          │   fixed  │
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

The Home page serves dual duty: marketing landing page for guests and research entry form for signed-in users.

#### Enhancement design

**E1.1 — Value-first landing page (guest)** — _De-prioritized_

Replace the current guest experience with a structured landing flow including hero section, social proof, and example outputs. **Assessment:** Good idea in principle but requires marketing content (testimonials, usage data) that doesn't exist yet. The current guest CTA flow is functional. Recommend tackling this when the product has traction data to display authentically.

**E1.2 — Progressive disclosure form (signed-in desktop)** — _De-prioritized_

Restructure the signed-in form into two tiers. **Assessment:** The mobile wizard already provides staged disclosure. The desktop form is compact enough as a single card. Over-engineering the desktop form risks breaking a functional flow for marginal gain. Revisit when user testing data shows desktop form abandonment.

**E1.3 — Mobile wizard label fix** — _Implemented April 5, 2026_

Step labels in the mobile wizard now display "Company", "Role Details", and "Personalize" instead of raw key names.

**E1.4 — Research draft persistence improvement** — _De-prioritized_

Drafts already auto-save and restore silently. Adding a visible "Draft saved" indicator and "Continue where you left off" prompt is a nice polish item but not high-impact. Low priority.

---

### 4.2 Auth (Sign In / Sign Up)

The auth page is functional with redirect banners, recovery flows, and separate tab state.

#### Enhancement design

**E2.1 — Auth page with value context** — _De-prioritized_

Adding a sidebar with value proposition on the auth page. **Assessment:** The auth page is clean and focused. Adding marketing content risks cluttering the sign-in experience. The redirect banner already provides context. Not high-value.

**E2.2 — Functional legal links** — _De-prioritized_

Replace placeholder "terms and privacy policy" text with actual links. **Assessment:** Valid concern but requires actual legal documents to exist. This is a content/legal task, not a UX engineering task. Flagged for the team.

**E2.3 — Post-signup onboarding flow** — _De-prioritized_

Multi-step onboarding after first sign-up. **Assessment:** Requires significant new page/component development. The current flow (sign up → redirected to Home with draft restored) is adequate. Recommend only after user retention data justifies the investment.

---

### 4.3 Dashboard (Research Results)

The dashboard is where Prepio delivers on its promise.

#### Enhancement design

**E3.1 — Research completion moment** — _De-prioritized_

Celebration animation when research transitions to completed. **Assessment:** The research completion is handled via the ProgressDialog → redirect flow. Adding celebration at this transition point is tricky because the user navigates from Home to Dashboard. A better approach would be enhancing the ProgressDialog itself. Low priority.

**E3.2 — Stage cards with progressive disclosure (desktop)** — _De-prioritized_

Desktop stage cards with accordion pattern. **Assessment:** Mobile already has `MobileStageCard` with collapsible content. Desktop shows all details which is appropriate for the screen real estate. Collapsing desktop stage cards would hide information users need to make practice selection decisions. Not recommended.

**E3.3 — Action-oriented metrics** — _Implemented April 5, 2026_

Dashboard metrics now use contextual labels: "tailored questions ready to practice", "stages identified from research" instead of raw counts.

**E3.4 — Research context bar** — _Implemented April 5, 2026_

Desktop dashboard now includes breadcrumb navigation (Home > Company Research) and a research timestamp showing when the run was created.

**E3.5 — Clean up dead data path** — _Implemented April 5, 2026_

Removed `enhancedQuestions` state, `setEnhancedQuestions`, and `getEnhancedQuestionCount` function — all dead code paths that were never populated by `getSearchResults`.

---

### 4.4 Practice (Question Sessions)

Practice is Prepio's highest-engagement surface.

#### Enhancement design

**E4.1 — Simplified setup with smart defaults** — _De-prioritized_

Reduce desktop setup to 2 steps. **Assessment:** The current 4-step setup (Goal → Stages → Filters → Review) provides useful granularity for power users. Mobile already has a simplified quick/custom path. Collapsing the desktop steps risks removing useful options without clear evidence of abandonment at the setup stage.

**E4.2 — Fix biased shuffle** — _Implemented April 5, 2026_

Replaced `sort(() => Math.random() - 0.5)` with Fisher-Yates shuffle for unbiased question randomization.

**E4.3 — Keyboard shortcut discoverability** — _Implemented April 5, 2026_

Desktop practice sessions now show a dismissible hint bar on first session: "← → to navigate · S to skip". Dismissal persists in `localStorage`.

**E4.4 — Celebratory session completion** — _Implemented April 5, 2026_

`SessionSummary` now displays a dynamic headline based on completion depth ("Great depth — you worked through all N questions" / "Solid session — you covered N of N questions" / "Good start — N questions down, N to go") with entrance animation.

**E4.5 — Preparation readiness indicator** — _De-prioritized_

Track coverage across sessions and show a readiness bar. **Assessment:** Good concept but requires aggregation logic across practice sessions, which adds complexity. The data exists in `practice_answers` but building the coverage calculation and displaying it across Dashboard and Practice is a significant effort. Recommend as a dedicated feature sprint when the product has enough active users to validate the approach.

**E4.6 — Timer UX improvement** — _De-prioritized_

Make the practice timer opt-in. **Assessment:** The timer is a simple elapsed counter. Making it opt-in adds state complexity for a minor anxiety concern. The current implementation is neutral — it tracks pace without pressure. Low priority.

---

### 4.5 History (Session Review)

#### Enhancement design

**E5.1 — Progress visualization** — _De-prioritized_

Add charts showing questions practiced over time, coverage by topic, and practice frequency. **Assessment:** Requires a charting library and significant data aggregation. The value is real but the effort is substantial. Recommend as a dedicated feature.

**E5.2 — Unified stats loading** — _Implemented April 5, 2026_

Removed the "Refreshing overview totals..." flicker message that appeared while switching between fallback and server stats.

**E5.3 — Richer empty states** — _Implemented April 5, 2026_

Empty states now use encouraging, forward-looking copy ("Ready to start practicing" instead of "No practice sessions yet") and prioritize the practice CTA over the dashboard link.

**E5.4 — Quick-resume practice** — _De-prioritized_

Add a "Continue practicing" CTA to History. **Assessment:** Would require computing un-practiced questions for a given research run. The current path (History → Dashboard → Practice) is clear enough. Low priority.

---

### 4.6 Profile (Resume & Settings)

#### Enhancement design

**E6.1 — Tabbed or sectioned Profile page** — _De-prioritized_

Replace the long-scroll page with tabs or sticky section nav. **Assessment:** The Profile page is long but not frequently visited. Adding tabs introduces routing complexity within the page. The existing accordion structure provides reasonable section boundaries. Revisit if user testing shows confusion navigating the profile.

**E6.2 — Profile completeness with motivation** — _De-prioritized_

Enhance completeness card with explanation of benefits. **Assessment:** The completeness indicator already exists. Adding motivational copy is a small improvement but not high-impact. Low priority.

**E6.3 — Custom deletion dialog** — _Implemented April 5, 2026_

Replaced `window.confirm` for resume deletion with a proper `AlertDialog` component that describes consequences and provides a styled destructive confirm button.

**E6.4 — Fix "Account setting" copy** — _Implemented April 5, 2026_

Changed "Account setting" → "Account Settings".

---

## 5. Cross-Cutting Issues

### 5.1 Dual toast systems — _Implemented April 5, 2026_

Removed Sonner and its mounting from `App.tsx`. Standardized on the Radix/hook toast system already in use. The Sonner component imported `useTheme` from `next-themes` with no `ThemeProvider` anywhere — dead integration.

### 5.2 Inconsistent `#main-content` landmarks — _Implemented April 5, 2026_

Added `id="main-content"` to all page branches across Dashboard (skeleton, empty, error, in-progress, mobile, desktop), History (skeleton, main), Practice (all 9 branches), and NotFound.

### 5.3 `ProtectedRoute` loading state — _Implemented April 5, 2026_

Replaced the raw "Loading..." text with the existing `RouteFallback` skeleton component.

### 5.4 Navigation history items are divs, not buttons — _Implemented April 5, 2026_

Replaced `<div onClick={...}>` with `<button type="button">` elements in both desktop and mobile history lists.

### 5.5 Dead `Index.tsx` page — _Implemented April 5, 2026_

Deleted the file. It was a Vite starter placeholder not wired into the router.

### 5.6 `NotFound` page uses `<a>` instead of router `<Link>` — _Implemented April 5, 2026_

Replaced `<a href="/">` with `<Link to="/">` for client-side navigation.

### 5.7 Unused `App.css` — _Implemented April 5, 2026_

Deleted the file. It contained Vite starter styles and was not imported by any file.

### 5.8 Inconsistent color token usage — _Implemented April 5, 2026_

Added `success`, `warning`, and `info` semantic color tokens to `tailwind.config.ts`, mapping to the existing CSS variables already defined in `index.css`. Migrated `SessionSummary` from hardcoded `green-600`/`green-100` to semantic `success` tokens. Further migration of other components is a gradual process.

### 5.9 Card radius inconsistency — _De-prioritized_

Two card dialects coexist (shadcn `rounded-lg` and product `rounded-2xl`/`rounded-3xl`). **Assessment:** The visual inconsistency is minor and the different radii serve different contexts (standard cards vs. mobile-first feature cards). Standardizing requires touching many components for marginal visual gain. Low priority.

### 5.10 TanStack Query underutilization — _De-prioritized_

Only `useSearchProgress` uses TanStack Query. **Assessment:** Migrating all data fetching to TanStack Query is a significant refactor that touches every page. The benefit (caching, dedup, background refetch) is real but the risk of introducing regressions is high. Recommend as a dedicated refactor sprint with thorough testing.

---

## 6. Enhancement Roadmap

### Implemented (April 5, 2026)

| ID | Enhancement | Pages Affected |
|----|-------------|----------------|
| E1.3 | Mobile wizard step labels | Home |
| E6.4 | "Account Settings" copy fix | Profile |
| 5.5 | Delete dead `Index.tsx` | Global |
| 5.7 | Delete unused `App.css` | Global |
| 5.6 | NotFound `<a>` → `<Link>` | NotFound |
| 5.3 | ProtectedRoute skeleton fallback | Global |
| 5.4 | Nav history items: `div` → `button` | Navigation |
| E4.2 | Fisher-Yates shuffle | Practice |
| E6.3 | AlertDialog for resume deletion | Profile |
| 5.2 | `#main-content` on all page branches | All pages |
| E3.5 | Remove dead `enhancedQuestions` code | Dashboard |
| 5.1 | Remove Sonner; standardize toasts | Global |
| E5.3 | Richer empty states | History |
| E5.2 | Remove stats flicker | History |
| E3.3 | Action-oriented dashboard metrics | Dashboard |
| E3.4 | Breadcrumb nav + research timestamp | Dashboard |
| E4.3 | Keyboard shortcut hint | Practice |
| E4.4 | Celebratory session completion | Practice |
| 5.8 | Semantic color tokens | Global |

### De-prioritized (with rationale)

| ID | Enhancement | Rationale |
|----|-------------|-----------|
| E1.1 | Value-first landing page | Needs marketing content (testimonials, data) that doesn't exist yet |
| E1.2 | Progressive disclosure form (desktop) | Desktop form is compact enough; mobile wizard already handles this |
| E1.4 | Draft persistence UX | Current silent save/restore is adequate |
| E2.1 | Auth page value context | Clutters a clean auth flow |
| E2.2 | Functional legal links | Content/legal task, not engineering |
| E2.3 | Post-signup onboarding | Significant development for unvalidated benefit |
| E3.1 | Research completion celebration | Tricky transition; better served by ProgressDialog enhancement |
| E3.2 | Desktop stage card accordions | Would hide useful information for practice selection |
| E4.1 | Simplified desktop setup | Current 4-step provides useful granularity; mobile already simplified |
| E4.5 | Preparation readiness indicator | Significant aggregation effort; validate with user data first |
| E4.6 | Timer opt-in | Current elapsed timer is neutral; low anxiety risk |
| E5.1 | Progress visualization charts | Requires charting library and data aggregation |
| E5.4 | Quick-resume practice | Requires un-practiced question computation |
| E6.1 | Tabbed Profile page | Long page but infrequently visited; accordions suffice |
| E6.2 | Profile completeness motivation | Minor copy improvement; low impact |
| 5.9 | Card radius standardization | Different radii serve different contexts intentionally |
| 5.10 | TanStack Query migration | High-risk refactor; recommend dedicated sprint |

---

## 7. Design Specifications

### 7.1 Color system (current + additions)

The existing sage/warm palette is well-chosen. Semantic tokens added:

```css
/* Added to tailwind.config.ts */
success: "hsl(var(--success))",
warning: "hsl(var(--warning))",
info: "hsl(var(--info))",
```

### 7.2 Card radius tiers

Not yet codified. Current practice:
- `rounded-lg` — standard shadcn cards, form elements
- `rounded-xl` to `rounded-2xl` — feature cards, mobile cards
- `rounded-3xl` — hero sections, dashboard cards

### 7.3 Motion principles (already partially implemented)

The existing motion system works well. Session completion now uses `motion-safe:animate-in` with `fade-in` and `zoom-in-95`.

### 7.4 Empty state template

Every empty state should follow this structure:

```
[Relevant illustration or icon]
[Clear headline — what's missing, framed positively]
[One-line explanation — why and what to do next]
[Primary CTA — the next action]
[Optional secondary link]
```

History empty states now follow this pattern.

### 7.5 Loading state hierarchy

| Duration | Pattern | Component |
|----------|---------|-----------|
| < 300ms | No indicator | — |
| 300ms–2s | Spinner on trigger element | `Loader2` from lucide-react |
| 2–10s | Skeleton matching target layout | `Skeleton` + page-specific layout |
| 10s–2min | Stage-based progress dialog | `ProgressDialog` (already exists) |

`ProtectedRoute` now uses the `RouteFallback` skeleton instead of raw "Loading..." text.

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
- **Mobile safe area:** `env(safe-area-inset-bottom)` on all fixed-bottom elements

---

## Appendix A: Comparison with Original Documentation

### What changed since the March 29 UI_UX_ENHANCEMENT_PLAN.md

| Item from Old Plan | Current Status |
|----|-----|
| "Missing glyph bug" (P0 Critical) | Not reproducible; likely resolved by font stack change |
| "Gate form behind auth-aware CTA" (P0) | Partially addressed — inline sign-in warning exists but form still visible for guests |
| "Auth recovery links missing" (P1) | **Resolved** — forgot password, resend verification, and set new password all shipped |
| "File upload disabled with Coming Soon" | **Resolved** — PDF and DOCX upload fully functional |
| "Practice setup wizard" (P2) | **Shipped** Nov 23, 2025 — presets and stepper in place |
| "Voice recording labeling" (P2) | **Shipped** Nov 23, 2025 — labeled "local preview only" |
| "`practice_v2` feature flag" (Section 4.4) | **Not implemented** — referenced only in docs, not in code |
| "Telemetry hooks" (Section 4.4) | **Not implemented** — analytics events not wired |

### What this plan adds (April 5, 2026 pass)

- 19 enhancements implemented across all pages
- Systematic evaluation of each proposal against current product reality
- Clear de-prioritization with rationale for items that don't justify implementation effort
- Semantic color tokens in design system
- Accessibility landmarks across all page branches

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
