import { describe, expect, it, vi } from "vitest";
import { claimPreviewRequest, type RateLimitRpcClient } from "./rate-limit.ts";

describe("claimPreviewRequest", () => {
  it("uses the atomic server-side claim with fixed limits", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await expect(claimPreviewRequest({ rpc } as RateLimitRpcClient, "203.0.113.4"))
      .resolves.toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("claim_research_preview_request", {
      p_fingerprint: "203.0.113.4",
      p_max_requests: 8,
      p_window_seconds: 3600,
    });
  });

  it("rejects a request when the atomic claim reports a full window", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    await expect(claimPreviewRequest({ rpc } as RateLimitRpcClient, "203.0.113.4"))
      .resolves.toBe(false);
  });

  it("fails closed when rate-limit storage is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    await expect(claimPreviewRequest({ rpc } as RateLimitRpcClient, "203.0.113.4"))
      .rejects.toThrow("Unable to enforce preview rate limit: database unavailable");
  });
});
