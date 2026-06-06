# Recurring hygiene review — 2026-06-06

## Summary

Fourth recurring codebase hygiene & security review for Prepio. Focus: a
fresh `npm audit` snapshot, a sweep of the logging surface across edge
functions (next-focus item carried over from 2026-06-03), a regression
check on lint / typecheck / build / test, and a status check on the
medium-severity items deferred in the prior three reviews.

The headline result is a **new react-router open-redirect advisory**
(GHSA-2j2x-hqr9-3h42, moderate) that wasn't present in the 2026-06-03
snapshot. The fix is a same-line patch bump (`react-router-dom`
6.30.3 → 6.30.4) that lands cleanly under the existing `^6.26.2`
range — applied this run. Build, typecheck, and the full 260-test
vitest suite stay green after the bump.

A separate quick docs fix: README still said "Checkout and portal flows
are next" in the stack section even though they are listed as shipped
two paragraphs above (and the 2026-06-03 review already moved them out
of "Not shipped yet"). Updated this run for consistency.

No application code, no schema, no auth changes.

## Commands run

- `npm install`: pass (note: Playwright Chromium download failed in the
  startup-hook sandbox — does not affect vitest or the build; e2e isn't
  part of the local safety net).
- `npm run lint`: 17 problems (7 errors, 10 warnings) — matches the
  documented baseline. No new failures.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 51 precache entries, ~2.17 MiB).
- `npm test`: pass (34 test files, 260 tests; +4 tests vs. 2026-06-03,
  no regressions). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: 4 moderate before fix; 2 moderate after `npm audit fix`
  (the residual two are the dev-only `esbuild`/`vite` finding carried
  from every prior review; unfixable without a Vite 8.x major bump).

## Findings

### Critical

None this run.

### High

