# Design Principles

## Product Feel

Prepio should feel like a focused prep workspace, not a marketing site or generic AI demo.

The user is usually under time pressure. Screens should make the next useful action obvious.

## Core Principles

Four principles, sharpened by the 2026-06-21 UX review
([`docs/audits/2026-06-21-ux-review.html`](./audits/2026-06-21-ux-review.html)). Measure new
UI against them:

1. **One obvious next action.** Every screen answers "what do I do now?" with a single
   primary button; everything else is secondary.
2. **A journey, not a menu.** The product walks the user from research to readiness, and
   their position in that arc is always visible — not a flat set of peer tabs.
3. **Calm by default.** Show the essential; tuck analytical depth behind progressive
   disclosure. Detail on demand, not by default.
4. **Honest, specific copy.** No fake AI chat, no vague scores. Say exactly what a thing is
   and does (see Copy, below).

## Information Architecture

Prepio is organised around one object: an **interview**. Research, plan, practice, and
review all live inside it.

- **One home — "Your interviews".** Each saved research run is a card with its own status,
  progress, and one-tap way back in. This is the post-login landing.
- **One workspace per interview.** A persistent identity header (e.g. "Stripe · Senior PM")
  over three segments — **Plan / Practice / Review**. The workspace *is* the interview;
  there is no hidden `?searchId` and no separate "active research" switcher.
- **Account stuff steps aside.** Profile, billing/pricing, and sign-out live in an account
  menu, not the primary nav.

This is the target structure. The migration from today's six-tab nav is tracked under the
**[Epic] Interview-as-object UX restructure** (PREPIO-99). Until it lands, prefer changes
that move toward this shape, not away from it.

## Hierarchy

- Research entry must stay prominent.
- In practice mode, the current question is the main object.
- Coaching, metadata, timers, filters, and navigation are secondary.
- History and dashboard views should help users resume work, not admire charts.

## Visual System

Target a restrained token set (to be locked under PREPIO-106): a 2-step corner-radius scale,
one accent, ≤2 badge styles, and uppercase tracked labels only where they earn hierarchy.
The 2026-06-21 review found four radius sizes, five badge colours, and uppercase
micro-labels on nearly every block — together they read as "heavy" before a word is read.
Calm the surface; don't nest cards inside cards.

## Copy

Use direct, specific copy.

Good:

- "Practice this stage"
- "Save answer"
- "Review profile import"
- "Transcription unavailable. Your answer was still saved."

Avoid:

- vague AI claims
- abstract readiness scores before feedback exists
- visible explanations of obvious UI mechanics

## Feedback Tone

When AI answer feedback ships, it should be paid-only and coaching-oriented.

It should say:

- what worked
- what was missing
- how to make the answer stronger
- what to practice next

It should not lead with a fake-feeling score.

## Paid Moments

Upgrade prompts should appear near real value:

- requesting detailed answer feedback
- reviewing deeper progress/readiness
- hitting plan usage limits

Free users must not trigger paid feedback generation behind the scenes.

## Mobile

Mobile practice must keep controls reachable:

- stable bottom navigation
- safe-area padding
- no layout shifts when timers, labels, or saved states change
- offline states that explain what cannot be saved

## Destructive Actions

Use `AlertDialog` for destructive actions such as deleting resume versions or ending important flows. Do not use `window.confirm()`.
