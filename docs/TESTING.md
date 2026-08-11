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

### Guest preview spend guard

The unauthenticated `research-preview` function fingerprints requests from the
edge-provided client IP and claims each uncached request through the atomic
`claim_research_preview_request` database function. The atomic upsert prevents
concurrent requests from sharing a stale counter value; database errors fail
closed before Tavily or OpenAI is called. Local tests cover the fixed RPC
contract and rejection/error behavior. A hosted non-production load check is
still required to verify the edge gateway's `x-forwarded-for` behavior and
confirm observed provider spend.

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

### New react-hooks 7 rules — untriaged

eslint-plugin-react-hooks 7 (via the 2026-07-04 lint-and-format dependency
bump) enables new rules that flag pre-existing code: `set-state-in-effect`
(20), `immutability` (9), `purity` (8), `refs` (2). These 39 errors are
untriaged — some may be real fixes, most are established patterns that
predate the rules. Triage them as a separate chore; do not fix them
drive-by inside unrelated diffs.

### Legacy Deno tests — out of scope here

`docs/TESTING.md` already notes the files under `tests/` are legacy and not a release gate. Their `any` usage (4 errors across `tests/integration/test_workflows/`, `tests/unit/test_edge_functions/`) will get rewritten when those suites are replaced, not patched in isolation.

- `tests/integration/test_workflows/test_07_complete_workflow.ts:79`
- `tests/unit/test_edge_functions/test_02_interview_research.ts:324`
- `tests/unit/test_edge_functions/test_03_company_research.ts:299`
- `tests/unit/test_edge_functions/test_05_cv_analysis.ts:317`
