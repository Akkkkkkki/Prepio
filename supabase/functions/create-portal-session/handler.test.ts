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
                  if (opts.existingCustomerId) {
                    return {
                      data: { stripe_customer_id: opts.existingCustomerId },
                      error: null,
                    };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return { supabase: supabase as unknown as SupabaseLike, customerSelectCalls };
}

interface FakeStripeOptions {
  sessionId?: string;
  sessionUrl?: string | null;
  sessionCreateError?: Error;
}

interface FakeStripeRecorder {
  stripe: StripeLike;
  sessionCreate: ReturnType<typeof vi.fn>;
}

function buildFakeStripe(opts: FakeStripeOptions = {}): FakeStripeRecorder {
  const sessionCreate = vi.fn(async (_params: unknown) => {
    if (opts.sessionCreateError) throw opts.sessionCreateError;
    return {
      id: opts.sessionId ?? "bps_test_123",
      url: opts.sessionUrl === undefined ? "https://billing.stripe.com/p/session/test_123" : opts.sessionUrl,
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

interface BuildDepsResult {
  deps: Deps;
  supabaseRec: FakeSupabaseRecorder;
  stripeRec: FakeStripeRecorder;
  logs: Array<{ event: string; fields?: Record<string, unknown> }>;
}

function buildDeps(
  overrides: { supabase?: FakeSupabaseOptions; stripe?: FakeStripeOptions } = {},
): BuildDepsResult {
  const supabaseRec = buildFakeSupabase(overrides.supabase);
  const stripeRec = buildFakeStripe(overrides.stripe);
  const logs: BuildDepsResult["logs"] = [];
  return {
    deps: {
      supabase: supabaseRec.supabase,
      stripe: stripeRec.stripe,
      appBaseUrl: APP_BASE_URL,
      log: (event, fields) => logs.push({ event, fields }),
    },
    supabaseRec,
    stripeRec,
    logs,
  };
}

describe("createPortalSession", () => {
  it("looks up the current user's existing Stripe customer and creates a portal session", async () => {
    const { deps, supabaseRec, stripeRec } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_123" },
      stripe: { sessionId: "bps_live_42", sessionUrl: "https://billing.stripe.com/p/session/live_42" },
    });

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({
      ok: true,
      url: "https://billing.stripe.com/p/session/live_42",
      sessionId: "bps_live_42",
    });
    expect(supabaseRec.customerSelectCalls).toEqual([{ col: "user_id", val: USER_ID }]);
    expect(stripeRec.sessionCreate).toHaveBeenCalledWith({
      customer: "cus_existing_123",
      return_url: `${APP_BASE_URL}/profile?billing=portal_return`,
    });
  });

  it("does not create a Stripe customer when no billing_customers row exists", async () => {
    const { deps, stripeRec, logs } = buildDeps();

    const result = await createPortalSession(deps, { userId: USER_ID });

    expect(result).toEqual({ ok: false, status: 409, error: "no_billing_customer" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    expect(logs.map((l) => l.event)).toContain("portal_blocked_missing_customer");
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

  it("returns 502 when Stripe portal session creation throws", async () => {
    const { deps, logs } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_123" },
      stripe: { sessionCreateError: new Error("rate limited") },
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
