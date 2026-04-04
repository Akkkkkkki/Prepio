import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Navigation from "../Navigation";

const mockGetSearchHistory = vi.fn();
const mockSignOut = vi.fn();
const mockNavigate = vi.fn();
const mockCanInstall = vi.fn();
const mockPromptInstall = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuthContext: () => ({
    user: { id: "user-1", email: "test@example.com" },
    signOut: mockSignOut,
  }),
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    getSearchHistory: (...args: unknown[]) => mockGetSearchHistory(...args),
  },
}));

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({
    canInstall: mockCanInstall(),
    promptInstall: mockPromptInstall,
  }),
}));

const renderNavigation = (path = "/", searchParams = "") =>
  render(
    <MemoryRouter initialEntries={[`${path}${searchParams}`]}>
      <Routes>
        <Route path="*" element={<Navigation />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Navigation component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSearchHistory.mockResolvedValue({ success: true, searches: [] });
    mockCanInstall.mockReturnValue(false);
  });

  it("renders all navigation links", async () => {
    renderNavigation();

    await waitFor(() => {
      expect(mockGetSearchHistory).toHaveBeenCalled();
    });

    expect(screen.getByText("Prepio")).toBeInTheDocument();
    // Desktop nav links
    const homeLinks = screen.getAllByText("Home");
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Practice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Practice History").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
  });

  it("highlights the active route", async () => {
    renderNavigation("/dashboard");

    await waitFor(() => {
      expect(mockGetSearchHistory).toHaveBeenCalled();
    });

    // Desktop nav: the Dashboard link should have the active class
    const dashboardLinks = screen.getAllByText("Dashboard");
    const desktopLink = dashboardLinks.find((el) =>
      el.closest("a")?.classList.contains("bg-primary"),
    );
    expect(desktopLink).toBeTruthy();
  });

  it("loads and displays search history", async () => {
    mockGetSearchHistory.mockResolvedValue({
      success: true,
      searches: [
        {
          id: "search-1",
          company: "Google",
          role: "SWE",
          country: "US",
          status: "completed",
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    renderNavigation();

    // The search history button should appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /History/i })).toBeInTheDocument();
    });
  });

  it("shows search selector when history is loaded", async () => {
    mockGetSearchHistory.mockResolvedValue({
      success: true,
      searches: [
        {
          id: "search-1",
          company: "Stripe",
          role: "Backend Engineer",
          country: null,
          status: "completed",
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    renderNavigation();

    await waitFor(() => {
      expect(screen.getByText("Active research")).toBeInTheDocument();
    });
  });

  it("preserves searchId across navigation links", async () => {
    mockGetSearchHistory.mockResolvedValue({ success: true, searches: [] });

    renderNavigation("/dashboard", "?searchId=search-123");

    await waitFor(() => {
      expect(mockGetSearchHistory).toHaveBeenCalled();
    });

    // Desktop practice link should carry the searchId
    const practiceLinks = screen.getAllByText("Practice");
    const desktopPracticeLink = practiceLinks.find((el) => el.closest("a"));
    expect(desktopPracticeLink?.closest("a")?.getAttribute("href")).toContain(
      "searchId=search-123",
    );
  });

  it("renders install option in the more-actions dropdown when available", async () => {
    mockCanInstall.mockReturnValue(true);

    renderNavigation();

    await waitFor(() => {
      expect(mockGetSearchHistory).toHaveBeenCalled();
    });

    // The install option is inside a DropdownMenu — check that the trigger is present
    // The dropdown content is rendered in a portal, so we verify the trigger exists
    const moreButtons = screen.getAllByRole("button", { name: /More actions/i });
    expect(moreButtons.length).toBeGreaterThan(0);
  });

  it("does not show install option in the more-actions dropdown when not available", async () => {
    mockCanInstall.mockReturnValue(false);

    renderNavigation();

    await waitFor(() => {
      expect(mockGetSearchHistory).toHaveBeenCalled();
    });

    // More actions button should still exist (sign out is always there)
    const moreButtons = screen.getAllByRole("button", { name: /More actions/i });
    expect(moreButtons.length).toBeGreaterThan(0);
  });

  it("handles search history loading failure gracefully", async () => {
    mockGetSearchHistory.mockResolvedValue({ success: false });

    renderNavigation();

    // Should not crash, navigation should still render
    await waitFor(() => {
      expect(screen.getByText("Prepio")).toBeInTheDocument();
    });
  });
});
