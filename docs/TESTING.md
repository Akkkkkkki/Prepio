# Testing

## Quick Start

```bash
npm test
npx vitest run src/services/entitlements.test.ts src/shared/entitlement-rules.test.ts
npx vitest run supabase/functions/create-checkout-session/handler.test.ts supabase/functions/create-portal-session/handler.test.ts src/pages/__tests__/BillingReturn.test.tsx
npx vitest run supabase/functions/stripe-webhook/handlers.test.ts
make test
```

## Current Reality

`npm test` is the main useful suite today. It runs Vitest plus the legacy-schema check.

The Deno files under `tests/` are legacy. `make test` can still be useful as a smoke check, but it is not a release gate until those tests are updated and no longer depend on stale schema assumptions or live credentials.

There is no configured coverage report. Do not quote a coverage percentage.

### Practice suite CI flake policy

`src/pages/__tests__/Practice.mobile.test.tsx` renders the full Practice page and
waits on question content that only appears after several async settles (search
load → session create → question render). The whole file is prone to CI flakes of
one shape — `Unable to find an element with the text …` — that has **two
distinct causes needing two levers**:

1. **Slow settle on a loaded runner.** The start-up chain takes longer than the
   default findBy*/waitFor ceiling, so a single attempt's `findByText` gives up
   before the tree settles. `vitest.setup.ts` already raises the global ceiling
   to 5000ms, but on a ~2× slow runner even that is hit (observed on PREPIO-177:
   the aria-live test failed all three retry attempts at exactly 5000ms). More
   attempts don't help here — on a persistently slow runner every retry hits the
   same ceiling — so the file raises its own ceiling to **10000ms** in a
   top-level `beforeAll` (still under the 20000ms `testTimeout` in
   `vite.config.ts`).
2. **Worker termination.** The vitest worker is occasionally killed mid-run
   (`Worker task was terminated` / `relay down`); no timeout helps that, only a
   re-run on a fresh worker. That is a **retry set once at the `describe` level**
   (`CI_FLAKE_RETRY`), which **applies to tests added later** so a test author
   doesn't rediscover the convention. It replaced four separate per-test
   `{ retry: 2 }` guards added one incident at a time (PREPIO-117, PREPIO-142,
   PREPIO-146, PREPIO-177).

The assertions are correct — the file passes 30/30 locally on repeat — so these
are environmental flakes, not bugs in a specific test. If a new describe block is
added to that file, give it `CI_FLAKE_RETRY` too. Retry only masks *flaky*
failures — a deterministic failure still fails on every attempt — so it does not
hide real regressions.

## Most Important Covered Areas

- Search service helpers and resume versioning behavior.
- Candidate profile import/merge helpers, including auto-apply behavior.
- Mobile Home, Practice, Dashboard, History, Auth, and Profile slices.
- Search progress polling/realtime fallback.
- Progress dialog behavior.
- Resume upload parsing helpers.
- Question sampling behavior.
- Frontend entitlement reader and shared entitlement rules.
- Stripe webhook handlers: idempotency, event ordering, stale events, cadence resolution, payment failure.

## Highest-Risk Gaps

### Research startup

The critical boundary is:

1. Browser creates a `searches` row.
2. Browser invokes `interview-research`.
3. Edge Function accepts work and updates progress.

This still needs a real integration or browser-level test. Mocking the service layer is not enough.

### Paid answer feedback

Local handler coverage now exists in `supabase/functions/answer-feedback/handler.test.ts` for the server-side paid gate and persistence contract:

- free users never trigger paid feedback generation
- paid users receive full feedback
- feedback includes the right question, answer, search, role, company, and candidate context
- empty or partial answers fail gracefully
- regenerated feedback does not duplicate history/session UI
- regenerated feedback is committed through the atomic `create_answer_feedback_atomic` RPC so concurrent stale writers fail without leaving partial supersession chains

When a local or hosted non-production Postgres connection is available, run:

```bash
DATABASE_URL=postgres://... npm run test:answer-feedback-rpc-db
```

The DB-backed check applies the RPC against fixture practice data inside a rolled-back transaction and verifies first generation, regeneration, stale-head rejection, and RPC execute privileges. Without `DATABASE_URL`, the script skips so `npm test` remains local-only.

Before shipping the hosted feature, run a Supabase Edge Function smoke check against a non-production project with a paid test user and a free test user. The local suite mocks Supabase and the model call; it cannot prove deployed environment variables, JWT auth wiring, or PostgREST behavior.

### Billing product surface

The billing foundation and local purchase/manage surface now have focused tests:

- Checkout session creation maps cadence to the configured Stripe Price IDs and ignores client-supplied Price IDs or amounts.
- Checkout refuses already-paid users, reuses or creates the Stripe Customer, writes `billing_customers`, and sets Stripe Customer `metadata.user_id`.
- Customer Portal session creation uses the existing Stripe customer, requires a stored customer row, and returns to Profile.
- `/billing/return` polls entitlement until the webhook lands and falls back clearly when the webhook is delayed.
- Paid answer feedback re-checks entitlement server-side and returns `403` before any model call for free users.

