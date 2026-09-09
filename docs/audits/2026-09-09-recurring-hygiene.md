# Recurring hygiene review — 2026-09-09

## Summary

Twenty-sixth recurring codebase hygiene & security review for Prepio.

**First functional window since run #22** — the last three hygiene runs (#23–#25)
were docs-only. Since run #25's base (`d0377e8`, 2026-08-22), `main` advanced to
`132816b` with several source-touching merges. The security-relevant ones were
reviewed directly this run:

- **[PREPIO-141] Redact free-text-derived fields from the `QUERY_PLAN` log
  (#333)** — a *security improvement*. `company-research` previously wrote the raw
  `signals` object (role/level/country and interviewer names parsed from the user's
  note) and full query strings to edge-function logs. It now logs only a PII-free
  view (`roleFamily`, query count, source/domain-pack categories, targeted-signal
  count) via a pure `buildQueryPlanLogPayload` helper. Verified landed at
  [`company-research/index.ts:201`](../../supabase/functions/company-research/index.ts)
  with focused test coverage in
  [`query-planner.test.ts`](../../supabase/functions/company-research/query-planner.test.ts)
  asserting no free-text leaks. No query, data-access, or auth behavior changed.
- **[PREPIO-155] Delete the dead DuckDuckGo fallback shim (#319)** — dead-code
  removal; no runtime path imported it. Reduces surface area. Clean.
- **Surface an honest note when practice transcription fails (#311)** — a
  non-blocking toast on genuine transcribe failure, silent on empty transcript.
  Aligns to the copy in `DESIGN_PRINCIPLES.md`. No sensitive data added to logs.
- **[PREPIO-178]/[PREPIO-171] single-`h1` a11y fixes (#329/#315)** and the
  **React group bump (#323)** / **React Router lockfile patch (#313)** — no new
  security or data-flow surface.

**Headline: the new source this window is security-neutral-to-positive, and no
new secret, PII-in-logs, or access-control regression was introduced.**

**Small fix made this run (lockfile-only): cleared every newly-disclosed
dependency advisory that had a non-breaking fix.** `npm audit` jumped from 3
findings (run #25) to **9** — not because any package version changed, but because
six new CVEs were disclosed against build/test tooling already in the tree
(`browserslist`, `baseline-browser-mapping`, `fast-uri`, `@vitest/mocker`) plus
`@xmldom/xmldom` (a transitive of `mammoth`, the DOCX resume parser — the one on a
runtime path). I bumped the four packages whose fix is SemVer-compatible via
targeted `npm update --package-lock-only`, bringing the audit back down to **3** —
the same known-deferred majors that run #25 ended on. **`package.json` is
untouched**; the change is a 29-line, lockfile-only transitive bump, validated with
a full green build + typecheck + test run.

> Note on tooling: `npm audit fix` (with or without `--force`, dry-run or real) is
> **broken in this repo** — it aborts with `Cannot read properties of null (reading
> 'edgesOut')`, a known npm resolver bug triggered by the `overrides` field. Targeted
> `npm update <pkg> --package-lock-only` works and is what I used. A future run
> should not read the `edgesOut` crash as a broken tree — the tree is fine; only
> `audit fix`'s whole-tree diff path trips the bug.

Baselines (measured against HEAD `132816b`; deltas vs 2026-08-22):
lint **51** problems (43 errors, 8 warnings, flat). Typecheck **pass at baseline**
(app tsc **62**, node **0**, flat). Build **2280.36 KiB** / 62 precache entries
(+1.44 KiB, from the refreshed `caniuse-lite` data feeding autoprefixer — expected
and immaterial). Tests **431** passing / 48 files (up from 426/49 — the Practice
de-flake #317 consolidated files and added cases). `npm audit` **9 → 3** after the
lockfile fix.

## Commands run

- `npm install`: **pass** (via SessionStart hook; re-run to sync node_modules to the
  updated lockfile — pass).
- `npm run lint`: **51 problems (43 errors, 8 warnings).** Flat vs 2026-08-22; all
  pre-existing (see run #25). The lockfile-only change introduces no lintable source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **62**, node **0**. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). This run
  changed no `supabase/functions` source, so the real CI `verify` job (a genuine
  blocking `deno check`) covers it unchanged.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries, **2280.36 KiB**).
  Re-run after the dependency bump — still green.
- `npm test`: **pass** (48 files, **431 tests**). Re-run after the dependency bump —
  still 431/431 green, confirming the transitive updates don't disturb the suite.
- `npm audit`: **9 → 3** after the lockfile-only fix (see below).

## Findings

### Critical

- None.

### High

- [ ] **`interview-research` never verifies `searchId` ownership — cross-tenant
  write (BOLA) via the service-role client.** *(Carried from 2026-08-12;
  re-verified still open this run. Pre-existing, not a regression. Tracked as
  PREPIO-143.)*
  - Evidence: the only identity check is body `userId` == JWT user
    ([interview-research/index.ts:1096](../../supabase/functions/interview-research/index.ts)).
    `searchId` (line 1085) is taken straight from the request and is **never**
    checked against the caller, yet every downstream write keys off it with the
    service-role client (which bypasses RLS). Re-confirmed this run: line 1096 is
    still a bare `userId` comparison with no `select user_id from searches` guard.
  - Risk: a signed-in user who supplies their own `userId` but another tenant's
    `searchId` can drive writes against a search row they do not own.
  - Recommended fix: before any write, `select user_id from searches where id =
    searchId` and reject when absent or `!= userId`. Land it with a
    cross-tenant-rejection test; then re-audit `company-research`, `job-analysis`,
    and `answer-feedback` for the same missing object-ownership check.
  - Owner / next step: **PREPIO-143** (substantive edge-function change, out of
    scope for a hygiene run and not validatable in this proxy-limited environment).

### Medium

- [ ] **`pdfjs-dist` high-severity advisory (GHSA-hq66-cqwq-w95j) — arbitrary JS
  execution on opening a malicious PDF.** *(Carried; re-verified. Needs a 5 → 6
  major, so not fixable in this lockfile-only run.)*
  - Evidence: `npm audit` reports `pdfjs-dist >=5.6.83 <6.2.108` high; the app parses
    user-uploaded resumes client-side. Fix is `pdfjs-dist@6.3.289` (breaking).
  - Risk: a crafted resume PDF could execute script in the parsing context.
    Materially mitigated by pdf.js worker isolation, but the highest-CVSS open
    advisory. Note the freeze already disables PDF upload behind PREPIO-140 in the
    locked frontend, which reduces live exposure.
  - Recommended fix: bump behind a resume-upload regression check (PDF **and** DOCX).
    Dependabot surfaces the PR; needs a human to validate the major.
  - Owner / next step: Deferred — dependency major, Dependabot-tracked.

### Low / clean-up

- [x] **Six newly-disclosed advisories against in-tree build/test tooling — the four
  with a non-breaking fix cleared this run (lockfile-only).** *(New this window;
  **fixed**.)*
  - Evidence: `npm audit` rose 3 → 9 as new CVEs were disclosed (no version churn).
    The SemVer-compatible ones were bumped via targeted
    `npm update <pkg> --package-lock-only`:
    - `@xmldom/xmldom` 0.8.13 → **0.8.15** (10 advisories incl. ReDoS / quadratic
      parsing on malformed input; **transitive of `mammoth`, the DOCX resume
      parser — the only one on a runtime path**, so the most worth clearing).
    - `browserslist` 4.28.2 → **4.28.9** (high; OOM + prototype-write; build tooling).
    - `fast-uri` 3.1.5 → **3.1.7** (high; SSRF / host-confusion; via
      `vite-plugin-pwa → workbox-build → ajv`, build tooling).
    - `baseline-browser-mapping` 2.10.37 → **2.11.21** (moderate DoS; build tooling).
      Plus the browserslist data chain refreshed (`caniuse-lite`,
      `electron-to-chromium`, `node-releases`, `update-browserslist-db`).
  - Fix: 29-line lockfile-only diff, `package.json` untouched. Full green build +
    typecheck + test re-run confirms no behavioral impact.
  - Shipped in the same PR as this note.

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9) — path traversal /
    arbitrary file read via redirect mock.** *(New this window; deferred.)*
  - Evidence: `@vitest/mocker 2.1.0 - 4.1.10` moderate; needs `vitest` ≥ 4.1.11.
  - Risk: **dev/test-only** — exploitable only through a malicious mock
    configuration, which does not apply to this repo's own trusted suite. No
    production-bundle exposure.
  - Note: the clean fix (bump `vitest` alone) could not be forced in this sandbox —
    the resolver only fetched 4.1.11 when `@vitest/mocker` was named explicitly, which
    would leave an awkward direct dev-dep on a vitest-internal package. Not worth that
    for a dev-only advisory; left to Dependabot's monthly `vitest` bump.
  - Recommended fix: let Dependabot bump `vitest` to ≥ 4.1.11; no manifest surgery.

- [ ] **`react-router` two advisories (open-redirect + SSR-hydration constructor
  injection) — needs the v7 major.** *(Carried; re-verified. SSR one does not apply
  to this CSR-only SPA.)*
  - Evidence: `react-router 6.0.0 - 7.17.0`; fix is `react-router-dom@7.18.3`
    (breaking). Prepio ships a client-only `BrowserRouter` ([`src/App.tsx`](../../src/App.tsx)),
    so the `deserializeErrors()` SSR-hydration path (GHSA-337j-9hxr-rhxg) is not
    reachable; the open-redirect one (GHSA-wrjc-x8rr-h8h6) is the live concern.
  - Owner / next step: Deferred — Dependabot-tracked v7 major; needs routing/redirect
    regression validation.

- [ ] **`npm audit` is not a CI gate.** *(Observation, not filed.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, and test — but not `npm audit`. Advisory
    response relies entirely on Dependabot's monthly cadence + security updates.
  - Recommended fix: optional — a non-blocking `npm audit --audit-level=high` step
    would surface highs in the PR checks without blocking on the noisy majors.
    Deferred as a CI-policy call for the maintainers, not a hygiene-run change.

## Small fixes made in this run

- **Lockfile-only dependency bump clearing four non-breaking advisories**
  (`@xmldom/xmldom` 0.8.13→0.8.15, `browserslist` 4.28.2→4.28.9, `fast-uri`
  3.1.5→3.1.7, `baseline-browser-mapping` 2.10.37→2.11.21, plus the browserslist
  data chain). `npm audit` 9 → 3. `package.json` untouched; full build + typecheck +
  test green. Shipped in the same PR as this note.

## Deferred items

Already tracked or explicitly noted-not-filed:

- **PREPIO-143** — `interview-research` `searchId` BOLA fix PR (High). Highest-value
  open follow-up. Tracked in Linear.
- **`pdfjs-dist` 5 → 6 major** (Medium) and **`react-router` v7 major** (Low, two
  advisories). Dependabot-surfaced breaking bumps needing human validation of the
  resume-upload and routing/redirect surfaces. Dependabot is the tracker.
- **`vitest` ≥ 4.1.11 for the `@vitest/mocker` advisory** (Low, dev-only). Left to
  Dependabot's monthly `vitest` bump; not manifest-surgery-worthy this run.
- **`npm audit` as a non-blocking CI step** (Low, process). Noted for maintainers.

No **new** Linear issue is owed: the one fixable item was fixed rather than filed,
and every remaining open is already tracked (PREPIO-143) or Dependabot-surfaced.

## Questions for product owner

- None blocking. All open findings have an owner or a clear next action.

## Next review focus

1. **PREPIO-143 (`searchId` BOLA) fix PR** — still the highest-value open item.
   Verify the ownership check lands with a cross-tenant-rejection test and the normal
   create → invoke flow still passes, then re-audit `company-research`,
   `job-analysis`, and `answer-feedback` for the same gap.
2. **`pdfjs-dist` 6 / `react-router` v7 / `vitest` ≥ 4.1.11 Dependabot PRs.** If open,
   spend a review validating the resume-upload (PDF+DOCX) and routing/redirect
   surfaces so the two majors can land instead of accumulating; the `vitest` bump is
   a rubber-stamp once the resolver lets it through outside this sandbox.
3. **Next source-touching merge.** Re-run the full baseline against it rather than
   re-verifying carried findings — same posture that caught this window's new
   advisories early.
