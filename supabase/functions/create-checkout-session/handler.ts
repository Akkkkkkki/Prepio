// Pure handler for the create-checkout-session edge function. No Deno or
// Stripe SDK imports — the entrypoint in index.ts wires real dependencies.
// This shape lets Vitest exercise validation, customer reuse, and idempotency
// without spinning up a runtime.
//
// Contract: docs/BILLING.md → "Upgrade".

import { type Cadence, type CadenceLookup, isCadence } from "../_shared/cadence.ts";

export interface SupabaseError {
  code?: string;
  message?: string;
}

export interface BillingCustomerRow {
  stripe_customer_id: string;
}

interface SelectBuilder {
  eq: (col: string, val: string) => {
    maybeSingle: () => Promise<{ data: BillingCustomerRow | null; error: SupabaseError | null }>;
  };
}

interface BillingCustomersTable {
  select: (columns: string) => SelectBuilder;
  upsert: (
    row: { user_id: string; stripe_customer_id: string },
    options: { onConflict: string },
  ) => Promise<{ error: SupabaseError | null }>;
}

export interface SupabaseLike {
  from: (table: "billing_customers") => BillingCustomersTable;
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
}

export interface CheckoutRequest {
  userId: string;
  userEmail: string | null;
  cadence: unknown;
}

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string; cadence: Cadence }
  | { ok: false; status: number; error: string };

export async function createCheckoutSession(
  deps: Deps,
  req: CheckoutRequest,
): Promise<CheckoutResult> {
  if (!isCadence(req.cadence)) {
    return { ok: false, status: 400, error: "invalid_cadence" };
  }
  const cadence: Cadence = req.cadence;
  const priceId = deps.cadenceLookup[cadence];

  const { data: existing, error: readError } = await deps.supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", req.userId)
    .maybeSingle();
  if (readError) {
    deps.log("billing_customers_read_failed", {
      userId: req.userId,
      message: readError.message,
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
    session = await deps.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${deps.appBaseUrl}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${deps.appBaseUrl}/`,
      client_reference_id: req.userId,
      allow_promotion_codes: false,
    });
  } catch (err) {
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
