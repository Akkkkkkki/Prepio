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

## Report footer

Every routine report should close with one of these capability statements:

- `Capability: live browser verified`
- `Capability: static code/change-diff review only`

