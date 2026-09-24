import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const mockUseAuthContext = vi.fn();

vi.mock("../components/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuthContext: () => mockUseAuthContext(),
}));

vi.mock("../components/OfflineBanner", () => ({
  default: () => null,
}));

vi.mock("../pages/Auth", () => ({
  default: () => <div>Auth page</div>,
}));

vi.mock("../pages/Home", () => ({
  default: () => <div>Home page</div>,
}));

vi.mock("../pages/Interviews", () => ({
  default: () => <div>Interviews page</div>,
}));

vi.mock("../pages/Dashboard", () => ({
  default: () => <div>Dashboard page</div>,
}));

vi.mock("../pages/Practice", () => ({
  default: () => <div>Practice page</div>,
}));

vi.mock("../pages/History", () => ({
  default: () => <div>History page</div>,
}));

vi.mock("../pages/NotFound", () => ({
  default: () => <div>Not found page</div>,
}));

const renderAt = (path: string) => {
  window.history.pushState(null, "", path);
  return render(<App />);
};

describe("App routing freeze boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthContext.mockReturnValue({
      user: null,
      loading: false,
    });
    window.history.pushState(null, "", "/");
  });

  it("keeps the public root on the guest research entry", async () => {
    renderAt("/");

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByText("Auth page")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("sends authenticated root visits to the interviews home", async () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
    });

    renderAt("/");

    expect(await screen.findByText("Interviews page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/interviews");
  });

  it("redirects protected routes to auth with the requested path preserved", async () => {
    renderAt("/practice?searchId=search-123");

    expect(await screen.findByText("Auth page")).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
    });
    expect(window.history.state?.usr).toMatchObject({
      from: { pathname: "/practice", search: "?searchId=search-123" },
      intent: "practice",
      resumeLabel: "Practice",
    });
  });

  it("leaves frozen profile routes unavailable", async () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
    });

    renderAt("/profile");

    expect(await screen.findByText("Not found page")).toBeInTheDocument();
    expect(screen.queryByText("Interviews page")).not.toBeInTheDocument();
  });
});
