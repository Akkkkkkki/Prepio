# Recurring hygiene review — 2026-11-25

## Summary

Recurring codebase hygiene & security review, measured on `main` @ **`ee3ea7b`**.
The last review on `main` (2026-11-14) measured `a330939`. Since then **eleven PRs
have merged**, five of them source-touching. This run read the merged code for each:

| PR | Change | Verdict |
|----|--------|---------|
| #375 [PREPIO-184] | Evidence ledger: `official_company` now requires the company to match the host's **registrable label** (eTLD+1, small multipart-suffix list, delegated-host deny-list), not any substring of the host. | **Fixes the carried Medium.** `acme.attacker.example` now reads as `market_heuristic`/low (re-probed). Two narrower residuals remain; see Medium and Low below. |
| #395 PREPIO-156 | `research_yield` log gains `role_family` + four top-5 outcome fields via `buildResearchYieldEvent`. | **Clean.** `role_family` is a closed enum (`tech`/`consulting`/`finance`/`other`) from `classifyRoleFamily(role, userNote)`; no free text reaches the log. `company` and `level` were already logged. The outcome fields are always `null` until a debrief exists (PREPIO-158), which `RUNBOOK.md` states correctly. |
| #393 | Interview cards show a UTC start date. | **Clean.** Strict ISO-with-offset regex, invalid dates fall back to "Start date unavailable". UI-only. |
| #396 / #401 | Offline evidence-integrity eval harness under `evals/research/`. | **Clean.** No network calls, secrets or PII; fixtures are public job URLs. Runs in `npm test`, which explains most of the test-count jump (494 → 714). |
| #399 | `interview-research` call-graph test. | Test-only. |

