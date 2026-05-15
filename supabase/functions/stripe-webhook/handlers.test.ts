import { beforeEach, describe, expect, it, vi } from "vitest";
import { cadenceFromPriceId, type CadenceLookup } from "./cadence.ts";
import {
  processEvent,
  type Deps,
  type SubscriptionPayload,
  type SupabaseError,
  type SupabaseLike,
  type WebhookEvent,
} from "./handlers.ts";

const LOOKUP: CadenceLookup = {
  monthly: "price_monthly_test",
  quarterly: "price_quarterly_test",
  annual: "price_annual_test",
};

const FUTURE_UNIX = Math.floor(new Date("2026-12-31T00:00:00Z").getTime() / 1000);

function buildSubscriptionEvent(
  type: "created" | "updated" | "deleted",
  overrides: Partial<SubscriptionPayload> = {},
): WebhookEvent {
  const sub: SubscriptionPayload = {
    id: "sub_test_123",
    status: "active",
    customer: "cus_test_abc",
    current_period_end: FUTURE_UNIX,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: LOOKUP.monthly } }] },
    ...overrides,
  };
  return {
    id: `evt_${type}_1`,
    type: `customer.subscription.${type}`,
    data: { object: sub },
  };
}

function buildInvoiceEvent(overrides: { subscription?: string | null } = {}): WebhookEvent {
  const subscription = "subscription" in overrides ? overrides.subscription : "sub_test_123";
  return {
    id: "evt_invoice_failed_1",
    type: "invoice.payment_failed",
    data: {
      object: {
        id: "in_test_1",
        customer: "cus_test_abc",
        subscription: subscription ?? null,
      },
    },
  };
}

interface Recorded {
  table: string;
  op: "insert" | "upsert" | "update";
  payload: Record<string, unknown>;
  filter?: { col: string; val: string };
}

interface FakeOptions {
  // If an insert into this table is attempted with a value already seen for
  // `dedupeKey`, return a unique-violation error.
  uniqueInsert?: { table: string; dedupeKey: string };
  // Force errors keyed by `${table}:${op}`.
  errors?: Record<string, SupabaseError>;
}

function buildFakeSupabase(opts: FakeOptions = {}) {
  const calls: Recorded[] = [];
  const seenKeys = new Set<string>();

  const supabase: SupabaseLike = {
    from(table) {
      return {
        async insert(row) {
          calls.push({ table, op: "insert", payload: row });
          const forced = opts.errors?.[`${table}:insert`];
          if (forced) return { error: forced };
          if (opts.uniqueInsert?.table === table) {
            const key = String(row[opts.uniqueInsert.dedupeKey]);
            if (seenKeys.has(key)) return { error: { code: "23505", message: "duplicate" } };
            seenKeys.add(key);
          }
          return { error: null };
        },
        async upsert(row, _opts) {
          calls.push({ table, op: "upsert", payload: row });
          const forced = opts.errors?.[`${table}:upsert`];
          return { error: forced ?? null };
        },
        update(row) {
          return {
            async eq(col, val) {
              calls.push({ table, op: "update", payload: row, filter: { col, val } });
              const forced = opts.errors?.[`${table}:update`];
              return { error: forced ?? null };
            },
          };
        },
      };
    },
  };

  return { supabase, calls };
}

function buildDeps(
  overrides: Partial<Deps> & { supabase?: SupabaseLike; calls?: Recorded[] } = {},
): { deps: Deps; calls: Recorded[]; logs: Array<{ event: string; fields?: Record<string, unknown> }> } {
  const fake = overrides.supabase
    ? { supabase: overrides.supabase, calls: overrides.calls ?? [] }
    : buildFakeSupabase();
  const logs: Array<{ event: string; fields?: Record<string, unknown> }> = [];
  const deps: Deps = {
    supabase: fake.supabase,
    cadenceLookup: LOOKUP,
    resolveUserId: vi.fn(async (cus: string) => (cus === "cus_test_abc" ? "user_xyz" : null)),
    log: (event, fields) => logs.push({ event, fields }),
    now: () => new Date("2026-05-15T00:00:00.000Z"),
    ...overrides,
  };
  return { deps, calls: fake.calls, logs };
}

describe("cadenceFromPriceId", () => {
  it("maps each known price to its cadence", () => {
    expect(cadenceFromPriceId(LOOKUP.monthly, LOOKUP)).toBe("monthly");
    expect(cadenceFromPriceId(LOOKUP.quarterly, LOOKUP)).toBe("quarterly");
    expect(cadenceFromPriceId(LOOKUP.annual, LOOKUP)).toBe("annual");
  });

  it("returns null for an unknown or empty price id", () => {
    expect(cadenceFromPriceId("price_unknown", LOOKUP)).toBeNull();
    expect(cadenceFromPriceId("", LOOKUP)).toBeNull();
  });
});

