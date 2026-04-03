import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Auth from "../Auth";
import type { AuthReturnState } from "@/lib/researchDraft";

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockResetPassword = vi.fn();
const mockResendVerification = vi.fn();
const mockUseAuthContext = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

const researchAuthState: AuthReturnState = {
  from: { pathname: "/" },
  source: "research_home",
  draftStorageKey: "prepio:research-home-draft:v1",
  intent: "research",
  resumeLabel: "Research",
};

const renderAuth = (state: AuthReturnState = researchAuthState) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/auth", state }]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<div>Home target</div>} />
        <Route path="/dashboard" element={<div>Dashboard target</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Auth page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthContext.mockReturnValue({
      user: null,
      signIn: mockSignIn,
      signUp: mockSignUp,
      resetPassword: mockResetPassword,
      resendVerification: mockResendVerification,
    });

    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockResetPassword.mockResolvedValue({ error: null });
    mockResendVerification.mockResolvedValue({ error: null });
  });

  it("keeps the redirect banner visible while switching auth recovery states", async () => {
    renderAuth();

    expect(screen.getByText(/Continue to Research\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(
      await screen.findByRole("heading", { name: "Reset your password" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Continue to Research\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Need another verification email?" }));

    expect(
      await screen.findByRole("heading", { name: "Resend verification email" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Continue to Research\./)).toBeInTheDocument();
  });

  it("submits password reset requests inline", async () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "reset@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("reset@example.com");
    });

    expect(
      await screen.findByText("Password reset email sent. Use the latest email you receive."),
    ).toBeInTheDocument();
  });

  it("submits verification resend requests inline", async () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "verify@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith("verify@example.com");
    });

    expect(
      await screen.findByText("Verification email sent. Check your inbox and spam folder."),
    ).toBeInTheDocument();
  });

  it("signs in and returns to the requested page", async () => {
    renderAuth();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "hunter22");
    });

    expect(await screen.findByText("Home target")).toBeInTheDocument();
  });
});
