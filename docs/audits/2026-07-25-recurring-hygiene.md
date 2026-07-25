# Recurring hygiene review — 2026-07-25

## Summary

Eighteenth recurring codebase hygiene & security review for Prepio.

One commit merged to `main` in the two days since 2026-07-23, docs-only:

- **Docs**
  - [#251](https://github.com/akkkkkkki/prepio/pull/251) — 2026-07-23
    UX review routine run #9 (246-line doc + 13 screenshots). Docs +
    assets only, no runtime touch.

**Zero runtime PRs merged this window** — the *third consecutive*
window with no product-source diff (`src/*`, `supabase/functions/*`,
migrations, or config). Consequently there is no runtime retro-audit
this run.

The material change this run is a **dependency-advisory regression**.
The 2026-07-22 run had cleared `npm audit` to 0; this window it
regressed to **11 vulnerabilities (2 moderate, 9 high)** from three
newly-published advisories. This run:

1. **Fixed the `postcss` advisory in-tree** with a lockfile-only,
   semver-compatible bump (`postcss 8.5.15 → 8.5.23`,
   [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)).
   Applied — see Small fixes. `npm audit` 11 → 10 after the fix.
2. **Deferred the two advisories whose only fix is a major bump** —
   they fall outside the hygiene-run "low-risk, tests-pass" allowance:
   - **`react-router` (moderate, runtime dep)** — no patched 6.x
     exists (6.30.4 is the latest 6.x); the fix is a **v6 → v7 major
     upgrade**, which touches core navigation / auth-redirect journeys
     ("Changes that alter core user journeys" — not allowed without
     approval). Recorded as a security escalation on the existing
     migration planner
     [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — a
     dedicated issue could **not** be filed (Linear workspace is at
     its free-issue cap, same block the 2026-07-23 UX routine hit).
   - **`brace-expansion` build-time chain (high)** — a *new* advisory
     ([GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg),
     range `<=5.0.7`, superseding the pair fixed on 2026-07-22) that
     `npm audit fix` cannot resolve without `--force`; the fix is a
     `vite-plugin-pwa` major bump. Build-time only, no runtime path.

Headline status:

1. **`npm audit`: 11 at entry (2 moderate, 9 high) → 10 after the
   postcss fix.** The remaining 10 are the two deferred advisory groups
   (see Findings).
2. **Lint baseline unchanged at 54 problems (46 errors, 8 warnings).**
   No net drift — no product source changed this window (same 39
   react-hooks-7 rule violations + the standing 15-problem baseline).
3. **Typecheck ratchet holding at baseline** — app: 381, node: 0.
   Nothing new tested it this window (no product-code diff); the
   baseline check itself still passes on the current tree.
4. **Bundle unchanged.** PWA precache 60 entries / 2265.65 KiB today,
   byte-identical to 2026-07-22 (the postcss bump is a build-time
   transitive; the emitted bundle is unaffected).
5. **Test count unchanged at 369** (46 test files). All green under
   `npm test` after the postcss fix — no `Practice.mobile.test.tsx`
   flake observed this run.
6. **Secret / client-exposure re-scan clean** — same posture as every
   prior audit (details below).

## Commands run

- `npm install`: pass. **11 vulnerabilities at entry (2 moderate, 9
  high)**; **10 after the in-run `postcss` fix** (2 moderate + 8 high,
  all in the two deferred groups).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged
  from 2026-07-22.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0 errors
  (baseline 0). Ratchet matches — no regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.65
  KiB** — identical to 2026-07-22).
- `npm test`: pass (46 test files, **369 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green, run *after* the postcss fix.
- `npm audit`: **11 at entry → 10 after `npm audit fix`** (postcss
  only; the other two groups need major bumps and were not forced).

## Review focus this run

### Dependency advisory regression (the substantive change)

`npm audit` regressed from 0 (2026-07-22) to 11 this window. Three
distinct advisory groups, triaged by remediation cost and runtime
exposure:

| Advisory | Package | Severity | Prod runtime? | Fix | Disposition |
|----------|---------|----------|---------------|-----|-------------|
| GHSA-r28c-9q8g-f849 | postcss `<=8.5.17` | High | No (build-time: vite/tailwind) | `8.5.15 → 8.5.23`, semver-compatible | **Fixed in-run** |
| GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | react-router `6.0.0 – 7.17.0` | Moderate | **Yes** (routing) | v6 → v7 major only | **Deferred** (major, core journeys) |
| GHSA-mh99-v99m-4gvg | brace-expansion `<=5.0.7` (via `filelist → jake → ejs → workbox-build → vite-plugin-pwa`) | High | No (build-time) | `vite-plugin-pwa` major (`--force`) | **Deferred** (build-time, needs force) |

**postcss (fixed).** `postcss` reaches the tree only as a build-time
dependency of Vite and Tailwind; the path-traversal advisory
(malicious `sourceMappingURL` leaking arbitrary `.map` files) affects
CSS processing at build time, not the shipped runtime bundle. The fix
was a plain patch bump inside the existing `^8.4.47` range — squarely
inside the "update dependencies when the risk is low and tests pass"
allowance. Applied; `package.json` untouched, only `package-lock.json`
changed; full test suite green afterward.

**react-router (deferred — runtime, but low practical exposure).** Two
advisories:

- *Open redirect via backslash in `<Link>`/`useNavigate`
  (GHSA-wrjc-x8rr-h8h6, a CVE-2025-68470 bypass).* Exploitable only
  when the app passes attacker-controlled input to `navigate()` /
  `<Link to>`. Prepio's only dynamic redirect target is
  [`src/pages/Auth.tsx:45`](../../src/pages/Auth.tsx), which builds
  `redirectPath` from `location.state.from` — an in-memory React
  Router `Location` set by `ProtectedRoute`
  ([`src/App.tsx:57`](../../src/App.tsx),
  `createAuthReturnState({ pathname: location.pathname + location.search })`).
  That value is the real same-origin route the user was bounced from;
  it is **not** read from a URL query parameter, so an attacker cannot
  inject a backslash path via a crafted link. Practical exposure is
  low.
- *Arbitrary constructor injection via `deserializeErrors()` in SSR
  hydration (GHSA-337j-9hxr-rhxg).* **Not applicable** — Prepio is a
  client-rendered Vite SPA with no SSR/hydration path.

Neither advisory has a patched 6.x release (6.30.4 is the latest in
the 6.x line; `version-6` dist-tag = 6.30.4). The only remediation is
a **react-router-dom v6 → v7 major upgrade**, which is a core runtime
dependency governing every route transition plus the auth/billing
return navigation. That is migration-sized, not hygiene-sized, and is
explicitly out of scope for this run ("Changes that alter core user
journeys — not allowed without approval"). Deferred with a tracked
Linear issue.

**brace-expansion build-time chain (deferred).** A newly-published
advisory (`<=5.0.7`, OOM-crash DoS) that supersedes the
`brace-expansion 2.1.1` / `fast-uri 3.1.2` pair the 2026-07-22 run
patched — the range now covers the patched `2.1.2` as well. It reaches
the tree only through `vite-plugin-pwa → workbox-build → ejs → jake →
filelist → minimatch → brace-expansion`, a build-time path with no
attacker-controlled input at runtime. `npm audit fix` cannot resolve
it without `--force` (a `vite-plugin-pwa` major bump that risks the
PWA-manifest build), so it is out of the low-risk lockfile allowance.
Deferred; tracked with the react-router item.

### No runtime diff to retro-audit

Third consecutive quiet window for product source. The single merged
PR (#251) is docs + screenshots only — no `src/*`, no
`supabase/functions/*`, no migration, no config. No retro-audit this
run.

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-07-22.

- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.SUPABASE_SERVICE_ROLE_KEY`,
  `import.meta.env.OPENAI_API_KEY`, `import.meta.env.STRIPE_SECRET_KEY`,
  `import.meta.env.TAVILY_API_KEY` in `src/` returns nothing.
- **No tracked `.env` / `.env.local`.** `git ls-files` shows none;
  untracked scan (`git ls-files -o --exclude-standard`, excluding the
  scratchpad) is clean. `.gitignore` still excludes `.env*`, `*.key`,
  `secrets.json`.
- **Server logs still scrub user content.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)` touching
  `question_text|answer_text|transcript_text|user_note|userNote|user_input`
  returns zero hits — same clean pattern as every prior audit.

## Findings

### Critical

- None.

### High

- [ ] **`brace-expansion` build-time DoS (GHSA-mh99-v99m-4gvg) — needs
  a `vite-plugin-pwa` major bump; deferred.**
  - Evidence: `npm audit` reports this High via
    `vite-plugin-pwa → workbox-build → @trickfilm400/rollup-plugin-off-main-thread
    → ejs → jake → filelist → minimatch → brace-expansion`. Range
    `<=5.0.7` supersedes the `2.1.2` patch applied 2026-07-22.
    `npm audit fix` leaves it unresolved (requires `--force`).
  - Risk: OOM-crash DoS in the build toolchain. **No runtime path** —
    triggered only during local build / PWA-manifest generation, with
    no attacker-controlled input at build time. Low practical
    exploitability.
  - Recommended fix: `vite-plugin-pwa` major upgrade, verified against
    the PWA precache build. Not a hygiene-run change; tracked in
    Linear (see Deferred items).
  - Owner / next step: Product-owner-scoped dependency upgrade. Watch
    whether upstream `vite-plugin-pwa` / `workbox-build` ship a
    non-major fix that `npm audit fix` can take.

### Medium

- [ ] **`react-router` open-redirect + SSR advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x; deferred to a tracked v7 upgrade.**
  - Evidence: `npm audit` reports both (moderate) against
    `react-router` / `react-router-dom` 6.30.4; range `6.0.0 – 7.17.0`
    with no 6.x fix (`version-6` dist-tag = 6.30.4). Only remediation
    is v6 → v7.
  - Risk: Open-redirect exposure is **low in Prepio** — the sole
    dynamic redirect target (`Auth.tsx` `redirectPath`) derives from
    `location.state.from` set by `ProtectedRoute`, not from a
    URL-controllable parameter, so backslash injection is not
    reachable. The SSR-hydration advisory does not apply (SPA, no SSR).
  - Recommended fix: react-router-dom v6 → v7 as focused,
    browser-tested work (auth + billing return navigation are the
    high-value regression scope). Out of hygiene scope.
  - Owner / next step: Recorded as a security escalation comment on
    the migration planner
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) (which
    already lists the Router 7 migration as version drift, but not the
    security motivation). A dedicated issue could not be filed — the
    Linear workspace is at its free-issue cap. See Deferred items.

### Low / clean-up

- [ ] **`Practice.mobile.test.tsx` CI flake — remains Low; not
  reproducing.**
  - Evidence: The `{ retry: 2 }` mitigation (PR #226) is still on the
    three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 369 tests passed cleanly this run — no flake observed, no
    retries visibly consumed.
  - Recommended fix: None from this audit. Trigger for a real
    investigation ticket remains: retries actually exhausting in CI.
- [ ] **Dependabot cadence vs. security advisories** — informational,
  recurring.
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml)
    runs `npm` monthly. Three security advisories surfaced this window
    (postcss, react-router, brace-expansion) with no off-schedule
    Dependabot security PR observed. The 2026-07-22 pair (per that
    audit) also went un-pre-empted.
  - Recommended fix: None required — postcss fixed in-tree, the other
    two deferred with tracking. Next reviewer: confirm the GitHub
    Dependabot alerts reflect these dispositions; if security updates
    are not auto-opening PRs, check Settings → Code security that
    Dependabot security updates are enabled.
- [ ] **`lovable-tagger` keep-or-drop decision** — thirteenth audit
  waiting.
  - Evidence: [`vite.config.ts:33`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`; unused in
    production.
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.
- [ ] **Typecheck backlog 381 → 381 — nothing tested it this window**
  — informational.
  - Evidence: No product source changed, so the ratchet had no PR to
    enforce against. Baseline check on the current tree still passes.
  - Recommended fix: None from this audit. The `tsconfig.test.json`
    split question (open since 2026-07-08) still stands.

## Small fixes made in this run

- **`npm audit fix` — resolved the `postcss` High advisory
  (lockfile-only).** Bumped the build-time transitive `postcss 8.5.15
  → 8.5.23` (GHSA-r28c-9q8g-f849). Only `package-lock.json` changed
  (`package.json` untouched). Verified `npm audit` 11 → 10, `npm run
  build` unchanged (2265.65 KiB, 60 precache entries), and `npm test`
  → 369/369 green after the change. Committed on this run's branch.

Explicitly *not* touched this run:

- **The react-router v7 and vite-plugin-pwa major upgrades.** Both
  need migration-sized, browser-/build-tested work outside the
  low-risk lockfile allowance; deferred with Linear tracking.
- **The 381-error typecheck backlog** and the **39 react-hooks-7
  violations.** Coordinated cleanup passes, not hygiene-runner scope.

## Deferred items

Tracked in Linear (no free-form bullets to re-discover):

- **react-router / vite-plugin-pwa security-motivated major upgrades**
  — recorded this run as a **security-escalation comment** on
  [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) (see the High
  and Medium findings). A dedicated tracking issue could **not** be
  filed: the Linear workspace is at its free-issue cap (the same block
  the 2026-07-23 UX routine documented). The react-router advisories
  (moderate, runtime) and the brace-expansion advisory (high,
  build-time) both require major bumps that this hygiene run cannot
  safely apply. **The free-issue cap is now blocking hygiene intake
  too, not just the UX routine — see Questions.**
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — Major
  dependency-migration planner. Already lists Router 6 → 7 as version
  drift; this run adds the security motivation via the new issue.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Thirteenth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Not re-counted this run (docs-only window).
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild
  override test guard (PR #240). Product-owner merge call.

## Questions for product owner

- **Prioritise the react-router v7 upgrade now that it carries a
  published (if low-exposure) security advisory?** The open-redirect
  path is not currently reachable in Prepio (see Medium finding), but
  there is no patched 6.x, so the advisory will keep appearing in
  `npm audit` until v7 lands. Scope it into a cycle, or accept the
  standing moderate advisory with the exposure note on record?
- **The Linear workspace free-issue cap is now blocking hygiene
  intake, not just the UX routine.** The 2026-07-23 UX routine
  root-caused runs #6–#8's un-filed tickets to the workspace hitting
  its free-issue limit. This run hit the same wall trying to file the
  react-router/vite-plugin-pwa security issue (`400 — You've exceeded
  the free issue limit for this workspace`). This is now the binding
  constraint on the "who owns filing tickets" question: **no one can
  file until the workspace is upgraded or existing issues are
  archived/closed to free capacity.** Recommend either upgrading the
  Linear plan or a triage pass to close/archive `Done`/`Canceled`
  issues so intake unblocks. Until then, audit findings that need a
  ticket are being recorded as comments on the nearest existing issue
  (this run: PREPIO-98) and documented in full in the audit doc.
- **Who owns filing audit-recommended Linear tickets?** Still
  unanswered — carried since 2026-07-18, now compounded by the cap
  above. Options remain (a) hygiene runner gets scoped Linear write
  access, (b) maintainer SLA to file audit-prescribed tickets, or (c)
  audits only flag findings — but all three are moot until the cap is
  resolved.
- **Is the `lovable-tagger` component tagger still in use?**
  Thirteenth run asking. One-line cleanup blocked on this.

## Next review focus

1. **Confirm the react-router / vite-plugin-pwa security issue is
   triaged.** If the product owner schedules the Router v7 upgrade,
   this becomes a runtime PR to retro-audit next cycle.
2. **Whether `npm audit` finds new build-time advisories.** The
   `vite-plugin-pwa → workbox-build` toolchain surfaced this run's
   brace-expansion advisory *and* both of 2026-07-22's — it is a
   recurring source. Watch whether an upstream non-major fix lands
   that `npm audit fix` can take.
3. **First runtime PR after three quiet windows.** Whenever the next
   non-docs PR merges, it is the next real exercise of the typecheck
   ratchet (381), lint baseline (54), and bundle guard (2265.65 KiB).
4. **Whether the Linear free-issue cap is resolved.** It is now
   blocking both the UX routine and hygiene intake. Confirm next run
   whether the workspace was upgraded or triaged; if still capped,
   keep recording findings as comments on existing issues.
</content>
</invoke>
