# Recurring hygiene review — 2026-08-22

## Summary

Twenty-fourth recurring codebase hygiene & security review for Prepio.

**Docs-only window — the quietest kind.** Since the last hygiene review
(#302, base `1ee9cbe`, 2026-08-19) merged, `main` advanced **two** commits
to HEAD `3dc1852`, both documentation:

- **#303** — the 2026-08-20 UX review routine note (run #16) plus its
  screenshot assets under `docs/audits/assets/2026-08-20/`.
- **#305** — `docs/FUTURE_AGENT_PLATFORM.md`, a forward-looking evaluation
  criteria doc.

No functional source, no config, no migration, no edge function, no
dependency changed this window (`git diff --stat 1ee9cbe..3dc1852` is 11
files, all under `docs/`). **Headline: no new code surface, so no new
security, reliability, or data-flow risk was introduced.** This run therefore
re-verifies the standing findings, re-runs the full command baseline, and
widens the secret scan to the whole tree (the action the last run's
next-focus #1 asked for).

**No code fix was needed or made this run** — the window introduced nothing
to fix, the one in-run fix from #302 (test-credential removal) is verified
still landed, and every open finding is already tracked in Linear and is
either owner-scheduling work or an edge-function change that cannot be
validated in this environment. This note is the deliverable.

Baselines (measured against base `1ee9cbe` / HEAD `3dc1852`; all flat):
lint **51 → 51** problems (43 errors, 8 warnings). Typecheck **pass at
baseline** (app tsc **62**, node **0**). Build **2278.79 KiB** / 62 precache
entries (byte-flat vs 2026-08-19). Tests **426 → 426** (49 files). `npm
audit` **3** (2 react-router moderate + 1 pdfjs-dist high) — unchanged, no
lockfile-only fix available.

## Commands run

- `npm install`: **pass** (via SessionStart hook). 3 vulnerabilities
  (2 moderate, 1 high) — unchanged from the 2026-08-19 exit state.
- `npm run lint`: **51 problems (43 errors, 8 warnings).** Unchanged vs the
  2026-08-19 baseline. No source changed this window, so no lint delta was
  possible.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: **62** errors. Node: **0** errors. Flat vs
  2026-08-19.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks
  `esm.sh` / `deno.land`, so Deno cannot resolve the edge functions' remote
  imports; the script reports `SKIPPED — this is not a pass` rather than a
  false green. **Confirmed it runs as a real, blocking CI step** — see next
  section (closes 2026-08-19 next-focus #3).
- `npm run build`: **pass** (Vite + PWA, 62 precache entries,
  **2278.79 KiB**). Byte-flat vs 2026-08-19.
- `npm test`: **pass** (49 test files, **426 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all green.
  The Practice keyboard-nav cases (previously flaky, guarded with
  `{ retry: 2 }` in #301) passed cleanly this run.
- `npm audit`: **3** (2 react-router moderate + 1 pdfjs-dist high).
  `npm audit fix` non-force remains a no-op for the runtime advisories —
  `react-router` is patched only at `>7.17.0` (v7 major from the installed
  `6.30.4`); `pdfjs-dist` needs the breaking 5 → 6 major.

## Review focus this run — re-verify standing findings + whole-tree re-scan

The window is docs-only, so this run re-verifies each carried finding against
the current code and clears three of the last run's next-focus items.

### Whole-tree secret scan — clean (widening the scope the last run flagged)

The 2026-08-19 next-focus #1 asked the scan to stop scoping itself to `src/`
+ `supabase/functions/` (the miss that let the committed test credential
slip past the first pass in #302). This run scanned the **entire tracked
tree**:

- **No live secrets anywhere.** Patterns `sk-proj-…`, `tvly-…`,
  `-----BEGIN … PRIVATE KEY`, `sk_live_…`, `sk_test_…`, `whsec_…`, and
  bare `eyJ…` JWTs return **zero** matches across the whole repo once the
  two known-benign sources are excluded: the `docs/audits/**` UX-review HTML
  snapshots (which embed large gzip+base64 page captures that trip byte-level
  regexes but contain no credentials) and `.env.example` (truncated
  placeholders only).
- **`.env.example` verified placeholder-only** — 15 keys, every value a
  redacted placeholder (`sb_publishable_…`, a JWT *header* fragment only,
  `sk-proj-…`, `tvly-…`, `sk_test_…`); no real signature present. Key set is
  complete for the documented local-dev + Stripe + story-linking flags.
- **#302 credential removal verified still landed.** All 7 legacy Deno test
  files now read `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` from env with a
  fail-closed guard (`if (!… ) throw`) and **no hard-coded fallback**. Grep
  for the removed email/password values across `tests/` returns nothing.
  *(The credential remains in git history — owner rotation is still owed;
  see Questions.)*

### Client-side exposure of server-only env — clean

`git grep` for `import.meta.env.{SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
STRIPE_SECRET_KEY, TAVILY_API_KEY, OPENAI_MODEL, STRIPE_WEBHOOK_SECRET}` in
`src/` returns nothing. No server-only variable is referenced from the
client bundle.

### PII log surface — clean

Every resume / CV / transcript / answer-adjacent `console.*` call in `src/`
logs the **error object only** (`console.error("Error …:", error)` /
`(…, result.error)`); none interpolates CV, transcript, or answer *text*.
No new log surface (no source changed).

### `searchId`-ownership BOLA (PREPIO-143) — re-verified still open

Re-read the `interview-research` `serve` path. The only identity check
remains body `userId` == JWT user
([index.ts:1096](../../supabase/functions/interview-research/index.ts):
`if (authContext.kind === "user" && authContext.userId !== userId) throw`);
the caller-supplied `searchId` is still **never** verified against the
caller, and every write goes through the service-role (RLS-bypassing)
client. Unchanged since 2026-08-12 (no PR has landed). Risk profile
unchanged: authenticated, UUID-gated, **write-only** cross-tenant write.
Kept deferred to a dedicated, test-covered security PR — see High finding.

### CI exercises the Deno edge-function typecheck (closes next-focus #3)

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs, in order,
`npm run typecheck` (line 45), `npm run typecheck:functions` (line 59, the
Deno edge-function check), `npm run build`, and `npm test` — all **without**
`continue-on-error`, so each gates the `verify` job. The
`typecheck:functions` step is genuinely blocking (its comment records the
19-error baseline from PR #294 and states "New edge-function type errors now
fail CI"), and `deno` comes from the pinned `deno` devDependency installed by
`npm ci`, not `setup-deno`. This is **not** the silent-no-op failure mode
PREPIO-119 caught on the root `tsc` — the step runs a real check that would
fail CI on a new type error. Next-focus #3 resolved: CI does exercise it.

## Findings

### Critical

- None.

### High

- [ ] **`interview-research` never verifies `searchId` ownership —
  cross-tenant write (BOLA) via the service-role client.** *(Carried from
  2026-08-12; re-verified still open this run. Pre-existing, not a
  regression.)*
  - Evidence: the only identity check is body `userId` == JWT user
    ([index.ts:1096](../../supabase/functions/interview-research/index.ts)).
    `searchId` is never checked against the caller, and all writes use the
    service-role client (RLS-bypassing): `prep_plans` upsert on `search_id`,
    `interview_stages` / `interview_questions` inserts, `searches` status
    updates `.eq('id', searchId)`. The legitimate flow
    ([`searchService.createSearchRecord`](../../src/services/searchService.ts))
    always creates the `searches` row with `user_id = user.id` before
    invoking, so an ownership check would break nothing.
  - Risk: **High (integrity).** An authenticated caller who knows a victim's
    search UUID can overwrite that victim's prep plan / stages / questions
    and flip their search status. **Write-only — not a read/exfil path.**
    UUID-gated, but the ID appears in shareable `/search/:searchId` URLs.
  - Recommended fix: fail closed on ownership in the `serve` handler before
    background work — `select id from searches where id = searchId and
    user_id = authContext.userId`, else 404. Small, safe, no legitimate-flow
    impact.
  - Owner / next step: **Tracked as
    [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143)** (High).
    **Deferred again this run**, for the same two reasons as 2026-08-19:
    (1) an authorization change to a core edge function warrants its own
    reviewed PR with a cross-tenant-rejection test, not an unattended
    docs-run bundle; and (2) that function's Deno typecheck and integration
    tests **cannot run in this environment** (proxy blocks
    `esm.sh`/`deno.land`; tests need a live local Supabase + test-user
    creds), so the change cannot be validated here.
- [ ] **`pdfjs-dist` arbitrary-JS-execution advisory (GHSA-hq66-cqwq-w95j)
  — production resume-parser dep; needs a breaking 5 → 6 major.** *(Carried,
  unchanged.)*
  - Evidence: `npm audit` reports it High against `pdfjs-dist 5.6.205`
    (direct dep, `~5.6.205`), used client-side in
    [`resumeUpload.ts`](../../src/lib/resumeUpload.ts). Affected range
    `>=5.6.83 <6.2.108`; fix is `6.2.108` (major).
  - Risk: **Low in practice, real surface.** The app only calls
    `getTextContent()` (never renders, never enables scripting), runs pdf.js
    in a Web Worker, and ships `isEvalSupported: false` (PR #286) — so the
    advisory's JS-execution vector is not reached. But a crafted resume PDF
    is still attacker-controlled input entering the browser.
  - Owner / next step: **Tracked as
    [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140)** (Chore, High,
    Quality & Maintenance). Product-owner scheduling call — the 5 → 6 bump
    needs a real-browser resume-parse regression pass (out of hygiene scope).

### Medium

- [ ] **`react-router` open-redirect + SSR advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x.** *(Carried, unchanged.)*
  - Evidence: `npm audit` reports both (moderate) against
    `react-router` / `react-router-dom` 6.30.4; the patched version is
    `>7.17.0` (v7 major). `npm audit fix` non-force is a no-op here
    (the advisory's "fix available via `npm audit fix`" line is misleading —
    the fix is a v7 major, out of the installed 6.x range).
  - Risk: **Low in Prepio.** Both dynamic redirect targets have same-origin
    protection (`Auth.tsx` derives from `location.state.from`, not a URL
    param; `BillingReturn.tsx` runs `?returnTo=` through `safeReturnTo`,
    which rejects `//` and `/\`). SSR advisory N/A (SPA).
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) (major
    dependency-migration planner). Product-owner scheduling call.

### Low / clean-up

- [ ] **Evidence ledger grants `official_job`/high-trust to unvalidated
  caller-supplied `roleLinks`.** *(Carried; not touched.)*
  - Evidence:
    [`evidence-ledger.ts:328–335`](../../supabase/functions/interview-research/evidence-ledger.ts)
    forces `sourceType: "official_job"` (→ high trust) on every
    `jobRawData.results` row, which come from `job-analysis` extracting
    arbitrary user-pasted `roleLinks` with no host validation.
  - Risk: **Low.** Normally affects only the caller's own run; sharpens only
    in combination with the `searchId`-ownership High (PREPIO-143).
  - Owner / next step: **Tracked as
    [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144)** (Chore).
- [ ] **`QUERY_PLAN` structured log captures interviewer person-names parsed
  from the user note into first-party operational logs.** *(Carried; not
  touched this window.)*
  - Evidence:
    [`company-research/index.ts`](../../supabase/functions/company-research/index.ts)
    logs `QUERY_PLAN` with `signals` + `queries`, forwarded to `console.log`
    by [`SearchLogger.log()`](../../supabase/functions/_shared/logger.ts).
  - Risk: **Low.** User's own note + a third-party interviewer name, to
    first-party operational logs — not cross-user, not client-exposed.
  - Owner / next step: **Tracked as
    [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141)** (Chore).
    Redact-vs-accept is a product-owner observability decision.
- [ ] **Stale bot-PR pile — 17 open PRs, 8 Dependabot.** *(Carried;
  recounted this run.)* The open list runs #237 (2026-07-10) → #304
  (2026-08-20): **8 Dependabot** (#264, #265, #266, #267, #269, #270, #271,
  #274 — the react group bump #274 could conflict), **5 github-actions codex
  auto-PR drafts** (#237, #240, #247, #289, #292), and **4 cursor[bot] test
  drafts** (#243, #252, #299, #304). Net vs 2026-08-19 (16 open, 9
  Dependabot): +1 open (new cursor draft #304), −1 Dependabot (one closed/
  merged). None is safely mergeable unattended from a docs run (dependency
  bumps need a test/CI pass). Tracked as
  [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110).
- [ ] **`Practice.mobile.test.tsx` keyboard-nav flake — fixed (#301); ticket
  reconciliation still owed.** *(Carried.)* All 426 tests passed cleanly this
  run under the `{ retry: 2 }` guard. Possible duplicate tickets remain:
  [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142) (filed 2026-08-12
  for the flake) vs [PREPIO-146](https://linear.app/qiuyue/issue/PREPIO-146)
  (the fix PR #301). Owner: close one as Duplicate. Linear MCP is
  unauthenticated in this session, so this could not be checked live.
- [ ] **Dependabot cadence vs. security advisories — informational.**
  *(Carried.)* [`.github/dependabot.yml`](../../.github/dependabot.yml) runs
  `npm` monthly. Its comment asserts security advisories are opened as soon
  as GitHub detects them — but that requires Dependabot **security updates**
  to be enabled in repo settings (separate from the version-update config in
  this file). Next reviewer / owner: confirm GitHub → Code security →
  Dependabot security updates is on, so patched advisories auto-open PRs
  between the monthly version runs.

## Small fixes made in this run

**None.** The window was documentation-only, so it introduced nothing to fix.
The one in-run fix from the prior run (#302 test-credential removal) is
verified still landed and clean. Every open finding is already tracked in
Linear and is either (a) an edge-function authorization change that cannot be
validated in this environment and warrants its own reviewed PR
(PREPIO-143), or (b) a breaking-major dependency bump needing a real-browser
or full-CI regression pass (PREPIO-140 pdfjs 5 → 6, PREPIO-98 react-router
6 → 7) — both out of hygiene-runner scope. Forcing an aesthetic change here
would violate the "avoid aesthetic refactors" guardrail.

## Deferred items

All tracked in Linear (no free-form bullets left to re-discover):

- [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) — **High:**
  `searchId`-ownership BOLA in `interview-research` (cross-tenant write).
  Code fix deferred to a dedicated, reviewed security PR with a
  cross-tenant-rejection test. **Re-verified still open this run.**
- [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140) — `pdfjs-dist`
  5 → 6 security upgrade (High advisory, production resume parser).
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — major
  dependency-migration planner (carries the react-router 6 → 7 upgrade).
- [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144) — evidence-ledger
  `official_job` over-trust of caller-supplied `roleLinks` (Low).
- [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141) — `QUERY_PLAN`
  operational-log PII redaction (Low; redact-vs-accept decision).
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — stale bot-PR
  cleanup pass (17 open PRs, 8 Dependabot).
- [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142) /
  [PREPIO-146](https://linear.app/qiuyue/issue/PREPIO-146) — the
  `Practice.mobile.test.tsx` flake: **fix landed (#301)**; reconcile the two
  tickets (one is likely a Duplicate).
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild override
  test guard (PR #240). Product-owner merge call.
- **Owner-action, cannot be tracked as code:** rotate the exposed test
  account credential (removed from `HEAD` in #302 but still in git history);
  separately, migrate the legacy Deno suite off live credentials. Needs a
  Linear issue (Bug/Chore, `area:infra`) — Linear MCP is unauthenticated
  this session, so it could not be filed here.

## Questions for product owner

- **Rotate the exposed test account credential (still owed from 2026-08-19).**
  Seven test files committed a real email + password; the code fallback was
  removed in #302, but the value is in git history and must be treated as
  compromised. Please rotate the account password and, if the address is a
  live personal inbox, review it. This is a do-now security action.
- **Schedule PREPIO-143 (`searchId`-ownership BOLA) as a priority fix?**
  Re-verified still open. Cross-tenant write on user-owned research data; the
  fix is small (one fail-closed ownership check) but changes edge-function
  authorization, so it wants its own reviewed PR with a
  cross-tenant-rejection test — ideally before `PROFILE_STORY_LINKING` is
  turned on. The hygiene runner cannot validate an edge-function change in
  its environment, so it should not land it unattended.
- **Enable Dependabot *security* updates?** *(Carried.)* Recurring highs keep
  surfacing between the monthly version runs; turning on security updates
  would auto-open patch PRs as advisories land.

## Next review focus

1. **Confirm the exposed test credential was rotated** and the tracking
   Linear issue is filed. This is the one open owner-action item that is a
   real security exposure rather than a scheduling call.
2. **PREPIO-143 (`searchId` BOLA) fix PR.** Still the highest-value
   follow-up. When scheduled, verify the ownership check lands with a
   cross-tenant-rejection test and the normal create → invoke flow still
   passes. Then re-audit the other service-role edge functions
   (`company-research`, `job-analysis`, `answer-feedback`) for the same
   missing object-ownership check.
3. **Next functional PR.** This was a docs-only window; the next merge that
   touches source (especially anything under the `PROFILE_STORY_LINKING`
   flags or the `interview-research` pipeline) should get a full retro-audit
   — serialization budget, alias resolution, and whether any profile text
   widens the operational-log surface.
