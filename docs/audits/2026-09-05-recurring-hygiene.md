# Recurring hygiene review — 2026-09-05

## Summary

Twenty-sixth recurring codebase hygiene & security review for Prepio.

**First non-trivial code window in three runs, and a clean one.** Since the
last hygiene review (#25, note commit `2ab52d7`, 2026-08-26) merged, `main`
advanced to HEAD `132816b` with real source changes for the first time since
run #23. The window is `2ab52d7..132816b` — 16 non-doc files
(`git diff --stat 2ab52d7..origin/main -- ':!docs' ':!package-lock.json'`),
all landed through reviewed PRs:

- **#333 (PREPIO-141)** — redact free-text-derived fields from the
  `QUERY_PLAN` operational log (`company-research/query-planner.ts` +
  `index.ts`). **This closes a standing Low PII-in-logs finding carried since
  2026-08-12.**
- **#319 (PREPIO-155)** — delete the dead DuckDuckGo fallback shim
  (`_shared/duckduckgo-fallback.ts` + its test). Dead-code removal.
- **#329 (PREPIO-178) / #315 (PREPIO-171)** — single-`h1` accessibility fixes
  on the practice question screen and guest landing (`Practice.tsx`,
  `Home.tsx`, `card.tsx`, `InterviewBriefPreview.tsx` + mobile tests).
- **#311** — surface an honest note when practice transcription fails
  (`Practice.tsx`).
- **#323** — Dependabot react group bump (react/react-dom 19.2.7 → 19.2.8,
  `@types/*` patch bumps).
- **#330 (PREPIO-168)** — document disposable `TEST_USER_EMAIL` /
  `TEST_USER_PASSWORD` in `.env.example` (non-production `.invalid`
  placeholders). **This closes the `.env.example` documentation gap run #24
  flagged.**
- **#327 (PREPIO-161)** — add the user-effort-budget guardrail to `CLAUDE.md`.
- **#320** — bump the SHA-pinned `openai/codex-action` in the auto-PR workflow
  (still `# v1`, still commit-pinned — supply-chain hygiene preserved).

**Headline: the product code surface changed, but every change reduced or
held risk flat — nothing new to worry about.** No new client secret, no
server-only env reaching the client bundle, no new client PII log sink, no
new risky DOM/redirect/injection pattern, and one server-side PII log sink
*removed*. I reviewed each changed source file's added lines against the
security/reliability checklist and found no new issue introduced this window.

**One small fix made this run (dependency, lockfile-only).** `npm audit`
opened this run at **6 vulnerabilities (3 moderate, 3 high)** — up from the
standing 3 — because a new **`fast-uri`** advisory cluster (SSRF + host
confusion, GHSA-fph4-wmhf-6fwf / GHSA-jqff-g426-hqxp / GHSA-f65p-4m7j-42xc /
GHSA-5jgf-p345-68v8) landed against `fast-uri@3.1.5`. `fast-uri` is a
**build-time transitive dev dependency**
(`vite-plugin-pwa → workbox-build → ajv → fast-uri`), not a runtime dep, and
the fix is a within-range patch. `npm audit fix` (non-force) bumped it to
`3.1.7`, **lockfile-only**, and returned the audit to the prior baseline of
**3** (2 react-router moderate + 1 pdfjs-dist high). Build and the full test
suite stayed green after the bump. This is the one safe, in-scope fix this
window.

**The three items that were untracked at run #24 are now all in Linear** —
verified live this session (Linear MCP was reachable, unlike the last several
runs): PREPIO-168 (credential rotation + legacy-Deno-suite migration),
PREPIO-169 (`check-deno-baseline.sh` hardening; PREPIO-174 is its Duplicate),
and the `parseJsonResponse` raw-response sink, which run #25 already *fixed*
(500-char preview) and whose residual redact-vs-accept question folds into
PREPIO-141. **No new Linear issue needed to be filed this run.**

Baselines (measured HEAD `132816b`, post-fix):
lint **51** problems (43 errors, 8 warnings) — flat vs 2026-08-26.
Typecheck **pass at baseline** (app tsc **62**, node **0**) — flat.
Build **2280.36 KiB** / 62 precache entries (+1.57 KiB vs 2026-08-26, from the
`caniuse-lite` data refresh the audit fix pulled in and the react patch).
Tests **431 passing / 48 files** (was 426 / 49: +5 new mobile-test cases,
−1 file from the deleted `duckduckgo-fallback.test.ts`).
`npm audit` **3** (2 react-router moderate + 1 pdfjs-dist high) post-fix.

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **pass at baseline** — 51 problems (43 errors, 8 warnings).
  Flat vs 2026-08-26. The pre-existing failures are the known baseline; none
  is attributable to this window (no lint delta on the changed files).
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline** — app **62**, node **0**. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks
  `esm.sh` / `deno.land`, so Deno cannot resolve the edge functions' remote
  imports; the wrapper reports `SKIPPED — this is not a pass` (exit 0 locally,
  `exit 1` under `$CI`). The edge-function changes this window
  (`company-research`) are covered by the real CI `verify` job on the PRs that
  landed them (#333). Wrapper-soundness gap tracked as **PREPIO-169**.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries,
  **2280.36 KiB**).