Plus five docs-only audit-note merges (#383, #386, #391, #398, #400).

**Ownership checks re-audited (next-review focus from 2026-11-14).** `company-research`
and `job-analysis` both call `ensureServiceCaller` and reject any non-service JWT with
403 *before* reading `searchId`, so a user cannot drive either function at another
user's search. `cv-analysis` generates its own `searchId`. `answer-feedback` is not in
the freeze manifest (`supabase/freeze-functions.json`). No new BOLA-style path found.

**Secret scan clean.** No tracked `.env`, key, or credential file besides
`.env.example` (placeholders). One tidy-up: `supabase/.temp/` (Supabase CLI link cache)
is listed in `.gitignore` but its six files were committed before the ignore rule. They hold
no secret (the pooler URL has a `[YOUR-PASSWORD]` placeholder; the project ref is
already public in `supabase/config.toml`), but they shouldn't be tracked. Untracked in
this run.

**`typecheck:functions` ran for real this time.** Earlier runs reported it as
"SKIPPED — not a pass" because the proxy blocked `esm.sh`/`deno.land`. This session
resolved the imports: **19 errors, at baseline, pass.**

## Commands run

- `npm install`: **pass** (SessionStart hook; 748 packages, `up to date`).
- `npm run lint`: **runs, 49 problems** (40 errors, 9 warnings). Same pre-existing
  classes as before (`no-explicit-any` in tests/edge functions, fast-refresh warnings).
  Informational in CI, not a gate. Unchanged since 2026-11-14.
- `npm run typecheck`: **pass at baseline** (app **61**, node **0**).
- `npm run typecheck:functions`: **pass at baseline** (Deno **19**). First run in which
  this gate was runnable from the review environment.
- `npm run build`: **pass** (41 precache entries, **1243.85 KiB**, +0.44 KiB from #393).
- `npm test`: **pass**: **714 tests / 63 files** (was 494 / 58), plus the
  legacy-schema, answer-feedback-schema and design-token checks.
- `npm audit`: **23** (1 low, 17 moderate, 5 high), down from 25. See Low below.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII still recoverable from Git history (PREPIO-145).** *(Carried.)*
  - Evidence: no history rewrite has landed since 2026-11-14 (the `ee3ea7b` history
    still contains the pre-redaction audit screenshots, as verified in that run). Linear
    shows PREPIO-145 **Todo / Urgent**, assigned to the owner, last touched 2026-11-24.
  - Risk: personal data in a public repo, fetchable by commit SHA. Freeze-exit blocker.
  - Recommended fix: unchanged. Owner-attended `git filter-repo`/BFG purge +
    coordinated force-push + exposure review. **Not something to run unattended.**
  - Owner / next step: **PREPIO-145** (owner).

### Medium

- [ ] **Evidence ledger trusts user-generated pages on a platform the researched
  company owns as `official_company`/high.** *(New. Not caused by #375; the old
  substring match had the same gap.)*
  - Evidence: a throwaway probe (not committed) against
    [`buildEvidenceLedger`](../../supabase/functions/interview-research/evidence-ledger.ts)
    classified these as `official_company` / `high`:
    `sites.google.com/view/<anyone>` for **Google**, `github.com/<anyone>/…` and
    `gist.github.com/<anyone>/…` for **GitHub**, `medium.com/@<anyone>/…` for
    **Medium**. `registrableLabel` correctly reads `google`/`github`/`medium`; the
    match is real ownership of the *domain*, but not authorship of the *page*.
  - Risk: content-integrity, not cross-tenant. For top interview targets (Google,
    Microsoft, Amazon), Tavily can surface third-party Docs/Sites/forum pages, which then
    get the same weight as the employer's careers site in the generated plan.
  - Recommended fix: a small user-content host/path deny-list feeding into the existing
    `DELEGATED_HOST_SUFFIXES` fall-through (only ever lowers trust), plus adversarial
    tests.
  - Owner / next step: filed **[PREPIO-194](https://linear.app/qiuyue/issue/PREPIO-194)**
    (Quality & Maintenance, `Chore` + `area:research-pipeline`, related to PREPIO-184).

### Low / clean-up

- [ ] **Trailing-dot FQDN reads the TLD as the registrable label.** *(Fix in flight,
  not on `main`.)*
  - Evidence: `hostFor` keeps a trailing `.`, so `anything.shop./…` is classified
    `official_company` for a company named "Shop" (probe-confirmed). Real-world exposure
    is small (needs a generic TLD that equals a company name, plus a trailing-dot URL in
    search results).
  - Recommended fix: already authored as open **#408** (strip trailing dot) and **#411**
    (tests). Review and merge.

- [ ] **`supabase/.temp/` committed despite `.gitignore`.** **Fixed in this run.**
  - Evidence: six Supabase CLI cache files (`project-ref`, `pooler-url` with password
    placeholder, service version pins) were tracked even though `.gitignore:15` lists
    `supabase/.temp/`. Nothing in the repo reads them; `supabase link` regenerates them.
  - Fix: `git rm -r --cached supabase/.temp`. Local copies stay on disk.

- [ ] **`zod` and `@hookform/resolvers` are declared runtime dependencies that no app
  code imports.**
  - Evidence: `git grep zod -- src supabase/functions` returns nothing; the only form
    file (`src/components/ui/form.tsx`) imports `react-hook-form`, not the resolvers.
    `zod@3.25.76` carries the one "high" advisory on a direct runtime dependency, but
    since nothing imports it, it never reaches the bundle. (Corrects the 2026-10-24
    note, which said zod backs client-side form validation.)
  - Recommended fix: drop both from `dependencies` after the freeze (CLAUDE.md bars
    routine dependency PRs during it). Fold into PREPIO-98.

- [ ] **`npm audit` 23: no runtime exposure.**
  - Evidence: the five highs are `brace-expansion` (dev), `source-map-js` (build),
    `undici` (via `jsdom`, tests), `vite` (dev-server / `launch-editor` advisories;
    7.3.6 fixes, SemVer-compatible), and `zod` (unused, above). Moderates are
    eslint/typescript-eslint/vitest/vite-plugin-pwa/`@tailwindcss/typography` tooling.
  - Recommended fix: leave to Dependabot security updates / the post-freeze dependency
    plan (PREPIO-98). The 2026-11-14 question about whether Dependabot security updates
    are firing is still open.

- [ ] **Unmerged audit-note and fix PR backlog keeps growing.** *(Carried.)*
  - Evidence: 21 open PRs. Twelve are unmerged audit notes (hygiene #374, #379, #381,
    #384, #388, #390, #394, #397, #408; UX #376, #380, #409). Fix/test PRs:
    #408/#411 (trailing dot), #410 (delegated-host tests), #389 (lockfile security
    patches), #378 [PREPIO-132], #385 [PREPIO-101], and cursor-bot test PRs #377, #382
    (draft), #387, #392.
  - Recommended fix: owner triage. Merge or close the stale notes, and merge #408/#411
    so the trailing-dot Low closes.

## Small fixes made in this run

- Untracked the gitignored `supabase/.temp/` Supabase CLI cache (six files, no
  secrets). No product source changed.
- Filed **PREPIO-194** for the user-content-platform trust gap.
- This note + the `docs/audits/README.md` index row.

## Deferred items

- **PREPIO-145**: Git-history CV PII purge (High, owner-attended).
- **PREPIO-194**: user-content-platform `official_company` over-trust (Medium).
- **#408 / #411**: trailing-dot host fix, authored, awaiting merge.
- **PREPIO-98**: post-freeze dependency work. Includes dropping unused `zod` and
  `@hookform/resolvers`, and the dev-tooling advisory bumps.
- Open-PR backlog triage (owner).

## Questions for product owner

- **Should #408 and #411 merge now?** They close a probe-confirmed (if narrow)
  trust-classification bug in the shipped research path. Six unmerged hygiene notes
  sit ahead of it in the queue.

## Next review focus

1. **PREPIO-194 and the trailing-dot fix landing.** When they merge, re-run the
   adversarial probe (company-owned user-content hosts, trailing dots, delegated hosts)
   against the merged `classifyRetrievedSource`.
2. **PREPIO-145.** Check whether the owner-attended history purge has happened. If it
   has, confirm the blob no longer resolves by SHA.
3. **Deno gate drift.** `typecheck:functions` is runnable here now (baseline 19). Run it
   on every source-touching merge, not just record it as skipped.
