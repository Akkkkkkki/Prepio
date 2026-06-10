# Recurring hygiene review — 2026-06-10

## Summary

Fifth recurring codebase hygiene & security review for Prepio. Focus this
run: the "next review focus" item carried over from 2026-06-06 —
**Storage and RLS posture** for `practice-audio`, `resume-files`, and
the user-owned data tables (`candidate_profiles`, `practice_answers`,
`practice_sessions`, `resumes`, `answer_feedback`). Plus the usual
safety-net commands, a fresh `npm audit` snapshot, and a status check on
items carried in from prior reviews.

The headline result is positive: **storage buckets and table-level RLS
are clean and matching the auth model.** Both private buckets pin
ownership to `(storage.foldername(name))[1] = auth.uid()::text`, and
every user-owned table either gates on `auth.uid() = user_id` directly
or joins through `searches`/`practice_sessions` ownership. No
finding here.

One open finding from prior reviews closed silently in #124
(2026-06-06) — the CI lint step now exits non-zero on parser / config
errors (exit code 2), while tolerating rule violations (exit code 1).
Removing it from the list of repeat findings.

One small fix landed this run: removed the **env-var-name enumeration**
in `company-research` and `job-analysis` (fourth recurrence,
recommended in 2026-05-23, 2026-06-03, and 2026-06-06). Replaced the
`Object.keys(Deno.env.toObject()).filter(...)` dump with a single
warn line naming the specific missing key. No behaviour change for the
caller (the function still returns `null` and surfaces the same
error). `npm run typecheck`, `npm run build`, and `npm test` all stay
green after the edit.

No application code, no schema, no auth, no product flow touched
otherwise.

## Commands run

- `npm install`: pass (note: Playwright Chromium download fails in the
  startup-hook sandbox — does not affect vitest or the build; e2e is
  not part of the local safety net).
- `npm run lint`: 17 problems (7 errors, 10 warnings) — matches the
  documented baseline. No new failures.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 51 precache entries, ~2.17 MiB).
- `npm test`: pass (34 test files, 265 tests; +5 tests vs. 2026-06-06,
  no regressions). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: 2 moderate (unchanged — the dev-only `esbuild` / `vite`
  finding carried from every prior review; unfixable without a Vite
  8.x major bump). No new advisories since 2026-06-06.

## Findings

### Critical

None this run.

### High

None this run.

### Medium

