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

## Research Evidence Yield

Quality counterpart to the Tavily cost query above. Use this to spot regressions where retrieval is paid for but synthesis produces little — e.g. throttled extraction or upstream prompt drift.

`interview-research` emits one `[research_yield]` JSON log per completed run with `questions_extracted`, `sources_returned`, `tavily_calls`, and `tavily_credits`. Grep Edge Function logs for live alerting — the body is JSON, so match the literal tag plus the JSON-encoded field:

```
[research_yield] "questions_extracted":0
```

Daily yield-per-credit (last 14 days):

```sql
select
  date_trunc('day', s.completed_at) as day,
  count(distinct s.id) as completed_runs,
  sum(coalesce(q.q_count, 0)) as questions_extracted,
  sum(coalesce(t.credits, 0)) as tavily_credits,
  round(sum(coalesce(q.q_count, 0))::numeric
        / nullif(sum(coalesce(t.credits, 0)), 0), 2) as questions_per_credit
from searches s
left join (
  select search_id, count(*) as q_count
  from interview_questions
  group by 1
) q on q.search_id = s.id
left join (
  select search_id, sum(credits_used) as credits
  from ops.tavily_searches
  group by 1
) t on t.search_id = s.id
where s.status = 'completed'
  and s.completed_at > now() - interval '14 days'
group by 1
order by 1 desc;
```

Zero-evidence runs (completed but nothing landed in `interview_questions`):

```sql
select s.id, s.company, s.role, s.completed_at,
       coalesce(t.credits, 0) as tavily_credits
from searches s
left join (
  select search_id, sum(credits_used) as credits
  from ops.tavily_searches
  group by 1
) t on t.search_id = s.id
where s.status = 'completed'
  and s.completed_at > now() - interval '7 days'
  and not exists (
    select 1 from interview_questions q where q.search_id = s.id
  )
order by s.completed_at desc;
```

Per-run drill-down for a specific search:

```sql
select
  (select count(*) from interview_questions where search_id = '<search_id>') as questions_extracted,
  (select coalesce(sum(results_count), 0) from ops.tavily_searches where search_id = '<search_id>') as sources_returned,
  (select coalesce(sum(credits_used), 0) from ops.tavily_searches where search_id = '<search_id>') as tavily_credits;
```

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

## Stripe Billing Go-Live

Use this checklist before accepting live payments. Run it separately for Stripe test mode and live mode, and do not paste secret values into the repo, issue tracker, or PR comments.

### Stripe Dashboard settings

- **Branding and business details:** configure the Prepio logo/icon, brand colors, public business name, statement descriptor, public business website, support email, support URL, support phone if available, and customer-facing address/tax details required for the launch country.
- **Receipts and emails:** enable successful payment receipts, failed payment emails where appropriate, and make sure support contact details render correctly on hosted Checkout, receipt emails, invoices, and Customer Portal.
- **Payment methods:** enable Stripe dynamic payment methods for Checkout and keep Link enabled. Check the hosted Checkout page on desktop browser, mobile browser, and installed PWA context before live launch.
- **Product and Prices:** create one `Prepio Subscription` Product and the three recurring Prices described in `docs/BILLING.md`: monthly, quarterly, and annual. Use the same lookup keys in test and live mode; Price IDs are mode-specific.

### Customer Portal settings

Configure the same Customer Portal features in test and live mode:

- Allow payment method updates.
- Allow subscription cancellation at period end.
- Allow plan changes only among the monthly, quarterly, and annual `Prepio Subscription` Prices.
- Set the dashboard fallback return URL to the same Profile surface the app uses for created sessions: `https://<app-origin>/profile?billing=portal_return`.

### Supabase secrets

Set these on the deployed Supabase project before smoke testing. The service-role key already exists for the project, but verify it is present because Checkout, Portal, and webhook handlers all depend on service-role database access.

```bash
supabase secrets set \
  STRIPE_SECRET_KEY="sk_test_or_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  STRIPE_PRICE_MONTHLY="price_..." \
  STRIPE_PRICE_QUARTERLY="price_..." \
  STRIPE_PRICE_ANNUAL="price_..." \
  APP_BASE_URL="https://<app-origin>" \
  --project-ref "<supabase-project-ref>"
```

Verification:

- `STRIPE_SECRET_KEY` mode must match the Stripe Dashboard mode being tested.
- `STRIPE_WEBHOOK_SECRET` must be copied from the matching Stripe webhook endpoint, not from a local Stripe CLI listener.
- `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, and `STRIPE_PRICE_ANNUAL` must be the Price IDs from the same Stripe mode as `STRIPE_SECRET_KEY`.
- `APP_BASE_URL` must be the deployed app origin used for Checkout success/cancel URLs and Portal return URLs.
- If a subscription webhook logs `unknown_price`, correct the relevant `STRIPE_PRICE_*` secret and resend the Stripe event from the Dashboard.

### Webhook endpoint

Register the deployed Edge Function as a Stripe webhook endpoint in both test and live mode:

```text
https://<supabase-project-ref>.functions.supabase.co/stripe-webhook
```

Select at least these events:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

After creating each endpoint, copy its signing secret into the matching environment's `STRIPE_WEBHOOK_SECRET`. Send Stripe's test event, then check Supabase Edge Function logs for signature verification and handler output.

### Test-mode smoke path

Run this end to end in Stripe test mode before configuring live mode. Use a fresh test user that does not already have rows in `billing_customers` or `billing_subscriptions`.

1. Sign in as the test user and start Checkout from `/pricing?checkout=monthly`.
2. Pay with Stripe test card `4242 4242 4242 4242`.
3. Confirm Checkout returns to `/billing/return?session_id=...` and the page reaches the paid state after the webhook lands.
4. Verify the database row:

```sql
select user_id, stripe_subscription_id, status, cadence, current_period_end, cancel_at_period_end, updated_at
from billing_subscriptions
where user_id = '<user_id>';
```

Expected: `status` is `active`, `cadence` is `monthly`, `cancel_at_period_end` is `false`, and `current_period_end` is in the future.

5. Open Profile and launch Customer Portal.
6. Change cadence to quarterly or annual in the Portal, return to Profile, and verify `billing_subscriptions.cadence` updates after the webhook lands.
7. Re-open Portal, cancel at period end, and verify `cancel_at_period_end` becomes `true`.
8. Confirm entitlement remains paid until `current_period_end`; paid access should not disappear immediately after a period-end cancellation.
9. Repeat the Checkout start and entitlement-return check for the other two cadences with separate fresh test users, or reset the test subscription/customer state between runs.

Do not run live-card payments until the test-mode smoke path passes and the live-mode Dashboard, Portal, webhook endpoint, and Supabase secrets have all been configured independently.

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

## Edge Function Auth Posture

All Edge Functions run with `verify_jwt = false` (see [`supabase/config.toml`](../supabase/config.toml)) and enforce their own caller checks via [`supabase/functions/_shared/auth.ts`](../supabase/functions/_shared/auth.ts).

Three classes of public entry point:

- **Service-only sub-functions.** `company-research`, `job-analysis`, `cv-analysis`, and `interview-question-generator` are invoked by `interview-research` using the service-role bearer. They call `authorizeRequest` and reject anything that isn't `kind: "service"` with a 403. Direct anon invocations are rejected before any OpenAI/Tavily call or service-role DB write.
- **User-scoped functions.** `interview-research`, `answer-feedback`, `practice-audio-transcribe`, `create-checkout-session`, `create-portal-session`, and `profile-import` require a user JWT.
- **Genuinely public function.** `research-preview` stays unauthenticated by product design (guest preview). It is rate-limited per fingerprint via `research_preview_rate_limits`. The fingerprint is the gateway-set `x-forwarded-for` first IP only — client-controlled headers like `x-preview-session` and `user-agent` are deliberately excluded from the key, because including any client-controllable signal lets a single attacker rotate the header and land in fresh rate-limit rows (PREPIO-61).
- **Signed function.** `stripe-webhook` verifies Stripe's signature instead of a JWT.

### Allowed origins (CORS)

`company-research`, `job-analysis`, `interview-question-generator`, and `research-preview` use the shared [`buildCorsHeaders`](../supabase/functions/_shared/cors.ts) helper. Set `APP_ALLOWED_ORIGINS` (comma-separated) as a function-level secret to lock CORS down to known origins; if the env var is unset, the helper falls back to `*` so local dev keeps working.

```bash
supabase secrets set APP_ALLOWED_ORIGINS="https://prepio.app,https://www.prepio.app"
```

## Tests To Run Before Release

```bash
npm test
npm run build
```

For Supabase or Edge Function changes, do a targeted hosted check because the Deno suite is currently legacy.
