# Recurring hygiene review — 2026-05-30

## Summary

Second recurring codebase hygiene & security review for Prepio. Focus: regression
check on the lint pipeline (which was silently broken since 2026-05-23), confirmation
that the previous review's CI workflow still works, re-check of the unauthenticated
edge functions called out twice already, dependency posture, and a sweep of the
two edge functions added since the last run (`answer-feedback`, `profile-import`).

The codebase is moving in the right direction on auth posture — both new edge
functions correctly use `authorizeRequest`. The three pre-existing
unauthenticated paid endpoints flagged in both prior reviews are still
unauthenticated. One small DX fix was landed this run (lint regression).

No product, auth, schema, or business logic was touched.

## Commands run

- `npm install`: pass (2 moderate audit advisories, both in `esbuild`/`vite` dev-only — see Findings).
- `npm run lint`: **broken on the lockfile shipped on `main`** (`TypeError: Error while loading rule '@typescript-eslint/no-unused-expressions': Cannot read properties of undefined (reading 'allowShortCircuit')`). After this run's `typescript-eslint` bump: runs cleanly with the documented 7-error / 10-warning baseline (no new failures).
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 44 precache entries, ~2.1 MiB).
- `npm test`: pass (24 test files, 198 tests, vitest + legacy schema checks).
- `npm audit`: 2 moderate (down from 26 high+moderate two reviews ago — both remaining are in `esbuild` / `vite` and require a major Vite 8.x bump).

## Findings

### Critical

None this run.

### High

- [ ] **Unauthenticated paid edge functions (`company-research`, `job-analysis`, `research-preview`)** — third recurrence
  - Evidence: [`supabase/config.toml:9-19`](../../supabase/config.toml) sets `verify_jwt = false` for these three. Their `serve()` handlers — [`supabase/functions/company-research/index.ts`](../../supabase/functions/company-research/index.ts), [`supabase/functions/job-analysis/index.ts`](../../supabase/functions/job-analysis/index.ts), [`supabase/functions/research-preview/index.ts`](../../supabase/functions/research-preview/index.ts) — do not call `authorizeRequest`. Each then hits OpenAI and/or Tavily.
  - Risk: Unchanged from 2026-05-23 / 2025-05-27 reviews — denial-of-wallet via the publicly-published Supabase publishable key. `research-preview` has an in-function rate limit, but it fingerprints on the spoofable `x-forwarded-for` / `x-preview-session` headers (also flagged 2025-05-27).
  - Recommended fix: Adopt the same pattern now used by the newer [`supabase/functions/answer-feedback/index.ts:92`](../../supabase/functions/answer-feedback/index.ts) and [`supabase/functions/profile-import/index.ts:276`](../../supabase/functions/profile-import/index.ts) — `authorizeRequest` + reject anything that isn't `kind: "service"` for the two orchestrator sub-functions. `research-preview` is genuinely unauthenticated by product design; tighten the rate-limit fingerprint instead (server-derived IP, or a CAPTCHA / proof-of-work).
  - Owner / next step: Still needs a focused security PR. The pattern is now well-established in the codebase — three other edge functions already use `authorizeRequest` correctly, so the diff is small and the precedent is clear.

### Medium

- [ ] **`npm run lint` fails on the lockfile shipped on `main`** — FIXED this run
  - Evidence: With the lockfile from commit `d8aa3c6`, `npm install && npm run lint` errors with `TypeError: ... Cannot read properties of undefined (reading 'allowShortCircuit')` in `@typescript-eslint/eslint-plugin@8.11.0`'s `no-unused-expressions` rule wrapper. `package.json` pins `eslint: ^9.9.0`, which `npm install` resolved to `9.39.4` — newer than `typescript-eslint@8.11.0`'s expected ESLint internal API. CI hides the failure because [`.github/workflows/ci.yml:31`](../../.github/workflows/ci.yml) runs lint with `continue-on-error: true`.
  - Risk: Lint has been silently no-op'ing on PRs since the last `typescript-eslint` was published. Any new rule violations are invisible. The fact that this took a full review cycle to notice is itself a finding — the "informational" CI step needs to at least report whether the linter actually ran.
  - Recommended fix: Bumped `typescript-eslint` from `^8.0.1` to `^8.60.0` in [`package.json`](../../package.json) (lockfile follows). Lint now runs and shows the documented 7-error / 10-warning baseline. No source changes.
  - Owner / next step: Consider making the CI lint step fail on a non-baseline regression. Cheapest version: keep `continue-on-error: true` but check the exit code separately and fail if it's `2` (config / runtime error) while tolerating `1` (rule violations). Out of scope for this run.

- [ ] **No Dependabot / scheduled dependency update mechanism**
  - Evidence: `.github/` contains `PULL_REQUEST_TEMPLATE.md`, `workflows/`, and `codex/` — no `dependabot.yml` or equivalent Renovate config. Two prior hygiene reviews each found a dependency-related issue (react-router XSS in 2025-05-27; the lint regression above), both of which Dependabot would have surfaced as PRs immediately.
  - Risk: Dependency drift goes unnoticed between recurring reviews. Security advisories on direct deps (e.g., the react-router open redirect) accumulate quietly.
  - Recommended fix: Add a minimal `.github/dependabot.yml` covering `npm` (weekly or monthly) and `github-actions`. Group dev-only deps together so the PR queue stays manageable. Not landed this run because cadence is a process decision the owner should weigh in on (weekly = noisy, monthly = stale).
  - Owner / next step: Product owner confirms cadence; follow-up PR adds the config.

