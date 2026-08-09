# Recurring hygiene review — 2026-08-01

## Summary

Nineteenth recurring codebase hygiene & security review for Prepio.

**The three-window "quiet" streak ends** — this window carries real
runtime diff to retro-audit for the first time since 2026-07-18. Merged
to `main` (plus two commits carried on this run's branch) since the
2026-07-25 review (#254):

- **Runtime — research pipeline**
  - [#249](https://github.com/akkkkkkki/prepio/pull/249) — 2026-07-29
    "Fix team-first research note signals."
  - [#253](https://github.com/akkkkkkki/prepio/pull/253) — 2026-07-31
    "Harden team-name extraction in the research query planner."
  - Together these rewrote
    [`supabase/functions/company-research/query-planner.ts`](../../supabase/functions/company-research/query-planner.ts)
    user-note parsing (+113 lines) and added 115 lines of unit tests.
- **Runtime — landing/new-interview**
  - [#256](https://github.com/akkkkkkki/prepio/pull/256)
    ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) —
    2026-08-01. Replaced the marketing hero on the signed-in
    `/new-interview` surface with a task header + breadcrumb.
    UI copy/layout only ([`src/pages/Home.tsx`](../../src/pages/Home.tsx)),
    +38 lines of `Home.mobile.test.tsx` coverage.
- **Docs**
  - [#255](https://github.com/akkkkkkki/prepio/pull/255),
    [#262](https://github.com/akkkkkkki/prepio/pull/262) — UX review
    routine runs #10 and #11. Docs + screenshots only.

Two headline results this run:

1. **Dependency advisories improved from 10 → 2**, and the review
   **cleared the last deferred High in-tree**. The `brace-expansion`
   build-time DoS (GHSA-mh99-v99m-4gvg) that the 2026-07-22 and
   2026-07-25 runs both had to defer (it required `npm audit fix
   --force` then) now has a non-major fix in range: a plain
   `npm audit fix` bumps `brace-expansion 2.1.2 → 2.1.4`, lockfile-only,
   `package.json` untouched. Applied — see Small fixes. Only the two
   **moderate** `react-router` advisories remain (still no patched 6.x;
   still needs a v7 major — deferred, unchanged disposition).
2. **The retro-audit of the query-planner rewrite is clean** — bounded
   regex quantifiers (no ReDoS), the user's own note feeding the user's
   own research (no cross-user path), and strong new test coverage. One
   **Low** observation surfaced: the pre-existing `QUERY_PLAN`
   structured log now carries extracted *interviewer person-names* from
   the user note into first-party operational logs (details in
   Findings).

Baselines held: lint 54 problems (unchanged), typecheck at baseline
(app 381 / node 0), test count **up 369 → 380** (new coverage from the
three runtime PRs), bundle 2265.72 KiB (+0.07 KiB from the Home.tsx copy
change — within noise). Secret / client-exposure re-scan clean.

## Commands run

- `npm install`: pass. **3 vulnerabilities at entry** (2 moderate, 1
  high); **2 after the in-run `brace-expansion` fix** (2 moderate — the
  two `react-router` advisories).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged
  from 2026-07-25 (39 `react-hooks` rule violations + the standing
  15-problem baseline). No net drift from the runtime PRs.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0 errors
  (baseline 0). No regressions from the runtime PRs.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.72
  KiB** — +0.07 KiB vs 2026-07-25's 2265.65, from the Home.tsx copy
  change).
- `npm test`: pass (46 test files, **380 tests**, up from 369). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green, run *after* the brace-expansion fix. No
  `Practice.mobile.test.tsx` flake observed this run.
- `npm audit`: **3 at entry → 2 after `npm audit fix`** (non-force). The
  fix cleared the `brace-expansion` High; the two `react-router`
  moderates remain (need v7 major). See Small fixes for the lockfile
  delta.

## Review focus this run

### Runtime retro-audit — query-planner rewrite (#249 / #253)

The two PRs rewrote user-note parsing in
[`query-planner.ts`](../../supabase/functions/company-research/query-planner.ts):
team-name extraction now normalizes leading stopwords and rejects
role-words in the prefix form, and interviewer-name extraction was
added/hardened with a trailing-team-keyword guard. This is
attacker-adjacent code — it parses free-text `userNote` and embeds
fragments into Tavily search queries — so it got a focused security
read:

- **No ReDoS.** Every regex uses bounded repetition: the team patterns
  cap the capture group at `{0,2}` extra words
  ([lines 138–142](../../supabase/functions/company-research/query-planner.ts)),
  the interviewer pattern at `{1,2}`
  ([line 211](../../supabase/functions/company-research/query-planner.ts)).
  No nested unbounded quantifiers, so no catastrophic backtracking on
  adversarial input. Signal output is additionally `.slice()`-capped (≤4
  labels, ≤2 targeted).
- **No injection surface.** Extracted signals are wrapped in quotes and
  concatenated into search-query strings sent to Tavily's REST API — not
  into SQL, a shell, or a prompt template that grants tool access. The
  `dedupe(... JSON.stringify / JSON.parse ...)` round-trip
  ([lines 390–403](../../supabase/functions/company-research/query-planner.ts))
  is a value round-trip, not `eval`.
- **No cross-user path.** `userNote` is the requesting user's own note
  about their own interview; the derived queries drive that user's own
  research run. Nothing is shared to another user's session.
- **Well tested.** +115 lines of unit tests covering both note forms,
  earliest-mention-wins ordering, stopword stripping, and the
  role-word/trailing-keyword guards.

**Verdict: clean, no regression.** One Low observation below.

### Runtime retro-audit — Home.tsx (#256, PREPIO-111)

Pure copy/layout: the signed-in `/new-interview` hero (`Prepio` marketing
headline) became a task header ("Prep a new interview") with a
breadcrumb/back-link to `/interviews`. No new data flow, no
`dangerouslySetInnerHTML`, no new network call, no new env read. Nothing
to flag.

### Dependency advisory improvement (the substantive fix)

`npm audit` improved from last run's 10 to 3 at entry, then to 2 after
the in-run fix:

| Advisory | Package | Severity | Prod runtime? | Fix | Disposition |
|----------|---------|----------|---------------|-----|-------------|
| GHSA-mh99-v99m-4gvg | brace-expansion `2.0.0–2.1.2` (via `filelist → …`) | High | No (build-time) | `2.1.2 → 2.1.4`, non-force | **Fixed in-run** |
| GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | react-router `6.0.0 – 7.17.0` | Moderate | **Yes** (routing) | v6 → v7 major only | **Deferred** (major, core journeys) |

**brace-expansion (fixed).** The 2026-07-25 run recorded this High as
un-fixable without `npm audit fix --force` (a `vite-plugin-pwa` major
bump). Upstream has since shipped a patched `2.1.4` inside the existing
range, so a plain `npm audit fix` now resolves it — a lockfile-only,
3-line change with `package.json` untouched. It reaches the tree only
through the build toolchain
(`vite-plugin-pwa → … → filelist → minimatch → brace-expansion`), with
no runtime or attacker-controlled path, so it sits squarely inside the
"update dependencies when the risk is low and tests pass" allowance.
Applied; `npm audit` 3 → 2, `npm run build` unchanged, `npm test` 380/380
green afterward.

**react-router (deferred — unchanged from 2026-07-25).** Still no patched
6.x (6.30.4 is the latest 6.x); only remediation is a v6 → v7 major that
governs every route transition plus auth/billing return navigation —
migration-sized, out of hygiene scope. Practical exposure remains **low**
and is unchanged from the detailed 2026-07-25 analysis:
[`Auth.tsx`](../../src/pages/Auth.tsx) `redirectPath` derives from
in-memory `location.state.from` (not a URL param);
[`BillingReturn.tsx`](../../src/pages/BillingReturn.tsx) `fallbackHref`
is URL-controlled but passes through `safeReturnTo`, which rejects the
`//` and `/\` prefixes the open-redirect advisory concerns; the
SSR-hydration advisory does not apply (client-rendered SPA, no SSR).
Deferred, tracked on [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98).

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-07-25.

- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` /
  `import.meta.env.OPENAI_API_KEY` / `import.meta.env.STRIPE_SECRET_KEY` /
  `import.meta.env.TAVILY_API_KEY` in `src/` returns nothing.
- **No tracked `.env` / `.env.local`.** Only `.env.example` is tracked;
  its values are placeholders (truncated `...` or, for
  `SUPABASE_SERVICE_ROLE_KEY`, only the non-secret JWT header prefix
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` = base64 of
  `{"alg":"HS256","typ":"JWT"}`). Untracked non-scratchpad scan clean.
- **No *direct* user content in server console logs.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)` touching
  `question_text|answer_text|transcript_text|user_note|userNote|user_input`
  returns zero hits. **Caveat:** this grep only catches *direct* variable
  use; it misses the *indirect* `userNote → queryPlan.signals →
  console.log` flow flagged as the Low finding below.

## Findings

### Critical

- None.

### High

- None. (The `brace-expansion` High that the prior two runs deferred is
  **fixed in-tree** this run — see Small fixes.)

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
    work (auth + billing return navigation are the high-value regression
    scope). Out of hygiene scope.
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) with the
    security motivation recorded 2026-07-25. Product-owner scheduling
    call.

### Low / clean-up

- [ ] **`QUERY_PLAN` structured log now captures extracted interviewer
  person-names from the user note into first-party operational logs.**
  *(New observation; not a regression introduced by a new log line.)*
  - Evidence:
    [`company-research/index.ts:201`](../../supabase/functions/company-research/index.ts)
    calls `logger?.log('QUERY_PLAN', 'DISCOVERY', { signals:
    queryPlan.signals, queries: queryPlan.queries, … })`.
    [`SearchLogger.log()`](../../supabase/functions/_shared/logger.ts)
    (line 69) forwards `data` to `console.log`, which lands in the
    Supabase edge-function logs. The `QUERY_PLAN` log line itself is
    **pre-existing** (unchanged this window), but #249/#253 widened what
    `extractUserNoteSignals` emits — `signals.userNote` and the built
    `queries` now include *interviewer names* parsed from the free-text
    note, not just team/topic labels.
  - Risk: **Low.** This is the user's own note content plus the name of a
    third party they are interviewing with, going to *first-party
    operational* logs — not cross-user, not client-exposed, not public.
    Supabase log retention is short. But it is prep-note PII in an
    operational log, and the standard secret-scan grep (which matches on
    `userNote` directly) does not catch this indirect flow.
  - Recommended fix: If operational-log PII is a concern, redact the
    free-text-derived fields — e.g. log `roleFamily`, `budget`, and
    counts (`signals.userNote.length`, `queries.length`) but not the raw
    `signals`/`queries` strings; or gate the full payload behind a
    debug-only flag. **Not applied this run** — altering `QUERY_PLAN`
    reduces research-pipeline debuggability that
    [`docs/RUNBOOK.md`](../../docs/RUNBOOK.md) relies on, so it is a
    product-owner observability call, not a unilateral hygiene edit.
  - Owner / next step: Product owner to decide redaction vs. accept.
    Worth a `Chore` / `area:research-pipeline` issue if the workspace
    issue cap is resolved (see Questions).
- [ ] **`Practice.mobile.test.tsx` CI flake — remains Low; not
  reproducing.** *(Carried.)*
  - Evidence: The `{ retry: 2 }` mitigation (PR #226) is still on the
    three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 380 tests passed cleanly this run — no flake observed.
  - Recommended fix: None from this audit. Trigger for a real
    investigation ticket remains: retries actually exhausting in CI.
- [ ] **Dependabot cadence vs. security advisories** — informational,
  recurring. *(Carried.)*
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml)
    runs `npm` monthly. The `brace-expansion` non-major fix became
    available upstream this window and was applied by hand here; no
    off-schedule Dependabot security PR was observed opening it first.
  - Recommended fix: None required — fixed in-tree. Next reviewer:
    confirm GitHub Settings → Code security has Dependabot *security*
    updates enabled so patched advisories auto-open PRs between the
    monthly version runs.
- [ ] **`lovable-tagger` keep-or-drop decision** — fourteenth audit
  waiting. *(Carried.)*
  - Evidence: [`vite.config.ts:33`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`; unused in production.
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.

## Small fixes made in this run

- **`npm audit fix` — resolved the `brace-expansion` High advisory
  (lockfile-only).** `brace-expansion 2.1.2 → 2.1.4`
  (GHSA-mh99-v99m-4gvg), a 3-line `package-lock.json` change with
  `package.json` untouched. The prior two runs (2026-07-22, 2026-07-25)
  recorded this High as deferred because the only fix then required
  `npm audit fix --force` (a `vite-plugin-pwa` major bump); upstream has
  since published a patched `2.1.4` inside the existing range, bringing
  it within the low-risk lockfile allowance. Build-time only, no runtime
  path. Verified `npm audit` 3 → 2, `npm run build` unchanged (2265.72
  KiB, 60 precache entries), `npm test` 380/380 green after the change.
  Committed on this run's branch.

Explicitly *not* touched this run:

- **The react-router v7 major upgrade.** Migration-sized, browser-tested
  work outside the low-risk lockfile allowance; deferred with Linear
  tracking (PREPIO-98).
- **The `QUERY_PLAN` operational-log PII observation.** Changing it
  reduces research-pipeline debuggability the RUNBOOK depends on — a
  product-owner observability call, not a hygiene edit (see Low finding).
- **The 381-error typecheck backlog** and the **39 react-hooks
  violations.** Coordinated cleanup passes, not hygiene-runner scope.

## Deferred items

Tracked in Linear (no free-form bullets to re-discover):

- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — Major
  dependency-migration planner. Carries the react-router 6 → 7 upgrade
  with the security motivation (recorded 2026-07-25).
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Fourteenth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass.
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild
  override test guard (PR #240). Product-owner merge call.
- **NEW (unfiled): `QUERY_PLAN` operational-log PII redaction.** Should
  be a `Chore` / `area:research-pipeline` issue in Quality &
  Maintenance, cross-linked to this audit and #249/#253. **Could not be
  filed** — the Linear workspace free-issue cap (documented 2026-07-25)
  is assumed still in effect; recorded here until intake unblocks.

## Questions for product owner

- **`QUERY_PLAN` log PII — redact or accept?** The research-pipeline
  discovery log now writes interviewer names parsed from the user's note
  into first-party edge-function logs (Low finding). It's the user's own
  data in operational logs, not a cross-user leak, but it is prep-note
  PII. Redact the free-text-derived fields (keep counts + `roleFamily`
  for debuggability), or accept with this note on record?
- **Schedule the react-router v7 upgrade?** Two standing moderate
  advisories with no patched 6.x — they will keep appearing in
  `npm audit` until v7 lands. Scope into a cycle, or accept the standing
  advisory with the low-exposure note on record? *(Carried.)*
- **Is the Linear workspace free-issue cap resolved?** It blocked
  hygiene intake on 2026-07-25 and would block filing the new
  `QUERY_PLAN` redaction issue this run. If still capped, findings keep
  landing in the audit doc as the system of record. Upgrade the plan or
  triage `Done`/`Canceled` issues to free capacity?
- **Is `lovable-tagger` still in use?** Fourteenth run asking. One-line
  cleanup (PREPIO-96) blocked on this. *(Carried.)*

## Next review focus

1. **Confirm `react-router` remains the only open advisory.** With
   `brace-expansion` cleared, `npm audit` should read 2 (both
   react-router). Watch for any new build-time advisory from the
   `vite-plugin-pwa → workbox-build` toolchain, the recurring source.
2. **`QUERY_PLAN` log PII disposition.** If the product owner opts to
   redact, that becomes a small, tested edge-function change to
   retro-audit next cycle; if accepted, close the loop in the doc.
3. **Next research-pipeline PR.** #249/#253 show the query planner is
   under active iteration — the next change there is the natural
   retro-audit target, with attention to whether any new free-text
   parsing widens the operational-log PII surface further.
