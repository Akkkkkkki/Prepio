import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { getEntitlement } from "./entitlements";
import { FREE_ENTITLEMENT } from "@/shared/entitlement-rules";

const chain = <T,>(result: { data: T; error: unknown }) => {
  const c: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    maybeSingle: vi.fn(async () => result),
  };
  return c;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("getEntitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns FREE_ENTITLEMENT when no subscription row exists", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const ent = await getEntitlement("user-123");

    expect(ent).toEqual(FREE_ENTITLEMENT);
    expect(mockSupabase.from).toHaveBeenCalledWith("billing_subscriptions");
  });

  it("returns paid entitlement when an active row is present", async () => {
    const future = new Date(Date.now() + 30 * MS_PER_DAY).toISOString();
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          status: "active",
          cadence: "monthly",
          current_period_end: future,
          cancel_at_period_end: false,
        },
        error: null,
      }),
    );

    const ent = await getEntitlement("user-123");

    expect(ent.tier).toBe("paid");
    expect(ent.cadence).toBe("monthly");
    expect(ent.status).toBe("active");
    expect(ent.cancelAtPeriodEnd).toBe(false);
  });

  it("exposes cancel_at_period_end for active paid subscriptions", async () => {
    const future = new Date(Date.now() + 30 * MS_PER_DAY).toISOString();
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          status: "active",
          cadence: "annual",
          current_period_end: future,
          cancel_at_period_end: true,
        },
        error: null,
      }),
    );

    const ent = await getEntitlement("user-123");

    expect(ent.tier).toBe("paid");
    expect(ent.cadence).toBe("annual");
    expect(ent.cancelAtPeriodEnd).toBe(true);
  });

  it("filters by user_id", async () => {
    const c = chain({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(c);

    await getEntitlement("user-xyz");

    expect(c.eq).toHaveBeenCalledWith("user_id", "user-xyz");
  });

  it("fails closed to FREE_ENTITLEMENT on a query error", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: null, error: { message: "boom" } }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ent = await getEntitlement("user-123");

    expect(ent).toEqual(FREE_ENTITLEMENT);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
