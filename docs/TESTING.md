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
