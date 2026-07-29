import { describe, expect, it } from "vitest";
import {
  buildSearchPayloads,
  type CachedContentRow,
  type SearchPayload,
} from "./result-aggregation.ts";

const COMPANY = "Acme";

function freshHit(query: string, url: string): SearchPayload {
  return {
    query,
    answer: `answer for ${query}`,
    results: [
      {
        title: `Result for ${query}`,
        url,
        content: `content from ${url}`,
        raw_content: null,
        score: 0.9,
        published_date: null,
      },
    ],
  };
}

function cachedRow(url: string, title?: string): CachedContentRow {
  return {
    url,
    content: {
      title,
      content: `cached body for ${url}`,
      raw_content: `raw ${url}`,
      score: 0.8,
    },
  };
}

describe("buildSearchPayloads", () => {
  it("returns the fresh hits as search_results when Tavily returns hits and no cache", () => {
    const fresh = [freshHit("acme interview", "https://example.com/a")];

    const { searchPayloads, validFreshResults } = buildSearchPayloads({
      shouldSkipFresh: false,
      freshResults: fresh,
      cachedResults: [],
      company: COMPANY,
    });

    // Regression for PREPIO-42: the fresh search results must reach the
    // returned payload. Before the fix the outer-scope `validResults` was
    // shadowed by a const inside the else branch, so this array was empty.
    expect(searchPayloads).toHaveLength(1);
    expect(searchPayloads[0]).toEqual(fresh[0]);
    expect(validFreshResults).toEqual(fresh);
  });

  it("filters null entries out of the fresh results", () => {
    const hit = freshHit("acme onsite", "https://example.com/b");

    const { searchPayloads, validFreshResults } = buildSearchPayloads({
      shouldSkipFresh: false,
      freshResults: [null, hit, null],
      cachedResults: [],
      company: COMPANY,
    });

    expect(searchPayloads).toEqual([hit]);
    expect(validFreshResults).toEqual([hit]);
  });

  it("prepends a cached-content payload before the fresh hits", () => {
    const hit = freshHit("acme behavioral", "https://example.com/c");
    const cached = [
      cachedRow("https://cache.example/1", "Glassdoor post"),
      cachedRow("https://cache.example/2"),
    ];

    const { searchPayloads, validFreshResults } = buildSearchPayloads({
      shouldSkipFresh: false,
      freshResults: [hit],
      cachedResults: cached,
      company: COMPANY,
    });

    expect(searchPayloads).toHaveLength(2);
    expect(searchPayloads[0].query).toBe(`Cached content for ${COMPANY}`);
    expect(searchPayloads[0].answer).toBe(
      `Reusing ${cached.length} previously analyzed sources`,
    );
    expect(searchPayloads[0].results.map((r) => r.url)).toEqual([
      cached[0].url,
      cached[1].url,
    ]);
    expect(searchPayloads[0].results[1].title).toBe("Cached Content");
    expect(searchPayloads[1]).toEqual(hit);
    expect(validFreshResults).toEqual([hit]);
  });

  it("returns only a cached payload when shouldSkipFresh is true", () => {
    const cached = [cachedRow("https://cache.example/3", "Blind thread")];

    const { searchPayloads, validFreshResults } = buildSearchPayloads({
      shouldSkipFresh: true,
      freshResults: [],
      cachedResults: cached,
      company: COMPANY,
    });

    expect(searchPayloads).toHaveLength(1);
    expect(searchPayloads[0].query).toBe(`Cached results for ${COMPANY}`);
    expect(searchPayloads[0].answer).toBe(
      `Using cached interview and company data for ${COMPANY}`,
    );
    expect(searchPayloads[0].results[0].url).toBe(cached[0].url);
    expect(searchPayloads[0].results[0].title).toBe("Blind thread");
    expect(validFreshResults).toEqual([]);
  });

  it("preserves when a cached source was originally observed", () => {
    const observedAt = "2026-01-04T09:30:00.000Z";
    const cached = [{
      ...cachedRow("https://cache.example/observed", "Cached report"),
      observed_at: observedAt,
    }];

    const { searchPayloads } = buildSearchPayloads({
      shouldSkipFresh: true,
      freshResults: [],
      cachedResults: cached,
      company: COMPANY,
    });

    expect(searchPayloads[0].results[0].observed_at).toBe(observedAt);
  });

  it("returns an empty array when all fresh results failed and no cache exists", () => {
    const { searchPayloads, validFreshResults } = buildSearchPayloads({
      shouldSkipFresh: false,
      freshResults: [null, null],
      cachedResults: [],
      company: COMPANY,
    });

    expect(searchPayloads).toEqual([]);
    expect(validFreshResults).toEqual([]);
  });
});
