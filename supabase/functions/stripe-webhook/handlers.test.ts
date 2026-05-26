import { beforeEach, describe, expect, it, vi } from "vitest";
import { cadenceFromPriceId, type CadenceLookup } from "./cadence.ts";
import {
  getSubscriptionIdFromInvoice,
  processEvent,
  type Deps,
  type InvoicePayload,
  type SelectBuilder,
  type SubscriptionPayload,
  type SupabaseError,
  type SupabaseLike,
  type UpdateBuilder,
  type WebhookEvent,
} from "./handlers.ts";

const LOOKUP: CadenceLookup = {
  monthly: "price_monthly_test",
  quarterly: "price_quarterly_test",
  annual: "price_annual_test",
};

const FUTURE_UNIX = Math.floor(new Date("2026-12-31T00:00:00Z").getTime() / 1000);
const NOW = new Date("2026-05-15T00:00:00.000Z");
// Default event.created = 2026-05-14T12:00:00Z, in seconds.
const DEFAULT_EVENT_CREATED = Math.floor(new Date("2026-05-14T12:00:00Z").getTime() / 1000);

function buildSubscriptionEvent(
  type: "created" | "updated" | "deleted",
  subOverrides: Partial<SubscriptionPayload> = {},
  eventOverrides: { id?: string; created?: number } = {},
): WebhookEvent {
  const sub: SubscriptionPayload = {
    id: "sub_test_123",
    status: "active",
    customer: "cus_test_abc",
    current_period_end: FUTURE_UNIX,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: LOOKUP.monthly } }] },
    ...subOverrides,
  };
  return {
    id: eventOverrides.id ?? `evt_${type}_1`,
    type: `customer.subscription.${type}`,
    created: eventOverrides.created ?? DEFAULT_EVENT_CREATED,
    data: { object: sub },
  };
}

function buildInvoiceEvent(
  overrides: { subscription?: string | null; parentSubscription?: string | null } = {},
  eventOverrides: { id?: string; created?: number } = {},
): WebhookEvent {
  const invoice: InvoicePayload = {
    id: "in_test_1",
    customer: "cus_test_abc",
    subscription: "subscription" in overrides ? overrides.subscription : "sub_test_123",
  };
  if ("parentSubscription" in overrides) {
    invoice.parent = {
      type: "subscription_details",
      subscription_details: { subscription: overrides.parentSubscription },
    };
  }
  return {
    id: eventOverrides.id ?? "evt_invoice_failed_1",
    type: "invoice.payment_failed",
    created: eventOverrides.created ?? DEFAULT_EVENT_CREATED,
    data: { object: invoice },
  };
}

interface Recorded {
  table?: string;
  rpc?: string;
  op: "select" | "insert" | "update" | "rpc";
  payload: Record<string, unknown>;
  filters?: Array<{ col: string; op: "eq" | "lt"; val: string }>;
}

interface FakeOptions {
  // Seed pre-existing rows. Lookups via .select().eq("col", val).maybeSingle()
  // match against these.
  selectRows?: Record<string, Array<Record<string, unknown>>>;
  // Force errors keyed by `${table}:${op}` or `rpc:${fn}`.
  errors?: Record<string, SupabaseError>;
  // Force the rpc result, keyed by fn name.
  rpcResults?: Record<string, unknown>;
}

