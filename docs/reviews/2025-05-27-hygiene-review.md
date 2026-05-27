# Recurring hygiene review — 2025-05-27

## Summary

Full codebase hygiene and security review covering: security posture of all 12 Supabase edge functions, frontend auth/data-access patterns, npm dependency health (28 vulnerabilities found, 26 fixed), code quality in large files, CI coverage, and repository process hygiene. Build, typecheck, and all 188 tests pass cleanly.

## Commands run

- `npm install`: pass (832 packages)
- `npm run lint`: fail (7 errors, 10 warnings — all pre-existing, documented in CI as informational)
- `npm run typecheck` (`tsc --noEmit`): pass
- `npm run build`: pass
- `npm test`: pass (23 test files, 188 tests)
- `npm audit`: 28 vulnerabilities pre-fix → 2 moderate post-fix

## Findings

### Critical

No critical findings.

### High

- [ ] **Sub-functions `company-research`, `job-analysis`, `interview-question-generator` lack auth checks**
  - Evidence: These edge functions do not call `authorizeRequest()`. While `company-research` and `job-analysis` are called internally by the `interview-research` orchestrator (which authenticates the user), they are exposed as HTTP endpoints. Any caller with the public anon key can invoke them with an arbitrary `searchId`. The functions create their own service-role Supabase client internally, bypassing RLS.
  - Risk: An attacker could trigger expensive OpenAI/Tavily API calls on any user's `searchId`, or write research data into another user's search record. Cost abuse and data integrity risk.
  - Recommended fix: Add `authorizeRequest()` or a simpler `isPrivilegedToken()` check at the top of each function's handler. Require either a valid user JWT (whose user_id matches the search owner) or a service-role key. This is a ~10-line change per function.
  - Owner / next step: Engineering — should be addressed before next production deploy.

- [ ] **`react-router-dom` 6.x open redirect / XSS vulnerability (GHSA-2w69-qvjg-hvjx)**
  - Evidence: `npm audit` flagged `@remix-run/router <=1.23.1` (transitive dep of react-router-dom 6.x). Fixed to `react-router-dom@6.31.0` by `npm audit fix`.
  - Risk: Open redirects can be used for phishing. The app uses `navigate()` with React Router internals so risk was low, but the fix is trivial.
  - Recommended fix: Already fixed in this run via `npm audit fix`.
  - Owner / next step: Done — included in this PR.

### Medium

- [ ] **CORS wildcard (`Access-Control-Allow-Origin: *`) on all 10+ edge functions**
  - Evidence: Every edge function in `supabase/functions/*/index.ts` sets `"Access-Control-Allow-Origin": "*"`.
  - Risk: Allows any website to make credentialed requests to these endpoints on behalf of a signed-in user. Combined with the missing auth on sub-functions, this amplifies attack surface.
  - Recommended fix: Restrict to the production domain (e.g., `https://prepio.app`) and `http://localhost:5173` for development. Can be configured via an env var.
  - Owner / next step: Engineering — medium priority, should be addressed alongside the auth fix above.

- [ ] **Remaining 2 npm audit vulnerabilities (esbuild/vite, moderate severity)**
  - Evidence: `esbuild <=0.24.2` (dev server request interception) requires upgrading to `vite@8.x` which is a breaking change.
  - Risk: Dev-only vulnerability — attacker on the same network could interact with the Vite dev server. Does not affect production builds.
  - Recommended fix: Defer until next major Vite upgrade cycle. Do not use `npm audit fix --force`.
  - Owner / next step: Track for next major dependency update.

- [ ] **`interview-question-generator` edge function appears to be dead code**
  - Evidence: No references found in the frontend (`src/`), nor in the orchestrator (`interview-research/index.ts`), nor in any other edge function. It also lacks `authorizeRequest`.
  - Risk: Unused deployed function increases attack surface and maintenance burden.
  - Recommended fix: Verify it's not called via any external integration, then undeploy and remove the function directory.
  - Owner / next step: Product owner to confirm it's not externally invoked, then remove.

