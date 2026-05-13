# Design Principles

## Product Feel

Prepio should feel like a focused prep workspace, not a marketing site or generic AI demo.

The user is usually under time pressure. Screens should make the next useful action obvious.

## Hierarchy

- Research entry must stay prominent.
- In practice mode, the current question is the main object.
- Coaching, metadata, timers, filters, and navigation are secondary.
- History and dashboard views should help users resume work, not admire charts.

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
