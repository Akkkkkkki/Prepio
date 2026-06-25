import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Navigation from "../Navigation";

const mockSignOut = vi.fn();
const mockCanInstall = vi.fn();
const mockPromptInstall = vi.fn();
const mockGetSearchHistory = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuthContext: () => ({
    user: { id: "user-1", email: "test@example.com" },
    signOut: mockSignOut,
  }),
}));

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({
    canInstall: mockCanInstall(),
    promptInstall: mockPromptInstall,
  }),
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    getSearchHistory: (...args: unknown[]) => mockGetSearchHistory(...args),
  },
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
    mockCanInstall.mockReturnValue(false);
  });

  it("renders all navigation links", () => {
    renderNavigation();

    expect(screen.getByText("Prepio")).toBeInTheDocument();
    const homeLinks = screen.getAllByText("Home");
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Practice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Practice History").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
  });

  it("highlights the active route", () => {
    renderNavigation("/dashboard");

    const dashboardLinks = screen.getAllByText("Dashboard");
    const desktopLink = dashboardLinks.find((el) =>
      el.closest("a")?.classList.contains("bg-primary"),
    );
    expect(desktopLink).toBeTruthy();
  });

  it("preserves searchId across navigation links", () => {
    renderNavigation("/dashboard", "?searchId=search-123");

    const practiceLinks = screen.getAllByText("Practice");
    const desktopPracticeLink = practiceLinks.find((el) => el.closest("a"));
    expect(desktopPracticeLink?.closest("a")?.getAttribute("href")).toContain(
      "searchId=search-123",
    );
  });

  it("renders the more-actions dropdown trigger when install is available", async () => {
    mockCanInstall.mockReturnValue(true);

    renderNavigation();

    await waitFor(() => {
      const moreButtons = screen.getAllByRole("button", { name: /More actions/i });
      expect(moreButtons.length).toBeGreaterThan(0);
    });
  });

  it("renders the more-actions dropdown trigger when install is not available", async () => {
    mockCanInstall.mockReturnValue(false);

    renderNavigation();

    await waitFor(() => {
      const moreButtons = screen.getAllByRole("button", { name: /More actions/i });
      expect(moreButtons.length).toBeGreaterThan(0);
    });
  });

  it("does not load search history from the navbar", () => {
    renderNavigation();

    expect(screen.getByText("Prepio")).toBeInTheDocument();
    expect(mockGetSearchHistory).not.toHaveBeenCalled();
  });
});