- [ ] **Research-preview rate limiting uses spoofable `x-forwarded-for` header**
  - Evidence: `supabase/functions/research-preview/index.ts` lines ~106-142 fingerprints requests using `x-forwarded-for` or `x-preview-session` header, both trivially spoofable.
  - Risk: Rate limit bypass allows abuse of OpenAI API credits via the public preview endpoint.
  - Recommended fix: Use Supabase's built-in IP from the request context, or require a CAPTCHA/proof-of-work for preview requests.
  - Owner / next step: Engineering — prioritize if preview abuse is observed in logs.

### Low / clean-up

- [ ] **Unused npm dependencies: `@hookform/resolvers`, `zod`**
  - Evidence: `depcheck` flagged both as unused. No imports found in `src/`. They may have been used in a previous form-validation approach.
  - Recommended fix: `npm uninstall @hookform/resolvers zod` (saves ~200KB from lockfile).

- [ ] **Verbose console logging in production frontend code**
  - Evidence: 55+ `console.error`/`console.warn`/`console.log` calls in `src/services/searchService.ts`, `src/hooks/useSearchProgress.ts`, and other files. These run in production and may leak operational details in browser DevTools.
  - Recommended fix: Replace with a centralized logger that can be silenced in production builds, or strip `console.*` calls in the Vite production build config.

- [ ] **Pre-existing lint errors (7 errors, 10 warnings)**
  - Evidence: `@typescript-eslint/no-empty-object-type` (2), `@typescript-eslint/no-explicit-any` (3), `@typescript-eslint/no-require-imports` (1), unused eslint-disable (1). All in UI components and test files.
  - Recommended fix: Fix incrementally. The `no-empty-object-type` and `no-require-imports` are trivial fixes; the `no-explicit-any` in tests can use `unknown`.

- [ ] **`Practice.tsx` is 3,056 lines**
  - Evidence: Largest file in the codebase by far. Next largest page is `Home.tsx` at 1,486.
  - Recommended fix: Extract setup wizard, question navigation state machine, and voice recorder into separate modules. Defer to a dedicated refactoring task.

- [ ] **`.env.example` includes the real Supabase project URL**
  - Evidence: Line 14 has `VITE_SUPABASE_URL=https://vjwrirrqprjzdorignlz.supabase.co`. The project URL is public by design (exposed in the browser), but `.env.example` should use placeholder values for clarity.
  - Recommended fix: Replace with `VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co`.

## Small fixes made in this run

1. **`npm audit fix`**: Applied safe non-breaking dependency updates, resolving 26 of 28 vulnerabilities (including the react-router XSS, xmldom injection, lodash prototype pollution, rollup path traversal, and multiple ReDoS issues). Build and all 188 tests pass after fix.

## Deferred items

1. **Add `authorizeRequest` to sub-functions** — requires careful testing with the orchestrator's service-role calling pattern; should not be done as a drive-by fix.
2. **Restrict CORS origins** — requires knowing the production domain(s) and setting up an env var for local dev.
3. **Upgrade to Vite 8.x** — breaking change, needs its own migration task.
4. **Remove `interview-question-generator`** — needs product owner confirmation.
5. **Refactor `Practice.tsx`** — feature-level task, not hygiene.
6. **Centralized frontend logging** — nice-to-have, not blocking.

## Questions for product owner

1. Is the `interview-question-generator` edge function still needed? It has no callers in the codebase. If it's safe to remove, it should be undeployed.

## Next review focus

1. **Edge function auth hardening** — verify `authorizeRequest` is added to all sub-functions and test the orchestrator still works.
2. **CORS origin restriction** — confirm production domain and implement.
3. **Supabase RLS audit** — deep-dive into all RLS policies to verify no cross-user data leakage paths exist.
