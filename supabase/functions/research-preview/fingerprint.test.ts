import { describe, expect, it } from "vitest";
import { getFingerprint } from "./fingerprint.ts";

const requestWith = (headers: Record<string, string>) =>
  new Request("https://preview.prepio.test", { headers });

describe("research-preview getFingerprint", () => {
  it("uses the first x-forwarded-for IP and the user-agent", () => {
    const fingerprint = getFingerprint(
      requestWith({
        "x-forwarded-for": "203.0.113.4, 10.0.0.1",
        "user-agent": "Mozilla/5.0",
      }),
    );
    expect(fingerprint.startsWith("203.0.113.4|")).toBe(true);
    expect(fingerprint).toContain("Mozilla/5.0");
  });

  it("ignores a client-supplied x-preview-session header", () => {
    const a = getFingerprint(
      requestWith({
        "x-forwarded-for": "203.0.113.4",
        "user-agent": "Mozilla/5.0",
        "x-preview-session": "spoofed-session-a",
      }),
    );
    const b = getFingerprint(
      requestWith({
        "x-forwarded-for": "203.0.113.4",
        "user-agent": "Mozilla/5.0",
        "x-preview-session": "spoofed-session-b",
      }),
    );
    // Two callers with identical IP+UA but different spoofed sessions must
    // resolve to the same fingerprint, so the rate limit can't be bypassed
    // by rotating x-preview-session.
    expect(a).toBe(b);
  });

  it("groups callers from the same IP across different user agents loosely", () => {
    const desktop = getFingerprint(
      requestWith({ "x-forwarded-for": "198.51.100.7", "user-agent": "DesktopChrome/120" }),
    );
    const mobile = getFingerprint(
      requestWith({ "x-forwarded-for": "198.51.100.7", "user-agent": "MobileSafari/17" }),
    );
    expect(desktop).not.toBe(mobile);
    expect(desktop.startsWith("198.51.100.7|")).toBe(true);
    expect(mobile.startsWith("198.51.100.7|")).toBe(true);
  });

  it("falls back to 'unknown' when no IP header is present", () => {
    const fingerprint = getFingerprint(requestWith({ "user-agent": "curl/8" }));
    expect(fingerprint.startsWith("unknown|")).toBe(true);
  });
});
