# Recurring hygiene review — 2026-08-19

## Summary

Twenty-third recurring codebase hygiene & security review for Prepio.

Narrow, quiet window. Since the last hygiene review (#295, base `4cd0acd`,
2026-08-12) merged, `main` advanced **two** functional commits to HEAD
`ebea456`, both low-risk maintenance:

- **#300 ([PREPIO-138](https://linear.app/qiuyue/issue/PREPIO-138))** —
  remove the phantom `question_type` mapping from the question loaders.
  `interview_questions` has no `question_type` column, so `type:
  q.question_type` only ever produced `type: undefined`; no shipped consumer
  reads `question.type` (the UI keys off `category`). Dead code removed at
  its two sources (`searchService.getSearchResults`, `researchService`), the
  unused optional `type` field dropped from the Practice / `sessionSampler`
  `Question` interfaces, plus a guard test. Clears two `TS2339`s → app tsc
  baseline **64 → 62**.
- **#301 ([PREPIO-146](https://linear.app/qiuyue/issue/PREPIO-146))** —
  de-flake the three Practice keyboard-navigation tests (ArrowLeft,
  ArrowRight, aria-live debounce) by extending the file's existing
  `{ retry: 2 }` convention to them. This is the fix for the standing
  `Practice.mobile.test.tsx` flake the last review escalated (previously
  filed as [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142); see
  note under Low).

Both retro-audited clean (details below). **Headline: no new security
surface, no runtime behaviour change, security posture unchanged.** The
secret / client-exposure re-scan is clean, `.env.example` carries
placeholders only, and no new PII log surface was introduced.

**No source code changed this run.** The two functional commits are already
merged and clean; the one High-severity code finding still open
([PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143), the `searchId`
BOLA — the standing #1 next-review-focus item) is **verified still unfixed**
but remains correctly deferred to its own reviewed, test-covered security PR.
Deferral is reinforced this run by a hard environment limit: the
`interview-research` edge function's Deno typecheck (`esm.sh`/`deno.land`
blocked by the agent proxy) and its integration tests (need Deno + a live
local Supabase + real test-user credentials) **cannot run in this
environment**, so an authorization change to that function cannot be
validated here and must not be pushed unattended.

