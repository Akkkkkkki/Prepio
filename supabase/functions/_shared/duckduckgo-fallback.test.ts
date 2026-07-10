import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchTavilyMock = vi.hoisted(() => vi.fn());

vi.mock("./tavily-client.ts", () => ({
  searchTavily: searchTavilyMock,
}));

import { searchWithFallback } from "./duckduckgo-fallback.ts";

describe("searchWithFallback", () => {
  beforeEach(() => {
    searchTavilyMock.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Tavily hits and forwards the bounded basic search request", async () => {
    const supabase = { schema: vi.fn() };
    const result = {
      query: "Acme engineer interview",
      answer: "Several candidates describe a recruiter screen and onsite loop.",
      results: [
        {
          title: "Acme interview experience",
          url: "https://example.com/acme",
          content: "Recruiter screen followed by technical interviews.",
          score: 0.91,
        },
      ],
    };
    searchTavilyMock.mockResolvedValue(result);

    await expect(
      searchWithFallback(
        "tavily-key",
        "Acme engineer interview",
        3,
        "search-123",
        "user-456",
        supabase,
      ),
    ).resolves.toBe(result);

    expect(searchTavilyMock).toHaveBeenCalledWith(
      "tavily-key",
      {
        query: "Acme engineer interview",
        searchDepth: "basic",
        maxResults: 3,
        includeAnswer: true,
        includeRawContent: false,
      },
      "search-123",
      "user-456",
      supabase,
    );
  });

  it("returns null when Tavily has no results instead of substituting fallback evidence", async () => {
    searchTavilyMock.mockResolvedValue({
      query: "Acme interview",
      answer: "",
      results: [],
    });

    await expect(searchWithFallback("tavily-key", "Acme interview")).resolves.toBeNull();

    expect(console.warn).toHaveBeenCalledWith(
      "Tavily returned no results; no non-equivalent fallback will be used.",
    );
  });

  it("returns null when Tavily fails instead of throwing or falling back", async () => {
    const error = new Error("network timeout");
    searchTavilyMock.mockRejectedValue(error);

    await expect(searchWithFallback("tavily-key", "Acme interview")).resolves.toBeNull();

    expect(console.warn).toHaveBeenCalledWith(
      "Tavily search failed; no non-equivalent fallback will be used:",
      error,
    );
  });
});
