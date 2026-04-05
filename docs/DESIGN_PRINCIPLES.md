# Design Principles

UX principles, design tokens, interaction patterns, and component conventions for Prepio.

## Core UX Principles

### 1. Time-to-value is everything

Job seekers are anxious and time-constrained. Every screen should minimize the distance between opening the app and doing useful work. Research runs should feel fast. Practice should start with one tap.

### 2. The question is the hero

In practice mode, the current question must dominate the screen. Everything else (coaching, metadata, navigation) is secondary. If the user has to scroll or hunt to find the question or the save button, the layout failed.

### 3. Mobile is primary

89% of job search activity happens on mobile. The mobile experience is designed first, then adapted for desktop — not the other way around. Practice especially must feel natural in-hand.

### 4. Honest over aspirational

Label features for what they do today. Voice recording is "local preview." Disabled features get honest copy explaining why. No empty promises.

### 5. Practice should feel like growth, not evaluation

Job seekers are already anxious. Copy, colors, and completion states should frame progress positively. Session summaries celebrate work done, not grade performance.

### 6. Explicit controls over gestures

Gestures (swipe to skip, swipe to favorite) exist for power users, but every gesture-driven action also has an explicit button. Users should never feel trapped by an interaction model.

### 7. Depth over density

Show less with more meaning. 30 tailored questions beat 150 generic ones. A clean stage card with a clear CTA beats a dense information grid.

## Design Tokens

### Color system

Colors are defined as CSS custom properties in `index.css` and mapped in `tailwind.config.ts`.

| Token family | Usage |
|-------------|-------|
| `primary` / `secondary` | Core brand actions and surfaces |
| `destructive` | Delete, cancel, error states |
| `muted` | Subdued backgrounds and text |
| `accent` | Highlighted interactive elements |
| `success` | Positive outcomes, completion states |
| `warning` | Caution, attention needed |
| `info` | Informational callouts |

The palette is sage/warm tones — professional and calming, intentionally chosen over high-contrast tech palettes. Do not redesign to slate/indigo without deliberate product rationale.

### Typography

| Context | Spec |
|---------|------|
| Body text | 18px / 1.6 line-height |
| Controls and labels | `text-sm` (14px) |
| Micro-labels | `text-[11px]` uppercase `tracking-[0.18em]` |
| Headings | `text-xl` to `text-2xl` |

### Touch targets

| Context | Minimum |
|---------|---------|
| Primary actions | 48px |
| Secondary actions | 44px |
| Spacing between targets | 8px |
| Mobile safe area | `env(safe-area-inset-bottom)` on fixed-bottom elements |

## Loading Patterns

| Duration | Pattern |
|----------|---------|
| < 300ms | No indicator |
| 300ms – 2s | Spinner on trigger element (`Loader2`) |
| 2s – 10s | Skeleton matching target layout |
| 10s – 2min | Stage-based progress dialog (`ProgressDialog`) with realtime updates |

The research pipeline takes 30-90 seconds. `ProgressDialog` shows named pipeline stages with percentage progress, stall detection (>45s), and retry affordance.

Protected route loading uses skeleton fallbacks, not "Loading..." text.

## Empty States

Every page that can be empty should follow this template:

```
[Icon or illustration]
[Clear headline — framed positively]
[One-line explanation + next action]
[Primary CTA]
[Optional secondary link]
```

History empty states use forward-looking, encouraging copy. Dashboard shows helpful context when no research exists.

## Interaction Patterns

### Practice navigation

- **Skip**: Explicit button (left side of sticky footer)
- **Save & Continue**: Primary CTA (right side of sticky footer)
- **Favorite**: Tap action in utility row
- **Back**: Header button
- **Swipe**: Available as secondary gesture (60px threshold, suppressed by 12px vertical movement)

### Mobile practice layout zones

The mobile practice screen has three permanent zones:

1. **Header** — Back, question position (Q3/10), timer, overflow menu
2. **Question area** — Stage/difficulty metadata chips + prompt text
3. **Sticky composer + CTA** — Recording, notes, Skip, Save & Continue

Everything else (coaching insights, session details, timer reset) is behind modals or overflow menus.

### Desktop practice

Desktop uses a wider grid layout with the insights panel visible as a side panel. Keyboard shortcuts are available (with a dismissible hint banner that persists across sessions).

### Form patterns

- **Mobile home form**: Multi-step wizard with staged disclosure (Company → Role Details → Personalize)
- **Desktop home form**: All fields visible at once (compact enough to not need a wizard)
- **Practice setup**: Quick Start (default) and Custom Session paths. Quick Start skips configuration entirely.

### Destructive actions

All destructive actions (resume deletion, session exit) use `AlertDialog` — never `window.confirm()`.

### Auth

- Sign-in and sign-up are separate tab states with independent field storage
- Redirect context is shown when users are bounced ("Sign in to continue to Practice")
- Password recovery, forgot-password, and resend-verification are distinct flows

## Component Conventions

### Use shadcn/ui

shadcn/ui + Radix provides accessible, consistent primitives. Do not replace with custom components. Extend or compose them.

### Toast notifications

Toasts use the shadcn toast system. The Sonner integration was removed as dead code.

### Navigation

- **Authenticated**: Full app nav with search selector and history access
- **Public**: Branded `PublicHeader` on Home and Auth
- **Practice mode on mobile**: Compact practice-specific header replaces full nav

### Accessibility

- `#main-content` landmark on all page branches
- Button elements for interactive items (not `div` with `onClick`)
- Proper `Link` components for navigation (no raw `<a>` tags for internal routes)
- Skeleton fallbacks for async route loading

## What Not to Do

These have been evaluated and explicitly rejected:

| Don't | Why |
|-------|-----|
| Full visual redesign to slate/indigo | Current sage/warm palette is professional and well-implemented |
| Remove shadcn/ui for custom components | Actively harmful — loses accessibility and consistency |
| Standardize all card border radii | Different radii serve different contexts intentionally |
| Add value-context sidebar to auth page | Clutters a clean auth flow |
| Migrate from PostgreSQL to session-only storage | Persistence is a competitive advantage |
