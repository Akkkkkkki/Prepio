// Pure handler for the create-portal-session edge function. The Deno entrypoint
// wires auth, env, Supabase, and Stripe; this file keeps the billing contract
// testable under Vitest.
//
// Contract: docs/BILLING.md -> "Manage subscription".

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

interface BillingCustomersTable {
  select: (columns: string) => CustomerSelectBuilder;
}

export interface SupabaseLike {
  from(table: "billing_customers"): BillingCustomersTable;
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
  const { data: customer, error: customerReadError } = await deps.supabase
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

  if (!customer?.stripe_customer_id) {
    deps.log("portal_customer_missing", { userId: req.userId });
    return { ok: false, status: 404, error: "customer_not_found" };
  }

  let session: { id: string; url: string | null };
  try {
    session = await deps.stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${deps.appBaseUrl}/profile?billing=portal_return`,
    });
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
