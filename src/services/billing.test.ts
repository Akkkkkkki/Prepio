import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { createBillingPortalSession } from "./billing";

describe("createBillingPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the create-portal-session edge function and returns its URL", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { url: "https://billing.stripe.com/p/session/test", sessionId: "bps_123" },
      error: null,
    });

    const result = await createBillingPortalSession();

    expect(result).toEqual({
      success: true,
      url: "https://billing.stripe.com/p/session/test",
      sessionId: "bps_123",
    });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("create-portal-session", {
      body: {},
    });
  });

  it("maps backend error codes from a function response body", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error: "no_billing_customer" }), {
          status: 409,
        }),
      },
    });

    const result = await createBillingPortalSession();

    expect(result).toEqual({
      success: false,
      code: "no_billing_customer",
      message: "No active billing account is linked yet. Start a subscription before using the portal.",
    });
  });

  it("fails closed when the function returns no URL", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { sessionId: "bps_123" },
      error: null,
    });

    const result = await createBillingPortalSession();

    expect(result).toEqual({
      success: false,
      code: "unknown",
      message: "Billing management is temporarily unavailable. Please try again.",
    });
  });

  it("fails closed when the function invoke throws", async () => {
    mockSupabase.functions.invoke.mockRejectedValue(new Error("network down"));

    const result = await createBillingPortalSession();

    expect(result).toEqual({
      success: false,
      code: "unknown",
      message: "Billing management is temporarily unavailable. Please try again.",
    });
  });
});
