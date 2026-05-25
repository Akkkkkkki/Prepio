# Recurring hygiene review — 2026-05-23

## Summary

First recurring codebase hygiene & security review for Prepio. Focus: security
posture of edge functions, dependency advisories, repo/CI hygiene, lint/build/
typecheck/test state, and documentation accuracy. Two small DX fixes were
landed in this run (a `typecheck` npm script and a minimal GitHub Actions CI
workflow). No product, auth, or schema changes.

## Commands run

- `npm install`: pass (warnings about deprecated transitive packages: `sourcemap-codec`, `source-map@0.8.0-beta.0`, `glob@11.1.0`).
- `npm run lint`: 38 problems (20 errors, 18 warnings) — matches the documented baseline in [`docs/TESTING.md`](../TESTING.md). Informational only; no new failures introduced.
- `npm run typecheck`: pass (script added this run; underlying `tsc --noEmit` was already clean).
- `npm run build`: pass (Vite production build + PWA, 44 precache entries, ~2.1 MiB).
- `npm test`: pass (21 test files, 179 tests, vitest + legacy schema check).
- `npm audit`: **26 vulnerabilities (2 low, 10 moderate, 14 high)** — all in dev/build/test transitive deps; see Findings.

## Findings

### Critical

None this run.

### High

- [ ] **Unauthenticated paid edge functions (`company-research`, `job-analysis`, `interview-question-generator`)**
  - Evidence: [`supabase/config.toml`](../../supabase/config.toml) sets `verify_jwt = false` for these three functions, and their `serve()` handlers in [`supabase/functions/company-research/index.ts:662`](../../supabase/functions/company-research/index.ts), [`supabase/functions/job-analysis/index.ts:258`](../../supabase/functions/job-analysis/index.ts), and [`supabase/functions/interview-question-generator/index.ts:476`](../../supabase/functions/interview-question-generator/index.ts) accept and process requests with no caller-identity check. Each function then hits OpenAI (`OPENAI_API_KEY`) and/or Tavily (`TAVILY_API_KEY`) — both paid APIs.
  - Risk: Any caller with the publicly-published Supabase publishable key (i.e., any visitor to the site) can invoke these endpoints directly and burn OpenAI/Tavily credits. Classic denial-of-wallet vector. Bonus risk: each function does a service-role read of `searches.user_id` from a caller-supplied `searchId`, which exposes a small lookup oracle.
  - Recommended fix: Adopt the existing pattern used by [`supabase/functions/practice-audio-transcribe/index.ts:27`](../../supabase/functions/practice-audio-transcribe/index.ts) and [`supabase/functions/create-checkout-session/index.ts:77`](../../supabase/functions/create-checkout-session/index.ts). Import `authorizeRequest` from `../_shared/auth.ts` and reject anything that is not `kind: "service"` (since the only legitimate caller is `interview-research`, which already passes `SUPABASE_SERVICE_ROLE_KEY` as the bearer at [`supabase/functions/interview-research/index.ts:190`](../../supabase/functions/interview-research/index.ts) / `:226` / `:262`).
  - Owner / next step: Needs an authorized PR in `area:research-pipeline`. Defer to a focused security PR rather than a hygiene run because (a) the change deploys edge functions and needs the service-role caller path verified end-to-end, and (b) authentication-model changes are outside the recurring-review scope without explicit approval.

- [ ] **High-severity dependency advisories on build/test tooling**
  - Evidence: `npm audit` reports 14 high-severity issues across `lodash`, `glob`, `minimatch`, `picomatch`, `rollup`, `fast-uri`, `flatted`, `serialize-javascript`, `@babel/plugin-transform-modules-systemjs`, `@remix-run/router`, `brace-expansion`. All are transitive — none are direct runtime deps of the shipped browser bundle (they sit under `workbox-build`, `@rollup/plugin-terser`, `eslint`, `vite`, `vitest`, etc.).
  - Risk: Primarily build-time exposure (e.g., RCE via `serialize-javascript` inside Workbox; path traversal via `rollup` writing artifacts; ReDoS in `picomatch`/`minimatch`). Lower runtime impact, but a compromised build pipeline can still ship malicious JS. `@remix-run/router` is the one runtime concern — it's pulled in by `react-router-dom@6.26.2`; advisory is for older versions, current pin needs verifying.
  - Recommended fix: Two-step in a follow-up PR. (1) Run `npm audit fix` on a branch and confirm `npm test`, `npm run build`, and `npm run preview` all still pass — `audit fix` here proposes touching ~60 packages including `workbox-*` and `rollup`, which is too broad for a hygiene run. (2) Bump `react-router-dom` to the latest 6.x to clear `@remix-run/router`. Don't bump to v7 in a maintenance pass (breaking).
  - Owner / next step: Standalone dependency-bump PR with a manual smoke pass on `/`, `/auth`, `/dashboard`, `/practice` before merge.

### Medium

- [ ] **No CI on PRs prior to this run**
  - Evidence: `.github/` contained only `PULL_REQUEST_TEMPLATE.md` — no `workflows/` directory. Nothing was enforcing that `typecheck`/`build`/`test` pass on PRs before merge.
  - Risk: Type/test regressions can land on `main` undetected; reviewers carry the verification burden manually.
  - Recommended fix: **Done this run.** Added [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) that runs `npm ci`, `lint` (continue-on-error, matching the documented informational status), `typecheck`, `build`, and `test` on PR + push to `main`.
  - Owner / next step: After this PR merges, enable branch protection on `main` requiring the `verify` job to pass. Recommended via Settings → Branches → Add rule.

