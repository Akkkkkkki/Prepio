# Testing

## Quick Start

```bash
npm test
npm test -- src/services/entitlements.test.ts src/shared/entitlement-rules.test.ts
npm test -- supabase/functions/stripe-webhook/handlers.test.ts
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

Before shipping feedback, cover:

- free users never trigger paid feedback generation
- paid users receive full feedback
- feedback includes the right question, answer, search, role, company, and candidate context
- empty or partial answers fail gracefully
- regenerated feedback does not duplicate history/session UI

### Billing product surface

The billing foundation has tests. The unshipped purchase/manage surface still needs coverage:

- Checkout session creation maps cadence to the right Stripe Price
- Customer Portal session creation uses the existing Stripe customer
- return page polls entitlement until the webhook lands
- stale client state cannot unlock paid AI work
- expired subscriptions downgrade cleanly

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

## Lint Baseline

`npm run lint` is informational, not a release gate. As of 2026-05-18 it reports **38 problems (20 errors, 18 warnings)**. This section triages what's there so reviewers can tell at a glance whether a new lint hit is signal or noise.

When changing code in a file listed here, do not silently "clean up" the pre-existing failures unless that is the explicit goal of the change — keep diffs scoped.

### Intentional — shadcn/ui and Tailwind scaffolding

These come from boilerplate that the shadcn CLI and Tailwind plugin docs generate verbatim. Rewriting them buys nothing and drifts us away from upstream patterns.

- `@typescript-eslint/no-empty-object-type` (2 errors)
  - `src/components/ui/command.tsx:24` — `interface CommandDialogProps extends DialogProps {}`
  - `src/components/ui/textarea.tsx:5` — `interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}`
- `react-refresh/only-export-components` (10 warnings) — components that also export a `cva` variants helper or a context. Standard shadcn pattern; only affects HMR fast-refresh, not runtime.
  - `src/components/AuthProvider.tsx`, `src/components/practice/BreathingBreak.tsx`
  - `src/components/ui/{badge,button,form,navigation-menu,sidebar,sonner,toggle}.tsx`
- `@typescript-eslint/no-require-imports` (1 error)
  - `tailwind.config.ts:110` — `require("tailwindcss-animate")`. The plugin's documented install.

### Stale — worth fixing, tracked as follow-ups

- `@typescript-eslint/no-explicit-any` in `src/hooks/useSearchProgress.ts` (12 errors) — the realtime payload mapper casts every column through `any`. The `searches` row type is available from the generated Supabase types; replacing these casts removes a class of bugs around progress polling.
- `react-hooks/exhaustive-deps` in `src/pages/Practice.tsx` (7 warnings) and `src/pages/Dashboard.tsx` (1 warning) — missing-dep warnings on a 2,900-line file flagged as high-complexity in `CLAUDE.md`. Some are likely real (stale closure risk on `handleSaveAnswer`, `previousQuestion`, `skipQuestion`); they should be addressed when that file is split, not piecemeal.
- `react-hooks/exhaustive-deps` unused disable in `src/pages/Auth.tsx:60` — one-line cleanup, but `area:auth` is gated, so only fold it into an authorized auth-touching PR.

### Legacy Deno tests — out of scope here

`docs/TESTING.md` already notes the files under `tests/` are legacy and not a release gate. Their `any` usage (5 errors across `tests/integration/test_workflows/`, `tests/unit/test_edge_functions/`) will get rewritten when those suites are replaced, not patched in isolation.

- `tests/integration/test_workflows/test_07_complete_workflow.ts:79`
- `tests/unit/test_edge_functions/test_02_interview_research.ts:324`
- `tests/unit/test_edge_functions/test_03_company_research.ts:299`
- `tests/unit/test_edge_functions/test_05_cv_analysis.ts:317`
- `src/hooks/__tests__/useSearchProgress.test.ts:55` — will fall out of the `useSearchProgress.ts` typing follow-up above.