- [ ] **`buildCorsHeaders` helper still adopted by only 4 of 11 edge
  functions** — fourth recurrence (2026-05-30, 2026-06-03, 2026-06-06,
  this review)
  - Evidence: `grep -L buildCorsHeaders supabase/functions/*/index.ts`
    returns the same seven handlers as last review:
    `answer-feedback`, `create-checkout-session`,
    `create-portal-session`, `cv-analysis`, `interview-research`,
    `practice-audio-transcribe`, `profile-import`, plus `stripe-webhook`
    (which legitimately doesn't need CORS). Six user-facing handlers
    still hardcode `"Access-Control-Allow-Origin": "*"`.
  - Risk: Medium. The two Stripe endpoints (`create-checkout-session`,
    `create-portal-session`) transact on user billing and are the
    highest-leverage CORS targets in the codebase. With
    `authorizeRequest` enforcing the auth check everywhere, the
    practical attack surface is narrow, but the wide-open CORS still
    matters as defence in depth.
  - Recommended fix: Same as last three reviews — one small PR
    replacing the hardcoded `corsHeaders` object with
    `buildCorsHeaders(req)` in the six remaining handlers. Helper falls
    back to `*` when `APP_ALLOWED_ORIGINS` is unset, so the change is
    operationally a no-op until the env var is configured.
  - Owner / next step: Now four consecutive reviews with no movement.
    Promoting from "recommended" to "should be bundled with the next
    edge-function touch regardless of scope" — out of scope for this
    hygiene run because it re-deploys six functions together, but the
    next change to any of these six should pick up the helper as part
    of the same PR.

- [ ] **No Dependabot / scheduled dependency update mechanism** —
  fourth recurrence (2026-05-30, 2026-06-03, 2026-06-06, this review)
  - Evidence: `.github/` still has only `PULL_REQUEST_TEMPLATE.md`,
    `codex/`, and `workflows/` (with `ci.yml` and the codex auto-PR
    workflow). No `dependabot.yml`.
  - Risk: Dependency drift goes unnoticed between recurring reviews.
    Last review's react-router open-redirect (GHSA-2j2x-hqr9-3h42) is
    a fresh example of the cost: a one-line PR from Dependabot would
    have surfaced 6.30.4 within days of publication instead of
    waiting for the manual cycle.
  - Recommended fix: Add a minimal `.github/dependabot.yml` for `npm`
    and `github-actions`, monthly cadence. Still waiting on the owner
    cadence decision flagged in 2026-06-03 — see the Questions
    section.

### Low / clean-up

- [x] **Env-var-name enumeration in `console.warn`** — FIXED this run
  (fourth recurrence: 2026-05-23, 2026-06-03, 2026-06-06, this review)
  - Evidence (before): four sites in
    [`supabase/functions/company-research/index.ts:91,92,99`](../../supabase/functions/company-research/index.ts)
    and
    [`supabase/functions/job-analysis/index.ts:82`](../../supabase/functions/job-analysis/index.ts)
    dumped `Object.keys(Deno.env.toObject()).filter(... 'API' | 'KEY' |
    'SUPABASE')` whenever `TAVILY_API_KEY` was missing.
  - Risk: Low — names only, no values. Still worth removing because
    the specific missing key is already named in the error message, so
    enumerating every API-shaped env var added zero diagnostic value
    while leaking the operator-side env-var topology.
  - Fix: Removed the enumeration in both functions. Kept a single
    warn line naming `TAVILY_API_KEY` and pointing operators at
    `.env.local` / function secrets. `logger?.log` now records
    `missingKey: 'TAVILY_API_KEY'` instead of two sorted arrays.
  - Verified `npm run typecheck`, `npm run build`, and `npm test`
    (265 tests) all stay green after the edit. No functional change
    for the caller — both code paths still return `null` after the
    warn.
  - The two edge functions will pick up the change on next deploy
    (`functions:deploy-single company-research` and
    `functions:deploy-single job-analysis`). No urgency — log content
    only.

- [x] **Storage and RLS posture audit** — clean (next-focus item from
  2026-06-06)
  - Scope audited:
    - **`resume-files` storage bucket** (created in
      [`20260329000003_resume_upload_storage.sql`](../../supabase/migrations/20260329000003_resume_upload_storage.sql),
      MIME types widened in
      [`20260329000004_resume_upload_docx_storage.sql`](../../supabase/migrations/20260329000004_resume_upload_docx_storage.sql)).
    - **`practice-audio` storage bucket** (created in
      [`20260515150000_security_hardening_and_resume_rpc.sql`](../../supabase/migrations/20260515150000_security_hardening_and_resume_rpc.sql)).
    - User-owned table RLS: `profiles`, `searches`,
      `practice_sessions`, `practice_answers`, `resumes`,
      `user_question_flags`, `candidate_profiles`, `profile_imports`,
      `answer_feedback`, `billing_customers`,
      `billing_subscriptions`.
    - Search-scoped read RLS: `search_artifacts`, `interview_stages`,
      `interview_questions`, `tavily_searches`.
  - Findings:
    - Both storage buckets are **private** (`public = false`) with all
      four CRUD policies keyed on `auth.uid()::text =
      (storage.foldername(name))[1]`. Cross-user reads, writes,
      updates, and deletes are blocked at the storage layer.
    - `resume-files` MIME allowlist is `application/pdf` +
      `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
      with a 10 MiB size cap. Matches the documented PDF + DOCX
      upload contract in CLAUDE.md.
    - `practice-audio` MIME allowlist covers the common recorder
      output types (`audio/webm`, `audio/mp4`, `audio/mpeg`,
      `audio/wav`, `audio/x-wav`, `audio/mp3`, `audio/ogg`) with a
      30 MiB size cap.
    - `practice-audio-transcribe` adds an explicit
      `path.split("/")[0] !== authResult.context.userId` check before
      downloading
      ([`supabase/functions/practice-audio-transcribe/index.ts:54–60`](../../supabase/functions/practice-audio-transcribe/index.ts)),
      so even if the storage RLS were misconfigured, the function
      would reject cross-user paths. Defence in depth here is solid.
    - Every user-owned table either gates on `auth.uid() = user_id`
      (`profiles`, `searches`, `practice_sessions`,
      `candidate_profiles`, `profile_imports`, `resumes`,
      `user_question_flags`, `billing_customers`,
      `billing_subscriptions`) or joins through ownership
      (`practice_answers` → `practice_sessions`,
      `interview_stages`/`interview_questions`/`tavily_searches` →
      `searches`).
    - `answer_feedback` is correctly restricted to own-row SELECT
      with all writes funnelled through `service_role` (so paid
      entitlement is enforced server-side, not at the row policy
      level).
    - Server-only tables (`scraped_urls`, `billing_events`,
      `research_previews`, `research_preview_rate_limits`) restrict
      to `service_role` ALL only.
  - Risk: None observed. No change recommended.

- [ ] **`supabase/functions/interview-question-generator/` is still
  uncalled by any in-repo caller** — fifth recurrence (2025-05-27,
  2026-05-23, 2026-05-30, 2026-06-03, 2026-06-06)
  - Evidence: `grep -rn interview-question-generator
    supabase/functions/ src/ scripts/` still returns no matches
    outside the function's own directory and the Deno test files.
    565 lines maintained for no observed caller.
  - Risk: Maintenance burden only — auth-gated since #107.
  - Recommended fix: Unchanged across the last four reviews — confirm
    with the product owner that no external integration calls it; if
    not, `supabase functions delete` + `git rm -r`. Now overdue for a
    Linear `Chore` issue (or an explicit "leave it" decision recorded
    in `docs/ARCHITECTURE.md`).

- [ ] **2 moderate `npm audit` advisories on `esbuild` / `vite`** —
  repeat from 2026-05-23 onwards
  - Evidence: `esbuild <=0.24.2` and `vite <=6.4.1`. `fixAvailable` is
    `vite@8.0.16` (major). Dev-only impact (dev-server only).
  - Recommended fix: Defer to the next planned Vite upgrade. Do not
    run `npm audit fix --force`.

- [x] **CI lint step `continue-on-error` blind spot** — closed in
  #124 (2026-06-06)
  - Evidence: [`.github/workflows/ci.yml:27–42`](../../.github/workflows/ci.yml)
    now runs `npm run lint` with `set +e`, captures exit code, and
    `exit 0` on codes 0 (clean) or 1 (rule violations) while still
    propagating any other exit code (parser / config errors). The
    underlying `lint` script also gained `--exit-on-fatal-error` so
    runtime breakage exits 2.
  - Status: Removing from the recurring list — the silent-fail
    blind spot identified in 2026-05-30 and 2026-06-03 is closed.

- [ ] **Lint baseline still has 7 errors** — informational
  - Evidence: 2 `@typescript-eslint/no-empty-object-type`
    (`command.tsx:24`, `textarea.tsx:5`), 1
    `@typescript-eslint/no-require-imports` (intentional,
    `tailwind.config.ts:110`), 4 `@typescript-eslint/no-explicit-any`
    (3 in legacy Deno tests, 1 in `Auth.tsx`). Baseline unchanged
    across the last four reviews.
  - Recommended fix: Unchanged — the two `no-empty-object-type` are
    shadcn-style boilerplate; the Deno `any`s can wait until that
    suite is rewritten.

## Small fixes made in this run

1. **`supabase/functions/company-research/index.ts`** — removed three
   `Object.keys(Deno.env.toObject()).filter(...)` enumerations (one in
   the structured `logger.log` payload, two in `console.warn` output).
   Replaced with a single warn line naming `TAVILY_API_KEY` and a
   structured `missingKey` field. Net `-7` lines.
2. **`supabase/functions/job-analysis/index.ts`** — removed one
   `Object.keys(Deno.env.toObject()).filter(...)` enumeration. Same
   pattern as above. Net `-4` lines.

Both functions still return `null` and surface the same caller-facing
error; only the operator-side log content changed. Two edge functions
will pick up the change on next deploy.

Verified after the edits: `npm run typecheck`, `npm run build`,
`npm test` (265 tests) all stay green.

No application code, no schema, no auth, and no product flow was
touched.

## Deferred items

- Adopting `buildCorsHeaders` in the remaining six user-facing edge
  functions (fourth recurrence — should be bundled with the next
  edge-function touch regardless of scope).
- Removing `interview-question-generator` dead code (fifth recurrence
  — overdue for a Chore issue or an explicit "leave it" decision in
  `docs/ARCHITECTURE.md`).
- Adding `.github/dependabot.yml` (fourth recurrence — still waiting
  on owner cadence decision; last review's react-router CVE remains a
  fresh example of the cost of waiting).
- Vite 8.x upgrade to clear residual moderate audit findings.

## Questions for product owner

- **Does anything external call
  `supabase/functions/interview-question-generator/`?** Fifth
  recurrence. If "no", delete the function. If "yes", document the
  external caller in `docs/ARCHITECTURE.md` so future reviews stop
  flagging it. Owner answer unblocks a small clean-up PR.
- **Dependabot cadence: weekly or monthly?** Or Renovate instead?
  Fourth recurrence. This blocks a 5-line config change that would
  have surfaced last review's react-router patch automatically.

## Next review focus

1. **`buildCorsHeaders` adoption.** Four consecutive reviews with no
   movement; if still open next cycle, escalate beyond "bundle with
   next touch" to a dedicated PR. Pair with documenting an
   `APP_ALLOWED_ORIGINS` value in the production secrets.
2. **Dependabot landing** — and if so, triage the first batch of
   bumps. If still not landed, raise the owner question above as a
   blocker.
3. **Supply-chain hygiene for the codex auto-PR workflow.** Not
   audited in detail this cycle. Specifically: are the third-party
   actions (`openai/codex-action@v1`, `actions/checkout@v5`,
   `actions/setup-node@v4`, `actions/upload-artifact@v4`) pinned to
   commit SHAs or just tags? What permission scope is required vs.
   granted? And does the LINEAR_API_KEY secret rotate?
