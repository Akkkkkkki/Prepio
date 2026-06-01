// Pure handler for the create-checkout-session edge function. No Deno or
// Stripe SDK imports — the entrypoint in index.ts wires real dependencies.
// This shape lets Vitest exercise validation, the already-subscribed gate,
// customer reuse, and idempotency without spinning up a runtime.
//
// Contract: docs/BILLING.md → "Upgrade".

import { type Cadence, type CadenceLookup, isCadence } from "../_shared/cadence.ts";
import { resolveEntitlement, type SubscriptionRow } from "../_shared/entitlement-rules.ts";

export interface SupabaseError {
  code?: string;
  message?: string;
}

export interface BillingCustomerRow {
  stripe_customer_id: string;
}

interface CustomerSelectBuilder {
  eq: (col: string, val: string) => {
    maybeSingle: () => Promise<{ data: BillingCustomerRow | null; error: SupabaseError | null }>;
  };
}

interface SubscriptionSelectBuilder {
  eq: (col: string, val: string) => {
    maybeSingle: () => Promise<{ data: SubscriptionRow | null; error: SupabaseError | null }>;
  };
}

interface BillingCustomersTable {
  select: (columns: string) => CustomerSelectBuilder;
  upsert: (
    row: { user_id: string; stripe_customer_id: string },
    options: { onConflict: string },
  ) => Promise<{ error: SupabaseError | null }>;
}

interface BillingSubscriptionsTable {
  select: (columns: string) => SubscriptionSelectBuilder;
}

export interface SupabaseLike {
  from(table: "billing_customers"): BillingCustomersTable;
  from(table: "billing_subscriptions"): BillingSubscriptionsTable;
}

export interface StripeCustomerCreateParams {
  email?: string;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutSessionCreateParams {
  mode: "subscription";
  customer: string;
  line_items: Array<{ price: string; quantity: number }>;
  success_url: string;
  cancel_url: string;
  client_reference_id?: string;
  allow_promotion_codes?: boolean;
}

export interface StripeLike {
  customers: {
    create: (
      params: StripeCustomerCreateParams,
      options?: { idempotencyKey?: string },
    ) => Promise<{ id: string }>;
  };
  checkout: {
    sessions: {
      create: (
        params: StripeCheckoutSessionCreateParams,
        options?: { idempotencyKey?: string },
      ) => Promise<{ id: string; url: string | null }>;
    };
  };
}

export interface Deps {
  supabase: SupabaseLike;
  stripe: StripeLike;
  cadenceLookup: CadenceLookup;
  appBaseUrl: string;
  log: (event: string, fields?: Record<string, unknown>) => void;
  now?: () => Date;
}

export interface CheckoutRequest {
  userId: string;
  userEmail: string | null;
  cadence: unknown;
}

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string; cadence: Cadence }
  | { ok: false; status: number; error: string };

function isStripeIdempotencyConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { type?: string; code?: string; rawType?: string };
  return (
    e.type === "StripeIdempotencyError" ||
    e.rawType === "idempotency_error" ||
    e.code === "idempotency_key_in_use"
  );
}

export async function createCheckoutSession(
  deps: Deps,
  req: CheckoutRequest,
): Promise<CheckoutResult> {
  if (!isCadence(req.cadence)) {
    return { ok: false, status: 400, error: "invalid_cadence" };
  }
  const cadence: Cadence = req.cadence;
  const priceId = deps.cadenceLookup[cadence];

  // Gate: refuse Checkout when the caller already has an active paid
  // subscription. Without this, a stale CTA or repeated direct call would mint
  // a second Stripe subscription on the same customer; the webhook's RPC
  // upserts a single row per user, so the old subscription would keep billing
  // silently. Cadence changes belong to the Customer Portal, not Checkout.
  // Fail closed on a read error: a DB blip must not let us double-charge.
  const { data: subscriptionRow, error: subscriptionReadError } = await deps.supabase
    .from("billing_subscriptions")
    .select("status, cadence, current_period_end, cancel_at_period_end")
    .eq("user_id", req.userId)
    .maybeSingle();
  if (subscriptionReadError) {
    deps.log("billing_subscriptions_read_failed", {
      userId: req.userId,
      message: subscriptionReadError.message,
    });
    return { ok: false, status: 500, error: "internal_error" };
  }
  const entitlement = resolveEntitlement(subscriptionRow ?? null, deps.now?.() ?? new Date());
  if (entitlement.tier === "paid") {
    deps.log("checkout_blocked_already_subscribed", {
      userId: req.userId,
      status: entitlement.status,
      cadence: entitlement.cadence,
    });
    return { ok: false, status: 409, error: "already_subscribed" };
  }

  const { data: existing, error: customerReadError } = await deps.supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", req.userId)
    .maybeSingle();
  if (customerReadError) {
    deps.log("billing_customers_read_failed", {
      userId: req.userId,
      message: customerReadError.message,
    });
    return { ok: false, status: 500, error: "internal_error" };
  }

  let stripeCustomerId = existing?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    try {
      // metadata.user_id is required by the stripe-webhook fallback resolver
      // (see stripe-webhook/index.ts). idempotencyKey scoped to the user
      // prevents duplicate Stripe customers when this endpoint is hit twice in
      // parallel before billing_customers has a row.
      const customer = await deps.stripe.customers.create(
        {
          email: req.userEmail ?? undefined,
          metadata: { user_id: req.userId },
        },
        { idempotencyKey: `billing_customer:${req.userId}` },
      );
      stripeCustomerId = customer.id;
    } catch (err) {
      deps.log("stripe_customer_create_failed", {
        userId: req.userId,
        message: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, status: 502, error: "stripe_error" };
    }

    const { error: upsertError } = await deps.supabase
      .from("billing_customers")
      .upsert(
        { user_id: req.userId, stripe_customer_id: stripeCustomerId },
        { onConflict: "user_id" },
      );
    if (upsertError) {
      deps.log("billing_customers_upsert_failed", {
        userId: req.userId,
        message: upsertError.message,
      });
      return { ok: false, status: 500, error: "internal_error" };
    }
  }

  let session: { id: string; url: string | null };
  try {
    // idempotencyKey scoped to the user (not cadence) closes the pre-webhook
    // double-billing window: a user with no billing_subscriptions row yet
    // cannot mint two Checkout Sessions at different cadences in parallel.
    // Cadence changes belong to the Customer Portal post-subscription, so the
    // already-subscribed gate above covers the legitimate cadence-change path.
    session = await deps.stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${deps.appBaseUrl}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${deps.appBaseUrl}/?checkout=canceled`,
        client_reference_id: req.userId,
        allow_promotion_codes: false,
      },
      { idempotencyKey: `checkout:${req.userId}` },
    );
  } catch (err) {
    if (isStripeIdempotencyConflict(err)) {
      // Same user already used this key with a different body within Stripe's
      // 24h window — typically a cadence switch before the first session was
      // completed or expired. Surface a distinct 409 so the UI can prompt the
      // user to finish or abandon the in-flight Checkout.
      deps.log("stripe_checkout_pending_conflict", {
        userId: req.userId,
        message: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, status: 409, error: "pending_checkout" };
    }
    deps.log("stripe_checkout_create_failed", {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 502, error: "stripe_error" };
  }

  if (!session.url) {
    deps.log("stripe_checkout_no_url", { userId: req.userId, sessionId: session.id });
    return { ok: false, status: 502, error: "stripe_error" };
  }

  deps.log("checkout_session_created", {
    userId: req.userId,
    sessionId: session.id,
    cadence,
  });
  return { ok: true, url: session.url, sessionId: session.id, cadence };
}
