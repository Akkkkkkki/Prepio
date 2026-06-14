# Recurring hygiene review — 2026-06-13

## Summary

Sixth recurring codebase hygiene & security review for Prepio. The
focus this run was the carry-over list from 2026-06-10:
**`buildCorsHeaders` adoption**, **Dependabot landing**, and
**supply-chain hygiene for the codex auto-PR workflow**. Plus the
standard safety-net commands and a fresh `npm audit` snapshot.

Two headline items:

1. **`npm audit` severity has escalated since 2026-06-10.** What was 2
   moderate advisories on `esbuild` is now **2 high + 1 moderate**
   after two new advisories landed
   ([GHSA-gv7w-rqvm-qjhr](https://github.com/advisories/GHSA-gv7w-rqvm-qjhr)
   — missing binary integrity verification in the Deno module,
   enabling RCE via `NPM_CONFIG_REGISTRY`;
   [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
   — arbitrary file read when running the dev server on Windows).
   Impact remains **dev-only** (esbuild is in `vite` and `vitest`
   transitively; not shipped to production), and the documented fix
   path is unchanged: Vite 8 major bump. Promoting this from **Low**
   to **Medium** for this run because the severity jump strengthens
   the case to plan the Vite upgrade — not because production risk
   has changed.

2. **Dependabot is landing this run.** Fifth recurrence; four
   reviews of waiting on a cadence decision has cost us visibility
   into both last cycle's react-router CVE and this cycle's esbuild
   severity bump. Going with monthly + grouped updates as a sensible
   default the owner can tighten to weekly with a one-line edit. See
   *Small fixes made in this run*.

Carry-over items unchanged:

- `buildCorsHeaders` adoption is still at 4 of 11 (same six
  user-facing handlers as last review). No movement.
- `interview-question-generator` dead-code question is still open
  (sixth recurrence).
- Lint baseline is unchanged (7 errors, 10 warnings, all documented).
- Storage and RLS posture audit closed last review remains clean
  (spot-checked the storage policy files; no changes since).

No application code, no schema, no auth, and no product flow touched
in this run. Only configuration (Dependabot) and documentation (this
note) changes.

## Commands run

- `npm install`: pass (note: Playwright Chromium download fails in the
  startup-hook sandbox — does not affect vitest or the build; e2e is
  not part of the local safety net).
- `npm run lint`: 17 problems (7 errors, 10 warnings) — matches the
  documented baseline. No new failures.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 51 precache entries, ~2.17 MiB).
- `npm test`: pass (35 test files, 272 tests; +7 tests vs. 2026-06-10,
  no regressions). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: **3 vulnerabilities (2 high, 1 moderate)** — up from 2
  moderate at 2026-06-10. Both new advisories are on `esbuild` (see
  Summary). `fixAvailable: vite@8.0.16` is a breaking major.

## Findings

### Critical

None this run.

### High

None this run. (The two new `esbuild` advisories are severity-high
but the dev-only impact keeps the production risk low — see Medium.)

### Medium

- [x] **`npm audit` advisories on `esbuild` now include two
  severity-high entries** — promoted from Low (where it has lived
  since 2026-05-23)
  - Evidence: `npm audit` now reports
    [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
    (moderate, dev-server CORS bypass — was the only finding through
    2026-06-10), plus
    [GHSA-gv7w-rqvm-qjhr](https://github.com/advisories/GHSA-gv7w-rqvm-qjhr)
    (high, RCE in the Deno module via `NPM_CONFIG_REGISTRY`,
    `esbuild >=0.17.0 <0.28.1`) and
    [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
    (low, arbitrary file read on Windows dev servers). All three
    reach us through `vite` and `vitest` only — `esbuild` is not in
    the shipped bundle.
  - Risk: Medium. Production users are not affected because esbuild
    runs in `vite` dev-server / `vitest` only. But "dev-only" still
    covers any contributor / CI machine running `npm run dev` or
    `npm test`, and the RCE advisory's attack vector is a malicious
    `NPM_CONFIG_REGISTRY` env var — plausible on shared CI or
    misconfigured dev environments.
  - Recommended fix: Plan the Vite 8 upgrade **and address
    `lovable-tagger`'s nested `esbuild` pin in the same PR.**
    `npm audit fix --force` installs `vite@8.0.16` (SemVer-major
    bump — PWA plugin, `@vitejs/plugin-react-swc` config surface need
    checking), but it does **not** clear the high advisory on its
    own: `lovable-tagger@1.3.0` carries
    `node_modules/lovable-tagger/node_modules/esbuild@0.25.0` which
    is still inside the affected `>=0.17.0 <0.28.1` range
    (`package-lock.json:10202-10209,10607-10608`). Three options for
    closing that gap, in increasing-invasiveness order:
    1. Wait for an upstream `lovable-tagger` release that uses
       `esbuild >= 0.28.1`, then bump.
    2. Add an `overrides` entry in `package.json` forcing
       `esbuild >= 0.28.1` across the dep tree (cheapest; assumes no
       breaking API changes in esbuild between `0.25.0` and `0.28.1`
       that `lovable-tagger` relies on).
    3. Remove `lovable-tagger` from `vite.config.ts` and from
       devDependencies — it's a dev-only Lovable.dev component
       tagger, not load-bearing for the build.

    Not appropriate for this hygiene run because it touches the
    build pipeline and risks regressions in PWA precache generation.
    Best handled as a standalone PR with `npm run build && npm test
    && npm run dev` smoke-checked, and a fresh `npm audit` to confirm
    the high advisory is gone after the fix.
  - Owner / next step: Open a Linear `Chore` issue for "Vite 8
    upgrade — clear esbuild advisories" and schedule for the next
    cycle. Dependabot will surface the major bump as a draft PR once
    it runs (now landed this review — see Small fixes).

- [ ] **`buildCorsHeaders` helper still adopted by only 4 of 11 edge
  functions** — fifth recurrence (2026-05-30, 2026-06-03, 2026-06-06,
  2026-06-10, this review)
  - Evidence: `grep -L buildCorsHeaders supabase/functions/*/index.ts`
    returns the same set as last review:
    [`answer-feedback`](../../supabase/functions/answer-feedback/index.ts),
    [`create-checkout-session`](../../supabase/functions/create-checkout-session/index.ts),
    [`create-portal-session`](../../supabase/functions/create-portal-session/index.ts),
    [`cv-analysis`](../../supabase/functions/cv-analysis/index.ts),
    [`interview-research`](../../supabase/functions/interview-research/index.ts),
    [`practice-audio-transcribe`](../../supabase/functions/practice-audio-transcribe/index.ts),
    [`profile-import`](../../supabase/functions/profile-import/index.ts),
    plus [`stripe-webhook`](../../supabase/functions/stripe-webhook/index.ts)
    (which legitimately doesn't need CORS). Six user-facing handlers
    still hardcode `"Access-Control-Allow-Origin": "*"`. The Stripe
    billing endpoints (`create-checkout-session`,
    `create-portal-session`) sit at the top of the leverage list.
  - Risk: Medium. `authorizeRequest` enforces the auth check
    everywhere, but defence-in-depth still calls for a tightened CORS
    posture. No production incident has been linked to this finding.
  - Recommended fix: Unchanged across five reviews — one small PR
    replacing the hardcoded `corsHeaders` object with
    `buildCorsHeaders(req)` in the six remaining handlers. Helper
    falls back to `*` when `APP_ALLOWED_ORIGINS` is unset, so the
    change is operationally a no-op until the env var is configured.
  - Owner / next step: Five consecutive reviews with no movement.
    **Escalating per the 2026-06-10 plan: this should now be a
    dedicated PR rather than "bundle with the next touch."** Pair
    with documenting an `APP_ALLOWED_ORIGINS` value in the production
    secrets. Out of scope for this hygiene run (six function
    re-deploys is too broad for a maintenance pass).

- [ ] **Third-party action in codex auto-PR workflow is tag-pinned,
  not SHA-pinned** — new this review (focus carry-over from
  2026-06-10)
  - Evidence:
    [`.github/workflows/codex-prepio-linear-auto-pr.yml:222`](../../.github/workflows/codex-prepio-linear-auto-pr.yml)
    uses `openai/codex-action@v1`. The job has
    `permissions: contents: write, pull-requests: write, issues:
    write` and the env carries `OPENAI_API_KEY` and `LINEAR_API_KEY`.
    A force-moved `v1` tag (whether by upstream mistake or upstream
    compromise) would execute arbitrary code with those credentials
    and write permissions.
  - Risk: Medium. Per OpenSSF Scorecard guidance and
    [GitHub's hardening guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions),
    third-party actions should be pinned to a full-length commit SHA.
    The first-party `actions/*` references in both workflows
    (`actions/checkout@v4`/`@v5`, `actions/setup-node@v4`,
    `actions/upload-artifact@v4`) also use tag refs but rely on
    GitHub's stewardship of those tags — lower risk than the
    third-party `openai/codex-action`.
  - Recommended fix: Pin `openai/codex-action` to the commit SHA that
    `v1` currently points to and add a `# v1` trailing comment. Verify
    upstream release notes for the right SHA before pinning. Pinning
    the first-party `actions/*` is a follow-up nice-to-have but lower
    priority. Dependabot's `github-actions` ecosystem will now open
    bump PRs as new SHAs are tagged (added this run — see Small
    fixes).
  - Owner / next step: Open a small PR pinning the third-party action
    only; don't bundle the first-party ones because they need release
    coordination. Out of scope for this hygiene run because it
    requires fetching and verifying the right upstream SHA.

- [x] **No Dependabot / scheduled dependency update mechanism** —
  FIXED this run (fifth recurrence: 2026-05-30, 2026-06-03,
  2026-06-06, 2026-06-10, this review)
  - Evidence (before): `.github/` had only `PULL_REQUEST_TEMPLATE.md`,
    `codex/`, and `workflows/`. No `dependabot.yml`.
  - Risk: Dependency drift was going unnoticed between recurring
    reviews. The last two reviews each surfaced a concrete cost:
    2026-06-06's react-router open-redirect (GHSA-2j2x-hqr9-3h42) and
    this review's two new high-severity esbuild advisories — both
    Dependabot-detectable.
  - Fix: Added [`.github/dependabot.yml`](../../.github/dependabot.yml)
    covering both `npm` and `github-actions` ecosystems. Configuration
    notes:
    - **Monthly cadence.** Trades responsiveness for PR noise. The
      cadence question has been open across four reviews; rather than
      block on it for a sixth, going with a sensible default the
      owner can tighten to weekly with a one-line edit. Security
      advisories ignore this schedule and open immediately when
      GitHub detects them.
    - **Grouped updates** for `@radix-ui/*`, React, `@tanstack/*`,
      ESLint stack, and the testing stack. Keeps Radix's frequent
      simultaneous bumps from creating a torrent of single-package
      PRs.
    - **5 open PR limit** per ecosystem so a paused review doesn't
      leave 20 stale Dependabot PRs sitting around.
    - **Conventional commit prefixes** (`chore(deps)`,
      `chore(dev-deps)`, `chore(actions)`) matching the repo's
      existing commit style.
  - Verified: file passes basic YAML parse; matches the
    [Dependabot config schema](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file).
    No installed dependencies, schema changes, or runtime behaviour
    affected.

### Low / clean-up

- [ ] **`supabase/functions/interview-question-generator/` is still
  uncalled by any in-repo caller** — sixth recurrence (2025-05-27,
  2026-05-23, 2026-05-30, 2026-06-03, 2026-06-06, 2026-06-10, this
  review)
  - Evidence: `grep -rn interview-question-generator
    supabase/functions/ src/ scripts/` still returns no matches
    outside the function's own directory and the Deno test files.
    565 lines maintained for no observed caller. Auth-gated since
    #107.
  - Recommended fix: Same as the last five reviews — confirm with the
    product owner that no external integration calls it; if not,
    `supabase functions delete interview-question-generator` +
    `git rm -r supabase/functions/interview-question-generator`. If
    yes, document the external caller in `docs/ARCHITECTURE.md` so
    future reviews stop flagging it.
  - Owner / next step: Sixth recurrence — overdue for an explicit
    decision. See *Questions for product owner*.

- [ ] **Lint baseline still has 7 errors** — informational
  - Evidence: 2 `@typescript-eslint/no-empty-object-type`
    ([`command.tsx:24`](../../src/components/ui/command.tsx),
    [`textarea.tsx:5`](../../src/components/ui/textarea.tsx)), 1
    `@typescript-eslint/no-require-imports` (intentional,
    [`tailwind.config.ts:110`](../../tailwind.config.ts)), 4
    `@typescript-eslint/no-explicit-any` (3 in legacy Deno tests, 1
    in [`Auth.tsx`](../../src/pages/Auth.tsx)). Baseline unchanged
    across the last five reviews.
  - Recommended fix: Unchanged — the two `no-empty-object-type` are
    shadcn-style boilerplate; the Deno `any`s can wait until that
    suite is rewritten. CI's `--exit-on-fatal-error` guard added in
    #124 still works correctly.

- [ ] **First-party `actions/*` references in both workflows are
  tag-pinned, not SHA-pinned** — informational
  - Evidence: `actions/checkout@v4`/`@v5`, `actions/setup-node@v4`,
    `actions/upload-artifact@v4` across both CI workflows.
  - Risk: Low. First-party `actions/*` are stewarded by GitHub
    itself; the supply-chain attack surface is materially smaller
    than for `openai/codex-action`. OpenSSF Scorecard still
    recommends SHA pins for full hygiene, but the cost / benefit
    skews differently here.
  - Recommended fix: Pin alongside the `openai/codex-action` change
    (see the Medium finding above), or accept the residual risk
    explicitly. Dependabot (added this run) will now propose bumps
    automatically.

## Small fixes made in this run

1. **`.github/dependabot.yml`** — added Dependabot configuration for
   both `npm` and `github-actions` ecosystems with monthly cadence,
   grouped updates, and conventional commit prefixes. See *Findings →
   Medium → No Dependabot* for the full rationale and config notes.
   Net `+74` lines (new file). No installed dependencies, schema, or
   runtime behaviour affected.

Verified after the edit: `npm run typecheck`, `npm run build`, and
`npm test` (272 tests) all stay green. `dependabot.yml` is config-only
and doesn't enter the dev / build / test pipeline.

No application code, no schema, no auth, no product flow touched in
this run. Lint and audit numbers are unchanged by the edit (the audit
severity jump is a fresh upstream advisory landing, not a regression
introduced here).

## Deferred items

All deferred items are now tracked in Linear under the **Quality &
Maintenance** project so they don't have to be re-discovered next
review:

- **[PREPIO-84](https://linear.app/qiuyue/issue/PREPIO-84)** — Vite 8
  upgrade to clear the two new high-severity `esbuild` advisories.
  Best done as a standalone PR with smoke testing of `npm run dev`,
  `npm run build`, and the PWA precache generation.
- **[PREPIO-85](https://linear.app/qiuyue/issue/PREPIO-85)** — Pin
  `openai/codex-action` to a commit SHA in
  `.github/workflows/codex-prepio-linear-auto-pr.yml`. Needs verified
  upstream SHA. Bundle the first-party `actions/*` SHA pins into this
  issue's secondary scope.
- **[PREPIO-86](https://linear.app/qiuyue/issue/PREPIO-86)** — Adopt
  `buildCorsHeaders` in the remaining six user-facing edge functions
  (now overdue for a dedicated PR per the 2026-06-10 escalation
  plan). Pair with documenting `APP_ALLOWED_ORIGINS` in the
  production secrets.
- **[PREPIO-87](https://linear.app/qiuyue/issue/PREPIO-87)** — Decide
  on `interview-question-generator`: delete it (no caller observed)
  or document the external caller in `docs/ARCHITECTURE.md`. Sixth
  recurrence; either outcome is fine, the cost is the indecision.

## Questions for product owner

- **Does anything external call
  `supabase/functions/interview-question-generator/`?** Sixth
  recurrence. If "no", delete the function. If "yes", document the
  external caller in `docs/ARCHITECTURE.md` so future reviews stop
  flagging it. Owner answer unblocks a small clean-up PR.
- **Dependabot cadence — is monthly the right default?** Now live
  with monthly cadence + grouped updates per
  [`.github/dependabot.yml`](../../.github/dependabot.yml). One-line
  edits switch any group to `weekly`. Confirm or tighten in the next
  review.
- **OK to plan the Vite 8 upgrade for the next cycle?** Two new
  high-severity `esbuild` advisories landed since 2026-06-10. Impact
  is dev-only but the fix is a major bump — wants explicit owner
  signoff before the work goes in flight.

## Next review focus

1. **First Dependabot wave triage.** Dependabot starts running
   monthly on the first Monday after this lands. Review the initial
   batch of bumps: which are safe-to-merge, which need test coverage
   first, which are deferred.
2. **`openai/codex-action` SHA pin landing.** Track whether the
   focused PR for the third-party action pin lands; if not, escalate
   beyond "deferred."
3. **Plan the Vite 8 upgrade.** Scope the work, list the breaking-change
   surface area (PWA plugin, lovable-tagger, plugin-react-swc config),
   and identify the smoke tests that need to pass.
