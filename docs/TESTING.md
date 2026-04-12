# Testing

How to run tests, what they really cover today, and where the gaps still are.

## Quick Start

```bash
npm test
npm test -- src/services/searchService.test.ts src/pages/__tests__/Home.mobile.test.tsx
make test
```

- `npm test` is the main automated suite in this repo right now.
- `make test` runs older Deno files. Treat it as legacy, not as a release gate.

## Current Reality

### Frontend

The Vitest suite is the only routinely runnable safety net here. It covers selected UI flows,
hooks, and service helpers. It does not provide full end-to-end coverage of the research pipeline.

Most relevant files for the research flow:

- `src/services/searchService.test.ts`
- `src/pages/__tests__/Home.mobile.test.tsx`
- `src/hooks/__tests__/useSearchProgress.test.ts`
- `src/components/__tests__/ProgressDialog.test.tsx`

### Backend

The `tests/` Deno files are not trustworthy as production coverage today.

Why:

- `make test` only runs `tests/unit/test_edge_functions/*.ts`.
- The integration workflow files are not part of that command.
- Multiple Deno tests still reference old schema fields like `search_status`.
- They depend on real Supabase credentials in `.env.local`.
- They do not exercise the real browser-to-Edge-Function startup handshake that broke research.

That means previous green runs could still miss a broken research trigger.

## What Was Missing

The failure mode from this incident lived between:

1. creating the `searches` row in the browser
2. starting `interview-research`
3. getting an acknowledgement back from the Edge Function

That boundary was previously untested. The browser marked the search as active before the function
had actually accepted the job, and the tests mostly mocked `startProcessing`, so they never caught
that gap.

## Coverage Reality

- There is no automated line or branch coverage report configured in this repo today.
- There is no trustworthy single percentage for coverage in the current setup.
- The frontend suite covers slices of behavior, not the complete product.
- The legacy Deno files should not be counted as reliable coverage until they are updated and wired
  into a real CI gate.

If you need an actual coverage number, add a coverage provider and generate a report as a separate
change. Right now any percentage would be guesswork.

## Priorities

### P0

| Focus | Key files |
|-------|-----------|
| Research startup handshake | `src/services/searchService.ts`, `src/pages/Home.tsx`, `supabase/functions/interview-research/index.ts` |
| Answer feedback generation and display | `src/pages/Practice.tsx`, `src/components/practice/*`, `supabase/functions/*feedback*`, `src/services/searchService.ts` |
| Billing entitlement enforcement | `src/pages/Home.tsx`, `src/pages/Practice.tsx`, pricing UI, Stripe webhook handlers, entitlement service layer |
| Progress and stall detection UI | `src/components/ProgressDialog.tsx`, `src/hooks/useSearchProgress.ts` |

### P1

| Focus | Key files |
|-------|-----------|
| Practice session pipeline | `src/pages/Practice.tsx`, `src/services/sessionSampler.ts`, `src/services/searchService.ts` |
| Landing page framing and guest conversion path | `src/pages/Home.tsx`, public header/navigation, marketing sections |
| Full dashboard and history regressions | `src/pages/Dashboard.tsx`, `src/pages/History.tsx` |
| Lifecycle notification triggers | event producers, worker/scheduler function, delivery adapter |

## What Must Be True For Upcoming Work

The next wave of product work changes revenue and trust surfaces. The test bar needs to rise with it.

### AI answer feedback

Cover at least these cases:

- feedback request includes the right question, search, and candidate context
- empty or partial answers do not crash the pipeline
- free users only receive teaser fields
- paid users receive full feedback details
- regenerated feedback does not orphan old records or duplicate summary UI

### Billing and pricing

Cover at least these cases:

- free user can finish the intended free path
- second paid-boundary action shows the right upgrade state
- webhook updates actually unlock features
- stale client state cannot bypass server-side entitlements
- expired Sprint access downgrades cleanly without corrupting history

### Landing page

This is not just visual QA. Verify the conversion path:

- primary CTA is visible and functional on mobile and desktop
- sample/demo states load without auth
- authenticated users still get into research quickly
- route guards do not create loops between public marketing and protected flows

### Notifications

Cover at least these cases:

- one product event creates one outbound job
- retries do not double-send
- unsubscribed or suppressed users are skipped cleanly
- delivery failures surface in logs and admin-visible state

## Tooling

- Frontend: Vitest with jsdom and Testing Library. Setup file: `vitest.setup.ts`.
- Backend: legacy Deno tests under `tests/`, currently requiring cleanup before they can be used as a release gate.
- Mocking: prefer focused Supabase client mocks for browser-side logic. Use hosted Supabase only for explicit end-to-end checks.

## Recommended Test Sequence For The Roadmap

When shipping the current priorities, test in this order:

1. Research flow still starts and completes
2. Practice answers still save
3. Feedback appears with the correct gated level
4. Billing state changes unlock and relock the right surfaces
5. Public landing page still routes cold and signed-in users correctly
