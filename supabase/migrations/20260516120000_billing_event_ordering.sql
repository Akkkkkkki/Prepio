-- ============================================================================
-- BILLING WEBHOOK EVENT ORDERING (PREPIO-12 follow-up)
--
-- Stripe explicitly does not guarantee webhook delivery order. Without an
-- explicit guard, a late-arriving customer.subscription.updated carrying a
-- stale "active" snapshot can overwrite a previously-applied
-- customer.subscription.deleted, resurrecting a canceled row to active and
-- granting paid entitlement that Stripe no longer recognises.
--
-- Fix: stamp every applied mutation with the originating Stripe event's
-- `created` timestamp, and reject any mutation whose event is older than the
-- row's recorded last_event_created. The check has to be atomic against
-- concurrent deliveries, which a JS read-then-write cannot guarantee — hence
-- the RPC for the upsert path. Cancellation and past_due updates use the
-- same column via a .lt() filter in PostgREST.
-- ============================================================================

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS last_event_created TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0);

-- Atomic, ordering-aware upsert called by the stripe-webhook edge function.
-- Returns true if the row was inserted or updated, false if a newer event
-- already won.
CREATE OR REPLACE FUNCTION public.apply_subscription_event(
  p_user_id                UUID,
  p_stripe_subscription_id TEXT,
  p_status                 TEXT,
  p_cadence                TEXT,
  p_current_period_end     TIMESTAMPTZ,
  p_cancel_at_period_end   BOOLEAN,
  p_event_created          TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows INT;
BEGIN
  INSERT INTO public.billing_subscriptions (
    user_id, stripe_subscription_id, status, cadence,
    current_period_end, cancel_at_period_end, last_event_created, updated_at
  ) VALUES (
    p_user_id, p_stripe_subscription_id, p_status, p_cadence,
    p_current_period_end, p_cancel_at_period_end, p_event_created, now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    status                 = EXCLUDED.status,
    cadence                = EXCLUDED.cadence,
    current_period_end     = EXCLUDED.current_period_end,
    cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
    last_event_created     = EXCLUDED.last_event_created,
    updated_at             = now()
  WHERE public.billing_subscriptions.last_event_created < EXCLUDED.last_event_created;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_event(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_subscription_event(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ
) TO service_role;
