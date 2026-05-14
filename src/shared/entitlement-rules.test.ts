import { describe, expect, it } from "vitest";
import {
  FREE_ENTITLEMENT,
  PAST_DUE_GRACE_DAYS,
  resolveEntitlement,
  type SubscriptionRow,
} from "./entitlement-rules";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-05-14T12:00:00.000Z");

const row = (overrides: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  status: "active",
  cadence: "monthly",
  current_period_end: new Date(NOW.getTime() + 30 * MS_PER_DAY).toISOString(),
  cancel_at_period_end: false,
  ...overrides,
});

describe("resolveEntitlement", () => {
  it("returns FREE_ENTITLEMENT for a null row", () => {
    expect(resolveEntitlement(null, NOW)).toEqual(FREE_ENTITLEMENT);
  });

  it("treats active with future period_end as paid", () => {
    const ent = resolveEntitlement(row({ status: "active" }), NOW);
    expect(ent.tier).toBe("paid");
    expect(ent.cadence).toBe("monthly");
    expect(ent.status).toBe("active");
  });

  it("downgrades active to free once period_end has passed", () => {
    const past = new Date(NOW.getTime() - MS_PER_DAY).toISOString();
    const ent = resolveEntitlement(row({ status: "active", current_period_end: past }), NOW);
    expect(ent.tier).toBe("free");
    expect(ent.cadence).toBeNull();
    expect(ent.status).toBe("active");
  });

  it("treats trialing with future period_end as paid", () => {
    const ent = resolveEntitlement(row({ status: "trialing" }), NOW);
    expect(ent.tier).toBe("paid");
    expect(ent.status).toBe("active");
  });

  it("treats past_due within grace as paid", () => {
    const sixDaysAgo = new Date(NOW.getTime() - 6 * MS_PER_DAY).toISOString();
    const ent = resolveEntitlement(
      row({ status: "past_due", current_period_end: sixDaysAgo }),
      NOW,
    );
    expect(ent.tier).toBe("paid");
    expect(ent.status).toBe("past_due");
    expect(ent.cadence).toBe("monthly");
  });

  it("treats past_due beyond grace as free", () => {
    const beyond = new Date(
      NOW.getTime() - (PAST_DUE_GRACE_DAYS + 1) * MS_PER_DAY,
    ).toISOString();
    const ent = resolveEntitlement(
      row({ status: "past_due", current_period_end: beyond }),
      NOW,
    );
    expect(ent.tier).toBe("free");
    expect(ent.cadence).toBeNull();
    expect(ent.status).toBe("past_due");
  });

  it("treats canceled as free regardless of period_end", () => {
    const ent = resolveEntitlement(row({ status: "canceled" }), NOW);
    expect(ent.tier).toBe("free");
    expect(ent.status).toBe("canceled");
    expect(ent.cadence).toBeNull();
  });

  it("treats incomplete as free with status 'none'", () => {
    const ent = resolveEntitlement(row({ status: "incomplete" }), NOW);
    expect(ent.tier).toBe("free");
    expect(ent.status).toBe("none");
  });

  it("treats paused as free with status 'none'", () => {
    const ent = resolveEntitlement(row({ status: "paused" }), NOW);
    expect(ent.tier).toBe("free");
    expect(ent.status).toBe("none");
    expect(ent.cadence).toBeNull();
  });

  it("never surfaces cadence when free", () => {
    const past = new Date(NOW.getTime() - MS_PER_DAY).toISOString();
    const cases: SubscriptionRow[] = [
      row({ status: "active", current_period_end: past }),
      row({ status: "canceled" }),
      row({ status: "incomplete" }),
      row({ status: "paused" }),
      row({ status: "unpaid" }),
    ];
    for (const r of cases) {
      expect(resolveEntitlement(r, NOW).cadence).toBeNull();
    }
  });

  it("normalises an unknown cadence value to null", () => {
    const ent = resolveEntitlement(row({ cadence: "weekly" as unknown as string }), NOW);
    expect(ent.tier).toBe("paid");
    expect(ent.cadence).toBeNull();
  });
});
