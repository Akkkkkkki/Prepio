# Recurring hygiene review — 2026-07-22

## Summary

Seventeenth recurring codebase hygiene & security review for Prepio.

Two commits merged to `main` in the four days since 2026-07-18, both
docs-only:

- **Docs**
  - [#246](https://github.com/akkkkkkki/prepio/pull/246) — 2026-07-19
    UX review routine run #8 (472-line doc + 23 screenshots). Docs +
    assets only, no runtime touch.
  - [#245](https://github.com/akkkkkkki/prepio/pull/245) — the
    2026-07-18 recurring hygiene review note. Docs-only.

**Zero runtime PRs merged this window** — the second consecutive
window with no product-source diff (`src/*`, `supabase/functions/*`,
migrations, or config). Consequently there is no runtime retro-audit
this run.

The one material change this run is a **hygiene dependency fix made
in-tree** (see Small fixes): `npm audit` broke its twelve-consecutive
clean streak with **2 new High advisories** (both dev/build-time
transitive deps), which this run resolved with a lockfile-only
`npm audit fix` and re-verified green.

Headline status:

1. **`npm audit` regressed to 2 High, then fixed to 0 in this run.**
   Two newly-surfaced advisories, both transitive and both
   **dev/build-time only** (not in the production runtime bundle):
   - `brace-expansion` 2.1.1 — DoS via exponential-time expansion of
     consecutive non-expanding `{}` groups
     ([GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp)).
     Reached only through `vite-plugin-pwa → workbox-build → ejs →
     jake → filelist → minimatch@5 → brace-expansion@2.1.1`.
   - `fast-uri` 3.1.2 — host confusion via literal backslash authority
     delimiter and via failed IDN canonicalization
     ([GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx),
     [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6)).
     Reached only through `vite-plugin-pwa → workbox-build → ajv →
     fast-uri@3.1.2`.

   Both had non-breaking fixes (`npm audit fix`, no `--force`). Applied
   this run — lockfile-only, `package.json` untouched, two transitive
   patch bumps (`brace-expansion 2.1.1 → 2.1.2`,
   `fast-uri 3.1.2 → 3.1.4`). `npm audit` now returns **0
   vulnerabilities**; all 369 tests still pass. See Small fixes.
2. **Lint baseline unchanged at 54 problems (46 errors, 8 warnings).**
   No net drift since no product source changed this window (same 39
   react-hooks-7 rule violations + the standing 15-problem baseline).
3. **Typecheck ratchet holding at baseline** — app: 381, node: 0.
   Nothing new tested it this window (no product-code diff); the
   baseline check itself still passes on the current tree.
4. **Bundle unchanged.** PWA precache 60 entries / 2265.65 KiB today,
   identical to 2026-07-18 (source and edge functions unchanged; the
   dependency fix touched only dev/build-time transitives, so the
   emitted bundle is byte-identical).
5. **Test count unchanged at 369** (46 test files). All green under
   `npm test` with the dependency fix applied — no
   `Practice.mobile.test.tsx` flake observed on this run.
6. **Bot-PR pile 21 → 23 (+2 net).** Composition today: 21
   github-actions + 2 cursor = 23. One new **human** PR opened this
   window ([#249](https://github.com/akkkkkkki/prepio/pull/249) — "Fix
   team-first research note signals"), not yet merged, so not part of
   this window's retro-audit.
7. **Dependabot is configured but did not pre-empt this advisory
   pair.** [`.github/dependabot.yml`](../../.github/dependabot.yml)
   runs `npm` on a **monthly** cadence; security advisories are
   supposed to open PRs off-schedule as soon as GitHub detects them,
   but no Dependabot security PR for `brace-expansion` / `fast-uri`
   appears in the open-PR list. These are deeply nested transitive
   dev deps, which Dependabot security updates sometimes surface
   slowly. Since the fix is now applied in-tree, no action needed —
   noted under Low for the next reviewer to confirm the alert clears.

## Commands run

- `npm install`: pass. **2 High vulnerabilities at entry** (see
  finding), **0 after the in-run `npm audit fix`.**
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged
  from 2026-07-18.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0
  errors (baseline 0). Ratchet matches — no regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.65
  KiB** — identical to 2026-07-18).
- `npm test`: pass (46 test files, **369 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green, run *after* the dependency fix. No `Practice.mobile.test.tsx`
  flake observed.
- `npm audit`: **2 High at entry → 0 after `npm audit fix`.** Breaks
  the twelve-consecutive-clean streak; resolved in-run.
- `npm outdated`: 54 lines of packages with a newer version available
  (unchanged major-upgrade drift; none map to an unresolved security
  advisory after the fix).

Dependency tree post-fix: 248 prod / 554 dev / 78 optional / 8 peer
(prod count unchanged — the two bumps are dev/build-time transitives).

## Review focus this run

### Dependency advisory regression (the one substantive change)

`npm audit` surfaced two High advisories this window — the first
non-clean audit since 2026-06-13 (which the 2026-06-17 run cleared).
Both are transitive and confined to the dev/build toolchain:

| Advisory | Package | Path | Prod runtime? |
|----------|---------|------|---------------|
| GHSA-3jxr-9vmj-r5cp | brace-expansion 2.1.1 | vite-plugin-pwa → workbox-build → ejs → jake → filelist → minimatch@5 → brace-expansion | No (build-time) |
| GHSA-v2hh-gcrm-f6hx, GHSA-4c8g-83qw-93j6 | fast-uri 3.1.2 | vite-plugin-pwa → workbox-build → ajv → fast-uri | No (build-time) |

Practical exploitability is low — neither the `brace-expansion` DoS
nor the `fast-uri` host-confusion sits on a path that processes
attacker-controlled input at runtime; they run only during the local
build / PWA-manifest generation. But both are High-severity with a
non-breaking fix available, so leaving them is not the hygiene-run
posture. `npm audit fix` (no `--force`) bumped only the two transitive
packages within their semver-compatible ranges, changed nothing in
`package.json`, and the full test suite passed afterward — squarely
inside the "update dependencies when the risk is low and tests pass"
allowance. Applied.

(Note: the `eslint@10 → minimatch@10 → brace-expansion@5.0.7` path was
**not** vulnerable — the advisory range is `2.0.0 – 2.1.1`, and 5.0.7
is outside it. Only the workbox-build `brace-expansion@2.1.1` was in
range.)

### No runtime diff to retro-audit

For the second consecutive window, the entire merge window carries no
product-source changes. The two merged PRs (#245, #246) are both
docs-only. There is no `supabase/functions/*` diff, no `src/*` diff,
no migration, no config touch. No retro-audit for this run.

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-07-18.

- **`.env.example`** contains only placeholders. Line 23's
  `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  is the standard truncated JWT-header placeholder
  (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` decodes to
  `{"alg":"HS256","typ":"JWT"}`) with a `...` tail — not real key
  material. Same posture as every prior audit.
- **`.gitignore`** excludes `.env`, `.env.local`, `.env.*.local`,
  `*.key`, `secrets.json`. Untracked scan (`git ls-files -o
  --exclude-standard`) is empty. No `.env` / `.env.local` is tracked.
- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.SUPABASE_SERVICE_ROLE_KEY`,
  `import.meta.env.OPENAI_API_KEY`, `import.meta.env.STRIPE_SECRET_KEY`,
  `import.meta.env.TAVILY_API_KEY` in `src/` returns nothing.
- **Server logs still scrub user content.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)`
  touching `question_text|answer_text|transcript_text|userNote|user_note|user_input`
  returns zero hits — same clean pattern as every prior audit.

## Findings

### Critical

- None.

### High

- None open at end of run. The two dependency advisories that opened
  this window at High were **fixed in-run** (see Small fixes) — noted
  here for the audit trail:
  - [x] **`brace-expansion` 2.1.1 DoS (GHSA-3jxr-9vmj-r5cp) and
    `fast-uri` 3.1.2 host confusion (GHSA-v2hh-gcrm-f6hx,
    GHSA-4c8g-83qw-93j6) — both dev/build-time transitive.**
    - Evidence: `npm audit` reported 2 High at install; dependency
      paths trace to `vite-plugin-pwa → workbox-build` (both) with no
      production-runtime path.
    - Risk: DoS / host-confusion in the build toolchain. Low practical
      exploitability (no attacker-controlled input at build time), but
      High-severity advisories with fixes available.
    - Recommended fix: `npm audit fix` (non-breaking, lockfile-only).
      **Done this run** — `brace-expansion 2.1.1 → 2.1.2`,
      `fast-uri 3.1.2 → 3.1.4`; `npm audit` now 0; tests green.
    - Owner / next step: Merged via this run's PR. Next reviewer:
      confirm the GitHub Dependabot alert auto-closes.

### Medium

- None open. (The standing `Practice.mobile.test.tsx` CI-flake item
  is downgraded this run — see Low — following the plan the 2026-07-18
  audit stated for the case where the follow-up-ownership question
  went unanswered another window.)

### Low / clean-up

- [ ] **`Practice.mobile.test.tsx` CI flake — downgraded from Medium
  to Low; ticket-filing prescription dropped as pre-announced.**
  - Evidence: The `{ retry: 2 }` mitigation added in PR #226 remains
    on the three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 369 tests passed cleanly this run — no flake observed, no
    retries visibly consumed. The 2026-07-18 audit stated: "if
    unresolved by the next audit, the flake ticket recommendation
    will be dropped from the Medium section." No product-owner answer
    on follow-up ownership arrived in this window, so per that plan
    the prescription is dropped here rather than re-issued a fifth
    time. The retry mitigation is holding; the underlying CI-resource
    race is not currently reproducing.
  - Recommended fix: None from this audit. If the flake resurfaces in
    CI (retries exhausted), that is the trigger to open a real
    investigation ticket. The follow-up-ownership process question
    remains open under Questions.
- [ ] **Dependabot did not pre-empt the `brace-expansion` / `fast-uri`
  advisory pair** — informational.
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml)
    is present (npm ecosystem, monthly cadence). Security advisories
    are meant to open PRs off-schedule, but no security PR for either
    package appears in the 25 open PRs. Both are deeply nested
    transitive dev deps.
  - Recommended fix: None required — the fix is applied in-tree this
    run. Next reviewer: confirm the corresponding GitHub Dependabot
    alerts clear after this PR merges; if they linger, check whether
    Dependabot security updates are enabled for the repo (Settings →
    Code security).
- [ ] **Bot-PR pile 21 → 23 (+2 net) —
  [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) scope
  updated to 23 PRs** — informational.
  - Evidence: Composition today: 21 github-actions + 2 cursor = 23.
    Plus 2 human PRs (#215 mockup adoption, #249 team-first research
    note signals). The github-actions PRs remain Linear auto-scaffold
    PRs largely untouched since their open date.
  - Recommended fix: [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110)
    scope updated to **23**. Auto-close-after-30-days question still
    open for the product owner (eighth audit asking).
- [ ] **`lovable-tagger` keep-or-drop decision** — twelfth audit
  waiting.
  - Evidence: [`vite.config.ts:33`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`; the package is
    unused in production.
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.
- [ ] **PR [#240](https://github.com/akkkkkkki/prepio/pull/240) test
  guard for the esbuild override — safe-to-merge** — informational,
  unchanged.
  - Evidence: The advisory GHSA-67mh-4wv8-2f99 remains mitigated by
    the [`overrides.esbuild = "^0.28.1"`](../../package.json) block
    from PR #152. PR #240 only adds a Vitest lockfile guard.
  - Recommended fix: Product owner review — reasonable defense-in-depth
    but not urgent. If merged, close PREPIO-62.
- [ ] **Typecheck backlog 381 → 381 — nothing tested it this window**
  — informational.
  - Evidence: No product source changed, so the ratchet had no PR to
    enforce against. Baseline check on the current tree still passes.
  - Recommended fix: None from this audit. The `tsconfig.test.json`
    cleanup question (open since 2026-07-08) still stands.

## Small fixes made in this run

- **`npm audit fix` — resolved 2 High dependency advisories
  (lockfile-only).** Bumped two dev/build-time transitive packages to
  their patched versions:
  - `brace-expansion 2.1.1 → 2.1.2` (GHSA-3jxr-9vmj-r5cp)
  - `fast-uri 3.1.2 → 3.1.4` (GHSA-v2hh-gcrm-f6hx, GHSA-4c8g-83qw-93j6)

  Only `package-lock.json` changed (`package.json` untouched). Verified
  `npm audit` → 0 vulnerabilities, `npm run build` unchanged (2265.65
  KiB), and `npm test` → 369/369 green after the change. Committed on
  this run's branch.

Explicitly *not* touched this run:

- **The 381-error typecheck backlog.** Same reasoning as prior audits
  — draining it is a coordinated cleanup pass, not a hygiene-runner
  scope. Waiting on the `tsconfig.test.json` product-owner answer.
- **Any of the 39 react-hooks-7 rule violations.** Follow-on chore,
  not a hygiene run.
- **Bot / human PR merges (#240, #243, #244, #249, #215).**
  Product-owner-call merges, outside recurring-hygiene scope.

## Deferred items

Tracked in Linear (no free-form bullets to re-discover):

- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Twelfth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **23** PRs (21 github-actions
  + 2 cursor).
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild
  override test guard (PR #240). Product-owner merge call.

The `Practice.mobile.test.tsx` CI-flake item is **no longer being
prescribed as a Linear ticket** — see the Low finding and the
follow-up-ownership question below. It is not currently reproducing.

## Questions for product owner

- **Who owns filing audit-recommended Linear tickets?** Unchanged and
  still unanswered — carried from 2026-07-18. The 2026-07-18 audit
  said that if this went unanswered another window, the
  `Practice.mobile.test.tsx` flake prescription would be dropped from
  the Medium section; that has now happened (downgraded to Low, no new
  ticket prescribed). The broader process question stands: recurring
  reviews keep producing recommendations that fall through with no
  owner. Options remain (a) hygiene runner gets scoped Linear write
  access to file into a triage state, (b) maintainer accepts an SLA to
  file audit-prescribed tickets, or (c) audits stop prescribing
  tickets and only flag findings.
- **Stale bot-PR cleanup (PREPIO-110)** — accept a one-time triage
  pass, or add an Action that auto-closes bot-authored PRs older than
  30 days with no human commits? Eighth run asking. Pile now 23.
- **Is the `lovable-tagger` component tagger still in use?** Twelfth
  run asking. One-line cleanup blocked on this.
- **Should the typecheck backlog be drained with a
  `tsconfig.test.json` split** (moves ~85% of the errors out of
  scope), or is a bulk `ts-expect-error` sweep of the product-code
  errors acceptable first? Fifth run asking.

## Next review focus

1. **Confirm the GitHub Dependabot alerts for `brace-expansion` /
   `fast-uri` clear after this run's fix merges.** If they linger,
   verify Dependabot security updates are enabled at the repo level.
2. **Whether `npm audit` stays clean.** The streak broke this window
   from newly-published transitive advisories; watch whether the
   `vite-plugin-pwa → workbox-build` toolchain keeps surfacing new
   ones (it is the common ancestor of both this run's advisories).
3. **First runtime PR after two quiet windows.** #249 (team-first
   research note signals) is the first non-docs PR queued; when it
   merges it is the next real exercise of the typecheck ratchet, lint
   baseline, and bundle guard, all sitting at 2026-07-18 values.
4. **Whether any bot PR gets merged / PREPIO-110 moves.** Pile is now
   23 and adding ~1/week; the auto-close proposal grows more relevant
   each quiet window.
5. **Whether the `Practice.mobile.test.tsx` flake actually reproduces
   in CI.** Now downgraded to Low; if CI logs show retries being
   consumed, that is the trigger to re-escalate.
