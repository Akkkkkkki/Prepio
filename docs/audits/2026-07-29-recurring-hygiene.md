# Recurring hygiene review — 2026-07-29

## Summary

Nineteenth recurring codebase hygiene & security review for Prepio.

Two commits merged to `main` in the four days since 2026-07-25 — and one
of them is the **first runtime source diff in four windows**:

- **Runtime** — [#249](https://github.com/akkkkkkki/prepio/pull/249) —
  2026-07-29. "Fix team-first research note signals." Edge-function only:
  `supabase/functions/company-research/query-planner.ts` (+12 / −2) plus
  29 lines of new tests. Retro-audited this run (see Review focus) —
  clean.
- **Docs / infra** — [#254](https://github.com/akkkkkkki/prepio/pull/254)
  — the 2026-07-25 hygiene note itself, which also carried last run's
  in-tree `postcss` lockfile fix. Now on `main`.

Headline status:

1. **`npm audit`: stable at 10** (2 moderate, 8 high) — **no regression,
   no new advisory** this window. Identical to the post-fix state the
   2026-07-25 run landed on. The 10 are the same two deferred groups:
   `react-router` (moderate ×2, runtime) and the `brace-expansion`
   build-time chain (high). A non-forced `npm audit fix` was re-checked
   this run and **cannot clear either** — it only churns optional
   platform binaries into the lockfile (see Small fixes → *not touched*).
2. **Lint baseline unchanged at 54 problems** (46 errors, 8 warnings).
   No drift — #249 touched only an edge function (outside the ESLint
   `src/` surface) and added tests.
3. **Typecheck ratchet holding at baseline** — app: 381, node: 0. The
   `check-typecheck-baseline.sh` guard passes on the current tree.
4. **Bundle unchanged.** PWA precache 60 entries / 2265.65 KiB, identical
   to 2026-07-25 (#249 is an edge function; the emitted frontend bundle
   is unaffected).
5. **Test count grew 369 → 371** (+2 from #249; 46 test files). All green
   under `npm test`, including the two schema guards.
6. **Secret / client-exposure re-scan clean** — same posture as every
   prior audit (details below).

## Commands run

- `npm install`: pass. **10 vulnerabilities** (2 moderate, 8 high), all
  in the two deferred groups — unchanged from the 2026-07-25 post-fix
  state.
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged from
  2026-07-25.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0 errors
  (baseline 0). Ratchet matches — no regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.65
  KiB** — identical to 2026-07-25).
- `npm test`: pass (46 test files, **371 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all green.
- `npm audit`: **10 at entry, 10 after `npm audit fix --dry-run`** — the
  non-forced fix resolves neither remaining advisory (both need major
  bumps). No change applied.

## Review focus this run

### Retro-audit — PR #249 (first runtime diff in four windows)

[#249](https://github.com/akkkkkkki/prepio/pull/249) changes one function
in `query-planner.ts`: `extractUserNoteSignals`. Previously it only
recognised the **"`X` team"** word order (`teamMatch`); the change adds a
**"team `X`"** (team-first) form and, when both match, prefers whichever
appears **earliest** in the note:

```
const teamFirstMatch = normalized.match(
  /\b(?:team|group|org|department)\s+([A-Z][A-Za-z0-9&-]*(?:\s+[A-Z][A-Za-z0-9&-]*){0,2})\b/,
);
const teamName =
  teamFirstMatch?.[1] &&
  (teamMatch?.index === undefined ||
    (teamFirstMatch.index ?? Number.POSITIVE_INFINITY) < teamMatch.index)
    ? teamFirstMatch[1]
    : teamMatch?.[1];
```

Security / reliability assessment — **clean**:

- **No ReDoS.** Both regexes use bounded `{0,2}` repetition over
  non-overlapping character classes (`[A-Z][A-Za-z0-9&-]*` segments
  separated by mandatory `\s+`). There is no nested unbounded quantifier
  and no ambiguous alternation, so no catastrophic backtracking on
  adversarial input.
- **No new injection surface.** The extracted `teamName` flows into a
  `` `${teamName.trim()} team` `` signal that joins the existing
  `labels` / `targeted` arrays. As established in prior retro-audits
  (2026-07-01, 2026-07-15), these signals interpolate user-note text into
  **Tavily search queries only** — no SQL, shell, or model-prompt sink —
  and remain bounded to 3 × 40-char signals downstream.
- **No new logging of raw user content.** The diff adds no `console.*`;
  `userNote` is still never logged in raw form (entry logging remains the
  `hasUserNote: !!userNote` boolean pattern).
- **Test coverage lands with the fix.** The +29 test lines cover the
  team-first form and the mixed-form earliest-wins tie-break — the two
  behaviours the diff introduces.

Bundle, lint, and typecheck are all unaffected (edge-function-only diff).

### Dependency posture — stable, no action

`npm audit` did **not** move this window (10 → 10). Both remaining groups
are unchanged from 2026-07-25 and both need major bumps that fall outside
the hygiene-run "low-risk, tests-pass" allowance:

| Advisory group | Package | Severity | Prod runtime? | Fix | Disposition |
|----------------|---------|----------|---------------|-----|-------------|
| GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | react-router `6.0.0 – 7.17.0` | Moderate ×2 | **Yes** (routing) | v6 → v7 major only | **Deferred** (core journeys) |
| GHSA-mh99-v99m-4gvg | brace-expansion `<=5.0.7` (via `vite-plugin-pwa → workbox-build → … → filelist`) | High | No (build-time) | `vite-plugin-pwa` major (`--force`) | **Deferred** (build-time, needs force) |

The open-redirect exposure remains **low** and unchanged from the
detailed 2026-07-25 analysis: Prepio's two dynamic redirect targets are
[`Auth.tsx`](../../src/pages/Auth.tsx) (`redirectPath` derives from
in-memory `location.state.from`, not a URL param) and
[`BillingReturn.tsx`](../../src/pages/BillingReturn.tsx) (`fallbackHref`
**is** URL-controlled via `?returnTo=`, but `safeReturnTo` rejects the
`//` and `/\` prefixes — the advisory's exact backslash vector — before
it reaches `<Link>`). The SSR-hydration advisory does not apply to
Prepio's client-rendered SPA. Both stay deferred to the tracked v7
upgrade.

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-07-25.

- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.SUPABASE_SERVICE_ROLE_KEY`,
  `import.meta.env.OPENAI_API_KEY`, `import.meta.env.STRIPE_SECRET_KEY`,
  `import.meta.env.TAVILY_API_KEY` in `src/` returns nothing.
- **No tracked `.env` / `.env.local`.** `git ls-files` shows only
  `.env.example`, which contains placeholder values exclusively
  (`sk-proj-...`, `eyJ...`, `tvly-...`, `whsec_...`, `sb_publishable_...`)
  — no real secrets. Untracked scan (`git ls-files -o`, excluding the
  scratchpad) is clean. `.gitignore` still excludes `.env`, `.env.local`,
  `.env.*.local`, `*.key`, `secrets.json`.
- **No real-key patterns in tracked non-doc files.** A regex scan for
  live `sk-…`, JWT (`eyJ….…`), and `tvly-…` shapes across tracked source
  (excluding `*.md` / `docs/`) returns nothing.
- **Server logs still scrub user content.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)` touching
  `question_text|answer_text|transcript_text|user_note|userNote|user_input`
  returns zero hits — same clean pattern as every prior audit, and #249
  added none.

## Findings

### Critical

- None.

### High

- [ ] **`brace-expansion` build-time DoS (GHSA-mh99-v99m-4gvg) — needs a
  `vite-plugin-pwa` major bump; deferred (unchanged from 2026-07-25).**
  - Evidence: `npm audit` reports this High via
    `vite-plugin-pwa → workbox-build → @trickfilm400/rollup-plugin-off-main-thread
    → ejs → jake → filelist → minimatch → brace-expansion`. Range
    `<=5.0.7`. Non-forced `npm audit fix` leaves it unresolved (requires
    `--force`).
  - Risk: OOM-crash DoS in the build toolchain. **No runtime path** —
    triggered only during local build / PWA-manifest generation, with no
    attacker-controlled input. Low practical exploitability.
  - Recommended fix: `vite-plugin-pwa` major upgrade, verified against
    the PWA precache build. Not a hygiene-run change; tracked in Linear
    (see Deferred items).
  - Owner / next step: Product-owner-scoped dependency upgrade. Watch
    whether upstream `vite-plugin-pwa` / `workbox-build` ship a non-major
    fix that `npm audit fix` can take.

### Medium

- [ ] **`react-router` open-redirect + SSR advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x; deferred to a tracked v7 upgrade (unchanged from 2026-07-25).**
  - Evidence: `npm audit` reports both (moderate) against
    `react-router` / `react-router-dom` 6.30.4; range `6.0.0 – 7.17.0`
    with no 6.x fix. Only remediation is v6 → v7.
  - Risk: Open-redirect exposure is **low in Prepio** — both dynamic
    redirect targets have same-origin protection (`Auth.tsx` derives from
    `location.state.from`, not a URL param; `BillingReturn.tsx`'s
    URL-controlled `?returnTo=` is passed through `safeReturnTo`, which
    rejects the `//` and `/\` backslash prefixes). The SSR-hydration
    advisory does not apply (SPA, no SSR).
  - Recommended fix: react-router-dom v6 → v7 as focused, browser-tested
    work (auth + billing return navigation are the high-value regression
    scope). Out of hygiene scope.
  - Owner / next step: Recorded as a security escalation on the migration
    planner [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) on the
    2026-07-25 run. A dedicated issue still could not be filed — the
    Linear workspace remains at its free-issue cap.

### Low / clean-up

- [ ] **`Practice.mobile.test.tsx` CI flake — remains Low; not
  reproducing.**
  - Evidence: The `{ retry: 2 }` mitigation (PR #226) is still on the
    three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 371 tests passed cleanly this run — no flake observed.
  - Recommended fix: None from this audit. Trigger for a real
    investigation ticket remains: retries actually exhausting in CI.
- [ ] **Dependabot cadence vs. security advisories** — informational,
  recurring.
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml)
    runs `npm` monthly. The two standing advisories both need major bumps
    Dependabot won't auto-apply within the configured update strategy; no
    off-schedule security PR observed this window.
  - Recommended fix: None required — both deferred with tracking. Next
    reviewer: confirm GitHub Dependabot alerts reflect these dispositions;
    if security updates are not auto-opening PRs, check Settings → Code
    security that Dependabot security updates are enabled.
- [ ] **`lovable-tagger` keep-or-drop decision** — fourteenth audit
  waiting.
  - Evidence: [`vite.config.ts`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`; unused in production.
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.

## Small fixes made in this run

- **None.** The dependency posture was stable at 10 with no in-tree
  resolution available (a non-forced `npm audit fix` clears neither
  remaining advisory — verified via `--dry-run`, which only proposes
  adding optional cross-platform `@rollup/*`, `@swc/*`, and `fsevents`
  binaries to the lockfile, not any security bump). PR #249 was the only
  runtime change and it was already merged, correct, and tested; nothing
  to fix on retro-audit. This run is documentation-only.

Explicitly *not* touched this run:

- **The react-router v7 and vite-plugin-pwa major upgrades.** Both need
  migration-sized, browser-/build-tested work outside the low-risk
  lockfile allowance; deferred with Linear tracking.
- **The 381-error typecheck backlog** and the **39 react-hooks-7
  violations.** Coordinated cleanup passes, not hygiene-runner scope.

## Deferred items

Tracked in Linear (no free-form bullets to re-discover):

- **react-router / vite-plugin-pwa security-motivated major upgrades** —
  recorded on the 2026-07-25 run as a security escalation on
  [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98). A dedicated
  tracking issue still **cannot** be filed: the Linear workspace remains
  at its free-issue cap (documented since the 2026-07-23 UX routine and
  the 2026-07-25 hygiene run). No new deferred item surfaced this window,
  so no new intake was attempted.
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — Major
  dependency-migration planner (carries the Router 6 → 7 security
  motivation).
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Fourteenth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale bot-PR
  cleanup pass.
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild
  override test guard (PR #240). Product-owner merge call.

## Questions for product owner

- **Prioritise the react-router v7 upgrade?** It carries a published (if
  low-exposure) moderate advisory with no patched 6.x, so it will keep
  appearing in `npm audit` until v7 lands. Scope it into a cycle, or
  accept the standing moderate with the exposure note on record?
- **The Linear workspace free-issue cap is still blocking hygiene and UX
  intake.** Documented since 2026-07-23. No new ticket could be filed
  this run (none was needed — no new deferred item — but the block
  persists). Recommend either upgrading the Linear plan or a triage pass
  to close/archive `Done`/`Canceled` issues so intake unblocks. Until
  then, findings that need a ticket are recorded as comments on the
  nearest existing issue and documented in full here.
- **Is the `lovable-tagger` component tagger still in use?** Fourteenth
  run asking. One-line cleanup blocked on this.

## Next review focus

1. **Whether `npm audit` finds new build-time advisories or an upstream
   non-major fix.** The `vite-plugin-pwa → workbox-build` toolchain is a
   recurring advisory source (it surfaced the current `brace-expansion`
   High and both 2026-07-22 highs). Watch for an upstream release that
   `npm audit fix` can take without `--force`.
2. **Confirm the react-router / vite-plugin-pwa security items are
   triaged.** If the product owner schedules the Router v7 upgrade, it
   becomes a runtime PR to retro-audit next cycle.
3. **The next runtime PR after #249.** #249 broke the three-window quiet
   streak; the following non-docs PR is the next real exercise of the
   typecheck ratchet (381), lint baseline (54), and bundle guard
   (2265.65 KiB).
4. **Whether the Linear free-issue cap is resolved.** Still blocking both
   routines; confirm next run whether the workspace was upgraded or
   triaged.
</content>
</invoke>