- [x] **`react-router` open redirect (GHSA-2j2x-hqr9-3h42, moderate
  CVSS)** — FIXED this run
  - Evidence: `npm audit` flagged `react-router` 6.7.0 – 6.30.3.
    Same-origin redirect with a path starting `//` is reinterpreted as
    a protocol-relative URL, allowing redirect to an attacker-controlled
    host. Patched in 6.30.4 on the 6.x line.
  - Risk: Moderate in our usage. Our two redirect sinks are
    [`src/pages/Auth.tsx:45–47`](../../src/pages/Auth.tsx) (post-sign-in
    redirect from `location.state.from`, populated by `ProtectedRoute`
    in [`src/App.tsx:56`](../../src/App.tsx) via `useLocation()` — not a
    user-controlled query string) and
    [`src/pages/BillingReturn.tsx:22–26`](../../src/pages/BillingReturn.tsx)
    (`returnTo` query param, which already has an explicit
    `safeReturnTo` allowlist rejecting `//` and `/\`). So the in-repo
    surface area is small, but the upstream patch is the right defence
    in depth.
  - Recommended fix: `npm audit fix` (lockfile-only — version constraint
    `^6.26.2` already allows 6.30.4).
  - Owner / next step: Applied this run. Bundled with the README fix
    below in a single hygiene PR.

### Medium

- [ ] **`buildCorsHeaders` helper still adopted by only 4 of 11 edge
  functions** — repeat from 2026-06-03
  - Evidence: No new adoption since 2026-06-03. `grep -L
    buildCorsHeaders supabase/functions/*/index.ts` returns the same
    seven handlers as last time: `answer-feedback`,
    `create-checkout-session`, `create-portal-session`, `cv-analysis`,
    `interview-research`, `practice-audio-transcribe`,
    `profile-import`, plus `stripe-webhook` (which legitimately doesn't
    need CORS — it's webhook-only). So six user-facing handlers still
    hardcode `"Access-Control-Allow-Origin": "*"`.
  - Risk: Medium. With `authorizeRequest` in place across all paid
    functions, a wide-open CORS still matters for credential-theft
    replay surface — particularly on the two Stripe endpoints
    (`create-checkout-session`, `create-portal-session`) which transact
    on user billing.
  - Recommended fix: Same as 2026-06-03 — one small PR replacing the
    hardcoded `corsHeaders` object with `buildCorsHeaders(req)`. Helper
    falls back to `*` when `APP_ALLOWED_ORIGINS` is unset, so the
    change is operationally a no-op until the env var is configured.
  - Owner / next step: Promoting to a Linear issue if not already
    tracked — this is now a third-recurrence finding. Out of scope for
    this hygiene run because the change re-deploys six edge functions
    together.

- [ ] **Env-var-name enumeration in `console.warn`** — repeat from
  2026-05-23, 2026-06-03
  - Evidence: still 4 sites in
    [`supabase/functions/company-research/index.ts:99`](../../supabase/functions/company-research/index.ts)
    and
    [`supabase/functions/job-analysis/index.ts:82`](../../supabase/functions/job-analysis/index.ts)
    that log `Object.keys(Deno.env.toObject()).filter(... 'API' | 'KEY')`
    when keys are missing.
  - Risk: Low — names only, no values. Worth fixing because the
    function is now authenticated, so the audience for these logs is
    operators and there's no diagnostic benefit to dumping every
    API-shaped env var when the specific missing one is already in the
    error message.
  - Recommended fix: Gate the enumeration behind a `DEBUG_CONFIG` env
    flag or remove it. Trivial change; not landed this run only
    because the same PR should clean up both sites and re-deploy two
    functions.

- [ ] **No Dependabot / scheduled dependency update mechanism** —
  repeat from 2026-05-30, 2026-06-03
  - Evidence: `.github/` still has only `PULL_REQUEST_TEMPLATE.md`,
    `codex/`, and `workflows/` (which has `ci.yml` and the codex
    auto-PR workflow). No `dependabot.yml`.
  - Risk: Dependency drift goes unnoticed between recurring reviews.
    Today's react-router advisory is a good example of the
    drive-by-CVE risk: a one-line PR from Dependabot would have
    surfaced 6.30.4 within days of its publication, instead of waiting
    for the next manual hygiene cycle.
  - Recommended fix: Add a minimal `.github/dependabot.yml` for `npm`
    and `github-actions`, monthly cadence. Still waiting on the owner
    cadence decision flagged in 2026-06-03.

### Low / clean-up

- [ ] **`supabase/functions/interview-question-generator/` is still
  uncalled by any in-repo caller** — fourth recurrence (2025-05-27,
  2026-05-23, 2026-05-30, 2026-06-03)
  - Evidence: `grep -rn interview-question-generator supabase/functions/
    src/ scripts/` still returns no matches outside the function's own
    directory and the Deno test files. 565 lines maintained for no
    observed caller.
  - Risk: Maintenance burden only — auth-gated since #107.
  - Recommended fix: Same as last three reviews — confirm with the
    product owner that no external integration calls it; if not,
    `supabase functions delete` + `git rm -r`. This is the fourth
    recurrence and now overdue for a Linear `Chore` issue (or an
    explicit "leave it" decision recorded in `docs/ARCHITECTURE.md`).

- [ ] **README "stack" line out of sync with shipped status** — FIXED
  this run
  - Evidence: [`README.md:29`](../../README.md) said "Stripe webhook
    and entitlement foundation. Checkout and portal flows are next."
    even though Checkout and Customer Portal were moved out of "Not
    shipped yet" in the 2026-06-03 review (and have been live since
    PRs #102 and #104).
  - Recommended fix: Updated this run.

- [ ] **2 moderate `npm audit` advisories on `esbuild` / `vite`** —
  repeat from 2026-05-23, 2026-05-30, 2026-06-03
  - Evidence: `esbuild <=0.24.2` and `vite <=6.4.1`. `fixAvailable` is
    `vite@8.0.16` (major). Dev-only impact (dev-server only).
  - Recommended fix: Defer to the next planned Vite upgrade. Do not
    run `npm audit fix --force`.

- [ ] **CI lint step still `continue-on-error: true`** — repeat from
  2026-05-30, 2026-06-03
  - Evidence:
    [`.github/workflows/ci.yml:31`](../../.github/workflows/ci.yml).
    The silent-fail-on-lint-config-error blind spot identified last
    review is still open. Lint baseline unchanged (7 errors, 10
    warnings), so this is informational.
  - Recommended fix: Same as 2026-05-30 — fail on exit code `2`
    (config / runtime error), tolerate exit code `1` (rule
    violations).

- [ ] **Edge-function logging surface — clean** — next-focus item from
  2026-06-03
  - Evidence: Audited all 11 edge functions for what they log under
    success and failure. Findings:
    - No edge function logs answer text, transcripts, prompt content,
      model responses, CV text, profile content, emails, tokens, or
      secrets.
    - [`answer-feedback/handler.ts`](../../supabase/functions/answer-feedback/handler.ts)
      uses structured JSON via `deps.log?.(event, fields)` and only
      passes IDs (userId, practiceAnswerId, feedbackId) and error
      `.message` strings.
    - [`cv-analysis/index.ts:371,389,404`](../../supabase/functions/cv-analysis/index.ts)
      logs `userId` + a status string. Reasonable for operational
      tracing.
    - Logs that touched URL counts or phase progress only carry counts,
      not URLs themselves.
    - The only outstanding logging concern is the env-var-name
      enumeration tracked separately above.
  - Risk: Low — no PII or interview-prep content surfaces in logs.

- [ ] **Lint baseline still has 7 errors** — informational
  - Evidence: 2 `@typescript-eslint/no-empty-object-type`
    (`command.tsx:24`, `textarea.tsx:5`), 1
    `@typescript-eslint/no-require-imports` (intentional,
    `tailwind.config.ts:110`), 4 `@typescript-eslint/no-explicit-any`
    (3 in legacy Deno tests, 1 in `Auth.tsx`).
  - Recommended fix: Unchanged from 2026-06-03 — the two
    `no-empty-object-type` are shadcn-style boilerplate; the Deno
    `any`s can wait until that suite is rewritten.

## Small fixes made in this run

1. **`npm audit fix`** — bumped `react-router` and `react-router-dom`
   6.30.3 → 6.30.4 to patch GHSA-2j2x-hqr9-3h42 (open redirect via
   protocol-relative URL). Lockfile-only change; the existing
   `^6.26.2` range already allowed the patch. Verified `npm run
   typecheck`, `npm run build`, and `npm test` (260 tests) all stay
   green after the bump.
2. **`README.md`** — corrected the stack line that still said Checkout
   and Customer Portal flows were "next" even though they have been
   live and listed as shipped two paragraphs above.

No application code, no schema, no auth, and no product flow was
touched.

## Deferred items

- Adopting `buildCorsHeaders` in the remaining six user-facing edge
  functions (third recurrence — promote to a Linear issue if not
  already tracked).
- Removing the env-var-name enumeration in `company-research` /
  `job-analysis` (third recurrence).
- Removing `interview-question-generator` dead code (fourth
  recurrence — overdue for a Chore issue or an explicit
  "leave it" decision in `docs/ARCHITECTURE.md`).
- Adding `.github/dependabot.yml` (third recurrence — still waiting on
  owner cadence decision; today's react-router CVE is a fresh example
  of the cost of waiting).
- Tightening the CI lint step to fail on config errors while
  tolerating rule violations.
- Vite 8.x upgrade to clear residual moderate audit findings.

## Questions for product owner

- **Does anything external call
  `supabase/functions/interview-question-generator/`?** Fourth
  recurrence. If "no", delete the function. If "yes", document the
  external caller in `docs/ARCHITECTURE.md` so future reviews stop
  flagging it. Owner answer unblocks a small clean-up PR.
- **Dependabot cadence: weekly or monthly?** Or Renovate instead?
  Third recurrence. This blocks a 5-line config change that would
  have surfaced today's react-router patch automatically.

## Next review focus

1. **`buildCorsHeaders` adoption and `APP_ALLOWED_ORIGINS`
   configuration.** Now flagged for three consecutive reviews with no
   movement; if still open next cycle, recommend bundling with the
   next edge-function touch regardless of scope.
2. **Dependabot landing** — and if so, triage the first batch of
   bumps. If still not landed, treat as a blocker on the owner
   question above.
3. **Storage and RLS posture** — areas not yet covered in detail by
   recurring reviews. Specifically, verify that the
   `practice-audio` bucket and the resume storage paths reject
   cross-user reads, and spot-check that the candidate-profile,
   practice-answers, and answer-feedback tables have RLS policies
   matching the auth model.