Baselines (measured against the actual base commit `4cd0acd`, not the
2026-08-12 note's self-reported figures — see below): lint **51 → 51**
problems (unchanged; #300 removed a `tsc` error, not a lint violation).
Typecheck **pass at baseline**, app tsc **64 → 62** (#300 cleared two
`TS2339`s; node 0). Tests **425 → 426** (+1 — #300's guard test; #301 adds
`{ retry: 2 }` options to three *existing* tests, no new cases). Build
**2278.79 KiB** / 62 precache entries (flat, +0.5 KiB). `npm audit` **3**
(2 react-router moderate + 1 pdfjs-dist high) — unchanged, no lockfile-only
fix available.

> **Baseline-source correction (Codex P2, verified in-run):** an earlier
> draft of this note took its "before" lint (54) and test (423) counts from
> the 2026-08-12 note's self-reported figures, which do **not** match the
> actual base commit. Checked out `4cd0acd` and re-ran the same commands: it
> already reports **51** lint problems and **425** tests. So the correct
> window deltas are lint **51 → 51** and tests **425 → 426**, not 54 → 51 and
> 423 → 426. #300 did not clear any lint violations (its change was a `tsc`
> `TS2339` fix, reflected in the app tsc baseline 64 → 62).

## Commands run

- `npm install`: **pass** (via SessionStart hook). 3 vulnerabilities
  (2 moderate, 1 high) — unchanged from the 2026-08-12 exit state.
- `npm run lint`: **51 problems (43 errors, 8 warnings).** Verified
  **unchanged** vs the actual base commit `4cd0acd` (also 51 / 43 / 8; the
  2026-08-12 note's "54" does not match the base). #300's dead-code removal
  was a `tsc` `TS2339` fix, not a lint change; no new lint violations.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: **62** errors (baseline lowered 64 → 62 by #300).
  Node: 0 errors (baseline 0).
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not available in this environment.** The agent proxy blocks
  `esm.sh` / `deno.land`, so Deno cannot resolve remote imports; the script
  reports `SKIPPED — this is not a pass` rather than a false green. Runs in
  CI where those hosts are reachable.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries,
  **2278.79 KiB**). Flat vs 2026-08-12 (2278.29, +0.5 KiB).
- `npm test`: **pass** (49 test files, **426 tests**, 425 → 426 vs base
  `4cd0acd` — the single new guard test from #300). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all green. The
  previously-flaky Practice keyboard-nav cases passed cleanly this run under
  the #301 retry guard.
- `npm audit`: **3** (2 react-router moderate + 1 pdfjs-dist high).
  `npm audit fix` (non-force) is a **no-op** — verified via `--dry-run`: the
  patched `react-router` is `>7.17.0` (a major from the installed `6.30.4`),
  so the "fix available via `npm audit fix`" line is misleading; there is no
  in-range 6.x fix. `pdfjs-dist` needs the breaking 5 → 6 major.

## Review focus this run — two-commit retro-audit + authz re-verify

The window is only two functional commits, so this run retro-audits both in
full and re-verifies the standing High finding rather than opening new
surface.

### #300 — phantom `question_type` removal (clean)

Pure dead-code deletion. `type: q.question_type` read a column that does not
exist on `interview_questions`, so it always yielded `undefined`; no shipped
consumer reads `question.type` (the Practice UI and sampler key off
`category`). Removing it at both mapping sites and dropping the unused
optional interface field is behaviour-preserving, adds a guard test
asserting enhanced questions keep `category` without a `type` key, and
lowers the app tsc baseline 64 → 62. No data-flow, auth, or PII impact.

### #301 — Practice keyboard-nav de-flake (clean)

Test-only. Adds the file's existing `{ retry: 2 }` guard to the three
timing-sensitive keyboard-navigation `it()` blocks that intermittently
exceeded the per-test budget under CI load (flaking on a different test each
run — the signature of a resource/timing problem, not a logic bug). No
product code touched; pairs with the `testTimeout: 20000` headroom from #296.
This is the concrete fix for the standing flake the 2026-08-12 review
escalated to Linear.

### `searchId`-ownership BOLA (PREPIO-143) — re-verified still open

Re-read the `interview-research` `serve` path. The only identity check
remains body `userId` == JWT user
([index.ts:1096](../../supabase/functions/interview-research/index.ts)); the
caller-supplied `searchId` is still **never** verified against the caller,
and every write goes through the service-role (RLS-bypassing) client. No fix
has landed since 2026-08-12 (no PR). Unchanged risk profile: authenticated,
UUID-gated, **write-only** cross-tenant write. Kept deferred to a dedicated
security PR — see High finding and Deferred.

### Secret / client-exposure re-scan — clean

- **No server-only env referenced from `src/`.** Grep for
  `import.meta.env.{SUPABASE_SERVICE_ROLE_KEY,OPENAI_API_KEY,STRIPE_SECRET_KEY,TAVILY_API_KEY,OPENAI_MODEL}`
  returns nothing.
- **No hardcoded secrets** in `src/` or `supabase/functions/` (JWT / `sk-` /
  PEM / `api_key=` patterns, excluding placeholders and `Deno.env`/`import.meta.env`
  reads).
- **`.env.example` clean** — every value is a truncated placeholder
  (`sb_publishable_...`, `eyJ...` JWT header only, `sk-proj-...`, `tvly-...`,
  `sk_test_...`); no real signature present.
- **No new PII log surface.** The resume/CV/transcript-adjacent `console.*`
  calls in `src/` are all `console.error("Error …:", error)` — the error
  object only; no CV / transcript / answer text is interpolated.

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
    `interview_stages`/`interview_questions` inserts, `searches` status
    updates `.eq('id', searchId)`. The legitimate flow
    ([`searchService.createSearchRecord`](../../src/services/searchService.ts))
    always creates the `searches` row with `user_id = user.id` before
    invoking, so an ownership check would break nothing.
  - Risk: **High (integrity).** An authenticated caller who knows a victim's
    search UUID can overwrite that victim's prep plan / stages / questions
    and flip their search status, and inject the caller's own profile text /
    bullet IDs into the victim's rows. **Write-only — not a read/exfil path.**
    UUID-gated but the ID appears in shareable `/search/:searchId` URLs.
  - Recommended fix: fail closed on ownership in the `serve` handler before
    background work — `select id from searches where id = searchId and
    user_id = authContext.userId`, else 404. Small, safe, no legitimate-flow
    impact.
  - Owner / next step: **Tracked as
    [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143)** (High).
    **Deferred again this run**, for two reasons: (1) an authorization change
    to a core edge function warrants its own reviewed PR with a
    cross-tenant-rejection test, not an unattended docs-run bundle; and (2)
    that function's Deno typecheck and integration tests **cannot run in this
    environment** (proxy blocks `esm.sh`/`deno.land`; tests need a live local
    Supabase + test-user creds), so the change cannot be validated here.
    Recommend scheduling ahead of any `PROFILE_STORY_LINKING` rollout.
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
    (confirmed via `--dry-run`).
  - Risk: **Low in Prepio.** Both dynamic redirect targets have same-origin
    protection (`Auth.tsx` derives from `location.state.from`, not a URL
    param; `BillingReturn.tsx` runs `?returnTo=` through `safeReturnTo`,
    which rejects `//` and `/\`). SSR advisory N/A (SPA).
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) (major
    dependency-migration planner). Product-owner scheduling call.

### Low / clean-up

- [ ] **`Practice.mobile.test.tsx` keyboard-nav flake — fix landed this
  window.** *(Carried; now addressed.)* #301
  ([PREPIO-146](https://linear.app/qiuyue/issue/PREPIO-146)) extended the
  `{ retry: 2 }` guard to the three timing-sensitive keyboard-nav cases; all
  426 tests passed cleanly this run. Note a **possible duplicate ticket**:
  the 2026-08-12 review filed
  [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142) for the same
  flake, and #301 references PREPIO-146. Next reviewer / owner: reconcile the
  two (close one as Duplicate) — Linear MCP is unauthenticated in this
  session, so this could not be checked live.
- [ ] **Evidence ledger grants `official_job`/high-trust to unvalidated
  caller-supplied `roleLinks`.** *(Carried from 2026-08-12; not touched.)*
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
- [ ] **Stale bot-PR pile — 16 open PRs, 9 Dependabot.** *(Carried.)* Open
    PRs run from #237 (2026-07-10) to #299 (2026-08-13); nine are Dependabot
    (#264–#274, oldest ~2026-08-01), the rest codex/cursor bot drafts. None
    is safely mergeable unattended from a docs run (dependency bumps need a
    test/CI pass; the react group bump #274 could conflict). Tracked as
    [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110).
- [ ] **Dependabot cadence vs. security advisories — informational.**
    *(Carried.)* [`.github/dependabot.yml`](../../.github/dependabot.yml)
    runs `npm` monthly. Next reviewer: confirm GitHub → Code security has
    Dependabot **security** updates enabled so patched advisories auto-open
    PRs between monthly version runs.

## Small fixes made in this run

None. This is a documentation-only run:

- The two functional commits in the window (#300, #301) are already merged
  and retro-audited clean — nothing to fix there.
- The one open High code finding (PREPIO-143) is an edge-function
  authorization change that (a) warrants its own reviewed, test-covered PR
  and (b) **cannot be validated in this environment** (Deno typecheck +
  integration tests are unreachable here), so pushing it unattended would be
  unsafe. Deferred with tracking.
- The advisory-driven items each need a breaking major (`pdfjs-dist` 5 → 6,
  `react-router` 6 → 7) — out of hygiene-runner scope; no lockfile-only
  `npm audit fix` is available this window.

There was no in-scope, low-risk, environment-validatable code change to make.

## Deferred items

Tracked in Linear (no free-form bullets left to re-discover):

- [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) — **High:**
  `searchId`-ownership BOLA in `interview-research` (cross-tenant write). Code
  fix deferred to a dedicated, reviewed security PR with a
  cross-tenant-rejection test. **Re-verified still open this run.**
- [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140) — `pdfjs-dist`
  5 → 6 security upgrade (High advisory, production resume parser).
- [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141) — `QUERY_PLAN`
  operational-log PII redaction (Low; redact-vs-accept decision).
- [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144) — evidence-ledger
  `official_job` over-trust of caller-supplied `roleLinks` (Low).
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — major
  dependency-migration planner (carries the react-router 6 → 7 upgrade).
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — stale bot-PR
  cleanup pass (16 open PRs, 9 Dependabot).
- [PREPIO-142](https://linear.app/qiuyue/issue/PREPIO-142) /
  [PREPIO-146](https://linear.app/qiuyue/issue/PREPIO-146) — the
  `Practice.mobile.test.tsx` flake: **fix landed (#301)**; reconcile the two
  tickets (one is likely a Duplicate).
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild override
  test guard (PR #240). Product-owner merge call.

## Questions for product owner

- **Schedule PREPIO-143 (`searchId`-ownership BOLA) as a priority fix?**
  Re-verified still open. It is a cross-tenant write on user-owned research
  data. The fix is small (one fail-closed ownership check) but changes
  edge-function authorization, so it wants its own reviewed PR with a
  cross-tenant-rejection test — ideally before `PROFILE_STORY_LINKING` is
  turned on. The hygiene runner cannot validate an edge-function change in
  its environment, so it should not be the one to land it unattended.
- **Schedule PREPIO-140 (`pdfjs-dist` 5 → 6)?** The only advisory on a
  genuine production-runtime, untrusted-input path. Defense-in-depth is
  already shipped; the version bump is the true fix and needs a real-browser
  resume-parse regression pass.
- **Enable Dependabot *security* updates?** *(Carried.)* Recurring highs keep
  surfacing between monthly version runs; turning on security updates would
  auto-open these.
## Next review focus

1. **PREPIO-143 (`searchId` BOLA) fix PR.** Still the highest-value
   follow-up. When scheduled, verify the ownership check lands with a
   cross-tenant-rejection test and the normal create → invoke flow still
   passes. Then re-audit the other service-role edge functions
   (`company-research`, `job-analysis`, `answer-feedback`) for the same
   missing object-ownership check.
2. **Confirm the Deno edge-function typecheck runs green in CI.** Gated in
   #294 but unreachable from this environment — verify CI actually exercises
   it (not silently skipping, like the root `tsc` no-op PREPIO-119 caught).
3. **Next research-pipeline PR under the story-linking flags.** If
   `PROFILE_STORY_LINKING` moves toward on, re-audit the profile-context path
   end to end (serialization budget, alias resolution, and whether any
   profile text widens the operational-log surface).
