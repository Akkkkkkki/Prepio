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

A `[research_yield]` line also emits a `⚠️ ZERO real sources returned` warning when a run
synthesised without any retrieved evidence. Grep for it directly:

```
[research_yield] ⚠️ ZERO real sources
```

## Synthesis Validation

`interview-research` validates every synthesized PrepPlan against the schema before
persisting (PREPIO-79): question minimums (core ≥15, follow-ups ≥15, depth ≥10), stage-link
resolution (a question's `stageName` must match a generated roadmap stage), and per-question
difficulty enums. On failure it runs one bounded repair pass; if the plan still fails, it is
persisted with `prep_plans.summary -> synthesisQuality.degraded = true` rather than silently
completing.

Each run emits one `[synthesis_validation]` JSON log with `degraded`, `repair_attempted`,
`question_counts`, and the first errors. Grep Edge Function logs for degraded runs:

```
[synthesis_validation] "degraded":true
```

Recent degraded runs (last 7 days):

```sql
select s.id, s.company, s.role, s.completed_at,
       p.summary -> 'synthesisQuality' ->> 'degraded' as degraded,
       p.summary -> 'synthesisQuality' -> 'questionCounts' ->> 'total' as question_total
from searches s
join prep_plans p on p.search_id = s.id
where (p.summary -> 'synthesisQuality' ->> 'degraded')::boolean is true
  and s.completed_at > now() - interval '7 days'
order by s.completed_at desc;
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

## Stripe Tax Tripwire

Stripe Tax is intentionally deferred for billing v1. Revisit the decision in
[`docs/BILLING.md`](./BILLING.md) before enabling live tax collection.

Tripwires:

- monthly recurring revenue reaches about USD 1,000 or equivalent;
- the first paid customer appears outside the launch home jurisdiction;
- the first paid customer appears in a jurisdiction with immediate sales-tax,
  VAT, or GST obligations, including US state sales tax, EU/UK VAT, AU GST, or
  CA GST/HST/PST.

Operational check:

- Review Stripe Customer, Subscription, and Checkout location data in the Stripe
  Dashboard during the billing go-live smoke-test pass and the first live-payment
  review.
- If any tripwire is hit, open a follow-up implementation issue to enable Stripe
  Tax on Checkout and Customer Portal sessions before accepting more payments in
  that jurisdiction.

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
