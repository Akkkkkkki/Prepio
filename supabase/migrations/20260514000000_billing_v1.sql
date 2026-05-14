-- ============================================================================
-- BILLING V1
-- Stripe Billing tables: customers, subscriptions, events.
-- Entitlement is derived from billing_subscriptions; no separate table.
-- Contract: docs/BILLING.md
-- ============================================================================

-- ============================================================================
-- TABLE: billing_customers
-- One row per paying user. Created lazily by the Checkout edge function.
-- ============================================================================
CREATE TABLE billing_customers (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE: billing_subscriptions
-- One row per user's active/past subscription. Single source of truth for
-- entitlement. Written by the Stripe webhook only.
-- ============================================================================
CREATE TABLE billing_subscriptions (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL
                         CHECK (status IN ('active','trialing','past_due','canceled',
                                           'incomplete','incomplete_expired','unpaid')),
  cadence                TEXT NOT NULL
                         CHECK (cadence IN ('monthly','quarterly','annual')),
  current_period_end     TIMESTAMPTZ NOT NULL,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  updated_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_billing_subs_period_end ON billing_subscriptions(current_period_end);

-- ============================================================================
-- TABLE: billing_events
-- Idempotency log for Stripe webhook deliveries.
-- ============================================================================
CREATE TABLE billing_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- billing_customers: users read their own row; service role manages all.
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_own ON billing_customers FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY customers_service ON billing_customers FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- billing_subscriptions: users read their own row; service role writes.
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_own ON billing_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY subscriptions_service ON billing_subscriptions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- billing_events: service role only; no user access.
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_service ON billing_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);
