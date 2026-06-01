import { describe, expect, it } from "vitest";
import { ensureServiceCaller, type AuthorizedRequestContext } from "./auth.ts";

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
