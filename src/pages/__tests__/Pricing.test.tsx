import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Pricing from "../Pricing";
import { BillingError } from "@/services/billing";
import { FREE_ENTITLEMENT, type Entitlement } from "@/shared/entitlement-rules";

const mockUseAuthContext = vi.fn();
const mockGetEntitlement = vi.fn();
const mockCreateCheckoutSession = vi.fn();
const mockCreatePortalSession = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/services/entitlements", () => ({
  getEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
}));

vi.mock("@/services/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/billing")>();
  return {
    ...actual,
    createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
    createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args),
  };
});

const paidEntitlement: Entitlement = {
  tier: "paid",
  cadence: "annual",
  currentPeriodEnd: "2026-12-31T00:00:00.000Z",
  status: "active",
};

const AuthTarget = () => {
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string; search?: string } } | undefined;
  return (
    <div>
      Auth target {state?.from?.pathname}
      {state?.from?.search}
    </div>
  );
};

const renderPricing = (initialEntry = "/pricing") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth" element={<AuthTarget />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ user: null, loading: false });
    mockGetEntitlement.mockResolvedValue(FREE_ENTITLEMENT);
    mockCreateCheckoutSession.mockReturnValue(new Promise(() => {}));
    mockCreatePortalSession.mockReturnValue(new Promise(() => {}));
  });

  it("renders the three cadences with annual featured and honest free/paid copy", () => {
    renderPricing();

    expect(screen.getByRole("heading", { name: "Monthly" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quarterly" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Annual" })).toBeInTheDocument();
    expect(screen.getByText("Best value")).toBeInTheDocument();
    expect(screen.getByText("About 70% off rolling monthly")).toBeInTheDocument();
    expect(
      screen.getByText(/Research, prep plans, and practice stay free/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("AI feedback on saved practice answers")).toHaveLength(3);
  });

  it("sends logged-out users through auth and back to selected Checkout cadence", () => {
    renderPricing();

    fireEvent.click(screen.getByRole("button", { name: /Choose annual/i }));

    expect(screen.getByText("Auth target /pricing?checkout=annual")).toBeInTheDocument();
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("starts Checkout automatically when a signed-in free user returns from auth", async () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    });
    mockGetEntitlement.mockResolvedValue(FREE_ENTITLEMENT);

    renderPricing("/pricing?checkout=annual");

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith("annual");
    });
  });

  it("routes a signed-in subscriber with a checkout return param to Customer Portal", async () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    });
    mockGetEntitlement.mockResolvedValue(paidEntitlement);

    renderPricing("/pricing?checkout=annual");

    await waitFor(() => {
      expect(mockCreatePortalSession).toHaveBeenCalled();
    });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("surfaces pending Checkout conflicts without blaming the user", async () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    });
    mockGetEntitlement.mockResolvedValue(FREE_ENTITLEMENT);
    mockCreateCheckoutSession.mockRejectedValue(new BillingError("pending_checkout", "conflict", 409));

    renderPricing();

    fireEvent.click(await screen.findByRole("button", { name: /Choose annual/i }));

    expect(
      await screen.findByText(/You already have a checkout in progress/i),
    ).toBeInTheDocument();
  });

  it("shows Customer Portal management for existing subscribers", async () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    });
    mockGetEntitlement.mockResolvedValue(paidEntitlement);

    renderPricing();

    expect(await screen.findByText("Your annual subscription is active.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Manage subscription/i })[0]);

    await waitFor(() => {
      expect(mockCreatePortalSession).toHaveBeenCalled();
    });
  });
});
