import { describe, expect, it } from "vitest";
import { planDeepExtraction } from "./retrieval-budget.ts";

describe("planDeepExtraction", () => {
  it("selects the top five ranked URLs when the configured credit cap allows it", () => {
    const plan = planDeepExtraction({
      candidateUrls: [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
        "https://example.com/4",
        "https://example.com/5",
        "https://example.com/6",
      ],
      plannedSearches: 6,
      maxCredits: 30,
    });

    expect(plan.urls).toEqual([
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
      "https://example.com/4",
      "https://example.com/5",
    ]);
    expect(plan.estimatedCredits).toBe(11);
    expect(plan.skippedReason).toBeNull();
  });

  it("keeps search and extract credits within the configured cap", () => {
    const plan = planDeepExtraction({
      candidateUrls: [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
      ],
      plannedSearches: 4,
      maxCredits: 6,
    });

    expect(plan.urls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(plan.plannedSearchCredits).toBe(4);
    expect(plan.plannedExtractCredits).toBe(2);
    expect(plan.estimatedCredits).toBe(6);
  });

  it("deduplicates URLs before spending extract credits", () => {
    const plan = planDeepExtraction({
      candidateUrls: [
        "https://example.com/a",
        "https://example.com/a",
        " https://example.com/b ",
      ],
      plannedSearches: 1,
      maxCredits: 30,
    });

    expect(plan.urls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(plan.plannedExtractCredits).toBe(2);
  });

  it("skips extraction when deep extraction is disabled", () => {
    const plan = planDeepExtraction({
      candidateUrls: ["https://example.com/a"],
      plannedSearches: 1,
      maxCredits: 30,
      enableDeepExtraction: false,
    });

    expect(plan.urls).toEqual([]);
    expect(plan.skippedReason).toBe("disabled");
    expect(plan.estimatedCredits).toBe(1);
  });
});