- [ ] **CORS wildcard (`Access-Control-Allow-Origin: *`) on all 10 edge functions** — repeat from 2025-05-27
  - Evidence: Every edge function in [`supabase/functions/*/index.ts`](../../supabase/functions/) sets `"Access-Control-Allow-Origin": "*"`. Same finding as 2025-05-27.
  - Risk: Combined with the unauthenticated functions above, any origin can invoke the paid endpoints. With `authorizeRequest` in place this matters less, but it still expands the credential-theft replay surface for authenticated endpoints.
  - Recommended fix: Add a tiny `allowedOrigins` helper in [`supabase/functions/_shared/`](../../supabase/functions/_shared/) that reads an env var (`APP_ALLOWED_ORIGINS`) and echoes `Access-Control-Allow-Origin` only if the request `Origin` is in the list. Fall back to `*` for development if the env var is unset, so local dev keeps working.
  - Owner / next step: Same engineer as the auth-hardening PR — bundle them together since both touch every edge function.

### Low / clean-up

- [ ] **`supabase/functions/interview-question-generator/` is dead code** — repeat from 2025-05-27
  - Evidence: No references in `src/`, no references in `interview-research/index.ts`, no references in any other edge function. Notably, it is no longer listed in [`supabase/config.toml`](../../supabase/config.toml), so it now defaults to `verify_jwt = true` (gateway-level protection). But the directory and code are still in the repo.
  - Risk: Low — gateway auth means the loose `verify_jwt = false` from prior reviews is now closed. Pure maintenance burden: 700+ lines of TypeScript no caller depends on.
  - Recommended fix: Confirm with product owner that no external integration calls it, then `supabase functions delete interview-question-generator` and `git rm -r supabase/functions/interview-question-generator/`. Same recommendation as 2025-05-27, still blocked on owner confirmation.

- [ ] **Env-var-name enumeration in `console.warn` when API keys are missing** — repeat from 2026-05-23
  - Evidence: 4 sites: [`supabase/functions/company-research/index.ts:90,91,98`](../../supabase/functions/company-research/index.ts) and [`supabase/functions/job-analysis/index.ts:85`](../../supabase/functions/job-analysis/index.ts). Logs env var **names** matching `API` / `KEY` / `SUPABASE` to help diagnose missing-key misconfigurations.
  - Risk: Low — names only, no values. Becomes higher if a log shipper that indexes log content is added.
  - Recommended fix: Either gate behind a `DEBUG_CONFIG` env flag, or remove the enumeration block entirely (the error message is already explicit about which key is missing).

- [ ] **2 moderate `npm audit` advisories on `esbuild` / `vite`** — repeat from 2025-05-27
  - Evidence: `esbuild <=0.24.2` (dev-server request smuggling) and `vite <=6.4.1` (path traversal in optimised-deps `.map` handling). `fixAvailable` requires `vite@8.0.14` — a major version bump.
  - Risk: Dev-only. Production builds are not affected.
  - Recommended fix: Defer until the next planned Vite upgrade. Do not run `npm audit fix --force` mid-cycle.

- [ ] **Lint baseline still has 7 errors** — informational
  - Evidence: After this run's fix, `npm run lint` exits non-zero with 7 errors and 10 warnings, matching the baseline documented in [`docs/TESTING.md`](../TESTING.md). Breakdown: 2 `@typescript-eslint/no-empty-object-type` (`command.tsx:24`, `textarea.tsx:5`), 1 `@typescript-eslint/no-require-imports` (intentional, `tailwind.config.ts:110`), 4 `@typescript-eslint/no-explicit-any` (3 in legacy Deno tests, 1 in `Auth.tsx`).
  - Recommended fix: Fix the two `no-empty-object-type` errors (trivial: change `interface X extends Y {}` → `type X = Y`). The legacy Deno test `any`s can wait until that suite is rewritten.

## Small fixes made in this run

1. **Bumped `typescript-eslint` from `^8.0.1` to `^8.60.0`** ([`package.json`](../../package.json), `package-lock.json`) to fix a `TypeError` that prevented `npm run lint` from running at all on a fresh `npm install`. No source changes, no rule changes. After the bump, lint reports the same documented baseline (7 errors, 10 warnings) — confirms no rule-set drift.

No application code, no schema, no auth, and no product flow was touched.

## Deferred items

- The three unauthenticated paid edge functions (above) — third recurrence, still needs a focused security PR.
- CORS-origin restriction — bundle with the auth-hardening PR above.
- Dependabot config — needs an owner decision on cadence first.
- Removing `interview-question-generator` dead code — needs owner confirmation it isn't called by anything external.
- Fix the lint `continue-on-error` blind spot — small CI tweak to fail on lint *runtime* errors while still tolerating rule violations.
- Vite 8.x upgrade to clear the residual moderate audit findings.

## Questions for product owner

None blocking. The unauthenticated-edge-functions and dead-code-removal questions from prior reviews remain open but the recommended approach is unchanged — they're waiting for engineer time, not for product input.

## Next review focus

1. **Re-run lint on a freshly-cloned checkout** before doing anything else — confirm the bump landed in the lockfile and the silent-fail-on-CI pattern hasn't re-appeared.
2. **Edge function auth hardening progress.** This is the third time the unauthenticated paid endpoints have been flagged. If still open, recommend escalating to a Linear `area:research-pipeline` issue with explicit "next" prioritisation rather than carrying it forward in another review.
3. **Whether Dependabot landed** and, if so, triage the first batch of PRs it opens.