Still cover with a hosted, non-production smoke check before release:

- deployed Checkout and Portal auth wiring
- expired subscription downgrade behavior against deployed PostgREST/RLS

### Practice audio

Practice audio is persisted and transcribed. Cover:

- recording upload to `practice-audio`
- transcription success and failure
- saved `audio_path` and `transcript_text`
- answer save still succeeds when transcription returns no text

## Release Gate Recommendation

For normal app work:

```bash
npm test
npm run build
```

For Supabase or Edge Function changes, add a targeted hosted check because the legacy Deno suite is not a full release gate.

## Manual Stripe Test-Card Flow

Run these only against Stripe test mode and a non-production Supabase project. Do not use live cards or live Stripe objects.

1. Successful subscription: sign in as a free test user, start Checkout for each cadence in separate runs, pay with Stripe test card `4242 4242 4242 4242`, confirm `/billing/return` reaches the paid state, and verify `billing_customers` plus `billing_subscriptions` rows use the expected cadence.
2. 3DS-required card: repeat Checkout with `4000 0025 0000 3155`, complete the authentication challenge, and verify the return page waits until the webhook-created entitlement becomes paid.
3. Declined card: repeat Checkout with `4000 0000 0000 0002`, confirm Checkout blocks payment, and verify no paid entitlement is created.
4. Portal cancellation: open Customer Portal from a paid test user, cancel at period end, verify the webhook sets `cancel_at_period_end`, and verify entitlement remains paid until `current_period_end`.
5. Cadence change: open Customer Portal from a paid test user, switch cadence, and verify the next webhook updates `billing_subscriptions.cadence` without creating a second local subscription row.

## Typecheck Baseline

`npm run typecheck` runs `scripts/check-typecheck-baseline.sh`, an error-count ratchet over the real project configs. It is a CI gate: the job fails when a change pushes the error count above the recorded baseline.

Before 2026-07-10 the script was `tsc --noEmit` against the root `tsconfig.json`, which has `"files": []` and only project references — it type-checked zero files and always passed. The ratchet replaces that no-op (PREPIO-119).

Baselines as of 2026-07-10 (TypeScript 5.9.3):

- `tsconfig.app.json` — **381** pre-existing errors. New code must not add to this backlog.
- `tsconfig.node.json` — **0** errors. Kept clean.

To see the actual errors, run `npx tsc -p tsconfig.app.json --noEmit`. If your change fixes some of the backlog, lower `APP_BASELINE` in `scripts/check-typecheck-baseline.sh` in the same PR to lock in the improvement. Never raise a baseline without a written justification in the PR — the count-only ratchet cannot tell you *which* errors are new, so compare `npx tsc` output against `main` when the gate trips.

Burning down the 381-error backlog is follow-up work, tracked separately from this gate.

### Backlog triage (2026-08-12, PREPIO-133)

The 381 errors were bucketed by code and the shipped-`src` subset read line by
line. PREPIO-133's working hypothesis — 30–60 genuine null/undefined bugs
clustered in the pipeline — did **not** hold: there are zero `TS2532` /
`TS18048` / `TS2531` (possibly null/undefined) errors. The distribution:

