// Pure mapping between Prepio's cadence enum and Stripe Price IDs.
// Kept dependency-free so it can be unit-tested without the Stripe SDK or Deno.

export type Cadence = "monthly" | "quarterly" | "annual";

export const CADENCES: readonly Cadence[] = ["monthly", "quarterly", "annual"] as const;

export interface CadenceLookup {
  monthly: string;
  quarterly: string;
  annual: string;
}

export function cadenceFromPriceId(
  priceId: string,
  lookup: CadenceLookup,
): Cadence | null {
  if (priceId && priceId === lookup.monthly) return "monthly";
  if (priceId && priceId === lookup.quarterly) return "quarterly";
  if (priceId && priceId === lookup.annual) return "annual";
  return null;
}

export function isCadence(value: unknown): value is Cadence {
  return value === "monthly" || value === "quarterly" || value === "annual";
}
