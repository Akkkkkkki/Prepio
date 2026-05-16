import { describe, expect, it, vi } from "vitest";
import { type CadenceLookup } from "../_shared/cadence.ts";
import { type SubscriptionRow } from "../_shared/entitlement-rules.ts";
import {
  createCheckoutSession,
  type Deps,
  type StripeLike,
  type SupabaseError,
  type SupabaseLike,
} from "./handler.ts";

const LOOKUP: CadenceLookup = {
  monthly: "price_monthly_test",
  quarterly: "price_quarterly_test",
  annual: "price_annual_test",
};

const APP_BASE_URL = "https://prepio.test";
const USER_ID = "user_xyz";
const USER_EMAIL = "user@example.com";
const NOW = new Date("2026-05-16T00:00:00.000Z");
const FUTURE_ISO = "2026-12-31T00:00:00.000Z";
const PAST_ISO = "2026-01-01T00:00:00.000Z";

interface FakeSupabaseOptions {
  existingCustomerId?: string;
  customerSelectError?: SupabaseError;
  upsertError?: SupabaseError;
  subscriptionRow?: SubscriptionRow | null;
  subscriptionSelectError?: SupabaseError;
}

interface FakeSupabaseRecorder {
  supabase: SupabaseLike;
  customerSelectCalls: Array<{ col: string; val: string }>;
  subscriptionSelectCalls: Array<{ col: string; val: string }>;
  upsertCalls: Array<{
    row: { user_id: string; stripe_customer_id: string };
    onConflict: string;
  }>;
}

function buildFakeSupabase(opts: FakeSupabaseOptions = {}): FakeSupabaseRecorder {
  const customerSelectCalls: FakeSupabaseRecorder["customerSelectCalls"] = [];
  const subscriptionSelectCalls: FakeSupabaseRecorder["subscriptionSelectCalls"] = [];
  const upsertCalls: FakeSupabaseRecorder["upsertCalls"] = [];

  const supabase = {
    from(table: "billing_customers" | "billing_subscriptions") {
      if (table === "billing_subscriptions") {
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
                    subscriptionSelectCalls.push({ col: eqCol, val: eqVal });
                    if (opts.subscriptionSelectError) {
                      return { data: null, error: opts.subscriptionSelectError };
                    }
                    return { data: opts.subscriptionRow ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      // billing_customers
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
        async upsert(
          row: { user_id: string; stripe_customer_id: string },
          options: { onConflict: string },
        ) {
          upsertCalls.push({ row, onConflict: options.onConflict });
          return { error: opts.upsertError ?? null };
        },
      };
    },
  };

  return {
    supabase: supabase as unknown as SupabaseLike,
    customerSelectCalls,
    subscriptionSelectCalls,
    upsertCalls,
  };
}

interface FakeStripeOptions {
  customerId?: string;
  sessionId?: string;
  sessionUrl?: string | null;
  customerCreateError?: Error;
  sessionCreateError?: Error;
}

interface FakeStripeRecorder {
  stripe: StripeLike;
  customerCreate: ReturnType<typeof vi.fn>;
  sessionCreate: ReturnType<typeof vi.fn>;
}

function buildFakeStripe(opts: FakeStripeOptions = {}): FakeStripeRecorder {
  const customerCreate = vi.fn(async () => {
    if (opts.customerCreateError) throw opts.customerCreateError;
    return { id: opts.customerId ?? "cus_new_123" };
  });
  const sessionCreate = vi.fn(async () => {
    if (opts.sessionCreateError) throw opts.sessionCreateError;
    return {
      id: opts.sessionId ?? "cs_test_123",
      url: opts.sessionUrl === undefined ? "https://checkout.stripe.com/c/pay/cs_test_123" : opts.sessionUrl,
    };
  });
  const stripe: StripeLike = {
    customers: {
      create: customerCreate as unknown as StripeLike["customers"]["create"],
    },
    checkout: {
      sessions: {
        create: sessionCreate as unknown as StripeLike["checkout"]["sessions"]["create"],
      },
    },
  };
  return { stripe, customerCreate, sessionCreate };
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
      cadenceLookup: LOOKUP,
      appBaseUrl: APP_BASE_URL,
      log: (event, fields) => logs.push({ event, fields }),
      now: () => NOW,
    },
    supabaseRec,
    stripeRec,
    logs,
  };
}

