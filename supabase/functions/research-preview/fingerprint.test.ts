import { describe, expect, it } from "vitest";
import { getFingerprint } from "./fingerprint.ts";

const requestWith = (headers: Record<string, string>) =>
  new Request("https://preview.prepio.test", { headers });

describe("research-preview getFingerprint", () => {
  it("uses only the first x-forwarded-for IP", () => {
    const fingerprint = getFingerprint(
      requestWith({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" }),
    );
    expect(fingerprint).toBe("203.0.113.4");
  });

  it("ignores a client-supplied x-preview-session header", () => {
    const a = getFingerprint(
      requestWith({
        "x-forwarded-for": "203.0.113.4",
        "x-preview-session": "spoofed-session-a",
      }),
    );
    const b = getFingerprint(
      requestWith({
        "x-forwarded-for": "203.0.113.4",
        "x-preview-session": "spoofed-session-b",
      }),
    );
    expect(a).toBe(b);
  });

  it("ignores user-agent so rotating it from a single IP cannot bypass the limit", () => {
    const desktop = getFingerprint(
      requestWith({ "x-forwarded-for": "198.51.100.7", "user-agent": "DesktopChrome/120" }),
    );
    const mobile = getFingerprint(
      requestWith({ "x-forwarded-for": "198.51.100.7", "user-agent": "MobileSafari/17" }),
    );
    expect(desktop).toBe(mobile);
    expect(desktop).toBe("198.51.100.7");
  });

  it("falls back to 'unknown' when no IP header is present", () => {
    const fingerprint = getFingerprint(requestWith({ "user-agent": "curl/8" }));
    expect(fingerprint).toBe("unknown");
  });
});
