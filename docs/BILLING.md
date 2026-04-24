# Billing

Stripe billing contract for Prepio. Single source of truth for anyone touching pricing, entitlements, or the webhook.

## Scope

- **v1 scope:** one Product, three cadences (monthly / quarterly / annual), two tiers (`free` / `paid`).
- **Out of scope for v1:** credit packs, team plans, coupons/promotions, Stripe Tax, proration edge cases, usage metering, trials. These are separate initiatives.

## Stripe objects

| Object | Shape |
|--------|-------|
| Product | One Product: "Prepio Subscription". |
| Prices | Three recurring Prices on that Product: `price_monthly`, `price_quarterly`, `price_annual`. Quarterly ≈ 50% off rolling monthly; annual ≈ 70% off rolling monthly. Store the Price IDs in env vars, not in code. |
| Checkout | Stripe Checkout (hosted). Success URL returns to app with session ID; cancel URL returns to pricing page. |
| Customer Portal | Stripe Customer Portal (hosted). Enabled features: update payment method, update plan (swap cadence), cancel subscription. |

## Database

Three tables. Entitlement is **derived from `billing_subscriptions`** — there is no separate entitlements table.

```
billing_customers
  user_id            uuid pk, fk -> auth.users
  stripe_customer_id text unique not null
  created_at         timestamptz

billing_subscriptions
  user_id                 uuid pk, fk -> auth.users
  stripe_subscription_id  text unique not null
  status                  text   -- Stripe status: active, past_due, canceled, etc.
  cadence                 text   -- monthly | quarterly | annual
  current_period_end      timestamptz not null
  cancel_at_period_end    boolean not null default false
  updated_at              timestamptz

billing_events
  stripe_event_id text primary key    -- idempotency key
  event_type      text not null
  payload         jsonb not null
  processed_at    timestamptz not null
```

RLS: users can read their own rows on `billing_customers` and `billing_subscriptions` (read-only). All writes happen from the webhook via the service-role key. `billing_events` is service-role only.

## Entitlement resolver

Every paid gate calls one function:

```ts
// src/services/entitlements.ts (frontend read-through)
// supabase/functions/_shared/entitlement.ts (edge functions)

getEntitlement(userId): {
  tier: 'free' | 'paid',
  cadence: 'monthly' | 'quarterly' | 'annual' | null,
  currentPeriodEnd: string | null,
  status: 'active' | 'past_due' | 'canceled' | 'none',
}
```

Rules:

- `tier = 'paid'` iff `status in ('active', 'trialing', 'past_due')` **and** `current_period_end > now()`.
- `past_due` is paid for a grace window (default 7 days after `current_period_end`); after that, `tier = 'free'`.
- No subscription row ⇒ `tier = 'free'`.

**Do not inline these rules anywhere else.** If a component needs to check access, it calls `getEntitlement`.

## Webhook

Single edge function: `supabase/functions/stripe-webhook`. Verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`.

Events handled at v1:

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Upsert `billing_customers` + `billing_subscriptions`. |
| `customer.subscription.updated` | Update `status`, `cadence` (from Price ID), `current_period_end`, `cancel_at_period_end`. |
| `customer.subscription.deleted` | Set `status = 'canceled'`; row kept for history. |
| `invoice.payment_failed` | Set `status = 'past_due'`; enqueue `notification_jobs` row. |

Idempotency: on every event, insert `(stripe_event_id, event_type, payload, now())` into `billing_events`. If the insert fails on unique constraint, the event has already been processed — return 200 without re-applying. No other events are handled; unknown event types log and return 200.

## Frontend flows

### Upgrade

1. User hits a paid gate or clicks a pricing CTA.
2. Frontend calls an edge function `create-checkout-session` with `{ cadence }`.
3. Edge function creates a Stripe Checkout Session and returns its URL. (Creates a Stripe Customer lazily if one doesn't exist yet.)
4. Client redirects to the URL. On success, user returns to `/billing/return?session_id=…`.
5. Return page polls `getEntitlement` until the webhook has landed (usually <2s).

### Manage subscription

1. User clicks "Manage subscription" in Profile.
2. Frontend calls `create-portal-session`; edge function returns the Customer Portal URL.
3. User self-serves in the portal. Any change fires a webhook; the app picks it up on next refetch.

## Tax

Not enabled at v1. Prices are tax-inclusive (or "excluding tax" if we want to add Stripe Tax later). Revisit before the first non-UK/EU marketing push.

## Test plan

See `docs/TESTING.md` → "Billing and pricing". Key cases:

- Three cadences each resolve to the correct `price_*` env var.
- Duplicate webhook delivery is a no-op (unique constraint on `stripe_event_id`).
- Cancelled subscription retains paid access until `current_period_end`, then downgrades.
- `past_due` grace window behaves as specified.
- A stale client cannot call a paid edge function — entitlement is re-checked server-side.

## Environment variables

```
STRIPE_SECRET_KEY           # server-side, edge functions only
STRIPE_PUBLISHABLE_KEY      # client-side
STRIPE_WEBHOOK_SECRET       # verify webhook signatures
STRIPE_PRICE_MONTHLY
STRIPE_PRICE_QUARTERLY
STRIPE_PRICE_ANNUAL
```

Never ship the secret key to the client; never hard-code Price IDs.
