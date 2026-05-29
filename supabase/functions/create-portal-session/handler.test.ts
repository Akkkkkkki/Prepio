import { describe, expect, it, vi } from "vitest";
import { type SubscriptionRow } from "../_shared/entitlement-rules.ts";
import {
  createPortalSession,
  type Deps,
  type StripeLike,
  type SupabaseError,
  type SupabaseLike,
} from "./handler.ts";

const APP_BASE_URL = "https://prepio.test";
const USER_ID = "user_xyz";
const NOW = new Date("2026-05-16T00:00:00.000Z");
const FUTURE_ISO = "2026-12-31T00:00:00.000Z";
const PAST_ISO = "2026-01-01T00:00:00.000Z";

interface FakeSupabaseOptions {
  customerId?: string;
  customerSelectError?: SupabaseError;
  subscriptionRow?: SubscriptionRow | null;
  subscriptionSelectError?: SupabaseError;
}

function buildFakeSupabase(opts: FakeSupabaseOptions = {}) {
  const customerSelectCalls: Array<{ col: string; val: string }> = [];
  const subscriptionSelectCalls: Array<{ col: string; val: string }> = [];

  const supabase = {
    from(table: "billing_customers" | "billing_subscriptions") {
      return {
        select(_columns: string) {
          let eqCol = "";
          let eqVal = "";
          return {
            eq(col: string, val: string) {
              eqCol = col;
              eqVal = val;
              return {
                async maybeSingle() {
                  if (table === "billing_subscriptions") {
                    subscriptionSelectCalls.push({ col: eqCol, val: eqVal });
                    if (opts.subscriptionSelectError) {
                      return { data: null, error: opts.subscriptionSelectError };
                    }
                    return { data: opts.subscriptionRow ?? null, error: null };
                  }

                  customerSelectCalls.push({ col: eqCol, val: eqVal });
                  if (opts.customerSelectError) {
                    return { data: null, error: opts.customerSelectError };
                  }
                  return {
                    data: opts.customerId ? { stripe_customer_id: opts.customerId } : null,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    supabase: supabase as unknown as SupabaseLike,
    customerSelectCalls,
    subscriptionSelectCalls,
  };
}

function buildFakeStripe(opts: { sessionUrl?: string | null; sessionError?: Error } = {}) {
  const sessionCreate = vi.fn(async (_params: unknown, _options?: unknown) => {
    if (opts.sessionError) throw opts.sessionError;
    return {
      id: "bps_test_123",
      url: opts.sessionUrl === undefined ? "https://billing.stripe.com/p/session" : opts.sessionUrl,
    };
  });

  const stripe: StripeLike = {
    billingPortal: {
      sessions: {
        create: sessionCreate as unknown as StripeLike["billingPortal"]["sessions"]["create"],
      },
    },
  };

  return { stripe, sessionCreate };
}

function paidRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    status: "active",
    cadence: "annual",
    current_period_end: FUTURE_ISO,
    cancel_at_period_end: false,
    ...overrides,
  };
}

function buildDeps(
  overrides: {
    supabase?: FakeSupabaseOptions;
    stripe?: { sessionUrl?: string | null; sessionError?: Error };
  } = {},
) {
  const supabaseRec = buildFakeSupabase(overrides.supabase);
  const stripeRec = buildFakeStripe(overrides.stripe);
  const logs: Array<{ event: string; fields?: Record<string, unknown> }> = [];
  const deps: Deps = {
    supabase: supabaseRec.supabase,
    stripe: stripeRec.stripe,
    appBaseUrl: APP_BASE_URL,
    log: (event, fields) => logs.push({ event, fields }),
    now: () => NOW,
  };

  return { deps, supabaseRec, stripeRec, logs };
}

describe("createPortalSession", () => {
  it("creates a Customer Portal session for a paid subscriber", async () => {
    const { deps, stripeRec, supabaseRec } = buildDeps({
      supabase: {
        customerId: "cus_existing_123",
        subscriptionRow: paidRow(),
      },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({
      ok: true,
      url: "https://billing.stripe.com/p/session",
      sessionId: "bps_test_123",
    });
    expect(stripeRec.sessionCreate).toHaveBeenCalledWith(
      {
        customer: "cus_existing_123",
        return_url: `${APP_BASE_URL}/pricing`,
      },
    );
    expect(supabaseRec.subscriptionSelectCalls).toEqual([{ col: "user_id", val: USER_ID }]);
    expect(supabaseRec.customerSelectCalls).toEqual([{ col: "user_id", val: USER_ID }]);
  });

  it("blocks users without an active paid entitlement", async () => {
    const { deps, stripeRec } = buildDeps({
      supabase: {
        customerId: "cus_existing_123",
        subscriptionRow: paidRow({
          status: "canceled",
          current_period_end: PAST_ISO,
        }),
      },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 409, error: "no_active_subscription" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when a paid entitlement has no Stripe customer row", async () => {
    const { deps, stripeRec } = buildDeps({
      supabase: {
        subscriptionRow: paidRow(),
      },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 409, error: "no_customer" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the subscription read fails", async () => {
    const { deps, stripeRec } = buildDeps({
      supabase: {
        customerId: "cus_existing_123",
        subscriptionSelectError: { message: "db down" },
      },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 500, error: "internal_error" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
  });

  it("returns 502 when Stripe fails to create the portal session", async () => {
    const { deps } = buildDeps({
      supabase: {
        customerId: "cus_existing_123",
        subscriptionRow: paidRow(),
      },
      stripe: { sessionError: new Error("stripe outage") },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
  });

  it("returns 502 when Stripe returns no portal URL", async () => {
    const { deps } = buildDeps({
      supabase: {
        customerId: "cus_existing_123",
        subscriptionRow: paidRow(),
      },
      stripe: { sessionUrl: null },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
  });
});
