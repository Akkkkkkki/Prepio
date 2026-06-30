import { describe, expect, it, vi } from "vitest";
import { UrlDeduplicationService } from "./url-deduplication.ts";

describe("UrlDeduplicationService", () => {
  it("upserts scraped content using the current ops.scraped_urls schema", async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let upsertOptions: Record<string, unknown> | undefined;

    const single = vi.fn(async () => ({ data: { id: "cached-url-1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn((row, options) => {
      insertedRow = row;
      upsertOptions = options;
      return { select };
    });
    const from = vi.fn(() => ({ upsert }));
    const schema = vi.fn(() => ({ from }));
    const service = new UrlDeduplicationService({ schema });

    const id = await service.storeScrapedUrl(
      "HTTPS://www.Example.com/interviews/#section",
      "Acme",
      "Product Manager",
      "US",
      {
        title: "Acme interview loop",
        content_summary: "Summary",
        content_type: "interview_review",
        quality_score: 0.82,
        extraction_method: "search_result",
        full_content: "Full interview content",
      },
    );

    expect(id).toBe("cached-url-1");
    expect(schema).toHaveBeenCalledWith("ops");
    expect(from).toHaveBeenCalledWith("scraped_urls");
    expect(upsertOptions).toEqual({ onConflict: "url_hash,company_name" });
    expect(insertedRow).toMatchObject({
      url: "https://www.example.com/interviews",
      company_name: "Acme",
      role_title: "Product Manager",
      domain: "example.com",
      title: "Acme interview loop",
      content_quality_score: 0.82,
      full_content: "Full interview content",
      ai_summary: "Summary",
    });
    expect(insertedRow?.url_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(insertedRow).not.toHaveProperty("content_type");
    expect(insertedRow).not.toHaveProperty("extraction_method");
    expect(insertedRow).not.toHaveProperty("country");
  });

  it("reads cached content and marks reused rows through the reuse counter RPC", async () => {
    const rows = [
      {
        id: "url-1",
        url: "https://example.com/a",
        title: "A",
        full_content: "cached body",
        ai_summary: "cached summary",
        content_quality_score: 0.9,
      },
    ];

    const limit = vi.fn(async () => ({ data: rows, error: null }));
    const not = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ not }));
    const inFilter = vi.fn(() => ({ eq }));
    const select = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const schema = vi.fn(() => ({ from, rpc }));
    const service = new UrlDeduplicationService({ schema });

    const cached = await service.getExistingContent(
      ["https://example.com/a"],
      "Acme",
      "Product Manager",
      "US",
    );

    expect(cached).toEqual([
      {
        url: "https://example.com/a",
        title: "A",
        content: "cached body",
        ai_summary: "cached summary",
      },
    ]);
    expect(select).toHaveBeenCalledWith("id, url, title, full_content, ai_summary, content_quality_score");
    expect(rpc).toHaveBeenCalledWith("increment_url_reuse_count", { url_id: "url-1" });
  });
});
