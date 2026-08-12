# Recurring hygiene review — 2026-08-12

## Summary

Twenty-second recurring codebase hygiene & security review for Prepio.

This is the widest review window in several runs. Since the last hygiene
review (#286, base `a40c250`, 2026-08-08) merged, `main` has advanced 17
commits to HEAD `d9cc5d1`, including the highest-risk work in the codebase
— the grounded-evidence research-pipeline rework flagged as *next focus*
by the last three reviews:

- **#277 ([PREPIO-40](https://linear.app/qiuyue/issue/PREPIO-40))** — run
  research as an asynchronous background job. `interview-research` now
  acknowledges with **202** and continues via `EdgeRuntime.waitUntil`,
  falling back to awaiting inline where the runtime has no background
  lifetime. Removes the browser + company-research 15s wall-clock races.
- **#283 ([PREPIO-78](https://linear.app/qiuyue/issue/PREPIO-78))** —
  ground evidence citations in a verified retrieval ledger. New
  [`evidence-ledger.ts`](../../supabase/functions/interview-research/evidence-ledger.ts)
  builds a deterministic `ev-*` ledger from real retrieval + first-party
  inputs; synthesis may only cite ledger IDs, and code (not the model)
  owns the persisted evidence log.
- **#285 ([PREPIO-57](https://linear.app/qiuyue/issue/PREPIO-57))** — link
  structured profile stories into research + Practice, behind default-off
  `PROFILE_STORY_LINKING` / `VITE_PROFILE_STORY_LINKING` flags. New
  [`profile-story-linking.ts`](../../supabase/functions/interview-research/profile-story-linking.ts)
  serializes citable bullets into opaque `S*` handles.

**Headline result: the pipeline rework is clean.** Read in full, the new
code is defensively engineered — ID-only citations enforced in code, opaque
story aliases so real bullet IDs never reach the model, code-owned ledger
persistence, bounded profile-lookup + acknowledgement timeouts, and a
`status = 'pending'` guard so a startup timeout can't clobber an in-flight
run. No new Critical / High / Medium finding came out of the diff.
Authorization is intact (the body `userId` must still match the JWT user).
Secret / client-exposure re-scan clean; both new env flags are already
documented in `.env.example`, RUNBOOK, and ARCHITECTURE.

**Process win this run:** the Linear issue-intake block that four prior
reviews cited as the reason the two standing deferred items stayed
audit-doc-only is **resolved** (new issues are being filed in the
workspace — e.g. PREPIO-137 on 2026-08-12). Both standing deferred items
were filed this run:
[PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140) (the `pdfjs-dist`
High) and [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141) (the
`QUERY_PLAN` log-PII Low). No source code changed this run — there was no
in-scope, low-risk code fix to make (the one open High needs a breaking
major; see Deferred).

Baselines: lint **54 problems** (unchanged). Typecheck **pass at baseline**
— note the app baseline dropped **381 → 64** via the PREPIO-133 triage
(#293), and CI now type-checks the Edge Functions too (#294). Tests **up
390 → 423** (the new pipeline suites). Build **2278.29 KiB** / 62 precache
entries. `npm audit` **3** (2 react-router moderate + 1 pdfjs high), all
carried and now Linear-tracked.

## Commands run

- `npm install`: **pass** (via SessionStart hook). 3 vulnerabilities
  (2 moderate, 1 high) — unchanged from the 2026-08-08 exit state.
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged from
  2026-08-08 (39 `react-hooks` violations + the standing 15-problem
  baseline). No net drift from the 17 merged commits.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 64 errors (baseline 64 — was 381 before the
  PREPIO-133 static-analysis triage in #293). Node: 0 errors (baseline 0).
- `npm run typecheck:functions` (new in #294,
  [`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not available in this environment.** The agent proxy blocks
  `esm.sh` / `deno.land`, so Deno cannot resolve the remote imports; the
  script correctly reports `SKIPPED — this is not a pass` rather than a
  false green. Runs in CI where those hosts are reachable.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries,
  **2278.29 KiB**). Up +11.8 KiB from 2026-08-08 (2266.47) — the new
  client-side `candidateProfile.ts` completion helpers and pipeline types.
- `npm test`: **pass** (49 test files, **423 tests**, up from 392). Vitest
  + `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all green.
  New suites: `evidence-ledger.test.ts`, `profile-story-linking.test.ts`,
  `candidateProfile.test.ts`, plus Dashboard/Practice/Interviews coverage.
- `npm audit`: **3** (2 react-router moderate + 1 pdfjs-dist high). No
  lockfile-only fix is available this run — both remaining advisories need
  breaking majors. `npm audit fix` (non-force) is a no-op here.

## Review focus this run — research-pipeline retro-audit

The 17-commit window is dominated by the grounded-evidence rework. Read
[`evidence-ledger.ts`](../../supabase/functions/interview-research/evidence-ledger.ts),
[`profile-story-linking.ts`](../../supabase/functions/interview-research/profile-story-linking.ts),
and the [`interview-research/index.ts`](../../supabase/functions/interview-research/index.ts),
[`company-research/index.ts`](../../supabase/functions/company-research/index.ts),
and [`searchService.ts`](../../src/services/searchService.ts) diffs in full.

### Evidence ledger (#283) — grounding hardened, not weakened

- **The model can no longer author evidence.** `getPrepPlanSchema` now
  ships an empty `internalEvidenceLog`, the prompt forbids inventing URLs /
  labels / trust weights, `sanitizePlanEvidenceCitations` strips any cited
  `evidenceId` not present in the code-built ledger, and persistence writes
  the **code-owned `evidenceLedger`** directly
  ([index.ts:944](../../supabase/functions/interview-research/index.ts)),
  never the model's array. A stage left with zero resolvable citations is
  force-downgraded to `low` confidence with honest guidance; a zero-ledger
  plan is marked `weakSignalCase`. This is a security/quality *improvement*
  over the prior model-graded log.
- **No new log-PII surface.** Ledger `snippet`/`excerpt` fields (incl. the
  user's own CV / note text) are passed into the synthesis prompt and
  persisted to the owner's own RLS-scoped `prep_plans` row, but are **not**
  logged — `logSynthesisOutcome` emits only counts and dropped `ev-*` IDs.
  `company-research` deliberately keeps `raw_research_data` out of the file
  logger (explicit comment) to avoid duplicating raw retrieval content.

### Profile story linking (#285) — opaque handles, own-data only

- **Real bullet IDs never reach the model.** `serializeProfileForPrompt`
  emits `S1`/`S2` aliases; the reverse map stays server-side, and only the
  resolving user's own `linked_story_bullet_id` / `_text` / `_source` land
  on their own question rows (new migration
  [`20260808110000_profile_story_linking.sql`](../../supabase/migrations/20260808110000_profile_story_linking.sql),
  nullable columns under the table's existing RLS). Hallucinated aliases
  degrade to `null`.
- **Client-supplied profile is own-data, flag-gated, degradable.**
  `candidateProfile` arrives in the request body, but it is the requesting
  user's own profile affecting only their own search, both flags default
  off, and `withProfileLookupTimeout` (5s) falls back to the legacy CV path
  on any timeout/error. No cross-user path.

### Async background job (#277) + startup guard

- The 202-early-ack rework is reliability-positive: the inline-await
  fallback means a runtime without `waitUntil` never abandons the pipeline,
  the 60s ack timeout bounds a stalled gateway, and the `searches` failure
  write is now scoped `.eq("status", "pending")` so a startup timeout
  cannot clobber a run already past `pending`. Background errors are caught
  and logged rather than surfacing as unhandled rejections.

### Secret / client-exposure re-scan — clean

- **No server-only env referenced from `src/`.** Grep for
  `import.meta.env.{SUPABASE_SERVICE_ROLE_KEY,OPENAI_API_KEY,STRIPE_SECRET_KEY,TAVILY_API_KEY,OPENAI_MODEL}`
  returns nothing. The two new flags are correctly split: `VITE_…` (client)
  and the unprefixed `PROFILE_STORY_LINKING` (Edge secret via `Deno.env`).
- **`.env.example` complete.** Both new flags documented with default
  `false`; no real secret present (the `SUPABASE_SERVICE_ROLE_KEY`
  placeholder is only the public JWT header). Matches RUNBOOK + ARCHITECTURE.

## Findings

### Critical

- None.

### High

- [ ] **`pdfjs-dist` arbitrary-JS-execution advisory (GHSA-hq66-cqwq-w95j)
  — production resume-parser dep; needs a breaking 5 → 6 major to fully
  remediate.** *(Carried from 2026-08-08; now Linear-tracked.)*
  - Evidence: `npm audit` reports it High against `pdfjs-dist 5.6.205`
    (direct dep, `~5.6.205`), used client-side in
    [`resumeUpload.ts`](../../src/lib/resumeUpload.ts). Affected range
    `>=5.6.83 <6.2.108`; fix is `6.2.108` (major).
  - Risk: **Low in practice, real surface.** The app only calls
    `getTextContent()` — never renders, never enables scripting — so the
    advisory's JS-execution vector is not reached; pdf.js runs in a Web
    Worker; and the `isEvalSupported: false` hardening (PR #286) disables
    the `eval()`/`Function` codepath. But a crafted resume PDF is still
    attacker-controlled input entering the browser.
  - Recommended fix: `pdfjs-dist` 5 → 6 as focused, real-browser-tested
    work (resume upload/parse on Home + Profile, PDF + DOCX). Out of
    hygiene scope.
  - Owner / next step: **Filed as
    [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140)** (Chore,
    `area:profile` + `area:infra`, Quality & Maintenance, priority High).
    Product-owner scheduling call.

### Medium

- [ ] **`react-router` open-redirect + SSR advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x.** *(Carried, unchanged.)*
  - Evidence: `npm audit` reports both (moderate) against
    `react-router` / `react-router-dom` 6.30.4; no 6.x fix — only v7.
  - Risk: **Low in Prepio.** Both dynamic redirect targets have same-origin
    protection (`Auth.tsx` derives from `location.state.from`, not a URL
    param; `BillingReturn.tsx` passes `?returnTo=` through `safeReturnTo`,
    which rejects the `//` and `/\` vectors). SSR advisory N/A (SPA).
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98). Product-owner
    scheduling call.

### Low / clean-up

- [ ] **`QUERY_PLAN` structured log captures interviewer person-names
  parsed from the user note into first-party operational logs.**
  *(Carried from 2026-08-01/05/08; not touched this window; now
  Linear-tracked.)*
  - Evidence:
    [`company-research/index.ts:~201`](../../supabase/functions/company-research/index.ts)
    logs `QUERY_PLAN` with `signals` + `queries`, forwarded to
    `console.log` by [`SearchLogger.log()`](../../supabase/functions/_shared/logger.ts).
  - Risk: **Low.** User's own note + a third-party interviewer name, to
    first-party operational logs — not cross-user, not client-exposed;
    short retention.
  - Owner / next step: **Filed as
    [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141)** (Chore,
    `area:research-pipeline`). Redact vs. accept is a product-owner
    observability decision recorded on the issue.
- [ ] **`Practice.mobile.test.tsx` CI flake — remains Low; not
  reproducing.** *(Carried.)* All 423 tests passed cleanly; the `{ retry: 2 }`
  mitigation holds. Trigger for a real ticket remains retries exhausting in CI.
- [ ] **Dependabot cadence vs. security advisories — informational.**
  *(Carried.)* [`.github/dependabot.yml`](../../.github/dependabot.yml) runs
  `npm` monthly. Next reviewer: confirm GitHub → Code security has
  Dependabot **security** updates enabled so patched advisories auto-open
  PRs between monthly version runs.

## Small fixes made in this run

- **Filed the two standing deferred items in Linear** now that the
  workspace intake is confirmed open:
  [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140) (`pdfjs-dist`
  5 → 6 security upgrade, High) and
  [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141) (`QUERY_PLAN`
  log-PII redaction, Low). Both Chore-typed, area-labelled, in Quality &
  Maintenance, cross-linked to this audit and the introducing PRs, per the
  CLAUDE.md recurring-hygiene requirement. This clears the "still unfiled"
  note that four prior reviews carried.

No source code changed this run. The wide pipeline diff produced no
Critical/High/Medium code finding, and the one open High needs a breaking
major that is out of the hygiene-runner's low-risk allowance — there was no
in-scope, low-risk code fix to make.

Explicitly *not* touched this run:

- **The `pdfjs-dist` 5 → 6 major bump.** Breaking, real-browser-tested work
  on the resume-parse journey — deferred with High tracking (PREPIO-140).
- **The react-router v7 major upgrade.** Migration-sized; deferred
  (PREPIO-98).
- **The `QUERY_PLAN` redaction.** Product-owner observability call
  (PREPIO-141).
- **The 64-error typecheck backlog** and the **39 react-hooks violations.**
  Coordinated cleanup passes, not hygiene-runner scope (PREPIO-133 line).

## Deferred items

Tracked in Linear (no free-form bullets left to re-discover):

- [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140) — `pdfjs-dist`
  5 → 6 security upgrade (High advisory, production resume parser). **Filed
  this run.**
- [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141) — `QUERY_PLAN`
  operational-log PII redaction (Low; redact-vs-accept decision). **Filed
  this run.**
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — major
  dependency-migration planner (carries the react-router 6 → 7 upgrade).
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — stale bot-PR
  cleanup pass.
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild override
  test guard (PR #240). Product-owner merge call.

## Questions for product owner

- **Schedule PREPIO-140 (`pdfjs-dist` 5 → 6)?** The only remaining High and
  the only advisory on a genuine production-runtime, untrusted-input path.
  Defense-in-depth is already shipped; the version bump is the true fix and
  needs a real-browser resume-parse regression pass.
- **PREPIO-141 (`QUERY_PLAN` log PII) — redact or accept?** *(Carried.)*
  Redact the free-text-derived fields (keep counts + `roleFamily` for
  debuggability), or accept with the issue as the on-record decision?
- **Enable Dependabot *security* updates?** Recurring highs (postcss →
  brace-expansion → fast-uri/undici → nanoid/pdfjs) keep surfacing between
  monthly version runs. Turning on security updates would auto-open these.

## Next review focus

1. **PREPIO-140 / react-router disposition.** If either major bump gets
   scheduled, the upgrade PR becomes the next focused retro-audit; if both
   are accepted as standing advisories, `npm audit` should stay at 3.
2. **Next research-pipeline PR under the story-linking flags.** If
   `PROFILE_STORY_LINKING` moves toward on, re-audit the profile-context
   path end to end (serialization budget, alias resolution, and whether any
   profile text widens the operational-log surface).
3. **Confirm the Deno edge-function typecheck runs green in CI.** It was
   gated in #294 but is unreachable from this environment; verify CI is
   actually exercising it (not silently skipping like the root tsc no-op
   PREPIO-119 caught).
