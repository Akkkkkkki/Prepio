// Edge-side mirror of src/shared/entitlement-rules.ts.
// Two copies because the supabase functions runtime (Deno) and the frontend
// (Vite/tsconfig path: src/*) live behind different bundling boundaries.
// Both implement the contract in docs/BILLING.md verbatim.
// Keep these files in lock-step — if you change one, change the other.

export const PAST_DUE_GRACE_DAYS = 7;

export type EntitlementTier = "free" | "paid";
export type Cadence = "monthly" | "quarterly" | "annual";
export type EntitlementStatus = "active" | "past_due" | "canceled" | "none";

export interface Entitlement {
  tier: EntitlementTier;
  cadence: Cadence | null;
  currentPeriodEnd: string | null;
  status: EntitlementStatus;
}

export interface SubscriptionRow {
  status: string;
  cadence: string | null;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export const FREE_ENTITLEMENT: Entitlement = {
  tier: "free",
  cadence: null,
  currentPeriodEnd: null,
  status: "none",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const asCadence = (value: string | null): Cadence | null =>
  value === "monthly" || value === "quarterly" || value === "annual" ? value : null;

export function resolveEntitlement(
  row: SubscriptionRow | null,
  now: Date = new Date(),
): Entitlement {
  if (!row) return FREE_ENTITLEMENT;

  const periodEnd = new Date(row.current_period_end);
  const periodEndMs = periodEnd.getTime();
  const nowMs = now.getTime();
  const currentPeriodEnd = periodEnd.toISOString();
  const cadence = asCadence(row.cadence);

  if (row.status === "active" || row.status === "trialing") {
    const paid = periodEndMs > nowMs;
    return {
      tier: paid ? "paid" : "free",
      cadence: paid ? cadence : null,
      currentPeriodEnd,
      status: "active",
    };
  }

  if (row.status === "past_due") {
    const graceEndMs = periodEndMs + PAST_DUE_GRACE_DAYS * MS_PER_DAY;
    const paid = graceEndMs > nowMs;
    return {
      tier: paid ? "paid" : "free",
      cadence: paid ? cadence : null,
      currentPeriodEnd,
      status: "past_due",
    };
  }

  return {
    tier: "free",
    cadence: null,
    currentPeriodEnd,
    status: row.status === "canceled" ? "canceled" : "none",
  };
}
