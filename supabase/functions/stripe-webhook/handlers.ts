// Pure event handlers for the Stripe webhook. No Stripe SDK imports, no Deno
// globals — the Deno entrypoint in index.ts wires up real dependencies. This
// shape lets Vitest exercise the dispatch, idempotency, and ordering paths
// directly.
//
// Contract: docs/BILLING.md → "Webhook".

import { type Cadence, type CadenceLookup, cadenceFromPriceId } from "./cadence.ts";

// Minimal shapes we read from Stripe events. Decouples handlers from SDK types.
export interface SubscriptionPayload {
  id: string;
  status: string;
  customer: string;
  current_period_end: number; // Unix seconds
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string } }> };
}

// Subscription invoices on Stripe API 2025-03-31.basil and newer no longer
// expose the subscription at the top level. The id moved to
// invoice.parent.subscription_details.subscription. We accept both shapes so
// the handler works against accounts on either API version.
// https://docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects
export interface InvoicePayload {
  id: string;
  customer: string;
  subscription?: string | null;
  parent?: {
    type?: string;
    subscription_details?: { subscription?: string | null } | null;
  } | null;
}

export interface WebhookEvent {
  id: string;
  type: string;
  created: number; // Unix seconds; used to reject stale out-of-order events.
  data: { object: unknown };
}

export interface SupabaseError {
  code?: string;
  message?: string;
}

// Thenable builders for chained PostgREST filters, mirroring supabase-js.
export interface UpdateBuilder extends PromiseLike<{ error: SupabaseError | null }> {
  eq: (col: string, val: string) => UpdateBuilder;
  lt: (col: string, val: string) => UpdateBuilder;
}

export interface SelectBuilder<T> {
  eq: (col: string, val: string) => SelectBuilder<T>;
  maybeSingle: () => Promise<{ data: T | null; error: SupabaseError | null }>;
}

interface TableQuery {
  select: <T = Record<string, unknown>>(columns: string) => SelectBuilder<T>;
  insert: (row: Record<string, unknown>) => Promise<{ error: SupabaseError | null }>;
  update: (row: Record<string, unknown>) => UpdateBuilder;
}

// The subset of the Supabase client surface this module touches.
export interface SupabaseLike {
  from: (table: string) => TableQuery;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: SupabaseError | null }>;
}

export interface Deps {
  supabase: SupabaseLike;
  cadenceLookup: CadenceLookup;
  // Resolve our user_id from a Stripe customer ID. Implementations should
  // consult billing_customers first and fall back to the Stripe API for the
  // customer's metadata.user_id.
  resolveUserId: (stripeCustomerId: string) => Promise<string | null>;
  log: (event: string, fields?: Record<string, unknown>) => void;
  now?: () => Date;
}

export type ProcessOutcome = "applied" | "duplicate" | "ignored" | "skipped";

export interface ProcessResult {
  outcome: ProcessOutcome;
  reason?: string;
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

const nowIso = (deps: Deps) => (deps.now?.() ?? new Date()).toISOString();

export function getSubscriptionIdFromInvoice(invoice: InvoicePayload): string | null {
  return (
    invoice.parent?.subscription_details?.subscription ??
    invoice.subscription ??
    null
  );
}

// Pre-check billing_events before mutating: gives us an explicit "duplicate"
// outcome for re-delivered events, and keeps the mutation idempotent for the
// case where it ran successfully but the log insert hasn't happened yet (a
// Stripe retry will re-run the mutation safely thanks to the RPC's ordering
// guard, then log).
export async function processEvent(deps: Deps, event: WebhookEvent): Promise<ProcessResult> {
  const { supabase, log } = deps;

  const { data: existingLog, error: checkError } = await supabase
    .from("billing_events")
    .select<{ stripe_event_id: string }>("stripe_event_id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (checkError) {
    log("billing_events_read_failed", {
      id: event.id,
      type: event.type,
      message: checkError.message,
    });
    throw new Error(`billing_events read failed: ${checkError.message ?? "unknown"}`);
  }
  if (existingLog) {
    log("stripe_event_duplicate", { id: event.id, type: event.type });
    return { outcome: "duplicate" };
  }

  const result = await dispatch(deps, event);

  if (result.outcome !== "applied") {
    // Skipped/ignored events aren't logged so a config fix + dashboard resend
    // can still apply them. Stale (out-of-order) events likewise are not
    // logged — the row already reflects the newer event.
    return result;
  }

  const { error: insertError } = await supabase.from("billing_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
    processed_at: nowIso(deps),
  });
  if (insertError && insertError.code !== POSTGRES_UNIQUE_VIOLATION) {
    log("stripe_event_log_insert_failed", {
      id: event.id,
      type: event.type,
      message: insertError.message,
    });
    throw new Error(`billing_events insert failed: ${insertError.message ?? "unknown"}`);
  }
  // Unique violation here means a concurrent delivery just logged the same
  // event id between our pre-check and insert. The RPC's ordering guard means
  // both deliveries' mutations converge on the same row state — harmless.
  return result;
}

