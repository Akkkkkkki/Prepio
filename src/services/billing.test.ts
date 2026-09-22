import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, createPortalSession } from "./billing";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
describe("frozen billing", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["monthly", "quarterly", "annual"] as const)("rejects %s checkout without a backend call", async cadence => {
    await expect(createCheckoutSession(cadence)).rejects.toMatchObject({ code: "billing_unavailable" });
    expect(invoke).not.toHaveBeenCalled();
  });
  it("rejects the customer portal without a backend call", async () => {
    await expect(createPortalSession()).rejects.toMatchObject({ code: "billing_unavailable" });
    expect(invoke).not.toHaveBeenCalled();
  });
});
