import { describe, expect, it } from "vitest";
import { buildResearchFreshness } from "./research-freshness.ts";

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
  });
});
