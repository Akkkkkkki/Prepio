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

## Edge Function Auth Posture

All Edge Functions run with `verify_jwt = false` (see [`supabase/config.toml`](../supabase/config.toml)) and enforce their own caller checks via [`supabase/functions/_shared/auth.ts`](../supabase/functions/_shared/auth.ts).

Three classes of public entry point:

- **Service-only sub-functions.** `company-research`, `job-analysis`, and `cv-analysis` are invoked by `interview-research` using the service-role bearer. They call `authorizeRequest` and reject anything that isn't `kind: "service"` with a 403. Direct anon invocations are rejected before any OpenAI/Tavily call or service-role DB write.
- **User-scoped functions.** `interview-research`, `answer-feedback`, `practice-audio-transcribe`, `create-checkout-session`, `create-portal-session`, and `profile-import` require a user JWT.
- **Genuinely public function.** `research-preview` stays unauthenticated by product design (guest preview). It is rate-limited per fingerprint via `research_preview_rate_limits`. The fingerprint is the gateway-set `x-forwarded-for` first IP only — client-controlled headers like `x-preview-session` and `user-agent` are deliberately excluded from the key, because including any client-controllable signal lets a single attacker rotate the header and land in fresh rate-limit rows (PREPIO-61).
- **Signed function.** `stripe-webhook` verifies Stripe's signature instead of a JWT.

### Allowed origins (CORS)

`company-research`, `job-analysis`, and `research-preview` use the shared [`buildCorsHeaders`](../supabase/functions/_shared/cors.ts) helper. Set `APP_ALLOWED_ORIGINS` (comma-separated) as a function-level secret to lock CORS down to known origins; if the env var is unset, the helper falls back to `*` so local dev keeps working.

```bash
supabase secrets set APP_ALLOWED_ORIGINS="https://prepio.app,https://www.prepio.app"
```

## Tests To Run Before Release

```bash
npm test
npm run build
```

For Supabase or Edge Function changes, do a targeted hosted check because the Deno suite is currently legacy.
