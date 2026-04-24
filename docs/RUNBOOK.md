# Runbook

Where to look when something breaks in production. Short on purpose — add a section only when you hit a real incident and wish this page had it.

## Observability stack (v1)

| Layer | Tool | Why |
|-------|------|-----|
| Error tracking | Sentry (free tier) | Catches silent client + edge-function errors that users never report. Drop-in SDK; ~10 min setup; removable in minutes if we switch. |
| Structured logs | Supabase function logs | Already in place at zero cost. Edge functions emit single-line JSON via `_shared/log.ts` so `{ event: "tavily_credits_low" }` is grep-friendly in the dashboard. |
| Product analytics | — | Deferred until the free→paid funnel exists. |

Rationale for this stack is in [ARCHITECTURE.md#observability](./ARCHITECTURE.md#observability). Everything here is low-lock-in so we can swap vendors once we know what we actually need.

## Sentry — minimum viable setup

Frontend (`src/main.tsx`):

```ts
import * as Sentry from '@sentry/react';
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0 });
}
```

Edge functions (`_shared/sentry.ts`):

```ts
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
if (Deno.env.get('SENTRY_DSN')) {
  Sentry.init({ dsn: Deno.env.get('SENTRY_DSN')! });
}
export { Sentry };
```

Wrap the top-level handler with `try/catch` and call `Sentry.captureException(err)`. No custom integrations, no performance traces, no session replay. If we outgrow this, revisit.

## Common incidents

### 1. Research stuck in `processing`

Symptom: user's search never completes; `searches.status = 'processing'` for >2 min.

Diagnose:

```sql
select id, user_id, company, status, updated_at
from searches
where status = 'processing' and updated_at < now() - interval '2 minutes'
order by updated_at asc;
```

Check the corresponding function logs: Supabase Dashboard → Edge Functions → `interview-research` → Logs. Look for the last `event` field before the gap.

Recover:

```sql
update searches set status = 'failed', error = 'timeout_manual_recovery'
where id = '<search_id>';
```

User can then retry from the UI. If retries keep failing, check Tavily (next section) and the OpenAI provider status page.

### 2. Tavily credit exhaustion

Symptom: research fails at the `company-research` stage with Tavily 402/429.

Check:

```sql
select
  date_trunc('day', started_at) as day,
  sum(credits_used) as credits,
  count(*) as calls
from tavily_searches
where started_at > now() - interval '7 days'
group by 1 order by 1 desc;
```

If credits are near the monthly cap, top up at tavily.com. The daily credit cap is configurable in `_shared/config.ts`.

### 3. Edge function deploy went bad

Rollback to a known-good commit:

```bash
git checkout <good_commit> -- supabase/functions/<name>
npm run functions:deploy-single <name>
git checkout HEAD -- supabase/functions/<name>   # restore working tree
```

Verify in Supabase Dashboard → Edge Functions → Deploys.

### 4. User reports missing feedback

Check the paid gate first:

```sql
select user_id, status, cadence, current_period_end
from billing_subscriptions where user_id = '<user_id>';
```

If the user is free-tier, this is expected — no `answer_feedback` row is ever written for free users. If paid, check:

```sql
select id, model, created_at, superseded_by
from answer_feedback
where practice_answer_id = '<answer_id>'
order by created_at desc;
```

No row ⇒ the edge function never ran or errored. Check `answer-feedback` function logs for that `practice_answer_id`.

### 5. Stripe webhook missed or duplicated

Duplicates are safe — unique constraint on `billing_events.stripe_event_id` makes retries no-ops. If a real event was missed (subscription shows paid in Stripe Dashboard but `billing_subscriptions` is stale):

1. In Stripe Dashboard → Developers → Webhooks, find the event and use "Resend".
2. Confirm the event lands by checking `billing_events` for its ID.
3. Confirm `billing_subscriptions` now reflects Stripe.

### 6. Resume upload failing

Common causes: file too large, wrong MIME, storage bucket RLS change. Check:

- Browser console for the Supabase Storage error code.
- Supabase Storage → `resume-files` bucket → recent uploads.
- Storage RLS policies still require `user_id` prefix on the object path.

## What to add here

When a new failure mode shows up, document: the symptom, one diagnostic query or log filter, and the recovery step. Keep each section short. If a section grows past ~15 lines, split it into a dedicated doc and link from here.