describe("processEvent — idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("processes a fresh event and applies the subscription upsert", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    const result = await processEvent(deps, buildSubscriptionEvent("created"));

    expect(result).toEqual({ outcome: "applied" });
    expect(fake.calls.filter((c) => c.table === "billing_events" && c.op === "insert")).toHaveLength(1);
    expect(fake.calls.filter((c) => c.table === "billing_subscriptions" && c.op === "upsert")).toHaveLength(1);
    expect(logs.find((l) => l.event === "stripe_event_applied")).toBeDefined();
  });

  it("returns duplicate without re-applying on second delivery of the same event id", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });
    const event = buildSubscriptionEvent("updated");

    const first = await processEvent(deps, event);
    const second = await processEvent(deps, event);

    expect(first.outcome).toBe("applied");
    expect(second.outcome).toBe("duplicate");
    expect(fake.calls.filter((c) => c.table === "billing_subscriptions").length).toBe(1);
    expect(logs.some((l) => l.event === "stripe_event_duplicate")).toBe(true);
  });

  it("throws on a non-unique billing_events insert error so Stripe retries", async () => {
    const fake = buildFakeSupabase({
      errors: { "billing_events:insert": { code: "08006", message: "connection lost" } },
    });
    const { deps } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    await expect(processEvent(deps, buildSubscriptionEvent("created"))).rejects.toThrow(
      /billing_events insert failed/,
    );
    expect(fake.calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
  });
});

describe("processEvent — subscription dispatch", () => {
  it("subscription.updated upserts with the resolved cadence and ISO timestamps", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps } = buildDeps({ supabase: fake.supabase, calls: fake.calls });
    const event = buildSubscriptionEvent("updated", {
      items: { data: [{ price: { id: LOOKUP.quarterly } }] },
      status: "active",
      cancel_at_period_end: true,
    });

    await processEvent(deps, event);

    const upsert = fake.calls.find((c) => c.table === "billing_subscriptions" && c.op === "upsert");
    expect(upsert?.payload).toMatchObject({
      user_id: "user_xyz",
      stripe_subscription_id: "sub_test_123",
      status: "active",
      cadence: "quarterly",
      cancel_at_period_end: true,
    });
    expect(upsert?.payload.current_period_end).toBe(new Date(FUTURE_UNIX * 1000).toISOString());
  });

  it("subscription.deleted flips status to canceled and keeps the row", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    await processEvent(deps, buildSubscriptionEvent("deleted"));

    const update = fake.calls.find((c) => c.table === "billing_subscriptions" && c.op === "update");
    expect(update?.payload.status).toBe("canceled");
    expect(update?.filter).toEqual({ col: "user_id", val: "user_xyz" });
  });

  it("skips with reason=unknown_price when the Stripe price id is not configured", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });
    const event = buildSubscriptionEvent("created", {
      items: { data: [{ price: { id: "price_legacy" } }] },
    });

    const result = await processEvent(deps, event);

    expect(result).toEqual({ outcome: "skipped", reason: "unknown_price" });
    expect(fake.calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_unknown_price")).toBe(true);
  });

  it("skips with reason=user_unresolved when the Stripe customer is unknown", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps, logs } = buildDeps({
      supabase: fake.supabase,
      calls: fake.calls,
      resolveUserId: async () => null,
    });

    const result = await processEvent(deps, buildSubscriptionEvent("created"));

    expect(result).toEqual({ outcome: "skipped", reason: "user_unresolved" });
    expect(fake.calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_user_unresolved")).toBe(true);
  });
});

describe("processEvent — invoice.payment_failed", () => {
  it("flips status to past_due and logs the deferred notification", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    const result = await processEvent(deps, buildInvoiceEvent());

    expect(result.outcome).toBe("applied");
    const update = fake.calls.find((c) => c.table === "billing_subscriptions" && c.op === "update");
    expect(update?.payload.status).toBe("past_due");
    expect(logs.some((l) => l.event === "payment_failed_notification_deferred")).toBe(true);
  });

  it("ignores one-off invoices without a subscription", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    const result = await processEvent(deps, buildInvoiceEvent({ subscription: null }));

    expect(result.outcome).toBe("ignored");
    expect(fake.calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
  });
});

describe("processEvent — unknown event types", () => {
  it("logs and returns ignored for event types we do not handle", async () => {
    const fake = buildFakeSupabase({ uniqueInsert: { table: "billing_events", dedupeKey: "stripe_event_id" } });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });
    const event: WebhookEvent = {
      id: "evt_unknown_1",
      type: "customer.created",
      data: { object: {} },
    };

    const result = await processEvent(deps, event);

    expect(result.outcome).toBe("ignored");
    expect(fake.calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_event_ignored")).toBe(true);
  });
});
