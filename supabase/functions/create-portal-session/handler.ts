// Pure handler for Customer Portal session creation. The Deno entrypoint wires
// Stripe and Supabase; this module keeps subscription gating unit-testable.
//
// Contract: docs/BILLING.md -> "Manage subscription".

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
}

interface BillingSubscriptionsTable {
  select: (columns: string) => SubscriptionSelectBuilder;
}

export interface SupabaseLike {
  from(table: "billing_customers"): BillingCustomersTable;
  from(table: "billing_subscriptions"): BillingSubscriptionsTable;
}

export interface StripePortalSessionCreateParams {
  customer: string;
  return_url: string;
}

export interface StripeLike {
  billingPortal: {
    sessions: {
      create: (
        params: StripePortalSessionCreateParams,
      ) => Promise<{ id: string; url: string | null }>;
    };
  };
}

export interface Deps {
  supabase: SupabaseLike;
  stripe: StripeLike;
  appBaseUrl: string;
  log: (event: string, fields?: Record<string, unknown>) => void;
  now?: () => Date;
}

export interface PortalRequest {
  userId: string;
}

export type PortalResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; status: number; error: string };

export async function createPortalSession(
  deps: Deps,
  req: PortalRequest,
): Promise<PortalResult> {
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
  if (entitlement.tier !== "paid") {
    deps.log("portal_blocked_no_active_subscription", {
      userId: req.userId,
      status: entitlement.status,
    });
    return { ok: false, status: 409, error: "no_active_subscription" };
  }

  const { data: customerRow, error: customerReadError } = await deps.supabase
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

  if (!customerRow?.stripe_customer_id) {
    deps.log("portal_blocked_no_customer", { userId: req.userId });
    return { ok: false, status: 409, error: "no_customer" };
  }

  let session: { id: string; url: string | null };
  try {
    session = await deps.stripe.billingPortal.sessions.create(
      {
        customer: customerRow.stripe_customer_id,
        return_url: `${deps.appBaseUrl}/pricing`,
      },
    );
  } catch (err) {
    deps.log("stripe_portal_create_failed", {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 502, error: "stripe_error" };
  }

  if (!session.url) {
    deps.log("stripe_portal_no_url", { userId: req.userId, sessionId: session.id });
    return { ok: false, status: 502, error: "stripe_error" };
  }

  deps.log("portal_session_created", {
    userId: req.userId,
    sessionId: session.id,
  });
  return { ok: true, url: session.url, sessionId: session.id };
}