- [ ] **`supabase/functions/**` excluded from ESLint scope**
  - Evidence: [`eslint.config.js:9`](../../eslint.config.js) — `ignores: ["dist", "supabase/functions/**"]`. Roughly 8,800 lines of Deno-flavored TypeScript (including the Stripe webhook and the research pipeline) are not linted.
  - Risk: Code-quality drift in the most security-sensitive layer (service-role DB access, payment processing).
  - Recommended fix: Carve out a separate Deno-friendly lint config (different globals, deno-style imports) and at least cover the `_shared/` helpers + `stripe-webhook/` + `create-checkout-session/`. Skip the older research files initially since they have known `any` usage that's not worth churning.
  - Owner / next step: Defer — sizing required. Add to "Quality & Maintenance" in Linear.

- [ ] **Frontend `console.*` calls leak resume/CV/profile error context (105 sites)**
  - Evidence: 105 `console.{log,info,warn,error,debug}` calls across `src/` (count via `grep`). Concentrated in `src/services/searchService.ts` and `src/services/search/profile.ts`. Several log resume/CV/profile failure objects directly — e.g., `console.error("Error analyzing CV:", error)` at [`src/services/search/profile.ts:52`](../../src/services/search/profile.ts).
  - Risk: Currently low — Prepio doesn't ship a third-party error tracker that would forward these. Becomes higher if Sentry/PostHog/etc. is added later, because the same call sites will start exfiltrating CV/resume metadata to the vendor.
  - Recommended fix: Either (a) introduce a tiny `log` wrapper that scrubs error payloads and centralises whether logs ship anywhere, or (b) keep `console.*` but add a project lint rule blocking new calls outside an approved logger module.
  - Owner / next step: Defer; flag at the moment an error tracker is introduced.

### Low / clean-up

- [ ] **No `typecheck` npm script**
  - Evidence: Missing from `package.json` scripts before this run; `tsc --noEmit` had to be invoked manually.
  - Recommended fix: **Done this run.** Added `"typecheck": "tsc --noEmit"` to `package.json`. The recurring-review prompt asks for it explicitly.

- [ ] **`.env.example` ships the real production Supabase project URL**
  - Evidence: [`.env.example`](../../.env.example) — `VITE_SUPABASE_URL=https://vjwrirrqprjzdorignlz.supabase.co` (matches `supabase/config.toml:1`).
  - Recommended fix: Not a secret (Supabase URLs are public by design), so no rotation needed. Cosmetic improvement only: replace with `https://YOUR_PROJECT_REF.supabase.co` to keep the example template-shaped. Leave for a docs-pass; not worth a fix in this run.

- [ ] **`make test` documented as a smoke check but requires `.env.local` with live API keys**
  - Evidence: [`Makefile`](../../Makefile) — `source .env.local && deno test --allow-all --no-check tests/unit/test_edge_functions/*.ts`. `docs/TESTING.md` already flags these as legacy.
  - Recommended fix: Already correctly de-emphasised in docs. Consider removing the `make test` target altogether next time the legacy suite is touched.

- [ ] **`tailwind.config.ts:110` uses `require()` despite ESM module type**
  - Evidence: Lint error `@typescript-eslint/no-require-imports`.
  - Recommended fix: Documented as intentional in `docs/TESTING.md` (tailwindcss-animate's documented install). Leave.

## Small fixes made in this run

- Added `"typecheck": "tsc --noEmit"` to [`package.json`](../../package.json) so the recurring `npm run typecheck` step works without manual invocation.
- Added [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — `npm ci`, informational `lint`, strict `typecheck`, `build`, `test` on PR + push to `main`. Lint runs `continue-on-error: true` because the baseline is documented as informational; the other three are blocking.

No application code, no schema, no auth, and no product flow was touched.

## Deferred items

- The unauthenticated paid edge functions (above) — needs a focused security PR with deploy + verify.
- `npm audit fix` rollup + workbox transitive bumps — needs a manual smoke pass on the production build.
- ESLint scope extension to `supabase/functions/_shared` + Stripe handlers.
- Centralised logger / lint rule against unscoped `console.*` in `src/services/**`.
- README quickstart for local dev (link to env vars, `npm test`, `make test` caveat) — minor cosmetic.

## Questions for product owner

None blocking. The unauthenticated-edge-functions finding (above) is the one I'd flag for prioritisation, but no clarification is needed before fixing — the recommended approach is just enforcing the existing `authorizeRequest` pattern.

## Next review focus

1. **Re-check the unauthenticated edge functions.** Either land the `authorizeRequest` fix, or document that they're intentionally open and add a rate limit + spending guard.
2. **Run `npm audit` again after a dependency-bump PR lands.** Track residual high-severity advisories.
3. **Look at edge-function logging.** Several `console.warn`/`console.log` calls in `company-research` and `job-analysis` dump `Object.keys(Deno.env.toObject())` filtered by `'API'`/`'KEY'` (search-pattern around `supabase/functions/company-research/index.ts:89`). Names only, not values, but worth confirming nothing leaks via downstream log shipping.