- `npm test`: **pass** — 48 test files, **431 tests**. Re-run after the
  `npm audit fix` lockfile bump: still 431/431 green, plus
  `check-legacy-schema.sh` and `check-answer-feedback-schema.sh`.
- `npm audit`: opened at **6** (3 moderate, 3 high); after the lockfile-only
  `npm audit fix` (`fast-uri` 3.1.5 → 3.1.7), back to **3** (2 react-router
  moderate + 1 pdfjs-dist high).

## Review focus this run — new source window + dependency delta

### Changed-source security review — clean

Reviewed the added lines of every changed source file
(`Practice.tsx`, `Home.tsx`, `card.tsx`, `InterviewBriefPreview.tsx`,
`company-research/index.ts`, `company-research/query-planner.ts`, and the two
mobile test files) against the checklist:

- **No server-only env in the client bundle.** `git grep` for
  `import.meta.env.{SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
  STRIPE_SECRET_KEY, TAVILY_API_KEY, OPENAI_MODEL, STRIPE_WEBHOOK_SECRET}`
  in `src/` returns nothing.
- **No new risky client patterns.** The added lines contain no `console.*`
  PII interpolation, no `fetch`/redirect on user input, no `dangerouslySet*` /
  `innerHTML` / `eval`, no new `localStorage`/`sessionStorage` write of
  sensitive content.
- **One server-side PII log sink removed (net-positive).** #333 replaces the
  raw `QUERY_PLAN` `signals`/`queries` dump with
  `buildQueryPlanLogPayload(plan)`, which reduces the payload to `roleFamily`,
  a query count, source/domain category labels, a targeted-signal *count*, and
  the budget — no free-text note content or parsed interviewer names reach the
  operational log. Verified against `query-planner.ts:462–487`.

### Whole-tree secret scan — clean

- **No formatted secrets anywhere.** Patterns `sk-proj-…`, `tvly-…`,
  `sk_live_…`, `whsec_…`, and `-----BEGIN … PRIVATE KEY` return **zero**
  matches across the tracked tree once `docs/audits/**` (UX-review HTML page
  captures, benign) and `package-lock.json` (third-party integrity hashes)
  are excluded.
- **`.env.example` verified placeholder-only, and the run #24 gap is closed.**
  #330 added `TEST_USER_EMAIL=test-user@example.invalid` and
  `TEST_USER_PASSWORD=replace-with-a-non-production-test-password` with an
  explicit "dedicated, disposable, non-production" comment. The `.invalid`
  TLD (RFC-2606-reserved) and the literal placeholder password mean **no real
  credential is present** — this documents the legacy-Deno-suite prerequisite
  without shipping a secret.
- **`codex-action` remains SHA-pinned.** #320 changed the pinned commit but
  kept the `@<sha> # v1` form — no move to a mutable tag.

## Findings

### Critical

- None.

### High

- [ ] **`interview-research` never verifies `searchId` ownership —
  cross-tenant write (BOLA) via the service-role client.** *(Carried from
  2026-08-12; re-verified still open this run. Pre-existing, not a
  regression.)*
  - Evidence: the only identity check is body `userId` == JWT user
    ([interview-research/index.ts:1096](../../supabase/functions/interview-research/index.ts)).
    The caller-supplied `searchId` is never checked against the caller, yet
    every downstream write keys off it through the RLS-bypassing service-role
    client (`prep_plans` upsert on `search_id`, `interview_stages` /
    `interview_questions` inserts, `searches` status `.eq('id', searchId)`).
    The legitimate flow
    ([`searchService.createSearchRecord`](../../src/services/searchService.ts))
    always creates the `searches` row with `user_id = user.id` first, so a
    fail-closed ownership check would break nothing.
  - Risk: **High (integrity).** An authenticated caller who knows a victim's
    search UUID can overwrite that victim's prep plan / stages / questions and
    flip their search status. **Write-only, not a read/exfil path.**
    UUID-gated, but the ID appears in shareable `/search/:searchId` URLs.
  - Recommended fix: `select id from searches where id = searchId and
    user_id = authContext.userId` before background work, else 404.
  - Owner / next step: **Tracked as
    [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143)** (High).
    Deferred again: an edge-function authorization change warrants its own
    reviewed PR with a cross-tenant-rejection test, and the function's Deno
    typecheck + integration tests cannot run in this environment (proxy blocks
    `esm.sh`/`deno.land`; tests need a live local Supabase + test creds), so it
    cannot be validated in an unattended hygiene run.