describe("createCheckoutSession", () => {
  it("rejects an unknown cadence with 400", async () => {
    const { deps, stripeRec } = buildDeps();
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "weekly",
    });
    expect(result).toEqual({ ok: false, status: 400, error: "invalid_cadence" });
    expect(stripeRec.customerCreate).not.toHaveBeenCalled();
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
  });

  it("rejects a missing cadence with 400", async () => {
    const { deps } = buildDeps();
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: undefined,
    });
    expect(result).toEqual({ ok: false, status: 400, error: "invalid_cadence" });
  });

  it("creates a Stripe customer with metadata.user_id and idempotency key on first checkout", async () => {
    const { deps, supabaseRec, stripeRec } = buildDeps();
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });

    expect(result.ok).toBe(true);
    expect(stripeRec.customerCreate).toHaveBeenCalledWith(
      { email: USER_EMAIL, metadata: { user_id: USER_ID } },
      { idempotencyKey: `billing_customer:${USER_ID}` },
    );
    expect(supabaseRec.upsertCalls).toEqual([
      {
        row: { user_id: USER_ID, stripe_customer_id: "cus_new_123" },
        onConflict: "user_id",
      },
    ]);
  });

  it("creates a Stripe customer without an email when none is available", async () => {
    const { deps, stripeRec } = buildDeps();
    await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: null,
      cadence: "monthly",
    });
    expect(stripeRec.customerCreate).toHaveBeenCalledWith(
      { email: undefined, metadata: { user_id: USER_ID } },
      { idempotencyKey: `billing_customer:${USER_ID}` },
    );
  });

  it("reuses the existing Stripe customer when billing_customers has a row", async () => {
    const { deps, supabaseRec, stripeRec } = buildDeps({
      supabase: { existingCustomerId: "cus_existing_999" },
    });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "annual",
    });

    expect(result.ok).toBe(true);
    expect(stripeRec.customerCreate).not.toHaveBeenCalled();
    expect(supabaseRec.upsertCalls).toEqual([]);
    expect(stripeRec.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing_999" }),
    );
  });

  it("passes the correct Price ID for each cadence", async () => {
    for (const cadence of ["monthly", "quarterly", "annual"] as const) {
      const { deps, stripeRec } = buildDeps();
      await createCheckoutSession(deps, { userId: USER_ID, userEmail: USER_EMAIL, cadence });
      expect(stripeRec.sessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          line_items: [{ price: LOOKUP[cadence], quantity: 1 }],
        }),
      );
    }
  });

  it("uses success_url with the {CHECKOUT_SESSION_ID} placeholder verbatim", async () => {
    const { deps, stripeRec } = buildDeps();
    await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(stripeRec.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: `${APP_BASE_URL}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_BASE_URL}/`,
        client_reference_id: USER_ID,
      }),
    );
  });

  it("returns the session URL and id on success", async () => {
    const { deps } = buildDeps({
      stripe: { sessionId: "cs_live_42", sessionUrl: "https://checkout.stripe.com/c/pay/cs_live_42" },
    });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_live_42",
      sessionId: "cs_live_42",
      cadence: "monthly",
    });
  });

  it("returns 500 when reading billing_customers fails", async () => {
    const { deps, stripeRec } = buildDeps({
      supabase: { customerSelectError: { message: "db down" } },
    });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(result).toEqual({ ok: false, status: 500, error: "internal_error" });
    expect(stripeRec.customerCreate).not.toHaveBeenCalled();
  });

  it("returns 500 when upserting billing_customers fails", async () => {
    const { deps, stripeRec } = buildDeps({
      supabase: { upsertError: { message: "constraint" } },
    });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(result).toEqual({ ok: false, status: 500, error: "internal_error" });
    expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
  });

  it("returns 502 when Stripe customer creation throws", async () => {
    const { deps, logs } = buildDeps({
      stripe: { customerCreateError: new Error("stripe outage") },
    });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(logs.map((l) => l.event)).toContain("stripe_customer_create_failed");
  });

  it("returns 502 when Stripe checkout session creation throws", async () => {
    const { deps } = buildDeps({
      stripe: { sessionCreateError: new Error("rate limited") },
    });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
  });

  it("returns 502 when Stripe returns a session without a URL", async () => {
    const { deps, logs } = buildDeps({ stripe: { sessionUrl: null } });
    const result = await createCheckoutSession(deps, {
      userId: USER_ID,
      userEmail: USER_EMAIL,
      cadence: "monthly",
    });
    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(logs.map((l) => l.event)).toContain("stripe_checkout_no_url");
  });

  describe("already-subscribed gate", () => {
    it("blocks Checkout with 409 when the user has an active subscription", async () => {
      const { deps, stripeRec, logs } = buildDeps({
        supabase: {
          subscriptionRow: {
            status: "active",
            cadence: "monthly",
            current_period_end: FUTURE_ISO,
            cancel_at_period_end: false,
          },
        },
      });
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "annual",
      });
      expect(result).toEqual({ ok: false, status: 409, error: "already_subscribed" });
      expect(stripeRec.customerCreate).not.toHaveBeenCalled();
      expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
      expect(logs.map((l) => l.event)).toContain("checkout_blocked_already_subscribed");
    });

    it("blocks Checkout when the user is trialing", async () => {
      const { deps, stripeRec } = buildDeps({
        supabase: {
          subscriptionRow: {
            status: "trialing",
            cadence: "monthly",
            current_period_end: FUTURE_ISO,
            cancel_at_period_end: false,
          },
        },
      });
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "monthly",
      });
      expect(result).toEqual({ ok: false, status: 409, error: "already_subscribed" });
      expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    });

    it("blocks Checkout when past_due and still inside the grace window", async () => {
      // current_period_end one day before NOW; grace = 7 days, so still paid.
      const { deps, stripeRec } = buildDeps({
        supabase: {
          subscriptionRow: {
            status: "past_due",
            cadence: "monthly",
            current_period_end: "2026-05-15T00:00:00.000Z",
            cancel_at_period_end: false,
          },
        },
      });
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "monthly",
      });
      expect(result).toEqual({ ok: false, status: 409, error: "already_subscribed" });
      expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    });

    it("blocks Checkout when active but pending cancel at period end (still paid)", async () => {
      const { deps, stripeRec } = buildDeps({
        supabase: {
          subscriptionRow: {
            status: "active",
            cadence: "monthly",
            current_period_end: FUTURE_ISO,
            cancel_at_period_end: true,
          },
        },
      });
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "annual",
      });
      expect(result).toEqual({ ok: false, status: 409, error: "already_subscribed" });
      expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    });

    it("allows Checkout when prior subscription is canceled and lapsed", async () => {
      const { deps, stripeRec } = buildDeps({
        supabase: {
          existingCustomerId: "cus_existing_999",
          subscriptionRow: {
            status: "canceled",
            cadence: "monthly",
            current_period_end: PAST_ISO,
            cancel_at_period_end: false,
          },
        },
      });
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "monthly",
      });
      expect(result.ok).toBe(true);
      expect(stripeRec.sessionCreate).toHaveBeenCalled();
    });

    it("allows Checkout when the user has never had a subscription", async () => {
      const { deps, stripeRec } = buildDeps();
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "monthly",
      });
      expect(result.ok).toBe(true);
      expect(stripeRec.sessionCreate).toHaveBeenCalled();
    });

    it("fails closed with 500 when billing_subscriptions read errors", async () => {
      const { deps, stripeRec } = buildDeps({
        supabase: { subscriptionSelectError: { message: "db down" } },
      });
      const result = await createCheckoutSession(deps, {
        userId: USER_ID,
        userEmail: USER_EMAIL,
        cadence: "monthly",
      });
      expect(result).toEqual({ ok: false, status: 500, error: "internal_error" });
      expect(stripeRec.customerCreate).not.toHaveBeenCalled();
      expect(stripeRec.sessionCreate).not.toHaveBeenCalled();
    });
  });
});
