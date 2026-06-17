# Recurring hygiene review — 2026-06-17

## Summary

Seventh recurring codebase hygiene & security review for Prepio. This
run is unusually clean: the 2026-06-13 carry-over list was almost
entirely cleared in the four days between reviews, and `npm audit` is
now reporting **zero vulnerabilities** for the first time since this
audit series began.

Headline items:

1. **`npm audit` is clean.** Last review reported 2 high + 1 moderate
   on `esbuild` (reaching us via `vite` / `vitest` / `lovable-tagger`).
   PREPIO-84 (PR [#152](https://github.com/akkkkkkki/prepio/pull/152))
   bumped Vite to 7.3.5 *and* added an `"esbuild": "^0.28.1"` override
   in `package.json` to clear the nested `lovable-tagger` copy. The
   lockfile now contains a single `esbuild@0.28.1`, deduped — no
   remaining advisories.
2. **`buildCorsHeaders` adoption is complete.** PREPIO-86 (PR
   [#150](https://github.com/akkkkkkki/prepio/pull/150)) closed the
   five-recurrence finding: all user-facing edge functions now use the
   shared helper. Only `stripe-webhook` (correctly) omits it.
3. **All GitHub Actions are SHA-pinned.** PREPIO-85 (PR
   [#141](https://github.com/akkkkkkki/prepio/pull/141)) pinned both the
   third-party `openai/codex-action` and the first-party `actions/*`
   references in both workflows, with trailing `# v1` / `# v4` / `# v5`
   comments per the OpenSSF guidance.
4. **`interview-question-generator` decision landed.** PREPIO-87 (PR
   [#153](https://github.com/akkkkkkki/prepio/pull/153)) preserved the
   function as a documented service-role-only endpoint, with a top-of-
   file note in `supabase/functions/interview-question-generator/
   index.ts:1-6` and a paragraph in
   [`docs/ARCHITECTURE.md:29`](../ARCHITECTURE.md). Sixth recurrence
   resolved.
5. **First Dependabot wave landed.** Seven PRs opened June 14, four
   days after `.github/dependabot.yml` landed in PR
   [#142](https://github.com/akkkkkkki/prepio/pull/141) (whoops — see
   triage below). The wave is the explicit next-review focus from
   2026-06-13. Triage and recommended dispositions are in *Findings →
   Low*.

No application code, no schema, no auth, no product flow touched in
this run. One tiny lint cleanup made (see *Small fixes*).

## Commands run

- `npm install`: pass. **0 vulnerabilities** (down from 2 high + 1
  moderate at 2026-06-13).
- `npm run lint`: 15 problems (7 errors, 8 warnings) after the small
  fix — was 16 problems (7 errors, 9 warnings) at run start. Errors
  unchanged from documented baseline.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite 7.3.5 + PWA, 49 precache entries, ~2.15
  MiB — slightly smaller than 2026-06-13's 51 entries / ~2.17 MiB
  thanks to the dead-code removal in PREPIO-83).
- `npm test`: pass (38 test files, 285 tests; +13 tests vs. 2026-06-13's
  272, no regressions). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: **0 vulnerabilities.** See Summary item 1.

## Findings

### Critical

None this run.

### High

None this run.

### Medium

None this run. The four standing Medium findings from 2026-06-13 are
all resolved (see Summary).

### Low / clean-up

- [ ] **First Dependabot wave needs triage** — new this review, called
  out as the explicit focus in 2026-06-13's *Next review focus*
  - Evidence: Seven Dependabot PRs opened against `main` between
    2026-06-14 and 2026-06-17:
    - [#142](https://github.com/akkkkkkki/prepio/pull/142) —
      `actions/checkout` 4.3.1 → 6.0.3 (major).
    - [#143](https://github.com/akkkkkkki/prepio/pull/143) —
      `actions/upload-artifact` 4.6.2 → 7.0.1 (major).
    - [#144](https://github.com/akkkkkkki/prepio/pull/144) —
      `actions/setup-node` 4.4.0 → 6.4.0 (major).
    - [#145](https://github.com/akkkkkkki/prepio/pull/145) — radix-ui
      group, **27 packages** in one PR.
    - [#146](https://github.com/akkkkkkki/prepio/pull/146) — react
      group, 4 packages.
    - [#148](https://github.com/akkkkkkki/prepio/pull/148) —
      lint-and-format group, 5 packages.
    - [#159](https://github.com/akkkkkkki/prepio/pull/159) — testing
      group, 2 packages.
  - Risk: Low individually; collectively a stale Dependabot backlog
    becomes its own hygiene smell, defeating the purpose of adding
    Dependabot in the first place.
  - Recommended disposition (in increasing-risk order, easiest first):
    1. **#159 testing group** (vitest / jsdom). Dev-only. The 285
       passing tests are the safety net — green CI is a strong signal.
       Safe to merge after CI passes.
    2. **#148 lint-and-format** (typescript-eslint family). Dev-only.
       Could shift the documented 7-error / 8-warning lint baseline.
       Merge, accept whatever the new baseline becomes, and document it
       here. Low risk because we already CI-fail on `--exit-on-fatal-
       error` rather than total count.
    3. **#142 / #143 / #144 GitHub Actions majors.** All three jump
       across major versions because we sat on the SHA-pinning fix.
       `actions/checkout@v6` dropped GHE 3.10 (not relevant);
       `actions/setup-node@v6` is Node-20-native (we're on Node 20);
       `actions/upload-artifact@v7` changed compression defaults
       (verify retention expectations in `.github/workflows/codex-
       prepio-linear-auto-pr.yml:432`). Merge one at a time so a CI
       break is bisectable.
    4. **#146 react group.** Likely React 19.x. React 19 has real
       breaking changes (ref handling, removed `defaultProps` on
       function components, `useFormStatus` API). This needs a focused
       PR with a manual smoke-test of Home / Dashboard / Practice /
       Profile, not a bulk merge. Recommend closing the Dependabot PR
       and tracking under a Linear issue with a planned upgrade path.
    5. **#145 radix-ui group (27 updates).** Bulk surface area covering
       every dialog, dropdown, popover, and tooltip in the app. Visual
       regressions are the obvious risk. Recommend treating like the
       React bump — close the bulk PR, file a Linear issue, and bring
       them up in smaller batches with deployed-preview QA.
  - Owner / next step: Open a Linear `Chore` issue per item above (#159
    + #148 can share one quick-merge ticket; #142 / #143 / #144 each
    its own; #145 and #146 each a focused upgrade ticket). Out of
    scope for this hygiene run — merging seven PRs is broader than a
    maintenance pass should be.

- [ ] **Lint baseline composition has drifted slightly** —
  informational
  - Evidence: Same 7-error total, but `Auth.tsx` no longer carries a
    `no-explicit-any` (was fixed somewhere between 2026-06-13 and
    today). The error count was held at 7 by a previously-unflagged
    `no-explicit-any` in
    [`tests/unit/test_edge_functions/test_05_cv_analysis.ts:317`](../../tests/unit/test_edge_functions/test_05_cv_analysis.ts).
    Both are legacy Deno test files — not user-facing code. After the
    small fix below, the warning count is now 8 (was 9 at run start).
  - Recommended fix: None. Documenting so the next review's baseline
    diff doesn't re-flag it. The Deno `any`s can wait until that
    suite is rewritten.

- [ ] **Dependabot config used `day: monday` with `interval: monthly`**
  — informational
  - Evidence:
    [`.github/dependabot.yml:13-15`](../../.github/dependabot.yml).
    GitHub's Dependabot docs (`schedule.day` field) say `day` only
    applies to `interval: weekly` and is silently ignored for
    `interval: monthly` — which uses the first day of the month.
    Confirmed empirically: the wave landed Saturday/Sunday 2026-06-14
    (the day after the dependabot.yml landing), not the first Monday
    of July.
  - Recommended fix: One-line edit, remove the `day:` key from both
    `npm` and `github-actions` blocks, or switch `interval` to
    `weekly` if the owner wants the Monday cadence to apply. Not
    fixing this run because the cadence question itself is still open
    pending the *Questions for product owner* answer below.

- [ ] **`lovable-tagger` is still a dev-dep with a Lovable.dev tagger
  use case that may no longer be relevant** — informational, second
  recurrence
  - Evidence:
    [`package.json:100`](../../package.json) still lists
    `lovable-tagger@^1.1.7`. The audit history flagged its nested
    `esbuild` pin as the blocker for closing the esbuild advisories.
    PREPIO-84 worked around it via an `overrides` entry rather than
    removing the dep. The lovable-tagger plugin is only loaded in
    `vite.config.ts` development mode for Lovable.dev's component
    tagger.
  - Risk: Low. The `overrides` entry holds esbuild at a safe version,
    so the immediate security concern is gone. But the dep continues
    to drag a stale `esbuild@0.25.0` reference in its own package
    metadata (the override is what ships at install time). If
    Lovable.dev tagging isn't actively used by the team, the dep is
    pure liability surface.
  - Recommended fix: Confirm with the product owner whether the
    Lovable.dev component tagger is still in use. If not,
    `npm uninstall lovable-tagger` + drop the `componentTagger()`
    import from `vite.config.ts` + remove the `overrides` entry once
    no other dep needs it. Out of scope for this hygiene run because
    it touches the build pipeline. See *Questions for product owner*.

## Small fixes made in this run

1. **Removed a stale `eslint-disable-next-line` directive in
   [`src/pages/Auth.tsx:60`](../../src/pages/Auth.tsx).** ESLint was
   reporting it as a `react-refresh/only-export-components`-style
   "unused eslint-disable directive" warning, meaning the
   `react-hooks/exhaustive-deps` rule it was suppressing wouldn't
   fire even without the directive. Removed → lint went from 16
   problems (7 errors, 9 warnings) to 15 problems (7 errors, 8
   warnings). Verified `npm run typecheck` and `npm test` (285 tests)
   still green afterwards.

No application code, no schema, no auth, no product flow touched in
this run. Lint and audit numbers are unchanged by the edit beyond the
single warning removal.

## Deferred items

All deferred items are tracked in Linear under the **Quality &
Maintenance** project so they don't have to be re-discovered next
review:

- **Dependabot wave triage** — file Linear issues per the disposition
  in *Findings → Low* above. Suggest one quick-merge ticket for
  [#159](https://github.com/akkkkkkki/prepio/pull/159) +
  [#148](https://github.com/akkkkkkki/prepio/pull/148), one per
  GitHub Actions major bump
  ([#142](https://github.com/akkkkkkki/prepio/pull/142),
  [#143](https://github.com/akkkkkkki/prepio/pull/143),
  [#144](https://github.com/akkkkkkki/prepio/pull/144)), and dedicated
  upgrade tickets for the React and Radix-UI groups
  ([#146](https://github.com/akkkkkkki/prepio/pull/146) and
  [#145](https://github.com/akkkkkkki/prepio/pull/145)). Don't bulk-
  merge the React or Radix groups — close those PRs in favour of
  focused upgrade work.
- **Dependabot `day: monday` no-op fix** — one-line edit to
  [`.github/dependabot.yml`](../../.github/dependabot.yml). Decide
  alongside the cadence question.
- **`lovable-tagger` dep decision** — confirm whether the
  Lovable.dev component tagger is still in use; if not, drop the dep
  and the `overrides` entry that was added to work around its nested
  esbuild pin.

## Questions for product owner

- **Dependabot cadence — keep monthly, or tighten to weekly?** The
  first wave produced 7 PRs at once after sitting on dependency drift
  for a month. Weekly would smooth that out at the cost of more
  frequent triage. Confirm in the next review.
- **Is the Lovable.dev component tagger (`lovable-tagger`) still in
  use?** If the team isn't using Lovable.dev's preview tooling, the
  dep can be dropped. Owner answer unblocks a small cleanup PR.
- **OK to merge the React 19 and Radix-UI bulk Dependabot PRs as
  focused upgrade work, rather than as Dependabot's bulk PRs?** The
  React 19 surface area (ref handling, `defaultProps` removal) and
  the 27-package Radix wave both warrant a planned upgrade with
  preview-QA rather than a single click-to-merge. Confirm the
  approach so the Dependabot PRs can be closed in favour of Linear-
  tracked work.

## Next review focus

1. **Dependabot wave outcome.** Track which PRs were merged, which
   were converted to Linear-tracked focused upgrades, and which were
   closed without action. The risk now is the seven open Dependabot
   PRs becoming this audit's recurring finding the way
   `buildCorsHeaders` and `interview-question-generator` did.
2. **Lovable.dev dep decision.** If the answer to the question above
   is "drop it," verify the cleanup PR landed cleanly and the
   `overrides` entry was removed.
3. **React 19 / Radix-UI upgrade scoping.** If the team accepts the
   focused-upgrade approach, scope the breaking-change surface area
   (React 19 ref API, removed `defaultProps`, Radix's API shifts in
   `1.x → 2.x` packages) and identify which surfaces need preview QA.
