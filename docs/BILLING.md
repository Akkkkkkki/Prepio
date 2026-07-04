# Billing

Stripe billing contract for Prepio. Single source of truth for anyone touching pricing, entitlements, or the webhook.

## Scope

- **v1 scope:** one Product, three cadences (monthly / quarterly / annual), two tiers (`free` / `paid`).
- **Out of scope for v1:** credit packs, team plans, coupons/promotions, Stripe Tax, proration edge cases, usage metering, trials. These are separate initiatives.

## Stripe objects

| Object | Shape |
|--------|-------|
| Product | One Product: "Prepio Subscription". |
| Prices | Three recurring Prices on that Product: `prepio_subscription_monthly`, `prepio_subscription_quarterly`, `prepio_subscription_annual`. Quarterly is about 50% off the rolling monthly equivalent; annual is about 70% off the rolling monthly equivalent. Store the Price IDs in env vars, not in code. |
| Checkout | Stripe Checkout (hosted). Success URL returns to app with session ID; cancel URL returns to pricing page. |
| Customer Portal | Stripe Customer Portal (hosted). Enabled features: update payment method, update plan (swap cadence), cancel subscription. |

### Customer Portal dashboard configuration

Configure the same Customer Portal features in Stripe test mode and live mode:

- **Payment methods:** allow customers to update their default payment method.
- **Subscriptions:** allow customers to cancel subscriptions and switch between the three Prices on the `Prepio Subscription` Product.
- **Allowed plan changes:** include only `prepio_subscription_monthly`, `prepio_subscription_quarterly`, and `prepio_subscription_annual` so self-serve changes stay within the v1 cadence model.
- **Return URL:** the app-created portal session sends customers back to `/profile?billing=portal_return`; the Stripe dashboard default return URL should point at the same stable Profile surface for manual/test sessions.

### Stripe product and price catalog

Create the same Product and three recurring Prices in both Stripe test mode and live mode. Do not hard-code Product or Price IDs in this repository; the Edge Functions read environment-scoped Price IDs from Supabase secrets.

Product:

| Field | Value |
|-------|-------|
| Name | `Prepio Subscription` |
| Statement descriptor | `PREPIO` |
| Metadata | `app=prepio`, `billing_contract=billing_v1`, `tier=paid` |

Prices:

Let `M` be the approved monthly unit amount in the chosen minor currency, for example cents. Keep all three Prices in the same currency.

| Cadence | Stripe lookup key | Billing interval | Unit amount rule | Env var consumed by code | Price metadata |
|---------|-------------------|------------------|------------------|---------------------------|----------------|
| Monthly | `prepio_subscription_monthly` | 1 month | `M` | `STRIPE_PRICE_MONTHLY` | `app=prepio`, `billing_contract=billing_v1`, `tier=paid`, `cadence=monthly` |
| Quarterly | `prepio_subscription_quarterly` | 3 months | `round(M * 3 * 0.5)` | `STRIPE_PRICE_QUARTERLY` | `app=prepio`, `billing_contract=billing_v1`, `tier=paid`, `cadence=quarterly` |
| Annual | `prepio_subscription_annual` | 1 year | `round(M * 12 * 0.3)` | `STRIPE_PRICE_ANNUAL` | `app=prepio`, `billing_contract=billing_v1`, `tier=paid`, `cadence=annual` |

Use the same lookup keys in test and live mode. Stripe Price IDs are mode-specific, so each deployment environment must set its own `STRIPE_PRICE_*` values. The current repository does not contain the real Stripe IDs because this CI job cannot create or verify Stripe dashboard objects.

Capture the IDs in the deployment environment this way:

| Mode | `STRIPE_PRICE_MONTHLY` | `STRIPE_PRICE_QUARTERLY` | `STRIPE_PRICE_ANNUAL` |
|------|------------------------|--------------------------|-----------------------|
| Test | `price_...` from Stripe test mode | `price_...` from Stripe test mode | `price_...` from Stripe test mode |
| Live | `price_...` from Stripe live mode | `price_...` from Stripe live mode | `price_...` from Stripe live mode |

