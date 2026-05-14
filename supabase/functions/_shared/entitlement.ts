import {
  FREE_ENTITLEMENT,
  resolveEntitlement,
  type Entitlement,
  type SubscriptionRow,
} from "./entitlement-rules.ts";

export {
  FREE_ENTITLEMENT,
  resolveEntitlement,
  PAST_DUE_GRACE_DAYS,
} from "./entitlement-rules.ts";
export type {
  Entitlement,
  EntitlementStatus,
  EntitlementTier,
  Cadence,
} from "./entitlement-rules.ts";

interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export async function getEntitlement(
  supabase: SupabaseLike,
  userId: string,
): Promise<Entitlement> {
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("status, cadence, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[entitlement] read failed", error);
    return FREE_ENTITLEMENT;
  }

  return resolveEntitlement((data as SubscriptionRow | null) ?? null);
}
