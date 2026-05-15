// Pure event handlers for the Stripe webhook. No Stripe SDK imports, no Deno
// globals — the Deno entrypoint in index.ts wires up real dependencies. This
// shape lets Vitest exercise the dispatch and idempotency paths directly.
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

export interface InvoicePayload {
  id: string;
  customer: string;
  subscription: string | null;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

// The subset of the Supabase client surface this module touches.
export interface SupabaseLike {
  from: (table: string) => TableQuery;
}

interface TableQuery {
  insert: (row: Record<string, unknown>) => Promise<{ error: SupabaseError | null }>;
  upsert: (
    row: Record<string, unknown>,
    opts?: { onConflict?: string },
  ) => Promise<{ error: SupabaseError | null }>;
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: SupabaseError | null }>;
  };
}

export interface SupabaseError {
  code?: string;
  message?: string;
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

export async function processEvent(deps: Deps, event: WebhookEvent): Promise<ProcessResult> {
  const { supabase, log } = deps;

  // Idempotency: insert first. A unique violation means we've seen this id.
  const { error } = await supabase.from("billing_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
    processed_at: nowIso(deps),
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      log("stripe_event_duplicate", { id: event.id, type: event.type });
      return { outcome: "duplicate" };
    }
    log("stripe_event_insert_failed", { id: event.id, type: event.type, message: error.message });
    throw new Error(`billing_events insert failed: ${error.message ?? "unknown"}`);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return upsertSubscription(deps, event.data.object as SubscriptionPayload);
    case "customer.subscription.deleted":
      return cancelSubscription(deps, event.data.object as SubscriptionPayload);
    case "invoice.payment_failed":
      return markPaymentFailed(deps, event.data.object as InvoicePayload);
    default:
      log("stripe_event_ignored", { id: event.id, type: event.type });
      return { outcome: "ignored" };
  }
}

async function upsertSubscription(
  deps: Deps,
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

  const { error } = await supabase.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      cadence,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: nowIso(deps),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    log("stripe_subscription_upsert_failed", { subscriptionId: sub.id, message: error.message });
    throw new Error(`billing_subscriptions upsert failed: ${error.message ?? "unknown"}`);
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
  sub: SubscriptionPayload,
): Promise<ProcessResult> {
  const { supabase, resolveUserId, log } = deps;
  const userId = await resolveUserId(sub.customer);
  if (!userId) {
    log("stripe_user_unresolved", { customerId: sub.customer, subscriptionId: sub.id });
    return { outcome: "skipped", reason: "user_unresolved" };
  }

  const { error } = await supabase
    .from("billing_subscriptions")
    .update({ status: "canceled", updated_at: nowIso(deps) })
    .eq("user_id", userId);
  if (error) {
    log("stripe_subscription_update_failed", { subscriptionId: sub.id, message: error.message });
    throw new Error(`billing_subscriptions update failed: ${error.message ?? "unknown"}`);
  }
  log("stripe_event_applied", { action: "subscription_canceled", userId, subscriptionId: sub.id });
  return { outcome: "applied" };
}

async function markPaymentFailed(
  deps: Deps,
  invoice: InvoicePayload,
): Promise<ProcessResult> {
  const { supabase, resolveUserId, log } = deps;

  // Non-subscription invoices (one-off charges) are out of scope.
  if (!invoice.subscription) {
    return { outcome: "ignored" };
  }

  const userId = await resolveUserId(invoice.customer);
  if (!userId) {
    log("stripe_user_unresolved", { customerId: invoice.customer, invoiceId: invoice.id });
    return { outcome: "skipped", reason: "user_unresolved" };
  }

  const { error } = await supabase
    .from("billing_subscriptions")
    .update({ status: "past_due", updated_at: nowIso(deps) })
    .eq("user_id", userId);
  if (error) {
    log("stripe_subscription_update_failed", { invoiceId: invoice.id, message: error.message });
    throw new Error(`billing_subscriptions update failed: ${error.message ?? "unknown"}`);
  }
  log("stripe_event_applied", { action: "subscription_past_due", userId, invoiceId: invoice.id });
  // Notification enqueue intentionally deferred — notification_jobs table not in v1 schema.
  log("payment_failed_notification_deferred", { userId, invoiceId: invoice.id });
  return { outcome: "applied" };
}
