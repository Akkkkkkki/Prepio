import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import {
  BillingError,
  createCheckoutSession,
  createPortalSession,
} from "./billing";

describe("billing service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes create-checkout-session with the selected cadence", async () => {
    mockInvoke.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test", sessionId: "cs_test" },
      error: null,
    });

    const result = await createCheckoutSession("annual");

    expect(mockInvoke).toHaveBeenCalledWith("create-checkout-session", {
      body: { cadence: "annual" },
    });
    expect(result).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test",
      sessionId: "cs_test",
    });
  });

  it("preserves edge function error codes from Checkout", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: "FunctionsHttpError",
        context: new Response(JSON.stringify({ error: "pending_checkout" }), { status: 409 }),
      },
    });

    await expect(createCheckoutSession("monthly")).rejects.toMatchObject({
      code: "pending_checkout",
      status: 409,
    });
  });

  it("invokes create-portal-session", async () => {
    mockInvoke.mockResolvedValue({
      data: { url: "https://billing.stripe.com/p/session" },
      error: null,
    });

    const result = await createPortalSession();

    expect(mockInvoke).toHaveBeenCalledWith("create-portal-session", { body: {} });
    expect(result).toEqual({ url: "https://billing.stripe.com/p/session" });
  });

  it("throws invalid_response when a billing function returns no redirect URL", async () => {
    mockInvoke.mockResolvedValue({ data: { sessionId: "cs_test" }, error: null });

    try {
      await createCheckoutSession("quarterly");
      throw new Error("expected createCheckoutSession to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(BillingError);
      expect(error).toMatchObject({ code: "invalid_response" });
    }
  });
});