function buildFakeSupabase(opts: FakeOptions = {}) {
  const calls: Recorded[] = [];
  const insertedKeys: Record<string, Set<string>> = {};

  const supabase: SupabaseLike = {
    rpc: async (fn, args) => {
      calls.push({ rpc: fn, op: "rpc", payload: args });
      const forced = opts.errors?.[`rpc:${fn}`];
      if (forced) return { data: null, error: forced };
      const result = opts.rpcResults?.[fn] ?? true;
      return { data: result, error: null };
    },
    from(table) {
      return {
        select<T>(_columns: string): SelectBuilder<T> {
          const eqs: Array<{ col: string; val: string }> = [];
          const builder: SelectBuilder<T> = {
            eq(col, val) {
              eqs.push({ col, val });
              return builder;
            },
            async maybeSingle() {
              calls.push({
                table,
                op: "select",
                payload: {},
                filters: eqs.map((e) => ({ ...e, op: "eq" as const })),
              });
              const forced = opts.errors?.[`${table}:select`];
              if (forced) return { data: null, error: forced };
              const rows = opts.selectRows?.[table] ?? [];
              const found = rows.find((row) => eqs.every((e) => row[e.col] === e.val));
              return { data: (found as T | undefined) ?? null, error: null };
            },
          };
          return builder;
        },
        async insert(row) {
          calls.push({ table, op: "insert", payload: row });
          const forced = opts.errors?.[`${table}:insert`];
          if (forced) return { error: forced };
          if (table === "billing_events") {
            const id = String(row.stripe_event_id);
            const seen = (insertedKeys[table] ??= new Set());
            if (seen.has(id)) return { error: { code: "23505", message: "duplicate" } };
            seen.add(id);
          }
          return { error: null };
        },
        update(row) {
          const filters: Array<{ col: string; op: "eq" | "lt"; val: string }> = [];
          const exec = async () => {
            calls.push({ table, op: "update", payload: row, filters });
            const forced = opts.errors?.[`${table}:update`];
            return { error: forced ?? null };
          };
          const builder: UpdateBuilder = {
            eq(col, val) {
              filters.push({ col, op: "eq", val });
              return builder;
            },
            lt(col, val) {
              filters.push({ col, op: "lt", val });
              return builder;
            },
            then(onFulfilled, onRejected) {
              return exec().then(onFulfilled, onRejected);
            },
          };
          return builder;
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
    now: () => NOW,
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

describe("getSubscriptionIdFromInvoice", () => {
  it("prefers invoice.parent.subscription_details.subscription (API >= 2025-03-31.basil)", () => {
    const invoice: InvoicePayload = {
      id: "in_1",
      customer: "cus_1",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_new" } },
      subscription: null,
    };
    expect(getSubscriptionIdFromInvoice(invoice)).toBe("sub_new");
  });

  it("falls back to invoice.subscription on older API versions", () => {
    const invoice: InvoicePayload = { id: "in_1", customer: "cus_1", subscription: "sub_old" };
    expect(getSubscriptionIdFromInvoice(invoice)).toBe("sub_old");
  });

  it("returns null for a true one-off invoice", () => {
    const invoice: InvoicePayload = { id: "in_1", customer: "cus_1", subscription: null };
    expect(getSubscriptionIdFromInvoice(invoice)).toBeNull();
  });
});

describe("processEvent — idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies a fresh event then records billing_events", async () => {
    const { deps, calls, logs } = buildDeps();

    const result = await processEvent(deps, buildSubscriptionEvent("created"));

    expect(result).toEqual({ outcome: "applied" });
    // Pre-check first, then RPC (mutation), then event log.
    const ops = calls.map((c) => `${c.table ?? c.rpc}:${c.op}`);
    expect(ops).toEqual([
      "billing_events:select",
      "apply_subscription_event:rpc",
      "billing_events:insert",
    ]);
    expect(logs.find((l) => l.event === "stripe_event_applied")).toBeDefined();
  });

  it("returns duplicate via the pre-check and does not re-run the mutation", async () => {
    const fake = buildFakeSupabase({
      selectRows: {
        billing_events: [{ stripe_event_id: "evt_updated_1" }],
      },
    });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    const result = await processEvent(deps, buildSubscriptionEvent("updated"));

    expect(result.outcome).toBe("duplicate");
    expect(fake.calls.some((c) => c.op === "rpc")).toBe(false);
    expect(fake.calls.some((c) => c.table === "billing_events" && c.op === "insert")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_event_duplicate")).toBe(true);
  });

  it("does NOT mark the event processed if the mutation throws — Stripe must be able to retry", async () => {
    const fake = buildFakeSupabase({
      errors: { "rpc:apply_subscription_event": { code: "08006", message: "connection lost" } },
    });
    const { deps } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    await expect(processEvent(deps, buildSubscriptionEvent("created"))).rejects.toThrow(
      /apply_subscription_event failed/,
    );

    expect(fake.calls.some((c) => c.table === "billing_events" && c.op === "insert")).toBe(false);
  });

  it("does not log billing_events for skipped events so a config fix + resend can apply them", async () => {
    const fake = buildFakeSupabase();
    const { deps } = buildDeps({
      supabase: fake.supabase,
      calls: fake.calls,
      resolveUserId: async () => null,
    });

    await processEvent(deps, buildSubscriptionEvent("created"));

    expect(fake.calls.some((c) => c.table === "billing_events" && c.op === "insert")).toBe(false);
  });
});

describe("processEvent — subscription dispatch + ordering guard", () => {
  it("subscription.updated calls apply_subscription_event with the event timestamp", async () => {
    const { deps, calls } = buildDeps();
    const event = buildSubscriptionEvent("updated", {
      items: { data: [{ price: { id: LOOKUP.quarterly } }] },
      status: "active",
      cancel_at_period_end: true,
    });

    await processEvent(deps, event);

    const rpc = calls.find((c) => c.rpc === "apply_subscription_event");
    expect(rpc?.payload).toMatchObject({
      p_user_id: "user_xyz",
      p_stripe_subscription_id: "sub_test_123",
      p_status: "active",
      p_cadence: "quarterly",
      p_cancel_at_period_end: true,
    });
    expect(rpc?.payload.p_current_period_end).toBe(new Date(FUTURE_UNIX * 1000).toISOString());
    expect(rpc?.payload.p_event_created).toBe(new Date(DEFAULT_EVENT_CREATED * 1000).toISOString());
  });

  it("when the RPC reports the event as stale, returns skipped:stale_event and does not log", async () => {
    // RPC returns false when last_event_created on the row is >= the new event.
    const fake = buildFakeSupabase({ rpcResults: { apply_subscription_event: false } });
    const { deps, logs } = buildDeps({ supabase: fake.supabase, calls: fake.calls });

    const result = await processEvent(deps, buildSubscriptionEvent("updated"));

    expect(result).toEqual({ outcome: "skipped", reason: "stale_event" });
    expect(fake.calls.some((c) => c.table === "billing_events" && c.op === "insert")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_event_stale")).toBe(true);
  });

  it("subscription.deleted scopes the update by user_id, stripe_subscription_id, AND last_event_created<event.created", async () => {
    // Regression: cancellation must NOT use the upsert RPC (which scopes only
    // by user_id and would silently overwrite an unrelated active row when a
    // late event for an old subscription arrives with a newer event.created).
    const { deps, calls } = buildDeps();
    const event = buildSubscriptionEvent("deleted");

    await processEvent(deps, event);

    expect(calls.some((c) => c.rpc === "apply_subscription_event")).toBe(false);
    const update = calls.find((c) => c.table === "billing_subscriptions" && c.op === "update");
    expect(update?.payload.status).toBe("canceled");
    expect(update?.payload.last_event_created).toBe(
      new Date(DEFAULT_EVENT_CREATED * 1000).toISOString(),
    );
    expect(update?.filters).toEqual([
      { col: "user_id", op: "eq", val: "user_xyz" },
      { col: "stripe_subscription_id", op: "eq", val: "sub_test_123" },
      {
        col: "last_event_created",
        op: "lt",
        val: new Date(DEFAULT_EVENT_CREATED * 1000).toISOString(),
      },
    ]);
  });

  it("subscription.deleted for an out-of-date sub_id does not overwrite the active row tracked under a different sub_id", async () => {
    // Concrete scenario: user previously had sub_A which we marked canceled,
    // then started sub_B which is now the user's active subscription. A
    // Stripe-emitted customer.subscription.deleted for sub_A — or a delayed
    // re-delivery whose event.created is newer than the row's
    // last_event_created — must be a no-op. The .eq("stripe_subscription_id")
    // filter is what enforces that; the previous RPC-based implementation only
    // checked the timestamp and would have silently downgraded sub_B.
    const { deps, calls } = buildDeps();
    const event = buildSubscriptionEvent(
      "deleted",
      { id: "sub_A_old", items: { data: [{ price: { id: LOOKUP.monthly } }] } },
      { created: DEFAULT_EVENT_CREATED + 3600 },
    );

    const result = await processEvent(deps, event);

    expect(result.outcome).toBe("applied");
    const update = calls.find((c) => c.table === "billing_subscriptions" && c.op === "update");
    // The recorded filter scopes the UPDATE so PostgreSQL leaves any row
    // tracking a different stripe_subscription_id (e.g. the active sub_B)
    // untouched, regardless of how new the cancel event is.
    expect(update?.filters).toContainEqual({
      col: "stripe_subscription_id",
      op: "eq",
      val: "sub_A_old",
    });
  });

  it("skips with reason=unknown_price when the Stripe price id is not configured", async () => {
    const { deps, calls, logs } = buildDeps();
    const event = buildSubscriptionEvent("created", {
      items: { data: [{ price: { id: "price_legacy" } }] },
    });

    const result = await processEvent(deps, event);

    expect(result).toEqual({ outcome: "skipped", reason: "unknown_price" });
    expect(calls.some((c) => c.op === "rpc")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_unknown_price")).toBe(true);
  });

  it("skips with reason=user_unresolved when the Stripe customer is unknown", async () => {
    const { deps, calls, logs } = buildDeps({ resolveUserId: async () => null });

    const result = await processEvent(deps, buildSubscriptionEvent("created"));

    expect(result).toEqual({ outcome: "skipped", reason: "user_unresolved" });
    expect(calls.some((c) => c.op === "rpc")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_user_unresolved")).toBe(true);
  });
});

describe("processEvent — invoice.payment_failed", () => {
  it("reads subscription from invoice.parent.subscription_details.subscription on new API versions", async () => {
    const { deps, calls } = buildDeps();
    const event = buildInvoiceEvent({
      subscription: null,
      parentSubscription: "sub_new_api",
    });

    const result = await processEvent(deps, event);

    expect(result.outcome).toBe("applied");
    const update = calls.find((c) => c.table === "billing_subscriptions" && c.op === "update");
    expect(update?.filters).toEqual([
      { col: "user_id", op: "eq", val: "user_xyz" },
      { col: "stripe_subscription_id", op: "eq", val: "sub_new_api" },
      { col: "last_event_created", op: "lt", val: new Date(DEFAULT_EVENT_CREATED * 1000).toISOString() },
    ]);
  });

  it("falls back to top-level invoice.subscription on legacy API versions", async () => {
    const { deps, calls } = buildDeps();

    const result = await processEvent(deps, buildInvoiceEvent());

    expect(result.outcome).toBe("applied");
    const update = calls.find((c) => c.table === "billing_subscriptions" && c.op === "update");
    expect(update?.payload.status).toBe("past_due");
    expect(update?.filters?.[1]).toEqual({
      col: "stripe_subscription_id",
      op: "eq",
      val: "sub_test_123",
    });
  });

  it("ignores genuine one-off invoices with no subscription on either field", async () => {
    const { deps, calls } = buildDeps();

    const result = await processEvent(
      deps,
      buildInvoiceEvent({ subscription: null, parentSubscription: null }),
    );

    expect(result.outcome).toBe("ignored");
    expect(calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
  });
});

describe("processEvent — unknown event types", () => {
  it("logs and returns ignored for event types we do not handle", async () => {
    const { deps, calls, logs } = buildDeps();
    const event: WebhookEvent = {
      id: "evt_unknown_1",
      type: "customer.created",
      created: DEFAULT_EVENT_CREATED,
      data: { object: {} },
    };

    const result = await processEvent(deps, event);

    expect(result.outcome).toBe("ignored");
    expect(calls.some((c) => c.table === "billing_subscriptions")).toBe(false);
    expect(calls.some((c) => c.table === "billing_events" && c.op === "insert")).toBe(false);
    expect(logs.some((l) => l.event === "stripe_event_ignored")).toBe(true);
  });
});
