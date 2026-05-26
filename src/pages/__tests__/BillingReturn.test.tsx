import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import BillingReturn from "../BillingReturn";
import type { Entitlement } from "@/services/entitlements";

const mockGetEntitlement = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuthContext: () => mockUseAuth(),
}));

vi.mock("@/services/entitlements", () => ({
  getEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
}));

const FREE: Entitlement = {
  tier: "free",
  cadence: null,
  status: "none",
  currentPeriodEnd: null,
};

const PAID: Entitlement = {
  tier: "paid",
  cadence: "monthly",
  status: "active",
  currentPeriodEnd: "2026-12-31T00:00:00.000Z",
};

const renderBillingReturn = (initialEntry = "/billing/return?session_id=cs_test_123") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/billing/return" element={<BillingReturn />} />
      </Routes>
    </MemoryRouter>,
  );

describe("BillingReturn page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("polls entitlement and shows success when the webhook has landed", async () => {
    mockGetEntitlement.mockResolvedValueOnce(FREE).mockResolvedValueOnce(PAID);

    renderBillingReturn();

    expect(screen.getByRole("heading", { name: "Checking your subscription" })).toBeInTheDocument();
    await act(async () => {});
    expect(mockGetEntitlement).toHaveBeenCalledWith("user-1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByRole("heading", { name: "Subscription active" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to practice" })).toHaveAttribute("href", "/practice");
  });

  it("times out to a clear fallback path when entitlement stays free", async () => {
    mockGetEntitlement.mockResolvedValue(FREE);

    renderBillingReturn("/billing/return?session_id=cs_test_123&returnTo=/dashboard");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
    });

    expect(screen.getByText(/Stripe is still processing the update/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to Prepio" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Checkout session cs_test_123")).toBeInTheDocument();
  });

  it("ignores unsafe returnTo values for the fallback link", async () => {
    mockGetEntitlement.mockResolvedValue(FREE);

    renderBillingReturn("/billing/return?returnTo=https://evil.test");

    expect(screen.getByRole("link", { name: "Continue to Prepio" })).toHaveAttribute("href", "/profile");
  });
});