async function dispatch(deps: Deps, event: WebhookEvent): Promise<ProcessResult> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return upsertSubscription(deps, event, event.data.object as SubscriptionPayload);
    case "customer.subscription.deleted":
      return cancelSubscription(deps, event, event.data.object as SubscriptionPayload);
    case "invoice.payment_failed":
      return markPaymentFailed(deps, event, event.data.object as InvoicePayload);
    default:
      deps.log("stripe_event_ignored", { id: event.id, type: event.type });
      return { outcome: "ignored" };
  }
}

const eventCreatedIso = (event: WebhookEvent) =>
  new Date(event.created * 1000).toISOString();

async function upsertSubscription(
  deps: Deps,
  event: WebhookEvent,
  sub: SubscriptionPayload,
): Promise<ProcessResult> {
  const { supabase, cadenceLookup, resolveUserId, log } = deps;

  const userId = await resolveUserId(sub.customer);
  if (!userId) {
    log("stripe_user_unresolved", { customerId: sub.customer, subscriptionId: sub.id });
    return { outcome: "skipped", reason: "user_unresolved" };
  }

  const priceId = sub.items.data[0]?.price.id ?? "";
  const cadence: Cadence | null = cadenceFromPriceId(priceId, cadenceLookup);
  if (!cadence) {
    log("stripe_unknown_price", { priceId, subscriptionId: sub.id });
    return { outcome: "skipped", reason: "unknown_price" };
  }

  // RPC because PostgREST upsert can't express a conditional ON CONFLICT
  // DO UPDATE WHERE clause. The RPC returns true when the row was inserted or
  // updated, false when this event was older than the row's last_event_created
  // and therefore skipped.
  const { data, error } = await supabase.rpc("apply_subscription_event", {
    p_user_id: userId,
    p_stripe_subscription_id: sub.id,
    p_status: sub.status,
    p_cadence: cadence,
    p_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    p_cancel_at_period_end: sub.cancel_at_period_end,
    p_event_created: eventCreatedIso(event),
  });
  if (error) {
    log("stripe_subscription_apply_failed", { subscriptionId: sub.id, message: error.message });
    throw new Error(`apply_subscription_event failed: ${error.message ?? "unknown"}`);
  }

  if (data !== true) {
    log("stripe_event_stale", {
      action: "subscription_upsert",
      eventId: event.id,
      subscriptionId: sub.id,
    });
    return { outcome: "skipped", reason: "stale_event" };
  }

  log("stripe_event_applied", {
    action: "subscription_upserted",
    userId,
    subscriptionId: sub.id,
    status: sub.status,
    cadence,
  });
  return { outcome: "applied" };
}

