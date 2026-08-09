# Recurring hygiene review — 2026-08-05

## Summary

Twentieth recurring codebase hygiene & security review for Prepio.

Merged to `main` since the 2026-08-01 review (#272), all now on this
run's branch base (HEAD `97ba491`):

- **Runtime — research pipeline**
  - [#257](https://github.com/akkkkkkki/prepio/pull/257)
    ([PREPIO-52](https://linear.app/qiuyue/issue/PREPIO-52)) — 2026-08-04
    "Surface research freshness." The substantive change this window:
    a new shared `research-freshness` module derives run-level source
    freshness from real Tavily results (per-source observation +
    publication dates), unions it across the company-search and
    job-extraction retrieval paths, and the Dashboard renders it. +681
    lines, ~half of them tests.
- **Runtime — landing / new-interview**
  - [#275](https://github.com/akkkkkkki/prepio/pull/275)
    ([PREPIO-88](https://linear.app/qiuyue/issue/PREPIO-88)) — 2026-08-05
    "Collapse duplicate guest conversion CTAs." UI-only, net −5 lines.
- **Dependency / DX**
  - [#261](https://github.com/akkkkkkki/prepio/pull/261)
    ([PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)) — 2026-08-04
    "Drop unused lovable-tagger dev dependency." **This closes the
    keep-or-drop decision that fourteen prior audits carried** as a
    standing Low. The `esbuild ^0.28.1` override (the PREPIO-62 guard)
    was correctly kept.

Two headline results this run:

1. **Two new HIGH advisories appeared and were both fixed in-run.**
   `npm audit` rose from last run's 2 to **5 at entry** (2 moderate,
   3 high): new `fast-uri` (GHSA-7p8r-x3mc-p8w7) and `undici`
   (five GHSAs) highs joined the two standing react-router moderates.
   Both new highs reach the tree only through **build/test tooling**
   (`fast-uri` via `vite-plugin-pwa → workbox-build → ajv`; `undici`
   via `jsdom`, the vitest DOM env) with no production-runtime path,
   and both have non-major, lockfile-only fixes in range. A plain
   `npm audit fix` cleared both — 5 → 2. Applied; see Small fixes.
2. **The retro-audit of the research-freshness rewrite (#257) is
   clean.** All date parsing is guarded, source URLs are
   protocol-validated (`http:`/`https:` only) and hash-stripped, the
   Dashboard renders freshness through plain JSX text (no
   `dangerouslySetInnerHTML`), and there is no cross-user path — a run's
   freshness is built from that run's own sources. Details in Findings.

Baselines held: lint **54 problems** (unchanged), typecheck at baseline
(app 381 / node 0), test count **up 380 → 390** (new freshness
coverage), bundle **2266.25 KiB** (+0.53 KiB from the merged PRs —
within noise). Secret / client-exposure re-scan clean.

## Commands run

- `npm install`: pass. **5 vulnerabilities at entry** (2 moderate,
  3 high); **2 after the in-run `npm audit fix`** (the two react-router
  moderates).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged
  from 2026-08-01 (39 `react-hooks` violations + the standing
  15-problem baseline). No net drift from the merged PRs.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0 errors
  (baseline 0). No regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2266.25
  KiB** — +0.53 KiB vs 2026-08-01's 2265.72, from the merged runtime
  PRs). Unchanged before vs. after the audit fix.
- `npm test`: pass (47 test files, **390 tests**, up from 380). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green, re-run *after* the audit fix. No `Practice.mobile.test.tsx`
  flake observed.
- `npm audit`: **5 at entry → 2 after `npm audit fix`** (non-force). The
  fix cleared the `fast-uri` and `undici` highs; the two react-router
  moderates remain (need a v7 major). See Small fixes for the lockfile
  delta.

## Review focus this run

### Dependency advisories — two new build/test-time highs (the substantive fix)

`npm audit` at entry:

| Advisory | Package | Severity | Prod runtime? | Path | Fix | Disposition |
|----------|---------|----------|---------------|------|-----|-------------|
| GHSA-7p8r-x3mc-p8w7 | fast-uri `3.1.4` | High | No (build-time) | `vite-plugin-pwa → workbox-build → ajv → fast-uri` | `3.1.4 → 3.1.5`, non-force | **Fixed in-run** |
| GHSA-8xcm-r25x-g524 + 4 more | undici `7.28.0` | High | No (test-time) | `jsdom → undici` | `7.28.0 → 7.29.0`, non-force | **Fixed in-run** |
| GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | react-router `6.30.4` | Moderate | **Yes** (routing) | direct dep | v6 → v7 major only | **Deferred** (major, core journeys) |

**fast-uri + undici (fixed).** Neither is on a production-runtime path.
`fast-uri` is pulled by the PWA/service-worker build toolchain
(`workbox-build`'s JSON-schema validator); `undici` is pulled by
`jsdom`, which only runs as the vitest DOM environment. Both have
patched versions inside the existing semver range, so a plain
`npm audit fix` resolves them lockfile-only — `package.json` untouched,
three transitive bumps in `package-lock.json` (`fast-uri 3.1.4 → 3.1.5`,
`undici 7.28.0 → 7.29.0`, plus a `brace-expansion 5.0.8 → 5.0.9`
carry-along). This sits squarely inside the "update dependencies when
the risk is low and tests pass" allowance. Verified `npm audit` 5 → 2,
`npm run build` unchanged (2266.25 KiB, 60 precache entries), typecheck
at baseline, `npm test` 390/390 green afterward.

**react-router (deferred — unchanged from 2026-08-01).** Still no
patched 6.x; only remediation is a v6 → v7 major that governs every
route transition plus auth/billing-return navigation — migration-sized,
out of hygiene scope. Practical exposure remains **low** and is
unchanged from the detailed 2026-07-25 analysis:
[`Auth.tsx`](../../src/pages/Auth.tsx) `redirectPath` derives from
in-memory `location.state.from` (not a URL param);
[`BillingReturn.tsx`](../../src/pages/BillingReturn.tsx) `fallbackHref`
passes through `safeReturnTo`, which rejects the `//` and `/\` prefixes
the open-redirect advisory concerns; the SSR-hydration advisory does not
apply (client-rendered SPA, no SSR). Deferred, tracked on
[PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98).

### Runtime retro-audit — research-freshness (#257, PREPIO-52)

The natural retro-audit target the 2026-08-01 review predicted. New
shared module
[`_shared/research-freshness.ts`](../../supabase/functions/_shared/research-freshness.ts)
consumes Tavily search payloads and produces run-level freshness
metadata that flows to the Dashboard. It parses external, provider-shaped
data and its output is user-visible, so it got a focused security read:

- **All date parsing is guarded.** `normalizeObservedAt`,
  `normalizeSourceObservedAt`, and `normalizePublishedAt` each validate
  with `Number.isNaN(parsed.getTime())` and (for published dates) a
  `^\d{4}-\d{2}-\d{2}` shape check before use; malformed input falls
  back to `null` or the run time, never throws
  ([lines 25–51](../../supabase/functions/_shared/research-freshness.ts)).
- **Source URLs are validated, not trusted.** `normalizeSourceUrl`
  runs each result URL through `new URL(...)`, **rejects any protocol
  other than `http:`/`https:`** (so no `javascript:`/`data:` reaches the
  UI), and strips the hash
  ([lines 53–64](../../supabase/functions/_shared/research-freshness.ts)).
- **No injection / no unsafe render.** The Dashboard renders
  `freshness.summary` and a computed "Sources checked …" label as plain
  JSX text — no `dangerouslySetInnerHTML`, no `eval`, no template
  concatenation into a query/shell.
- **No cross-user path, no new PII.** Freshness is built from the
  requesting user's own research run; the only strings surfaced are
  public research **source URLs** the user already sees in their results,
  not third-party or prep-note content. Nothing is shared to another
  user's session.
- **Well tested.** +193 lines in `research-freshness.test.ts` plus
  Dashboard and aggregation coverage — cache-reuse observation time,
  URL de-duplication across retrieval paths, and the pre-field fallback
  copy are all exercised.

**Verdict: clean, no regression.**

### Runtime retro-audit — guest CTAs (#275, PREPIO-88)

Pure UI: collapses two duplicate guest conversion CTAs in
[`ConversionPanel.tsx`](../../src/components/preview/ConversionPanel.tsx)
into one. No new data flow, no new network call, no new env read.
Nothing to flag.

### Dependency drop retro-audit — lovable-tagger (#261, PREPIO-96)

Verified fully removed: no `lovable`/`componentTagger` residue in
`src/`, `vite.config.ts`, or `package.json`, and the `esbuild ^0.28.1`
override (the PREPIO-62 advisory guard) is intact. `npm audit` did not
regress from the removal. **This resolves the standing Low that fourteen
prior audits carried.**

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-08-01.

- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` /
  `import.meta.env.OPENAI_API_KEY` / `import.meta.env.STRIPE_SECRET_KEY` /
  `import.meta.env.TAVILY_API_KEY` in `src/` returns nothing.
- **No tracked `.env` / `.env.local`.** Only `.env.example` is tracked;
  every value is a truncated placeholder (`sk-proj-...`, `tvly-...`,
  `whsec_...`, etc.) except the Supabase project URL and publishable-key
  prefix, which are client-public by design. No real secret present.
- **No *direct* user content in server console logs.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)` touching
  `question_text|answer_text|transcript_text|user_note|userNote|user_input`
  returns zero hits. (Same indirect-flow caveat as the Low finding
  carried below.)

## Findings

### Critical

- None.

### High

- None. (Both new highs this window — `fast-uri` and `undici` — are
  **fixed in-tree** this run; see Small fixes.)

### Medium

- [ ] **`react-router` open-redirect + SSR advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x; deferred to a tracked v7 upgrade.** *(Carried, unchanged.)*
  - Evidence: `npm audit` reports both (moderate) against
    `react-router` / `react-router-dom` 6.30.4; range `6.0.0 – 7.17.0`
    with no 6.x fix. Only remediation is v6 → v7.
  - Risk: Open-redirect exposure is **low in Prepio** — both dynamic
    redirect targets have same-origin protection (`Auth.tsx` derives
    from `location.state.from`, not a URL param; `BillingReturn.tsx`
    passes `?returnTo=` through `safeReturnTo`, which rejects the `//`
    and `/\` backslash vectors). SSR-hydration advisory does not apply
    (SPA, no SSR).
  - Recommended fix: react-router-dom v6 → v7 as focused, browser-tested
    work (auth + billing-return navigation are the high-value regression
    scope). Out of hygiene scope.
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98). Product-owner
    scheduling call.

### Low / clean-up

- [ ] **`QUERY_PLAN` structured log captures extracted interviewer
  person-names from the user note into first-party operational logs.**
  *(Carried from 2026-08-01; not a regression this window — #257 did not
  touch the log line.)*
  - Evidence:
    [`company-research/index.ts:201`](../../supabase/functions/company-research/index.ts)
    logs `QUERY_PLAN` with `signals` + `queries`, which
    [`SearchLogger.log()`](../../supabase/functions/_shared/logger.ts)
    forwards to `console.log` (Supabase edge-function logs). Since
    #249/#253, those fields can include interviewer names parsed from the
    free-text note.
  - Risk: **Low.** User's own note content plus a third-party interviewer
    name, to first-party operational logs — not cross-user, not
    client-exposed, not public; short Supabase retention.
  - Recommended fix: Redact the free-text-derived fields (log
    `roleFamily`, counts) or gate the full payload behind a debug flag.
    **Not applied** — altering `QUERY_PLAN` reduces research-pipeline
    debuggability the [RUNBOOK](../../docs/RUNBOOK.md) relies on; a
    product-owner observability call.
  - Owner / next step: Product owner to decide redact vs. accept. Worth a
    `Chore` / `area:research-pipeline` issue if the workspace issue cap
    is resolved (see Questions).
- [ ] **`Practice.mobile.test.tsx` CI flake — remains Low; not
  reproducing.** *(Carried.)*
  - Evidence: The `{ retry: 2 }` mitigation (PR #226) is still on the
    three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 390 tests passed cleanly this run — no flake observed.
  - Recommended fix: None from this audit. Trigger for a real ticket
    remains: retries actually exhausting in CI.
- [ ] **Dependabot cadence vs. security advisories** — informational,
  recurring. *(Carried.)*
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml)
    runs `npm` monthly. Two new high advisories (`fast-uri`, `undici`)
    surfaced upstream this window and were applied by hand here; no
    off-schedule Dependabot *security* PR was observed opening them
    first.
  - Recommended fix: None required — fixed in-tree. Next reviewer:
    confirm GitHub Settings → Code security has Dependabot **security**
    updates enabled so patched advisories auto-open PRs between the
    monthly version runs. The recurrence of build/test-tool highs
    (postcss, brace-expansion, now fast-uri/undici) makes this the
    single highest-leverage process fix.

## Small fixes made in this run

- **`npm audit fix` — resolved two HIGH advisories (lockfile-only).**
  `fast-uri 3.1.4 → 3.1.5` (GHSA-7p8r-x3mc-p8w7, build-time only via
  `workbox-build → ajv`) and `undici 7.28.0 → 7.29.0` (five GHSAs,
  test-time only via `jsdom`), plus a `brace-expansion 5.0.8 → 5.0.9`
  carry-along. `package.json` untouched; only `package-lock.json`
  changed. Both advisories are off the production-runtime path, bringing
  them inside the low-risk lockfile allowance. Verified `npm audit`
  5 → 2, `npm run build` unchanged (2266.25 KiB, 60 precache entries),
  `npm run typecheck` at baseline, `npm test` 390/390 green after the
  change. Committed on this run's branch.

Explicitly *not* touched this run:

- **The react-router v7 major upgrade.** Migration-sized, browser-tested
  work outside the low-risk lockfile allowance; deferred with Linear
  tracking (PREPIO-98).
- **The `QUERY_PLAN` operational-log PII observation.** Reduces
  research-pipeline debuggability the RUNBOOK depends on — a
  product-owner observability call (see Low finding).
- **The 381-error typecheck backlog** and the **39 react-hooks
  violations.** Coordinated cleanup passes, not hygiene-runner scope.

## Deferred items

Tracked in Linear (no free-form bullets to re-discover):

- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — Major
  dependency-migration planner. Carries the react-router 6 → 7 upgrade
  with the security motivation.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass.
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild
  override test guard (PR #240). Product-owner merge call.
- **Resolved this window:**
  [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
  (`lovable-tagger` drop) shipped in #261 — no longer carried.
- **Still unfiled: `QUERY_PLAN` operational-log PII redaction.** Should
  be a `Chore` / `area:research-pipeline` issue in Quality &
  Maintenance, cross-linked to this audit and #249/#253. Recorded here
  until the Linear workspace issue-intake cap is confirmed resolved.

## Questions for product owner

- **`QUERY_PLAN` log PII — redact or accept?** The research-pipeline
  discovery log writes interviewer names parsed from the user's note into
  first-party edge-function logs (Low finding, carried). User's own data
  in operational logs, not a cross-user leak. Redact the free-text-derived
  fields (keep counts + `roleFamily` for debuggability), or accept with
  this note on record?
- **Schedule the react-router v7 upgrade?** Two standing moderate
  advisories with no patched 6.x — they will keep appearing in
  `npm audit` until v7 lands. Scope into a cycle, or accept the standing
  advisory with the low-exposure note on record? *(Carried.)*
- **Enable Dependabot *security* updates?** Three windows in a row have
  surfaced new build/test-tool highs (postcss → brace-expansion →
  fast-uri/undici) that the monthly Dependabot version run missed and the
  hygiene run patched by hand. Turning on security updates would auto-open
  these between version runs.
- **Is the Linear workspace free-issue cap resolved?** Still blocks
  filing the `QUERY_PLAN` redaction issue. If capped, findings keep
  landing in the audit doc as the system of record.

## Next review focus

1. **Confirm `react-router` remains the only open advisory.** With
   `fast-uri`/`undici` cleared, `npm audit` should read 2 (both
   react-router). Watch the `vite-plugin-pwa → workbox-build` and
   `jsdom` toolchains — the recurring sources of new build/test-time
   highs.
2. **Next research-pipeline PR.** #257 shows the pipeline is under active
   iteration; the next change there is the natural retro-audit target,
   with attention to whether any new free-text or provider-shaped parsing
   widens the operational-log PII surface (the standing `QUERY_PLAN`
   Low).
3. **`QUERY_PLAN` log PII disposition.** If the product owner opts to
   redact, that becomes a small, tested edge-function change to
   retro-audit; if accepted, close the loop in the doc.
