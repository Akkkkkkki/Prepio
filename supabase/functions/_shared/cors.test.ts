import { describe, expect, it } from "vitest";
import { buildCorsHeaders } from "./cors.ts";

const requestFrom = (origin?: string) =>
  new Request("https://example.test", {
    headers: origin ? { origin } : {},
  });

describe("buildCorsHeaders", () => {
  it("falls back to wildcard when no allowlist is configured", () => {
    const headers = buildCorsHeaders(requestFrom("https://anywhere.test"), {
      allowedOrigins: null,
    });
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
    expect(headers["Vary"]).toBeUndefined();
  });

  it("echoes the request origin when it is in the allowlist", () => {
    const headers = buildCorsHeaders(requestFrom("https://app.prepio.test"), {
      allowedOrigins: ["https://app.prepio.test", "https://www.prepio.test"],
    });
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.prepio.test");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("returns the first allowed origin when the request origin is not allowlisted", () => {
    const headers = buildCorsHeaders(requestFrom("https://evil.test"), {
      allowedOrigins: ["https://app.prepio.test", "https://www.prepio.test"],
    });
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.prepio.test");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("returns the first allowed origin when no origin header is present", () => {
    const headers = buildCorsHeaders(requestFrom(), {
      allowedOrigins: ["https://app.prepio.test"],
    });
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.prepio.test");
  });

  it("respects an allowHeaders override", () => {
    const headers = buildCorsHeaders(requestFrom(), {
      allowedOrigins: null,
      allowHeaders: "authorization, content-type",
    });
    expect(headers["Access-Control-Allow-Headers"]).toBe("authorization, content-type");
  });
});
