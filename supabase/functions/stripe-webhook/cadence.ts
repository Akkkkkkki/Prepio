// Pure mapping from a Stripe Price ID to our cadence enum.
// Kept separate so it can be unit-tested without the Stripe SDK or Deno.

export type Cadence = "monthly" | "quarterly" | "annual";

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