| Code | Count | Verdict |
|------|-------|---------|
| `TS2339` property-does-not-exist | 338 | **Noise.** ~317 are in `__tests__` files (mock/fixture shape drift Vitest never enforces at runtime). The 21 in shipped `src` are runtime-correct **except one** (`question_type`, broken out below): discriminated unions TS fails to narrow (`result.errorCode` reached only after a `success` guard; `Auth` `confirmPassword` on the signup branch), local annotations narrower than the actual `select("*")` row shape (`Practice.tsx` question fields, populated by `searchService`), and columns absent from stale generated types. |
| `TS2352` unsound cast | 22 | **Noise.** Deliberate `as` casts of Supabase `Json` columns in `searchService.ts` / `entitlements.ts`. Unsound but runtime-safe by construction. |
| `TS2345` / `TS2769` / `TS2305` / `TS2304` | 8 | **Noise, mixed owners.** 4 are stale generated types PREPIO-124 clears (`save_resume_version` RPC ×2; `subscriptions`/entitlements, billing WIP). 3 are **local** type errors PREPIO-124 will *not* touch — a `type CardProps` import (`card.tsx` doesn't export it; runtime-erased), a `PDFPageProxy`→`PdfPage` mismatch (`resumeUpload.ts`), and a `PrepPlanRow` setState cast (`Dashboard.tsx`) — all runtime-correct, opportunistic tsc hygiene. 1 is a vitest global (`afterEach`, `globals: true`), test-only. |
| `TS2739` / `TS2741` / `TS2740` / `TS2322` | 13 | **Noise.** Test fixtures and fallback profile construction missing optional fields that `normalizeCandidateProfile` backfills. |

**One confirmed defect, not noise** (found within the `TS2339` bucket): `searchService.ts:577` maps `type: q.question_type`, but `interview_questions` has no `question_type` column (it's `category`) — so every question gets `type: undefined`. Type regeneration cannot fix a column that does not exist. Currently latent: `Practice.tsx:757` forwards it into `question.type`, but no shipped behavior consumes that field (the UI renders `category`), so there is no user-visible symptom — it is still a real error. Tracked in **PREPIO-138**.

Exactly one confirmed defect survived reading — the `question_type` phantom
column above (PREPIO-138), and it is currently dead code with no user-visible
symptom. The `mammoth.default` access in `resumeUpload.ts` was the other
plausible functional risk (DOCX upload); it is exercised by a passing test and
works via Vite's CJS interop. So the backlog is overwhelmingly a type-hygiene
and stale-type-generation problem, not a pre-computed bug list, and a burn-down
ranks below PREPIO-124 (deploy migrations → regenerate types), which clears the
stale RPC/table errors. The residue — local narrowing/annotation gaps and
test-file mock drift — is opportunistic hygiene, best cleaned when those files
are next edited. Baseline unchanged — nothing was fixed in this triage.

## Lint Baseline

`npm run lint` is informational, not a release gate. As of 2026-07-07 (after the eslint 10 / eslint-plugin-react-hooks 7 upgrade) it reports **54 problems (46 errors, 8 warnings)** from a clean `npm ci`. This section triages what's there so reviewers can tell at a glance whether a new lint hit is signal or noise.

When changing code in a file listed here, do not silently "clean up" the pre-existing failures unless that is the explicit goal of the change — keep diffs scoped.

### Intentional — shadcn/ui and Tailwind scaffolding

These come from boilerplate that the shadcn CLI and Tailwind plugin docs generate verbatim. Rewriting them buys nothing and drifts us away from upstream patterns.

- `@typescript-eslint/no-empty-object-type` (2 errors)
  - `src/components/ui/command.tsx:24` — `interface CommandDialogProps extends DialogProps {}`
  - `src/components/ui/textarea.tsx:5` — `interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}`
- `react-refresh/only-export-components` (8 warnings) — components that also export a `cva` variants helper or a context. Standard shadcn pattern; only affects HMR fast-refresh, not runtime.
  - `src/components/AuthProvider.tsx`
  - `src/components/ui/{badge,button,form,navigation-menu,sidebar,sonner,toggle}.tsx`
- `@typescript-eslint/no-require-imports` (1 error)
  - `tailwind.config.ts:110` — `require("tailwindcss-animate")`. The plugin's documented install.

### react-hooks 7 rules — triaged (2026-08-12, PREPIO-133)

eslint-plugin-react-hooks 7 (via the 2026-07-04 lint-and-format dependency
bump) surfaced 39 errors: `set-state-in-effect` (20), `immutability` (9),
`purity` (8), `refs` (2). Triaged. Note the framing: React 19 is **already
live** (`react@^19.2.7`, mounted via `createRoot` in `src/main.tsx`; PREPIO-93
shipped in #205), so concurrent rendering is in play now — the concurrent-render
rules below are current correctness smells, not "forward-looking under a future
upgrade." Still don't fix them drive-by inside unrelated diffs.

- `set-state-in-effect` (20) — **safe.** Each is either a one-shot mount sync
  (`useIsMobile`, `useMobileFooterHeight`) or a `setState` inside an async
  `.then()` / guarded early-return in a data-load effect (`Practice.tsx`,
  `Dashboard.tsx`, `Home.tsx`). Stable deps, no render loops.
- `refs` (2) — **current hazard, tracked in PREPIO-137.** `Practice.tsx:1568`
  and `:1570` write `handleSaveAnswerRef.current` / `skipQuestionRef.current`
  **during render** (not in an effect or handler). Under live concurrent
  rendering an interrupted render can leave the ref pointing at a callback that
  closed over uncommitted state, which the committed keydown listener then
  invokes. Real, if narrow. Fix = move the writes to commit phase.
- `purity` (8) — **current, low severity.** `Date.now()` read during render in
  the `useSearchProgress` time-estimate/stall helpers, plus impure `useState`
  initializers reading `window` / `sessionStorage`. Deterministic enough that no
  defect is observed today, but a genuine concurrent-render smell.
- `immutability` (9) — **low severity.** Ref/object mutations the rule dislikes,
  in event handlers (`Practice.tsx` media-stream refs, `Auth.tsx`), not render
  output.

One `Bug` issue filed for the confirmed hazard (PREPIO-137, the `refs`
render-writes). The `purity`/`immutability` items are lower-severity cleanup
best folded into that follow-up, not a standalone burn-down.

### Legacy Deno tests — out of scope here

`docs/TESTING.md` already notes the files under `tests/` are legacy and not a release gate. Their `any` usage (4 errors across `tests/integration/test_workflows/`, `tests/unit/test_edge_functions/`) will get rewritten when those suites are replaced, not patched in isolation.

- `tests/integration/test_workflows/test_07_complete_workflow.ts:79`
- `tests/unit/test_edge_functions/test_02_interview_research.ts:324`
- `tests/unit/test_edge_functions/test_03_company_research.ts:299`
- `tests/unit/test_edge_functions/test_05_cv_analysis.ts:317`
