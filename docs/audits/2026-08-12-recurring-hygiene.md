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

**Headline result: the pipeline's *new* code is well-engineered, but
adversarial review surfaced a real pre-existing authorization gap the first
read missed.** The new synthesis/grounding code is defensively written —
ID-only citations enforced in code, opaque story aliases so real bullet IDs
never reach the model, code-owned ledger persistence, bounded
profile-lookup + acknowledgement timeouts, and a `status = 'pending'` guard
so a startup timeout can't clobber an in-flight run.

My first-pass conclusion — "authz intact, no cross-user path" — was
**overstated**, and a Codex review on this PR (#295) correctly challenged
it. Verified against the code: `interview-research` checks only that the
body `userId` matches the JWT user; it **never verifies the caller-supplied
`searchId` belongs to that user**, and every write goes through the
service-role client (RLS-bypassing). An authenticated caller who knows a
victim's search UUID can overwrite that victim's prep plan / questions /
status — a broken object-level authorization (BOLA) **cross-tenant write**
(High; write-only, UUID-gated, **pre-existing** — not introduced by this
window). Filed as
[PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143). Codex also flagged
that the ledger grants `official_job`/high-trust to unvalidated
caller-supplied `roleLinks` (Low,
[PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144)). Both are recorded
in Findings below; the lesson is that a single-reader "clean" verdict on
an authorization surface is worth an adversarial second pass.

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
- **Client-supplied profile is own-data, flag-gated, degradable** — *in the
  normal flow.* `candidateProfile` arrives in the request body, is the
  requesting user's own profile, both flags default off, and
  `withProfileLookupTimeout` (5s) falls back to the legacy CV path on any
  timeout/error. **Caveat (see High finding):** because `searchId` ownership
  is not verified, a caller can steer their profile text/bullet IDs into a
  *victim's* question rows by supplying the victim's `searchId`. The
  own-data guarantee holds only as long as the `searchId`-ownership gap
  (PREPIO-143) is open.

### Async background job (#277) + startup guard

- The 202-early-ack rework is reliability-positive: the inline-await
  fallback means a runtime without `waitUntil` never abandons the pipeline,
  the 60s ack timeout bounds a stalled gateway, and the `searches` failure
  write is now scoped `.eq("status", "pending")` so a startup timeout
  cannot clobber a run already past `pending`. Background errors are caught
  and logged rather than surfacing as unhandled rejections. **Note:** this
  refactor did not touch request authorization, so the missing `searchId`
  ownership check (High, PREPIO-143) is orthogonal to and pre-dates it.

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

- [ ] **`interview-research` never verifies `searchId` ownership —
  cross-tenant write (BOLA) via the service-role client.** *(New this run;
  surfaced by Codex review on PR #295, verified against the code.
  Pre-existing, not a regression from this window.)*
  - Evidence: the only identity check is body `userId` == JWT user
    ([index.ts:1096](../../supabase/functions/interview-research/index.ts)).
    `searchId` is never checked against the caller, and all writes use the
    service-role client (RLS-bypassing): `prep_plans` upsert on `search_id`,
    `interview_stages`/`interview_questions` inserts, and `searches` status
    updates `.eq('id', searchId)`. The legitimate flow
    ([`searchService.createSearchRecord`](../../src/services/searchService.ts):485)
    always creates the `searches` row with `user_id = user.id` before
    invoking, so an ownership check would break nothing.
  - Risk: **High (integrity).** An authenticated caller who knows a victim's
    search UUID can overwrite that victim's prep plan / stages / questions
    and flip their search status, and inject the caller's own profile
    text/bullet IDs into the victim's rows. **Write-only — not a read/exfil
    path** (results derive from the caller's inputs; the 202 returns no
    data; frontend reads stay RLS-scoped). Gated by knowing a non-enumerable
    UUID that nonetheless appears in shareable `/search/:searchId` URLs.
  - Recommended fix: fail closed on ownership in the `serve` handler before
    background work — `select id from searches where id = searchId and
    user_id = authContext.userId`, else 404. Small, safe, no legitimate-flow
    impact. **Not applied in this docs-only run**: an authorization change to
    a core edge function warrants its own reviewed, test-covered PR rather
    than being bundled unattended into a hygiene-note PR.
  - Owner / next step: **Filed as
    [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143)** (Bug,
    `area:research-pipeline` + `area:infra`, High). Recommend scheduling
    ahead of any `PROFILE_STORY_LINKING` rollout.
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

- [ ] **Evidence ledger grants `official_job`/high-trust to unvalidated
  caller-supplied `roleLinks`.** *(New this run; Codex PR #295, line 95.)*
  - Evidence:
    [`evidence-ledger.ts:328–335`](../../supabase/functions/interview-research/evidence-ledger.ts)
    forces `sourceType: "official_job"` (→ `trustWeight: "high"`) on every
    `jobRawData.results` row, and those rows come from `job-analysis`
    extracting arbitrary user-pasted `roleLinks` with no host validation.
    The ledger classifies by provenance *channel*, not by whether the URL is
    actually a job/employer origin.
  - Risk: **Low.** `roleLinks` normally affect only the caller's own run
    (self-inflicted mis-grounding); the concern sharpens only in combination
    with the `searchId`-ownership High (PREPIO-143).
  - Recommended fix: classify job rows via the existing
    `isJobPosting(url, title)` / company-domain check (as company rows
    already are) instead of a blanket `official_job` force.
  - Owner / next step: **Filed as
    [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144)** (Chore,
    `area:research-pipeline`).
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
- [ ] **`Practice.mobile.test.tsx` CI flake — crossed its trigger this run;
  now Linear-tracked.** *(Carried, escalated.)* All 423 tests passed
  cleanly **locally**, but the "ArrowLeft navigates back after skipping
  forward" case (`Practice.mobile.test.tsx:802`) **exhausted its `{ retry: 2 }`
  budget and failed the `verify` job on this docs-only PR #295**
  (`Test timed out in 5000ms`; 422/423). The change touches only this audit
  markdown file, so the failure is pure flake, not a regression. This is the
  exact "retries actually exhaust in CI" trigger the finding has carried for
  months, so it is now filed as
  [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142) (Bug,
  `area:practice` + `area:infra`). CI was re-run to unblock the PR.
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
- **Filed [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142)** after
  the `Practice.mobile.test.tsx` flake exhausted its retry budget and failed
  CI on this PR (see the Low finding) — the documented trigger for
  escalating the standing flake to a real ticket. CI was re-run to bring the
  PR green.
- **Filed [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) (High
  BOLA) and [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144) (Low
  role-link trust)** after adversarial Codex review on this PR surfaced them
  and I verified both against the code. The audit conclusion above was
  corrected from "authz intact / no cross-user path" to record the real
  authorization gap. **No code fix in this PR** — the `searchId` ownership
  check belongs in its own reviewed, test-covered security PR, not bundled
  unattended into a docs note.

No source code changed this run — the review is delivered as this note plus
the tracked findings. The two code findings this run (the `searchId` BOLA
and the ledger role-link over-trust) are authorization/grounding changes to
a core edge function that each warrant a reviewed, test-covered PR, and the
one advisory-driven High needs a breaking major — none fit an unattended,
low-risk docs-PR fix.

Explicitly *not* touched this run:

- **The `searchId`-ownership BOLA fix (PREPIO-143).** A small but real
  edge-function authorization change; belongs in a dedicated security PR
  with a cross-tenant-rejection test, not this docs note.
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
- [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) — **High:**
  `searchId`-ownership BOLA in `interview-research` (cross-tenant write).
  **Filed this run.** The code fix is deferred to a dedicated, reviewed
  security PR.
- [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144) — evidence-ledger
  `official_job` over-trust of caller-supplied `roleLinks` (Low). **Filed
  this run.**
- [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142) — flaky
  `Practice.mobile.test.tsx` keyboard-nav case (exhausts retries, fails CI).
  **Filed this run.**
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — major
  dependency-migration planner (carries the react-router 6 → 7 upgrade).
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — stale bot-PR
  cleanup pass.
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild override
  test guard (PR #240). Product-owner merge call.

## Questions for product owner

- **Schedule PREPIO-143 (`searchId`-ownership BOLA) as a priority fix?** It
  is a cross-tenant write on user-owned research data. The fix is small
  (one fail-closed ownership check) but changes edge-function authorization,
  so it wants its own reviewed PR with a cross-tenant-rejection test —
  ideally before `PROFILE_STORY_LINKING` is turned on.
- **Schedule PREPIO-140 (`pdfjs-dist` 5 → 6)?** The advisory-driven High and
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

1. **PREPIO-143 (`searchId` BOLA) fix PR.** The highest-value follow-up —
   verify the ownership check lands with a cross-tenant-rejection test and
   that the normal create→invoke flow still passes. Then re-audit the other
   service-role edge functions (`company-research`, `job-analysis`,
   `answer-feedback`, etc.) for the same missing object-ownership check.
2. **PREPIO-140 / react-router disposition.** If either major bump gets
   scheduled, the upgrade PR becomes a focused retro-audit; if both are
   accepted as standing advisories, `npm audit` should stay at 3.
3. **Next research-pipeline PR under the story-linking flags.** If
   `PROFILE_STORY_LINKING` moves toward on, re-audit the profile-context
   path end to end (serialization budget, alias resolution, and whether any
   profile text widens the operational-log surface).
4. **Confirm the Deno edge-function typecheck runs green in CI.** It was
   gated in #294 but is unreachable from this environment; verify CI is
   actually exercising it (not silently skipping like the root tsc no-op
   PREPIO-119 caught).