async function cancelSubscription(
  deps: Deps,
  event: WebhookEvent,
  sub: SubscriptionPayload,
): Promise<ProcessResult> {
  const { supabase, cadenceLookup, resolveUserId, log } = deps;
  const userId = await resolveUserId(sub.customer);
  if (!userId) {
    log("stripe_user_unresolved", { customerId: sub.customer, subscriptionId: sub.id });
    return { outcome: "skipped", reason: "user_unresolved" };
  }

  const priceId = sub.items.data[0]?.price.id ?? "";
  const cadence: Cadence | null = cadenceFromPriceId(priceId, cadenceLookup);
  if (!cadence) {
    // Without a known cadence we cannot satisfy the NOT NULL CHECK on the
    // billing_subscriptions row in the no-row-yet branch of the RPC. Skip
    // rather than fail; a config fix + Stripe dashboard resend can still
    // apply this event later because we did not log it to billing_events.
    log("stripe_unknown_price", { priceId, subscriptionId: sub.id });
    return { outcome: "skipped", reason: "unknown_price" };
  }

  // apply_subscription_cancel atomically handles three cases:
  //   1. No row exists yet (delete arrived before created/updated): INSERT a
  //      canceled snapshot stamped with this event.created. A later replay of
  //      the older customer.subscription.created event then loses the
  //      apply_subscription_event ordering guard and cannot resurrect the
  //      subscription as active.
  //   2. Row exists but tracks a different stripe_subscription_id (e.g. the
  //      user previously canceled sub_A and now has an active sub_B): no-op.
  //      A late Stripe-emitted delete for sub_A — common after dashboard
  //      metadata edits — must NOT overwrite the active sub_B row.
  //   3. Row exists for the same subscription: UPDATE to canceled only if the
  //      event is newer than the row's last_event_created (stale-event guard).
  // Returns false when the call is a no-op for cases 2 or 3; we treat both as
  // "stale" so processEvent does not log the event to billing_events, leaving
  // the door open for a redelivery + config fix to apply the right state.
  const { data, error } = await supabase.rpc("apply_subscription_cancel", {
    p_user_id: userId,
    p_stripe_subscription_id: sub.id,
    p_cadence: cadence,
    p_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    p_cancel_at_period_end: sub.cancel_at_period_end,
    p_event_created: eventCreatedIso(event),
  });
  if (error) {
    log("stripe_subscription_apply_failed", { subscriptionId: sub.id, message: error.message });
    throw new Error(`apply_subscription_cancel failed: ${error.message ?? "unknown"}`);
  }

  if (data !== true) {
    log("stripe_event_stale", {
      action: "subscription_cancel",
      eventId: event.id,
      subscriptionId: sub.id,
    });
    return { outcome: "skipped", reason: "stale_event" };
  }

  log("stripe_event_applied", { action: "subscription_canceled", userId, subscriptionId: sub.id });
  return { outcome: "applied" };
}

async function markPaymentFailed(
  deps: Deps,
  event: WebhookEvent,
  invoice: InvoicePayload,
): Promise<ProcessResult> {
  const { supabase, resolveUserId, log } = deps;

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    // Genuine one-off invoice (no associated subscription).
    return { outcome: "ignored" };
  }

  const userId = await resolveUserId(invoice.customer);
  if (!userId) {
    log("stripe_user_unresolved", { customerId: invoice.customer, invoiceId: invoice.id });
    return { outcome: "skipped", reason: "user_unresolved" };
  }

  const eventCreated = eventCreatedIso(event);
  const { error } = await supabase
    .from("billing_subscriptions")
    .update({
      status: "past_due",
      last_event_created: eventCreated,
      updated_at: nowIso(deps),
    })
    .eq("user_id", userId)
    .eq("stripe_subscription_id", subscriptionId)
    .lt("last_event_created", eventCreated);
  if (error) {
    log("stripe_subscription_update_failed", { invoiceId: invoice.id, message: error.message });
    throw new Error(`billing_subscriptions update failed: ${error.message ?? "unknown"}`);
  }
  log("stripe_event_applied", { action: "subscription_past_due", userId, invoiceId: invoice.id });
  // notification_jobs not in v1 schema — see PREPIO-12 follow-up.
  log("payment_failed_notification_deferred", { userId, invoiceId: invoice.id });
  return { outcome: "applied" };
}
