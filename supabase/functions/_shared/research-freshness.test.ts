import { describe, expect, it } from "vitest";
import {
  buildResearchFreshness,
  mergeResearchFreshness,
} from "./research-freshness.ts";

const OBSERVED_AT = "2026-07-23T12:00:00.000Z";

describe("buildResearchFreshness", () => {
  it("deduplicates retrieved URLs and records published and observed dates", () => {
    const freshness = buildResearchFreshness(
      [
        {
          results: [
            {
              url: "https://example.com/report-a#interview",
              published_date: "2024-05-10T08:00:00Z",
            },
            {
              url: "https://example.com/report-b",
              published_date: "2025-02-03",
            },
          ],
        },
        {
          results: [
            {
              url: "https://example.com/report-a",
              published_date: null,
            },
            {
              url: "https://example.com/report-c",
              published_date: "not-a-date",
            },
          ],
        },
      ],
      OBSERVED_AT,
    );

    expect(freshness).toMatchObject({
      sourceCount: 3,
      datedSourceCount: 2,
      observedAt: OBSERVED_AT,
      oldestObservedAt: OBSERVED_AT,
      newestObservedAt: OBSERVED_AT,
      oldestPublishedAt: "2024-05-10",
      newestPublishedAt: "2025-02-03",
      summary: "Based on 3 sources; 2 dated reports span 2024–2025.",
    });
    expect(freshness.sourceDates).toEqual([
      {
        url: "https://example.com/report-a",
        publishedAt: "2024-05-10",
        observedAt: OBSERVED_AT,
      },
      {
        url: "https://example.com/report-b",
        publishedAt: "2025-02-03",
        observedAt: OBSERVED_AT,
      },
      {
        url: "https://example.com/report-c",
        publishedAt: null,
        observedAt: OBSERVED_AT,
      },
    ]);
  });

  it("reports when retrieved sources do not include publication dates", () => {
    const freshness = buildResearchFreshness(
      [{ results: [{ url: "https://example.com/undated" }] }],
      OBSERVED_AT,
    );

    expect(freshness.sourceCount).toBe(1);
    expect(freshness.datedSourceCount).toBe(0);
    expect(freshness.summary).toBe(
      "Based on 1 source; publication dates were unavailable.",
    );
  });

  it("ignores malformed source URLs and handles an empty run", () => {
    const freshness = buildResearchFreshness(
      [{ results: [{ url: "javascript:alert(1)", published_date: "2025-01-01" }] }],
      OBSERVED_AT,
    );

    expect(freshness.sourceDates).toEqual([]);
    expect(freshness.summary).toBe(
      "No research sources were captured for this run.",
    );
    expect(freshness.oldestObservedAt).toBeNull();
    expect(freshness.newestObservedAt).toBeNull();
  });

  it("keeps a cached source's original scrape time instead of the run time", () => {
    const freshness = buildResearchFreshness(
      [
        {
          results: [
            {
              url: "https://example.com/cached",
              observed_at: "2026-01-04T09:30:00.000Z",
            },
            { url: "https://example.com/fresh" },
          ],
        },
      ],
      OBSERVED_AT,
    );

    expect(freshness.sourceDates).toEqual([
      {
        url: "https://example.com/cached",
        publishedAt: null,
        observedAt: "2026-01-04T09:30:00.000Z",
      },
      {
        url: "https://example.com/fresh",
        publishedAt: null,
        observedAt: OBSERVED_AT,
      },
    ]);
    // The run must not claim the cached source was checked today.
    expect(freshness.oldestObservedAt).toBe("2026-01-04T09:30:00.000Z");
    expect(freshness.newestObservedAt).toBe(OBSERVED_AT);
  });

  it("ignores an unparseable per-source observation time", () => {
    const freshness = buildResearchFreshness(
      [{ results: [{ url: "https://example.com/a", observed_at: "nonsense" }] }],
      OBSERVED_AT,
    );

    expect(freshness.oldestObservedAt).toBe(OBSERVED_AT);
  });
});

describe("mergeResearchFreshness", () => {
  it("unions company and job-extraction sources, de-duplicating by URL", () => {
    const company = buildResearchFreshness(
      [
        {
          results: [
            { url: "https://example.com/report", published_date: "2025-03-01" },
            { url: "https://example.com/shared" },
          ],
        },
      ],
      OBSERVED_AT,
    );
    const job = buildResearchFreshness(
      [
        {
          results: [
            { url: "https://example.com/shared" },
            { url: "https://jobs.example.com/posting" },
          ],
        },
      ],
      OBSERVED_AT,
    );

    const merged = mergeResearchFreshness([company, job]);

    expect(merged).toMatchObject({
      sourceCount: 3,
      datedSourceCount: 1,
      oldestPublishedAt: "2025-03-01",
      summary: "Based on 3 sources; the dated report is from 2025.",
    });
  });

  it("reports job-extraction sources when company search returned nothing", () => {
    const company = buildResearchFreshness([], OBSERVED_AT);
    const job = buildResearchFreshness(
      [{ results: [{ url: "https://jobs.example.com/posting" }] }],
      OBSERVED_AT,
    );

    const merged = mergeResearchFreshness([company, job]);

    expect(merged?.sourceCount).toBe(1);
    expect(merged?.summary).toBe(
      "Based on 1 source; publication dates were unavailable.",
    );
  });

  it("merges duplicate sources without losing dated metadata or newer observation time", () => {
    const cachedCompany = buildResearchFreshness(
      [
        {
          results: [
            {
              url: "https://example.com/shared",
              observed_at: "2026-01-04T09:30:00.000Z",
            },
          ],
        },
      ],
      OBSERVED_AT,
    );
    const extractedJob = buildResearchFreshness(
      [
        {
          results: [
            {
              url: "https://example.com/shared",
              published_date: "2026-02-10",
              observed_at: "2026-07-23T12:00:00.000Z",
            },
          ],
        },
      ],
      OBSERVED_AT,
    );

    const merged = mergeResearchFreshness([cachedCompany, extractedJob]);

    expect(merged?.sourceCount).toBe(1);
    expect(merged?.datedSourceCount).toBe(1);
    expect(merged?.oldestPublishedAt).toBe("2026-02-10");
    expect(merged?.oldestObservedAt).toBe(OBSERVED_AT);
    expect(merged?.newestObservedAt).toBe(OBSERVED_AT);
    expect(merged?.sourceDates).toEqual([
      {
        url: "https://example.com/shared",
        publishedAt: "2026-02-10",
        observedAt: OBSERVED_AT,
      },
    ]);
    expect(merged?.summary).toBe(
      "Based on 1 source; the dated report is from 2026.",
    );
  });

  it("returns null when no retrieval path produced freshness", () => {
    expect(mergeResearchFreshness([null, undefined])).toBeNull();
  });
});
