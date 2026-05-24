# Runbook

Use this for common operational checks.

## Research Does Not Start

Check:

- browser created a row in `searches`
- `interview-research` invocation returned success
- `searches.status`, `progress_step`, and `error_message`
- Supabase Edge Function logs
- required environment variables: Supabase URL/service key, OpenAI key, Tavily key

Likely issue: the browser marked work as started before the Edge Function accepted it.

## Research Stalls

Check:

```sql
select id, user_id, company, status, progress_step, error_message, updated_at
from searches
where status = 'processing'
  and updated_at < now() - interval '2 minutes'
order by updated_at asc;
```

Recovery:

```sql
update searches
set status = 'failed',
    error_message = 'timeout_manual_recovery',
    updated_at = now()
where id = '<search_id>';
```

## Tavily Issues

Tavily call logs live in `ops.tavily_searches`.

```sql
select
  date_trunc('day', created_at) as day,
  sum(credits_used) as credits,
  count(*) as calls
from ops.tavily_searches
where created_at > now() - interval '7 days'
group by 1
order by 1 desc;
```

Check function logs for Tavily 402/429 responses and the configured credit cap in `supabase/functions/_shared/config.ts`.

## Resume Upload Fails

Check:

- file type is PDF or DOCX
- file size is within limit
- text extraction completed
- `resume-files` storage bucket policy allows the authenticated user path
- `save_resume_version` RPC succeeds

If profile import fails, the resume version can still be valid.

## Practice Audio Fails

Check:

- browser microphone permission
- recorded blob is non-empty
- upload to `practice-audio`
- `practice-audio-transcribe` logs
- saved `practice_answers.audio_path` and `transcript_text`

Answer save should not depend on transcription text being present.

## Stripe Webhook Looks Wrong

Check:

```sql
select user_id, stripe_subscription_id, status, cadence, current_period_end, last_event_created, updated_at
from billing_subscriptions
where user_id = '<user_id>';
```

Then check:

```sql
select stripe_event_id, event_type, processed_at
from billing_events
where stripe_event_id = '<event_id>';
```

Notes:

- duplicate delivered events should return `duplicate`
- stale events should not overwrite newer subscription state
- skipped unresolved users usually mean the Stripe customer has no `metadata.user_id` and no `billing_customers` row
- `invoice.payment_failed` marks the subscription `past_due`; notification jobs are not implemented yet

## Entitlement Looks Wrong

Check the source row first:

```sql
select status, cadence, current_period_end, cancel_at_period_end
from billing_subscriptions
where user_id = '<user_id>';
```

Then compare against `src/shared/entitlement-rules.ts`. The frontend and Edge copies of entitlement rules must stay in lock-step.

## Checkout: Stuck on "Pending Checkout" (409)

When `create-checkout-session` returns `409 { error: "pending_checkout" }`, Stripe is rejecting the request because the same user already used the idempotency key `checkout:<user_id>` with different parameters within the last 24h. This happens when a user starts Checkout at one cadence, abandons it without completing or canceling, then retries at a different cadence.

What the user sees: the pricing CTA returns an error instead of redirecting to Stripe.

Resolution options (cheapest first):

1. **Tell the user to complete or cancel the original Stripe Checkout in the original tab.** Once the session is paid, canceled, or expires (Stripe default 24h), the next attempt at any cadence succeeds.
2. **Expire the open Checkout Session from the Stripe dashboard** (Payments → Checkout Sessions → find the open session for the customer → Expire). Subsequent attempts at any cadence will succeed immediately.
3. **Wait 24h.** Stripe's idempotency key window expires automatically.

Do **not** delete or modify the `billing_customers` row to work around this — the next Checkout would create a duplicate Stripe customer.

## Tests To Run Before Release

```bash
npm test
npm run build
```

For Supabase or Edge Function changes, do a targeted hosted check because the Deno suite is currently legacy.