- [ ] **`pdfjs-dist` arbitrary-JS-execution advisory (GHSA-hq66-cqwq-w95j) —
  production resume-parser dep; needs a breaking 5 → 6 major.** *(Carried,
  unchanged.)*
  - Evidence: `npm audit` reports it High against `pdfjs-dist 5.6.205`
    (direct dep, `~5.6.205`), used client-side in
    [`resumeUpload.ts`](../../src/lib/resumeUpload.ts). Affected
    `>=5.6.83 <6.2.108`; fix is `6.2.108` (major).
  - Risk: **Low in practice, real surface.** The app only calls
    `getTextContent()` (never renders, never enables scripting), runs pdf.js in
    a Web Worker, and ships `isEvalSupported: false` (PR #286) — so the
    advisory's JS-execution vector is not reached. A crafted resume PDF is
    still attacker-controlled input.
  - Owner / next step: **Tracked as
    [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140)** (Chore, High).
    The 5 → 6 bump needs a real-browser resume-parse regression pass
    (out of hygiene-runner scope).

### Medium

- [ ] **`react-router` open-redirect + SSR-hydration advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x.** *(Carried, unchanged.)*
  - Evidence: both (moderate) against `react-router` / `react-router-dom`
    6.30.4; patch is `>7.17.0` (v7 major, outside the `^6.26.2` manifest
    range). `npm audit fix` non-force is a no-op here.
  - Risk: **Low in Prepio.** Both dynamic redirect targets have same-origin
    protection (`Auth.tsx` derives from `location.state.from`, not a URL param;
    `BillingReturn.tsx` runs `?returnTo=` through `safeReturnTo`, which rejects
    `//` and `/\`). The SSR-hydration advisory does **not apply** — Prepio is a
    client-only SPA (`BrowserRouter` in
    [`src/App.tsx:84`](../../src/App.tsx); no
    `hydrateRoot`/`renderToString`/`StaticRouter` anywhere in `src/`).
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) (major
    dependency-migration planner). Scheduling call.

### Low / clean-up

- [ ] **Evidence ledger grants `official_job`/high-trust to unvalidated
  caller-supplied `roleLinks`.** *(Carried; not touched.)*
  - Evidence:
    [`evidence-ledger.ts:328–335`](../../supabase/functions/interview-research/evidence-ledger.ts)
    forces `sourceType: "official_job"` (→ high trust) on every
    `jobRawData.results` row, which originate from `job-analysis` extracting
    arbitrary user-pasted `roleLinks` with no host validation.
  - Risk: **Low.** Normally affects only the caller's own run; sharpens only in
    combination with the `searchId`-ownership High (PREPIO-143).
  - Owner / next step: **Tracked as
    [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144)** (Chore).
- [x] **`QUERY_PLAN` structured log captured interviewer person-names parsed
  from the user note — FIXED this window (#333, PREPIO-141).** The raw
  `signals`/`queries` dump is replaced by the PII-free
  `buildQueryPlanLogPayload` (counts + category labels only). Verified against
  `query-planner.ts`. **No residual for the `QUERY_PLAN` sink.**
- [x] **`parseJsonResponse` raw-model-response PII log sink — FIXED in run #25
  (500-char preview).** Re-verified landed at
  [`_shared/openai-client.ts:92–107`](../../supabase/functions/_shared/openai-client.ts).
  **Residual (not re-filed):** a 500-char preview still logs the *start* of a
  malformed model response, which for `cv-analysis` can be the candidate's
  name/email/phone. This is a deliberate debuggability-vs-privacy trade
  (matching the `logContentSamples` convention) and folds into the same
  redact-vs-accept observability decision as **PREPIO-141** — not a new issue.
- [ ] **Stale bot-PR pile.** *(Carried; not recounted in depth this run —
  Linear MCP was slow and the GitHub PR list is large.)* Tracked as
  [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110). None is safely
  mergeable unattended from a hygiene run (dependency bumps need CI). The
  react group bump #323 from that pile did land this window.
- [ ] **Dependabot cadence vs. security advisories — informational.**
  *(Carried.)* [`.github/dependabot.yml`](../../.github/dependabot.yml) runs
  `npm` monthly. Its comment asserts security advisories open PRs as soon as
  GitHub detects them, but that requires Dependabot **security updates** to be
  enabled in repo settings (separate from the version-update config). The
  `fast-uri` cluster this run is exactly the case that setting would auto-open
  between monthly runs. Next reviewer / owner: confirm GitHub → Code security →
  Dependabot security updates is on.

## Small fixes made in this run

- **`fast-uri` 3.1.5 → 3.1.7 (lockfile-only) via `npm audit fix`.** Clears the
  new SSRF + host-confusion advisory cluster on a build-time transitive dev
  dependency (`vite-plugin-pwa → workbox-build → ajv → fast-uri`). The bump is
  within `ajv`'s existing semver range, changed only `package-lock.json`, and
  build + all 431 tests stayed green after it. `npm audit` returned from 6 to
  the standing 3. `npm audit fix` also opportunistically refreshed several
  within-range build-metadata transitives (`@xmldom/xmldom` 0.8.13 → 0.8.15,
  `browserslist`, `caniuse-lite`, `electron-to-chromium`, `node-releases`,
  `update-browserslist-db`) — all lockfile-only, all within existing ranges,
  all validated by the green build + test run.

## Deferred items

Discrete actionable findings only. **All are now tracked in Linear** — verified
live this session; nothing untracked remains, so no new issue was filed this
run.

- [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) — **High:**
  `searchId`-ownership BOLA in `interview-research` (cross-tenant write). Code
  fix deferred to a dedicated, reviewed security PR with a
  cross-tenant-rejection test. **Re-verified still open.**
- [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140) — `pdfjs-dist`
  5 → 6 security upgrade (High advisory, production resume parser).
- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — major
  dependency-migration planner (carries the react-router 6 → 7 upgrade).
- [PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144) — evidence-ledger
  `official_job` over-trust of caller-supplied `roleLinks` (Low).
- [PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141) — operational-log
  PII redact-vs-accept decision. The `QUERY_PLAN` sink is now fixed (#333);
  what remains under this issue is the observability policy call that also
  covers the `parseJsonResponse` preview residual.
- [PREPIO-168](https://linear.app/qiuyue/issue/PREPIO-168) — rotate the exposed
  test-account credential (removed from `HEAD` in #302, still in git history)
  and migrate the legacy Deno suite off live credentials. **`.env.example`
  documentation shipped this window (#330); rotation + suite migration remain.**
- [PREPIO-169](https://linear.app/qiuyue/issue/PREPIO-169) — harden
  `check-deno-baseline.sh` (reject unclassified nonzero `deno` exits; treat a
  below-baseline count as inspect-not-pass). **In Progress.**
  [PREPIO-174](https://linear.app/qiuyue/issue/PREPIO-174) is its Duplicate.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — stale bot-PR
  cleanup pass.
- [PREPIO-146](https://linear.app/qiuyue/issue/PREPIO-146) — the
  `Practice.mobile.test.tsx` keyboard-nav flake: **Done** (fix landed; the two
  duplicate tickets have been reconciled since run #24).

## Questions for product owner

- **Rotate the exposed test-account credential (PREPIO-168).** Still owed. The
  code fallback was removed in #302 and `.env.example` now documents disposable
  placeholders (#330), but the original real email + password remain in git
  history and must be treated as compromised. Please rotate the account
  password (and review the inbox if it is a live personal address). This is a
  do-now security action, not a scheduling call.
- **Schedule PREPIO-143 (`searchId`-ownership BOLA)?** Re-verified still open —
  a cross-tenant write on user-owned research data. The fix is small (one
  fail-closed ownership check) but changes edge-function authorization, so it
  wants its own reviewed PR with a cross-tenant-rejection test, ideally before
  `PROFILE_STORY_LINKING` is turned on. The hygiene runner cannot validate an
  edge-function change in its environment.
- **Enable Dependabot *security* updates?** *(Carried.)* The `fast-uri` cluster
  this run is a fresh example: turning on security updates would auto-open the
  patch PR as the advisory lands, instead of waiting for the monthly version
  run or a hygiene sweep.

## Next review focus

1. **PREPIO-143 (`searchId` BOLA) fix PR.** Still the highest-value follow-up.
   When scheduled, verify the ownership check lands with a
   cross-tenant-rejection test and the normal create → invoke flow still
   passes; then re-audit the other service-role edge functions
   (`company-research`, `job-analysis`, `answer-feedback`) for the same missing
   object-ownership check.
2. **Confirm credential rotation and the Dependabot security-updates setting.**
   Both are owner actions that no code change can substitute for; the
   `fast-uri` window shows the security-updates gap is live.
3. **Next functional PR retro-audit.** This window was clean, but the next
   merge touching the `interview-research` pipeline or anything under the
   `PROFILE_STORY_LINKING` flags should get a full retro-audit — serialization
   budget, alias resolution, and whether any profile/note text widens the
   operational-log surface (the class PREPIO-141 covers).