The Checkout function sends the selected Price ID as a `line_items[].price`; the webhook maps incoming subscription item Price IDs back to `monthly`, `quarterly`, or `annual` using those same env vars. A missing or mismatched Price ID causes the webhook to skip the subscription with `reason=unknown_price`, so update the env vars before resending affected Stripe events.

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
  last_event_created      timestamptz not null  -- Stripe event.created of the last applied mutation; ordering guard
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
// Frontend:   src/services/entitlements.ts            → getEntitlement(userId)
// Edge:       supabase/functions/_shared/entitlement.ts → getEntitlement(supabase, userId)
// Pure rules: src/shared/entitlement-rules.ts (mirror at supabase/functions/_shared/entitlement-rules.ts)

getEntitlement(...): {
  tier: 'free' | 'paid',
  cadence: 'monthly' | 'quarterly' | 'annual' | null,
  currentPeriodEnd: string | null,
  status: 'active' | 'past_due' | 'canceled' | 'none',
}
```

Rules (encoded in `resolveEntitlement` — the canonical implementation):

- `tier = 'paid'` iff `status in ('active', 'trialing', 'past_due')` **and** `current_period_end > now()`.
- `past_due` is paid for a grace window (`PAST_DUE_GRACE_DAYS = 7` after `current_period_end`); after that, `tier = 'free'`.
- No subscription row ⇒ `tier = 'free'`.
- Both readers **fail closed** to `FREE_ENTITLEMENT` on a query error — paid access is never granted on a DB blip.

**Do not inline these rules anywhere else.** If a component needs to check access, it calls `getEntitlement`. The frontend and edge `entitlement-rules.ts` files must stay in lock-step; tests in `src/shared/entitlement-rules.test.ts` exercise the full matrix.

## Webhook

Single edge function: `supabase/functions/stripe-webhook`. Verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`.

Events handled at v1:

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Upsert `billing_customers` + `billing_subscriptions`. |
| `customer.subscription.updated` | Update `status`, `cadence` (from Price ID), `current_period_end`, `cancel_at_period_end`. |
| `customer.subscription.deleted` | Set `status = 'canceled'`; row kept for history. |
| `invoice.payment_failed` | Set `status = 'past_due'`; log that payment-failure notification is deferred. |

Idempotency: each event is first pre-checked against `billing_events.stripe_event_id`. A hit returns 200 `duplicate` without touching subscription state. On a miss, dispatch runs the mutation; only a successful applied mutation then logs the event. If the mutation fails, no `billing_events` row is written — Stripe retries can still apply the change. Unknown / skipped / stale / ignored events do not write to `billing_events`, so a config fix followed by a manual resend from the Stripe dashboard can still apply them.

Ordering: Stripe does not guarantee webhook delivery order, so each mutation is also gated on the originating event's `created` timestamp via `billing_subscriptions.last_event_created`. The `created`/`updated` path goes through the `apply_subscription_event` RPC, whose `ON CONFLICT DO UPDATE WHERE last_event_created < EXCLUDED.last_event_created` is the only way to make the "ignore stale" check atomic against concurrent deliveries. `invoice.payment_failed` uses a `.lt("last_event_created", event_created)` filter on a scoped `UPDATE`. A late-arriving stale snapshot therefore cannot resurrect a canceled or past-due row.

Scope: `subscription.deleted` and `invoice.payment_failed` also filter by `stripe_subscription_id` so a late delete for an already-replaced subscription is a silent no-op rather than clobbering the user's current row. `subscription.deleted` uses its own RPC (`apply_subscription_cancel`) which is both ordering-aware AND subscription-id-aware: it INSERTs a canceled snapshot when no row exists yet (so an out-of-order `deleted` arriving before `created` materialises the canceled state and the later older `created` event is rejected by the `apply_subscription_event` ordering guard), and on conflict only UPDATEs when the existing row's `stripe_subscription_id` matches the event AND the event is newer than `last_event_created`. A delete for an unrelated subscription is a no-op (returned to the handler as `skipped: stale_event`) and is not logged to `billing_events`, leaving redelivery viable after a config fix.

