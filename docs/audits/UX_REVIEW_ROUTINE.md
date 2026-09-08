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

## Captured evidence must not leak PII

Screenshots of any surface that renders a loaded CV expose real résumé PII and
must never be committed unredacted. The high-risk surfaces are `/profile` (the
"About" block, the `Current source: <filename>` line, and the sidebar source
box) and `/new-interview` (the "Add your CV" textarea once a CV is loaded). Note
that the CV *filename* is itself PII — it embeds the candidate's name — so the
`Current source` line has to be covered too, not just the free-text blocks.

Before committing evidence from these surfaces, do one of:

- Capture with a throwaway account that has no real CV loaded, or
- Cover the About block, the CV textarea, and every `Current source` filename
  with an **opaque, flattened** redaction before saving the PNG — a solid black
  bar over the region, or a full-image placeholder. **Do not blur.** Blur (and
  pixelation) on small high-contrast text is often reversible or still legible,
  so it can leave the exact PII recoverable; only an irreversible opaque cover
  is acceptable.

The same rule applies to the report **prose**, not just the images: do not
transcribe the CV filename, name, or contact details into the note body when
quoting a surface (e.g. a `Current source: <filename>` line) — strip the
name-bearing part first.

A committed screenshot is a binary blob that stays in Git history forever, so a
working-tree replacement is necessary but not sufficient once raw PII has
landed. If an unredacted shot is discovered after the fact, replace the
working-tree blobs and escalate for an owner-attended history purge — see
[PREPIO-145](https://linear.app/qiuyue/issue/PREPIO-145).

## Report footer

Every routine report should close with one of these capability statements:

- `Capability: live browser verified`
- `Capability: static code/change-diff review only`

