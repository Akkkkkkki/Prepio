import { supabase } from "@/integrations/supabase/client";
import {
  FREE_ENTITLEMENT,
  resolveEntitlement,
  type Entitlement,
  type SubscriptionRow,
} from "@/shared/entitlement-rules";

export type { Entitlement } from "@/shared/entitlement-rules";

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("status, cadence, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[entitlements] read failed", error);
    return FREE_ENTITLEMENT;
  }

  return resolveEntitlement((data as SubscriptionRow | null) ?? null);
}