Invoice subscription field: `invoice.payment_failed` reads `invoice.parent.subscription_details.subscription` first (Stripe API 2025-03-31.basil and newer), falling back to legacy `invoice.subscription`.

User resolution: subscription events carry a Stripe customer ID, not our `user_id`. The webhook looks up `billing_customers.stripe_customer_id` first, then falls back to fetching the Stripe Customer and reading `metadata.user_id`. **The Checkout edge function must therefore set `metadata.user_id` when creating a Stripe Customer** — without it the fallback fails and the subscription update is skipped (logged as `stripe_user_unresolved`).

## Frontend flows

The webhook, tables, entitlement readers, Checkout session creator, Customer Portal session creator, and pricing page are implemented. A dedicated Checkout return page remains tracked separately.

### Upgrade

1. User hits a paid gate or clicks a pricing CTA on `/pricing`.
2. Frontend calls an edge function `create-checkout-session` with `{ cadence }`.
3. Edge function creates a Stripe Checkout Session and returns its URL. (Creates a Stripe Customer lazily if one doesn't exist yet.) The session is created with `idempotencyKey = checkout:<user_id>` (user-scoped, not cadence-scoped) so a free-tier user cannot mint distinct Sessions for two cadences in parallel before the first webhook lands. If a different cadence is retried within Stripe's 24h key window, Stripe rejects the second call and the edge function surfaces `409 { error: "pending_checkout" }` — the UI should prompt the user to finish or abandon the in-flight Checkout. Cadence changes for already-paid users belong in the Customer Portal, not Checkout.
4. Client redirects to the URL. On success, user returns to `/billing/return?session_id=…`; on cancel, to `/?checkout=canceled`.
5. `/billing/return` polls `getEntitlement` until the webhook lands, then links into Practice. If entitlement is still free after the timeout window, it keeps a clear fallback back into the app; paid features still rely on server-side entitlement checks.

If the caller already has an active paid subscription, `create-checkout-session` refuses with `409 { error: "already_subscribed" }`. The frontend should route those users into the Customer Portal flow instead — cadence changes belong to the portal, not a fresh Checkout. Other error codes: `400 invalid_cadence | invalid_json`, `401 missing/invalid bearer | user_token_required`, `409 pending_checkout` (a Checkout Session for this user is already in flight), `500 internal_error | misconfigured`, `502 stripe_error`.

### Manage subscription

1. User clicks "Manage subscription" (from Profile, or from `/pricing` for existing subscribers).
2. Frontend calls the edge function `create-portal-session`; edge function returns the Customer Portal URL for the user's existing Stripe Customer.
3. User self-serves in the portal. Any change fires a webhook; the app picks it up on next refetch. Portal returns to `/profile?billing=portal_return`.

`create-portal-session` checks the same entitlement rules before creating a Portal session. If the caller has no active paid entitlement it returns `409 { error: "no_active_subscription" }`; if no Stripe customer row exists it returns `409 { error: "no_customer" }`. Other error codes mirror Checkout where applicable: `401 missing/invalid bearer | user_token_required`, `500 internal_error | misconfigured`, `502 stripe_error`.

## Tax

Decision as of 2026-07-04: defer Stripe Tax for v1. Do not enable `automatic_tax`
speculatively in Checkout or Customer Portal sessions while billing is still in
go-live mode and paid volume is unknown.

Revisit and enable Stripe Tax at the earliest of:

- monthly recurring revenue reaches about USD 1,000 or equivalent;
- the first paid customer appears outside the launch home jurisdiction;
- the first paid customer appears in a jurisdiction with immediate sales-tax,
  VAT, or GST obligations, including US state sales tax, EU/UK VAT, AU GST, or
  CA GST/HST/PST.

When the trigger fires, create a follow-up implementation issue to enable
`automatic_tax: { enabled: true }` on Checkout Sessions and Customer Portal
sessions, decide whether displayed pricing is tax-inclusive or tax-exclusive,
and configure Customer Tax ID collection in Stripe.

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
APP_BASE_URL                # checkout success/cancel redirect base, e.g. https://prepio.app
```

Never ship the secret key to the client; never hard-code Price IDs.
