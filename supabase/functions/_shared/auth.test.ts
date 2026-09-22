import { describe, expect, it, vi } from "vitest";
import { authorizeRequest, ensureServiceCaller, type AuthorizedRequestContext } from "./auth.ts";

const serviceContext: AuthorizedRequestContext = {
  kind: "service",
  token: "svc-token",
  userId: null,
};

const userContext: AuthorizedRequestContext = {
  kind: "user",
  token: "user-jwt",
  userId: "user-123",
};

describe("ensureServiceCaller", () => {
  it("accepts a service-role caller", () => {
    expect(ensureServiceCaller(serviceContext)).toEqual({ ok: true });
  });

  it("rejects a user caller with a 403 response", async () => {
    const result = ensureServiceCaller(userContext);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    expect(result.response.headers.get("Content-Type")).toBe("application/json");
    const body = await result.response.json();
    expect(body).toEqual({ success: false, error: "Service caller required" });
  });
});

describe("authorizeRequest freeze boundary", () => {
  it.each([null, { id: "guest", is_anonymous: true }])("rejects guests before provider work", async user => {
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
    try {
      const result = await authorizeRequest(new Request("https://example.test", { headers: { authorization: "Bearer guest-token" } }), {
        auth: { getUser: async () => ({ data: { user }, error: null }) },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    } finally { vi.unstubAllGlobals(); }
  });

  it("accepts a verified non-anonymous user", async () => {
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
    try {
      const result = await authorizeRequest(new Request("https://example.test", { headers: { authorization: "Bearer invited-token" } }), {
        auth: { getUser: async () => ({ data: { user: { id: "invited", is_anonymous: false } }, error: null }) },
      });
      expect(result).toMatchObject({ ok: true, context: { kind: "user", userId: "invited" } });
    } finally { vi.unstubAllGlobals(); }
  });
});
