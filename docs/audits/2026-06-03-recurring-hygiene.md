# Recurring hygiene review — 2026-06-03

## Summary

Third recurring codebase hygiene & security review for Prepio. Focus: regression
check on lint/typecheck/build/test pipelines, confirmation that the two recent
edge-function auth-hardening PRs (#106, #107) closed the long-standing
unauthenticated-paid-endpoint finding, a sweep of CORS posture after the
`buildCorsHeaders` helper landed, a fresh `npm audit` snapshot, and a docs
accuracy pass against shipped features.

The headline result is good: the **three unauthenticated paid edge functions
flagged in every prior review are now closed**. `company-research`,
`job-analysis`, and `interview-question-generator` all require a service
caller, matching the pattern in `answer-feedback` and `profile-import`. The
`research-preview` rate-limit fingerprint was also tightened
(server-derived IP only — see `supabase/functions/research-preview/fingerprint.ts`).

Two small documentation fixes were landed this run (README and CLAUDE.md
both still claimed pricing/checkout/portal/answer-feedback were unshipped).
No application code, no schema, no auth changes.

## Commands run

- `npm install`: pass (2 moderate audit advisories — see Findings; unchanged
  from prior review).
- `npm run lint`: 17 problems (7 errors, 10 warnings) — matches the documented
  baseline. No new failures.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 51 precache entries, ~2.17 MiB).
- `npm test`: pass (34 test files, 256 tests, vitest + legacy schema check +
  answer-feedback schema check).
- `npm audit`: 2 moderate (both in `esbuild` / `vite`, dev-only —
  unchanged from 2026-05-30, fix still requires the Vite 8.x major bump).

## Findings

### Critical

None this run.

### High

None this run. **The unauthenticated paid edge functions are now closed**:

