import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResend = vi.fn();
type AuthTestSession = { access_token: string; user: { id: string } };
type AuthStateCallback = (event: string, session: AuthTestSession | null) => void;
let authStateCallback: AuthStateCallback | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      resend: (...args: unknown[]) => mockResend(...args),
    },
  },
}));

const storedSession = { access_token: "stored-token", user: { id: "signed-in-account" } };

// useAuth reads the link from the URL at module load, as supabase-js clears it later.
const loadUseAuthAt = async (url: string) => {
  window.history.replaceState(null, "", url);
  vi.resetModules();
  const module = await import("../useAuth");
  const { result } = renderHook(() => module.useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return { result, expiredMessage: module.EXPIRED_AUTH_LINK_MESSAGE };
};

describe("useAuth link handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    mockOnAuthStateChange.mockImplementation((callback: AuthStateCallback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockResend.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("sends only password recovery to the set-new-password callback", async () => {
    const { result } = await loadUseAuthAt("/auth");

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

  it("allows password setup for the session the invite link created", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "invite-token", user: { id: "invited-account" } } },
    });

    const { result } = await loadUseAuthAt("/auth?flow=invite#access_token=invite-token&type=invite");

    expect(result.current.passwordSetupRequired).toBe(true);
    expect(result.current.authLinkChecking).toBe(false);
    expect(result.current.authLinkError).toBeNull();
  });

  it("replaces a session-less recovery link with an expired-link error", async () => {
    const { result, expiredMessage } = await loadUseAuthAt("/auth?flow=recovery");

    expect(result.current.passwordSetupRequired).toBe(false);
    expect(result.current.authLinkChecking).toBe(false);
    expect(result.current.authLinkError).toBe(expiredMessage);
  });

  it.each([
    ["an expired recovery link", "/auth?flow=recovery#error=access_denied&error_code=otp_expired"],
    ["a bare invite link", "/auth?flow=invite"],
  ])("never offers password setup to a stored session after %s", async (_label, url) => {
    mockGetSession.mockResolvedValue({ data: { session: storedSession } });

    const { result, expiredMessage } = await loadUseAuthAt(url);

    expect(result.current.passwordSetupRequired).toBe(false);
    expect(result.current.authLinkError).toBe(expiredMessage);
  });

  it("does not report a link error on an ordinary visit", async () => {
    mockGetSession.mockResolvedValue({ data: { session: storedSession } });

    const { result } = await loadUseAuthAt("/auth");

    expect(result.current.passwordSetupRequired).toBe(false);
    expect(result.current.authLinkChecking).toBe(false);
    expect(result.current.authLinkError).toBeNull();
  });

  it("enters password setup when Supabase emits a genuine recovery event", async () => {
    const { result } = await loadUseAuthAt("/auth");

    act(() => {
      authStateCallback?.("PASSWORD_RECOVERY", {
        access_token: "recovery-event-token",
        user: { id: "recovered-account" },
      });
    });

    expect(result.current.passwordSetupRequired).toBe(true);
    expect(result.current.user?.id).toBe("recovered-account");
    expect(result.current.session?.access_token).toBe("recovery-event-token");
    expect(result.current.authLinkError).toBeNull();
  });
});
