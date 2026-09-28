import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXPIRED_AUTH_LINK_MESSAGE, useAuth } from "../useAuth";

const mockGetSession = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResend = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      resend: (...args: unknown[]) => mockResend(...args),
    },
  },
}));

const syntheticSession = { user: { id: "synthetic-user" } };

describe("useAuth link handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockResend.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("sends only password recovery to the set-new-password callback", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.resetPassword("reset@example.com");
    await result.current.resendVerification("verify@example.com");

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("reset@example.com", {
      redirectTo: `${window.location.origin}/auth?flow=recovery`,
    });
    expect(mockResend).toHaveBeenCalledWith({
      type: "signup",
      email: "verify@example.com",
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
  });

  it("keeps password setup for an invite link that produced a session", async () => {
    window.history.replaceState(null, "", "/auth?flow=invite");
    mockGetSession.mockResolvedValue({ data: { session: syntheticSession } });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.passwordSetupRequired).toBe(true);
    expect(result.current.authLinkError).toBeNull();
  });

  it("replaces a session-less recovery link with an expired-link error", async () => {
    window.history.replaceState(null, "", "/auth?flow=recovery");

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.passwordSetupRequired).toBe(false);
    expect(result.current.authLinkError).toBe(EXPIRED_AUTH_LINK_MESSAGE);
  });

  it("does not report a link error on an ordinary visit", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.passwordSetupRequired).toBe(false);
    expect(result.current.authLinkError).toBeNull();
  });
});
