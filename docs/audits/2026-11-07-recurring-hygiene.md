# Recurring hygiene review — 2026-11-07

## Summary

Recurring codebase hygiene & security review for Prepio, run while the
invite-only **freeze release** (see [`docs/FREEZE_RELEASE.md`](../FREEZE_RELEASE.md))
is in force.

**Baseline note — the audit trail in `main` is stale.** This branch was cut from
`main` at `a330939`, whose newest tracked hygiene note is the **2026-09-12** review
(#346). Reviews have in fact continued on roughly a 3–4 day cadence since then, but
every one of those notes is sitting on an **open, unmerged doc PR** (see the Medium
finding below), so `main` — and therefore this run's starting context — skips from
2026-09-12 straight to today. To avoid duplicating or contradicting the in-flight
runs, this note reviews the **source** that has actually landed on `main` since the
last *merged* note (`f9b0454..a330939`, 15 commits, 6 touching product source) and
records the process backlog itself as the headline finding.

The dominant change on `main` in this window is the **freeze lockdown** (#354, #360,
#363) plus two security-advisory dependency majors (#350 `pdfjs-dist` 5→6, #353
`react-router-dom` 6→7) and the `interview-research` ownership guard (#337). All
source-touching merges were read, not just their commit messages. They are
security-neutral-to-positive; **no new critical or high code finding was introduced.**
The notable items this run are process/supply-chain hygiene, not product-code defects.

## Commands run

- `npm install`: **pass** (session bootstrap; 747 packages, 26 advisories — all in
  dev/build tooling, see Findings)
- `npm run lint`: **pass with pre-existing errors** (40 errors / 9 warnings, exit 0 —
  lint is informational in CI and these are the documented pre-existing failures, not
  new; confirmed none originate in this window's merges)
- `npm run typecheck`: **pass** (app `tsconfig.app.json` 61 errors ≤ baseline 62;
  node `tsconfig.node.json` 0 — ratchet intact)
- `npm run build`: **pass** (Vite build + PWA precache, 6.4s; the >550 kB
  `index` chunk warning is pre-existing and advisory only)
- `npm test`: **pass** (Vitest `494 passed / 58 files`, up from 427/49 at the
  CLAUDE.md baseline; legacy-schema, answer-feedback-schema, and design-token guards
  all green)
- `npm run test:e2e` (Playwright landing smoke): **not run** — the session bootstrap
  could not download the Chromium build from the Playwright CDN (network policy), so
  the blocking e2e gate was not exercised locally. It runs in CI.
- `npm run typecheck:functions` (deno check): **not run** — needs egress; runs in CI.

## Findings

### Critical

None.

### High

None in product code.

The highest-severity npm-audit entry is `brace-expansion` (DoS, GHSA-q2hr-2g5m-vwhr
et al.). It is **build/dev-time only** and does not ship, so its effective severity
to Prepio is Low — see the Medium/Low dependency finding rather than treating it as a
deployable High.

### Medium

- [ ] **Recurring-review doc PRs are not being merged — the audit trail in `main`
  has not advanced since 2026-09-12.**
  - Evidence: `git ls-files docs/audits/ | grep hygiene` ends at
    `2026-09-12-recurring-hygiene.md`, yet open PRs exist for later runs:
    hygiene #374 (10-14), #379 (10-17), #381 (10-21), #383 (10-24), #384 (10-28),
    #388 (10-31), #390 (11-04); plus UX-routine doc PRs #376, #380, #386, #391. That
    is ~11 open, unmerged audit-doc PRs.
  - Risk: the whole point of the recurring loop is to leave a dated trail future
    maintainers can read. Because the notes never land on `main`, each new run (this
    one included) starts from a context that is ~8 weeks stale, re-derives the same
    findings, and cannot see what the previous run concluded or deferred — directly
    wasting the loop's value and risking contradictory or duplicated conclusions.
  - Recommended fix: owner merges (or closes with a reason) the backlog of audit-doc
    PRs, ideally oldest-first, so `main` carries a continuous trail again. These are
    docs-only changes with green-or-trivial CI; they are safe to land even under the
    freeze (the freeze pauses *features and dependency version bumps*, not the audit
    record).
  - Owner / next step: **@Akkkkkkki** — triage the open `docs(audits): …` PRs.

- [ ] **Dev/build-time dependency advisories accumulating while Dependabot version
  updates are paused for the freeze.**
  - Evidence: `npm audit` reports 26 advisories (3 low / 18 moderate / 5 high) across
    `@vitest/mocker`, `vitest`, `brace-expansion`, `minimatch`, `glob`, `fast-uri`,
    and `deepmerge`→`workbox-build`/`@rollup/plugin-node-resolve`. `npm audit
    --omit=dev` reports **none** — every flagged package is test-runner, linter, or
    build-tool tooling, not in the browser bundle or the edge runtime.
    `.github/dependabot.yml` sets `open-pull-requests-limit: 0` (version updates
    paused for the freeze; security updates remain enabled per GitHub's documented
    behaviour). PR **#389 "[codex] refresh dependency lock security patches"** is open
    and already targets the lockfile patches (`npm audit fix`, non-breaking:
    `@vitest/mocker`/`vitest`→4.1.11, `brace-expansion`, `fast-uri`).
  - Risk: low in production terms (no shipped exposure), but a growing moderate/high
    backlog degrades signal and the DoS advisories do affect local/CI runtime of the
    build and test tooling.
  - Recommended fix: land the non-breaking lockfile patches via the already-open
    **#389** (verify `npm test` + `npm run build` stay green), rather than hand-rolling
    a parallel dependency PR in this hygiene run — the freeze explicitly discourages
    routine dependency PRs. Leave the `vite-plugin-pwa` / `eslint` *major* bumps
    (the `--force` ones) to Dependabot + human validation after the freeze.
  - Owner / next step: **@Akkkkkkki** — review & merge #389; let Dependabot carry the
    majors.

### Low / clean-up

- [ ] **~100 stale branches on the remote.**
  - Evidence: `list_branches` returns ~100 refs, including long-dead feature branches
    (`Akkkkkkki/fix-cv-upload`, `Akkkkkkki/mobile-ui-plan`, `Akkkkkkki/supabase-audit`,
    …) and dozens of merged `claude/*` run branches whose PRs are closed.
  - Recommended fix: prune branches whose PRs are merged/closed (OpenSSF-Scorecard
    "clean repo" hygiene). Low-risk, owner-attended; a one-time sweep plus enabling
    GitHub's "automatically delete head branches" on merge keeps it from recurring.

- [ ] **`pdfjs-dist` 5→6 removed the `isEvalSupported: false` hardening — verified
  this is correct, not a regression.**
  - Evidence: [`src/lib/resumeUpload.ts:114`](../../src/lib/resumeUpload.ts) dropped the
    explicit `isEvalSupported: false` option in #350. The option is **entirely absent**
    from the installed `pdfjs-dist@6.3.289` (0 references in the whole package), so
    passing it in v6 would have been a no-op. The call site still only extracts text
    (no `page.render`, scripting off by default), keeping the untrusted-PDF surface
    small. Resume upload is also gated off by `FROZEN_PRODUCT.resumeUpload = false`
    under the freeze, so the parser is not reachable from the shipped UI at all.
  - Recommended fix: none — recorded so a future reader does not mistake the removed
    line for a lost defence.

- [ ] **Local e2e / deno typecheck gates could not run in this environment.**
  - Evidence: Playwright Chromium download was blocked by the network policy at
    bootstrap; `typecheck:functions` needs egress.
  - Recommended fix: none (CI covers both). Noted so the "Commands run" section is
    honest about what was and wasn't exercised locally.

## Small fixes made in this run

None. The product code is clean, all blocking gates are green, and the actionable
items are owner-process actions (merge the audit-doc backlog, merge #389, prune
branches) that the freeze and the repo's Dependabot-driven convention say should not
be hand-rolled into a hygiene PR. This run is deliberately **review-note-only** — a
valid outcome consistent with prior code-level-only runs.

## Deferred items

- **Merge the open audit-doc PR backlog** (#374, #379, #381, #383, #384, #388, #390,
  and UX #376/#380/#386/#391) so `main`'s trail is continuous again. Owner action.
- **Merge #389** (non-breaking lockfile security patches) after confirming green CI;
  leave `vite-plugin-pwa`/`eslint` majors to Dependabot. Owner action.
- **Prune stale branches** + enable auto-delete-on-merge. Owner action.
- **PREPIO-184 `official_company` registrable-label trust fix** (open as PR #375) and
  **PREPIO-144 job-row classification** — the two research-pipeline trust Mediums
  carried from the 2026-09-12 note are now in flight as their own PRs; verify they
  land rather than re-filing.
- **Linear issue filing** for the above was *not* done this run: prior runs recorded a
  Linear free-issue cap, and the freeze discourages process churn. The items are
  owner-facing and already tracked as PRs/this note; file against Quality &
  Maintenance if/when the cap clears and the freeze lifts.

## Questions for product owner

- **Are GitHub "Dependabot security updates" and "Secret scanning" toggled on at the
  repo level?** The `security_and_analysis` block and the `dependabot/alerts` API were
  not readable with this session's token, so I could confirm `dependabot.yml` keeps
  security updates enabled, but not that the repo-level alert/secret-scanning features
  are actually on. If they are off, `open-pull-requests-limit: 0` means *no*
  dependency security PRs will open during the freeze. (Blocks a safe assumption about
  advisory coverage; everything else was inferable from the code.)

## Next review focus

1. **Once the audit-doc backlog merges**, re-cut from a `main` that carries the
   continuous trail and reconcile this note's findings against the 2026-10-14→11-04
   runs so the record is deduplicated.
2. **Verify #389 landed** and `npm audit --omit=dev` stays clean; re-check the
   dev-tooling advisory count trend.
3. **Freeze-exit review**: when the freeze lifts, re-audit the surfaces it gated off
   (`resumeUpload`, `billing`, `answerFeedback`, `profile`, `voice`) for the moment
   they become reachable again — the parsers and endpoints are still in the tree and
   should get a fresh authz/untrusted-input pass before re-enabling.
