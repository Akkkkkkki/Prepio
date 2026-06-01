import { describe, expect, it, vi } from "vitest";
import {
  createPortalSession,
  type Deps,
  type StripeLike,
  type SupabaseError,
  type SupabaseLike,
} from "./handler.ts";

const APP_BASE_URL = "https://prepio.test";
const USER_ID = "user_xyz";

interface FakeSupabaseOptions {
  existingCustomerId?: string;
  customerSelectError?: SupabaseError;
}

interface FakeSupabaseRecorder {
  supabase: SupabaseLike;
  customerSelectCalls: Array<{ col: string; val: string }>;
}

function buildFakeSupabase(opts: FakeSupabaseOptions = {}): FakeSupabaseRecorder {
  const customerSelectCalls: FakeSupabaseRecorder["customerSelectCalls"] = [];
  const supabase = {
    from(table: "billing_customers") {
      expect(table).toBe("billing_customers");
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
                  customerSelectCalls.push({ col: eqCol, val: eqVal });
                  if (opts.customerSelectError) {
                    return { data: null, error: opts.customerSelectError };
                  }
                  if (!opts.existingCustomerId) {
                    return { data: null, error: null };
                  }
                  return {
                    data: { stripe_customer_id: opts.existingCustomerId },
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

  return { supabase: supabase as SupabaseLike, customerSelectCalls };
}

interface FakeStripeOptions {
  sessionId?: string;
  sessionUrl?: string | null;
  sessionCreateError?: Error;
}

function buildFakeStripe(opts: FakeStripeOptions = {}) {
  const sessionCreate = vi.fn(async (_params: unknown) => {
    if (opts.sessionCreateError) throw opts.sessionCreateError;
    return {
      id: opts.sessionId ?? "bps_test_123",
      url: opts.sessionUrl === undefined ? "https://billing.stripe.com/p/session/test" : opts.sessionUrl,
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

function buildDeps(
  overrides: { supabase?: FakeSupabaseOptions; stripe?: FakeStripeOptions } = {},
) {
  const supabaseRec = buildFakeSupabase(overrides.supabase);
  const stripeRec = buildFakeStripe(overrides.stripe);
  const logs: Array<{ event: string; fields?: Record<string, unknown> }> = [];
  const deps: Deps = {
    supabase: supabaseRec.supabase,
    stripe: stripeRec.stripe,
    appBaseUrl: APP_BASE_URL,
    log: (event, fields) => logs.push({ event, fields }),
  };
  return { deps, supabaseRec, stripeRec, logs };
}

describe("createPortalSession", () => {
  it("looks up the authenticated user's existing Stripe customer", async () => {
    const { deps, supabaseRec } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_123" },
    });

    await createPortalSession(deps, { userId: USER_ID });

    expect(supabaseRec.customerSelectCalls).toEqual([{ col: "user_id", val: USER_ID }]);
  });

  it("creates a Customer Portal session with the expected return URL", async () => {
    const { deps, stripeRec } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_123" },
      stripe: { sessionId: "bps_live_42", sessionUrl: "https://billing.stripe.com/p/session/live" },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({
      ok: true,
      url: "https://billing.stripe.com/p/session/live",
      sessionId: "bps_live_42",
    });
    expect(stripeRec.sessionCreate).toHaveBeenCalledWith({
      customer: "cus_existing_123",
      return_url: `${APP_BASE_URL}/profile?billing=portal_return`,
    });
  });

  it("returns 404 when the user has no billing_customers row", async () => {
    const { deps, stripeRec, logs } = buildDeps();

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 404, error: "customer_not_found" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    expect(logs.map((l) => l.event)).toContain("portal_customer_missing");
  });

  it("returns 500 when reading billing_customers fails", async () => {
    const { deps, stripeRec, logs } = buildDeps({
      supabase: { customerSelectError: { message: "db down" } },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 500, error: "internal_error" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    expect(logs.map((l) => l.event)).toContain("billing_customers_read_failed");
  });

  it("returns 502 when Stripe portal creation throws", async () => {
    const { deps, logs } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_123" },
      stripe: { sessionCreateError: new Error("stripe outage") },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(logs.map((l) => l.event)).toContain("stripe_portal_create_failed");
  });

  it("returns 502 when Stripe returns a portal session without a URL", async () => {
    const { deps, logs } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_123" },
      stripe: { sessionUrl: null },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(logs.map((l) => l.event)).toContain("stripe_portal_no_url");
  });
});
