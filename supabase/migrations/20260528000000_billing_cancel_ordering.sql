-- ============================================================================
-- BILLING WEBHOOK CANCEL ORDERING (PREPIO-12 follow-up)
--
-- cancelSubscription previously used a scoped PostgREST UPDATE
-- (eq user_id + eq stripe_subscription_id + lt last_event_created). That
-- correctly refuses to clobber an unrelated active row, but it is a no-op
-- when the row does not exist yet — and the handler still records the event
-- as processed in billing_events. A later, older customer.subscription.created
-- replay (e.g. a webhook endpoint catching up after downtime) would then
-- INSERT an `active` row via apply_subscription_event for a subscription that
-- Stripe has already canceled, silently granting paid entitlement.
--
-- Fix: apply_subscription_cancel both materialises the canceled snapshot
-- when no row exists AND refuses to update an existing row whose
-- stripe_subscription_id differs (dual-subscription scenario) or whose
-- last_event_created is already at/after this event. The combined check has
-- to be atomic against concurrent webhook deliveries, which a JS read-then-
-- write cannot guarantee — hence the RPC.
--
-- Returns true when a row was inserted or updated; false when this delete
-- targets a different stripe_subscription_id than the row we already track
-- (a no-op for the dual-sub scenario) or when an existing newer event has
-- already won the ordering guard.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_subscription_cancel(
  p_user_id                UUID,
  p_stripe_subscription_id TEXT,
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
    p_user_id, p_stripe_subscription_id, 'canceled', p_cadence,
    p_current_period_end, p_cancel_at_period_end, p_event_created, now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    status                 = 'canceled',
    current_period_end     = EXCLUDED.current_period_end,
    cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
    last_event_created     = EXCLUDED.last_event_created,
    updated_at             = now()
  WHERE
    public.billing_subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id
    AND public.billing_subscriptions.last_event_created < EXCLUDED.last_event_created;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_cancel(
  UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_subscription_cancel(
  UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ
) TO service_role;
