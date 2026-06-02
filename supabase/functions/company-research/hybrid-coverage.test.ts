import { describe, expect, it } from "vitest";
import {
  NATIVE_COVERAGE_THRESHOLD,
  decideTavilyCoverage,
} from "./hybrid-coverage.ts";

describe("decideTavilyCoverage", () => {
  it("excludes every native domain when all platforms clear the threshold", () => {
    const decision = decideTavilyCoverage({
      glassdoor: 10,
      reddit: 5,
      blind: 4,
      leetcode: 3,
    });

    expect(decision.excludedDomains.sort()).toEqual([
      "blind.teamblind.com",
      "glassdoor.com",
      "leetcode.com",
      "reddit.com",
    ]);
    expect(decision.rescuedDomains).toEqual([]);
    expect(decision.uncoveredPlatforms).toEqual([]);
  });

  it("rescues a platform when native scraping returned nothing for it", () => {
    // Regression for PREPIO-49: native Glassdoor scrape gets bot-blocked
    // (zero results) — Tavily was previously still told to skip glassdoor.com,
    // so the analyzer received no Glassdoor evidence at all.
    const decision = decideTavilyCoverage({
      glassdoor: 0,
      reddit: 8,
      blind: 6,
      leetcode: 5,
    });

    expect(decision.excludedDomains).not.toContain("glassdoor.com");
    expect(decision.rescuedDomains).toContain("glassdoor.com");
    expect(decision.uncoveredPlatforms).toEqual(["glassdoor"]);
  });

  it("treats yields below the threshold as uncovered", () => {
    const decision = decideTavilyCoverage(
      { glassdoor: 2, reddit: 2, blind: 2, leetcode: 2 },
      NATIVE_COVERAGE_THRESHOLD,
    );

    expect(decision.excludedDomains).toEqual([]);
    expect(decision.rescuedDomains.sort()).toEqual([
      "blind.teamblind.com",
      "glassdoor.com",
      "leetcode.com",
      "reddit.com",
    ]);
    expect(decision.uncoveredPlatforms.sort()).toEqual([
      "blind",
      "glassdoor",
      "leetcode",
      "reddit",
    ]);
  });

  it("rescues platforms missing from the breakdown entirely", () => {
    // If a native scraper crashed and reported no entry at all, that platform
    // should still be considered uncovered rather than silently excluded.
    const decision = decideTavilyCoverage({ reddit: 9, blind: 9 });

    expect(decision.rescuedDomains.sort()).toEqual([
      "glassdoor.com",
      "leetcode.com",
    ]);
    expect(decision.uncoveredPlatforms.sort()).toEqual(["glassdoor", "leetcode"]);
  });

  it("handles a null or undefined breakdown by rescuing every domain", () => {
    expect(decideTavilyCoverage(null).rescuedDomains.length).toBe(4);
    expect(decideTavilyCoverage(undefined).rescuedDomains.length).toBe(4);
  });

  it("respects a custom threshold", () => {
    const decision = decideTavilyCoverage(
      { glassdoor: 1, reddit: 1, blind: 1, leetcode: 1 },
      1,
    );

    expect(decision.uncoveredPlatforms).toEqual([]);
    expect(decision.excludedDomains.sort()).toEqual([
      "blind.teamblind.com",
      "glassdoor.com",
      "leetcode.com",
      "reddit.com",
    ]);
  });
});
