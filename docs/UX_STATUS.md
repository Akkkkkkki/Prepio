# Prepio UX Status

**Last updated:** April 5, 2026
**Purpose:** Single source of truth for UX decisions, shipped work, and remaining backlog.

---

## Current Product State

Prepio is a research-driven interview prep tool. The core loop works: users create research runs, review generated stages and questions, and practice with tailored content. The mobile practice redesign shipped and is in follow-up QA (see [`MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./MOBILE_PRACTICE_UX_EXECUTION_PLAN.md)).

### What's solid
- Research pipeline generates tailored, company-specific questions
- PDF and DOCX resume upload works from Home and Profile
- Auth includes forgot-password, resend-verification, and password-recovery flows
- Mobile practice has dedicated layout with swipe guards, safe-area padding, and explicit button controls
- Practice setup presets (Quick / Deep) shipped Nov 2025
- Voice recording labeled honestly as "local preview only"
- Search history accessible from authenticated navigation

### Where friction remains
- **Guest landing** — the full form is visible to guests but non-functional; no social proof or output preview
- **Desktop form** — all fields shown at once (mobile wizard already provides staged disclosure)
- **Dashboard** — dense stage cards on desktop, no celebration when research completes
- **Profile** — long single-scroll page with no section navigation
- **No analytics or telemetry** — no data on how users actually interact

---

## Shipped UX Improvements (April 5, 2026)

All items below are merged and passing build.

### Correctness & accessibility
| Change | Files |
|--------|-------|
| Mobile wizard step labels: raw keys → "Company", "Role Details", "Personalize" | `Home.tsx` |
| "Account Settings" copy fix (was singular) | `Profile.tsx` |
| Fisher-Yates shuffle replacing biased `sort(() => Math.random() - 0.5)` | `Practice.tsx` |
| `AlertDialog` for resume deletion replacing `window.confirm` | `Profile.tsx` |
| `<a href="/">` → `<Link to="/">` on NotFound page | `NotFound.tsx` |
| Navigation history items: `<div onClick>` → `<button>` | `Navigation.tsx` |
| `#main-content` landmarks on all page branches | Dashboard, Practice, History, NotFound |
| `ProtectedRoute` "Loading..." → skeleton fallback | `App.tsx` |

### Dead code removal
| Change | Files |
|--------|-------|
| Deleted unused `Index.tsx` placeholder | Deleted |
| Deleted unused `App.css` starter styles | Deleted |
| Removed Sonner toast system (dead `next-themes` integration) | `App.tsx`, deleted `sonner.tsx` usage |
| Removed dead `enhancedQuestions` state and code path | `Dashboard.tsx` |

### UX improvements
| Change | Files |
|--------|-------|
| Dashboard metrics: action-oriented labels ("tailored questions ready to practice") | `Dashboard.tsx` |
| Dashboard breadcrumb navigation (Home > Company Research) | `Dashboard.tsx` |
| Dashboard research creation timestamp | `Dashboard.tsx` |
| Keyboard shortcut hint on desktop practice (dismissible, persisted) | `Practice.tsx` |
| Celebratory session completion with dynamic headline | `SessionSummary.tsx` |
| History empty states with encouraging, forward-looking copy | `History.tsx` |
| Removed "Refreshing overview totals..." flicker | `History.tsx` |
| Semantic color tokens (`success`, `warning`, `info`) in Tailwind | `tailwind.config.ts` |

---

## De-prioritized Items (with rationale)

These were evaluated against the codebase and judged not worth implementing now.

### Not worth the effort currently
| Item | Why |
|------|-----|
| Value-first landing page for guests | Needs marketing content (testimonials, usage data) that doesn't exist |
| Progressive disclosure form (desktop) | Desktop form is compact enough; mobile wizard already handles this |
| Auth page value context sidebar | Clutters a clean auth flow |
| Post-signup onboarding flow | Significant development for unvalidated benefit |
| Tabbed Profile page | Long page but infrequently visited; accordions suffice |
| TanStack Query migration | High-risk refactor touching every page; recommend dedicated sprint |
| Card radius standardization | Different radii serve different contexts intentionally |

### Require more data or dedicated initiative
| Item | Why |
|------|-----|
| Preparation readiness indicator | Significant aggregation effort; needs active user data to validate |
| Progress visualization charts (History) | Requires charting library; good idea but needs dedicated feature work |
| Research completion celebration | Tricky transition between ProgressDialog and Dashboard; low-priority |
| Desktop stage card accordions | Would hide useful information for practice selection decisions |
| Simplified desktop practice setup | Current 4-step provides useful granularity; mobile already simplified |

### Explicitly rejected from redesign analysis
| Item | Why |
|------|-----|
| Full visual redesign to slate/indigo | Current sage/warm palette is professional and well-implemented |
| Live AI interview (bidirectional audio) | Major dedicated initiative requiring WebRTC expertise; not incremental |
| Remove shadcn/ui for custom components | Actively harmful — shadcn provides accessible, consistent components |
| Migrate from PostgreSQL to session-only storage | Persistence is a competitive advantage |
| Gap analysis with match scoring | Interesting but requires AI prompt engineering research spike first |
| On-demand question generation | Useful but not critical; current batch generation covers needs |

---

## Design Specifications

### Color tokens
```
Primary/secondary/destructive/muted/accent — defined in index.css, mapped in tailwind.config.ts
success/warning/info — added April 2026, mapped to CSS variables
```

### Loading states
| Duration | Pattern |
|----------|---------|
| < 300ms | No indicator |
| 300ms–2s | Spinner on trigger element (`Loader2`) |
| 2–10s | Skeleton matching target layout |
| 10s–2min | Stage-based progress dialog (`ProgressDialog`) |

### Touch targets
- Primary actions: 48px minimum
- Secondary actions: 44px minimum
- Spacing between targets: 8px minimum
- Mobile safe area: `env(safe-area-inset-bottom)` on fixed-bottom elements

### Typography
```
Body: 18px / 1.6
Controls: text-sm (14px)
Micro-labels: text-[11px] uppercase tracking-[0.18em]
Headings: text-xl to text-2xl
```

### Empty state template
```
[Icon or illustration]
[Clear headline — framed positively]
[One-line explanation + next action]
[Primary CTA]
[Optional secondary link]
```

---

## Future Roadmap (Ideas Bank)

These are ideas from various planning documents that remain interesting but are not actively being worked on. They should be evaluated when the product has more user data.

### Near-term polish (when capacity allows)
- Functional legal links on auth page (requires actual legal docs)
- Draft persistence UX — "Draft saved" indicator and "Continue where you left off" prompt
- Profile completeness with motivational copy explaining why it matters
- Quick-resume practice CTA in History page
- Timer opt-in for practice sessions

### Larger features (require dedicated initiative)
- **AI answer feedback** — evaluate practice answers with GPT, show clarity/relevance/structure scores
- **Gap analysis** — match score between CV and job requirements with strategic recommendations
- **Practice modes** — Deep Dive (fewer questions, immediate feedback) vs Mock Interview (full set, holistic evaluation)
- **Progress visualization** — charts showing practice coverage, session trends, and readiness
- **Live AI interview** — real-time conversational practice with bidirectional audio (requires WebRTC)

### Architecture improvements (require careful planning)
- Migrate core data fetching to TanStack Query hooks for caching and dedup
- Normalize `search_artifacts` JSON blobs into relational tables
- Add taxonomy columns to `interview_questions` (vertical, competency, seniority)
- Practice telemetry — scoring, transcript metadata, feedback loops

---

## Research Lineage

This document consolidates findings from four previous documents that have been retired:
- `UI_UX_ENHANCEMENT_PLAN.md` (March 29, 2026) — original UX backlog with gap review
- `UI_UX_REDESIGN_ANALYSIS.md` (December 9, 2025) — comparison with alternative Gemini-based design
- `UX_DESIGN_RESEARCH_REPORT.md` (April 2026) — UX best practices research (Apple HIG, MD3, SaaS patterns)
- `UX_ENHANCEMENT_DESIGN_PLAN.md` (April 5, 2026) — page-by-page audit with implementation status
- `IMPLEMENTATION_ROADMAP.md` (December 9, 2025) — detailed planning for gap analysis, AI feedback, visual redesign

Key conclusions preserved from those documents:
- **Hybrid integration strategy** is correct — add features incrementally, preserve architecture
- **Preserve shadcn/ui, Supabase, PostgreSQL** — the current stack is proven and robust
- **Time-to-value** is the most impactful UX principle for this product
- **Emotional design** matters — job seekers are anxious; practice should feel like growth, not evaluation
- **Mobile is primary** for job seekers (89% mobile usage in job search activities)