- [`supabase/functions/company-research/index.ts:681`](../../supabase/functions/company-research/index.ts)
  calls `authorizeRequest` (PREPIO-61, #106).
- [`supabase/functions/job-analysis/index.ts:268`](../../supabase/functions/job-analysis/index.ts)
  calls `authorizeRequest` (PREPIO-61, #106).
- [`supabase/functions/interview-question-generator/index.ts:486`](../../supabase/functions/interview-question-generator/index.ts)
  calls `authorizeRequest` (PREPIO-39, #107). Note this function remains
  uncalled by any in-repo caller — see Low / clean-up below — but the auth
  hardening still removes the denial-of-wallet vector if anyone discovers it.
- [`supabase/functions/research-preview/fingerprint.ts`](../../supabase/functions/research-preview/fingerprint.ts)
  now keys the rate limit on the first IP from `x-forwarded-for` only, with an
  explicit comment about why client-supplied headers are excluded. Closes the
  spoofable-fingerprint sub-finding from 2025-05-27.

### Medium

- [ ] **`buildCorsHeaders` helper exists but is only adopted by 4 of 11 edge
  functions**
  - Evidence: The helper at
    [`supabase/functions/_shared/cors.ts`](../../supabase/functions/_shared/cors.ts)
    reads `APP_ALLOWED_ORIGINS` and echoes a matching origin (falls back to
    `*` if unset). It is imported by `company-research`, `job-analysis`,
    `interview-question-generator`, and `research-preview`. The other seven
    edge functions still hardcode
    `"Access-Control-Allow-Origin": "*"`:
    `answer-feedback/index.ts:15`,
    `interview-research/index.ts:10`,
    `cv-analysis/index.ts:8`,
    `practice-audio-transcribe/index.ts:6`,
    `profile-import/index.ts:15`,
    `create-checkout-session/index.ts:18`,
    `create-portal-session/index.ts:14`.
  - Risk: Medium. With `authorizeRequest` in place across all paid functions,
    a wide-open CORS still matters for credential-theft replay surface (any
    origin can drive an attached browser session through these endpoints).
    Particularly worth tightening on the two Stripe endpoints, which transact
    on user billing.
  - Recommended fix: One small PR that replaces the hardcoded `corsHeaders`
    object in each of the seven remaining handlers with
    `buildCorsHeaders(req)`. The helper already falls back to `*` when
    `APP_ALLOWED_ORIGINS` is unset, so the change is operationally a no-op
    until the env var is configured. Configure `APP_ALLOWED_ORIGINS` in the
    Supabase secrets in a follow-up.
  - Owner / next step: Bundle with the next edge-functions touch.
    Out of scope for this hygiene run because it deploys all 7 functions
    together.

- [ ] **Env-var-name enumeration in `console.warn`** — repeat from 2026-05-23
  - Evidence: still 4 sites in
    [`supabase/functions/company-research/index.ts:91,92,99`](../../supabase/functions/company-research/index.ts)
    and
    [`supabase/functions/job-analysis/index.ts:82`](../../supabase/functions/job-analysis/index.ts)
    that log `Object.keys(Deno.env.toObject()).filter(... 'API' | 'KEY' | 'SUPABASE')`
    when keys are missing.
  - Risk: Low — names only, no values. Worth fixing because the function is
    now authenticated, so the audience for these logs is operators, not the
    public — there's no diagnostic benefit to dumping every API-shaped env var
    when the specific missing one is already in the error message.
  - Recommended fix: Gate the enumeration behind a `DEBUG_CONFIG` env flag or
    remove it. Trivial change; not landed this run only because the same PR
    should clean up all four sites and re-deploy two functions.

- [ ] **No Dependabot / scheduled dependency update mechanism** — repeat from
  2026-05-30
  - Evidence: `.github/` still contains no `dependabot.yml`.
  - Risk: Dependency drift goes unnoticed between recurring reviews. The
    vitest CVE patched in #109 is exactly the kind of advisory Dependabot
    would have surfaced as a one-line PR.
  - Recommended fix: Add a minimal `.github/dependabot.yml` for `npm` and
    `github-actions`. Defaulting to **monthly** (rather than weekly) keeps
    the PR queue manageable for a small team; the existing CI workflow will
    auto-verify each bump. Not landed this run because the prior review
    explicitly deferred for an owner decision on cadence — flag for the next
    cycle's owner question if still open.

### Low / clean-up

- [ ] **`supabase/functions/interview-question-generator/` is still uncalled
  by any in-repo caller** — repeat from 2025-05-27 and 2026-05-30
  - Evidence: `grep -rn "interview-question-generator" supabase/functions/
    src/ scripts/` returns no matches outside the function's own directory.
    The function is now properly auth-gated (PREPIO-39), but 565 lines of
    Deno TypeScript are still maintained for no observed caller.
  - Risk: Maintenance burden only. The gateway- and function-level auth means
    the denial-of-wallet risk is gone.
  - Recommended fix: Confirm with the product owner that no external
    integration calls it; if not, `supabase functions delete
    interview-question-generator` + `git rm -r` the directory. Same
    recommendation as the prior two reviews — third recurrence — and now
    explicitly worth a Linear `Chore` issue rather than carrying it forward
    again.

- [ ] **README.md and CLAUDE.md routes table were stale** — FIXED this run
  - Evidence: README's "Not shipped yet" section still listed user-facing
    pricing page, Stripe Checkout, Customer Portal, and AI answer feedback,
    all of which have shipped (#96, #102, #104). CLAUDE.md's routes table
    was missing `/pricing` (public) and `/billing/return` (protected) and
    listed `/profile` instead of `/profile/*`.
  - Recommended fix: Updated this run.

- [ ] **2 moderate `npm audit` advisories on `esbuild` / `vite`** — repeat
  - Evidence: `esbuild <=0.24.2` and `vite <=6.4.1`. `fixAvailable` is
    `vite@8.0.16` (major). Dev-only impact.
  - Recommended fix: Defer to the next planned Vite upgrade. Do not run
    `npm audit fix --force`.

- [ ] **CI lint step still `continue-on-error: true`** — repeat from
  2026-05-30
  - Evidence:
    [`.github/workflows/ci.yml:31`](../../.github/workflows/ci.yml). The
    silent-fail-on-lint-config-error blind spot identified last review is
    still open. Lint baseline is unchanged (7 errors, 10 warnings), so this
    is informational.
  - Recommended fix: Same as 2026-05-30 — fail on exit code `2` (config /
    runtime error), tolerate exit code `1` (rule violations).

- [ ] **Lint baseline still has 7 errors** — informational
  - Evidence: 2 `@typescript-eslint/no-empty-object-type` (`command.tsx:24`,
    `textarea.tsx:5`), 1 `@typescript-eslint/no-require-imports` (intentional,
    `tailwind.config.ts:110`), 4 `@typescript-eslint/no-explicit-any` (3 in
    legacy Deno tests, 1 in `Auth.tsx`).
  - Recommended fix: The two `no-empty-object-type` are trivial (shadcn-style
    `interface X extends Y {}` boilerplate); leaving untouched to avoid
    churning the shadcn convention used elsewhere in the codebase. The Deno
    `any`s can wait until that suite is rewritten.

## Small fixes made in this run

1. **Updated `README.md`** — moved pricing page, Stripe Checkout, Customer
   Portal, and AI answer feedback from "Not shipped yet" to "Shipped". These
   landed in PRs #96, #102, #104, and the entitlement-gated answer feedback
   suite (#77, #78, #100, #104) over the past cycle.
2. **Updated `CLAUDE.md`** — added `/pricing` (public) and `/billing/return`
   (protected) to the routes table; corrected `/profile` to `/profile/*` to
   match the actual nested-route definition in
   [`src/App.tsx:124`](../../src/App.tsx).

No application code, no schema, no auth, and no product flow was touched.

## Deferred items

- Adopting `buildCorsHeaders` in the remaining 7 edge functions (above).
- Removing the env-var-name enumeration in `company-research` /
  `job-analysis` (above).
- Removing `interview-question-generator` dead code (third recurrence —
  promote to a Chore issue if owner confirms no external caller).
- Adding `.github/dependabot.yml` (still waiting on owner cadence decision).
- Tightening the CI lint step to fail on config errors while tolerating rule
  violations.
- Vite 8.x upgrade to clear residual moderate audit findings.

## Questions for product owner

- **Does anything external call
  `supabase/functions/interview-question-generator/`?** Third recurrence
  of this question. If "no", the function should be deleted. If "yes", the
  external caller should be documented in `docs/ARCHITECTURE.md` so future
  reviews stop flagging it. Owner answer unblocks a small clean-up PR.
- **Dependabot cadence: weekly or monthly?** Or do we want Renovate instead?
  This blocks a 5-line config change.

## Next review focus

1. **CORS hardening progress.** Verify that the seven remaining edge functions
   adopt `buildCorsHeaders` and that `APP_ALLOWED_ORIGINS` is configured in
   production secrets.
2. **Dependabot in place** — and if so, triage the first batch of PRs it
   opens.
3. **Edge-function logging surface.** Now that all paid endpoints require
   `authorizeRequest`, take a closer look at what fields each function logs
   under success and failure paths (especially `cv-analysis` which logs user
   IDs at info level, and `answer-feedback`'s JSON event log).
