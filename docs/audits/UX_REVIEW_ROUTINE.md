# UI/UX Review Routine Contract

This is the durable operating contract for the recurring Prepio UI/UX review
routine.

## Capability check

Before claiming interactive coverage, the routine must verify both:

- Playwright Chromium is ready, either from the session-start hook or
  `npx playwright install chromium`.
- The execution environment can load `https://prepio.qiuyue.dev`.

If either check fails, the review is a static code and change-diff review only.

## Static-only scope

When live browser access is unavailable, the routine must state that limitation
near the top of the report and must not claim to have verified:

- screenshots or rendered layout
- mobile viewport behavior
- touch target sizes
- keyboard focus order
- screen-reader behavior
- slow-network, offline, or runtime loading states

Static-only findings are still useful, but each finding must include source
file evidence and must use language such as "inferred from code" or
"needs live-browser confirmation" when the user impact depends on rendering.

## Interactive scope

When both capability checks pass, the routine should visit the live app and
capture evidence for at least:

- logged-out home
- logged-in home or dashboard equivalent
- practice on a mobile viewport

The report should include the screenshots or a precise note explaining why a
specific route could not be captured.

## Deferred items must name a metric

Every deferred item this routine produces must declare the one verifiable
number that will move when it is addressed — a composite-scorecard dimension,
a touch-target pass rate, a contrast ratio, an audit-repeat count that should
reach zero — or explicitly mark itself `no metric (pure cleanup)`. "Improves
UX" is not a metric. The declaration must also record the metric's **current
baseline value** — and, for a metric that drifts on its own (a contrast pass
rate, a touch-target pass rate), the window it was measured over — so a later
run has a pre-fix value to compare against; a named metric with no captured
baseline is not a verifiable one. The declaration must also state the
**expected direction** (and a target where one applies), because the point is
improvement, not motion. The full declaration — metric, baseline,
direction/target — carries onto the Linear issue so the outcome can be checked
after it closes. This mirrors the recurring-hygiene closing condition in
[`CLAUDE.md`](../../CLAUDE.md) (PREPIO-160).

Each run opens by reviewing the deferred items **filed under this contract**
(those carrying a declared metric + baseline) that closed since the previous
run — per item, whether its number moved in the intended direction to (or past)
its target, or `no metric (pure cleanup)` where that was the declaration. A
closed item whose number did not move, or moved the wrong way, is itself a
finding. Items predating this contract carry no baseline and are out of scope
— it is not applied retroactively.

## Report footer

Every routine report should close with one of these capability statements:

- `Capability: live browser verified`
- `Capability: static code/change-diff review only`

