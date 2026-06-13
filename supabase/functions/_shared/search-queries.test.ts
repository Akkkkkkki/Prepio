import { beforeAll, describe, expect, it } from "vitest";

// `_shared/config.ts` calls `Deno.env.get` at module load. Stub it out so
// the module can be imported from Node-side Vitest.
type SearchQueries = (
  company: string,
  role?: string,
  country?: string,
) => string[];

let getAllSearchQueries: SearchQueries;

beforeAll(async () => {
  (globalThis as unknown as { Deno: { env: { get: () => undefined } } }).Deno =
    { env: { get: () => undefined } };
  const mod = await import("./config.ts");
  getAllSearchQueries = mod.getAllSearchQueries;
});

function classify(query: string): string {
  if (query.includes("glassdoor.com")) return "glassdoor";
  if (query.includes("blind.teamblind.com")) return "blind";
  if (query.includes("reddit.com")) return "reddit";
  if (
    query.includes("leetcode.com") ||
    query.includes("interviewing.io") ||
    query.includes("interviewbit.com")
  ) {
    return "technical";
  }
  if (query.includes("1point3acres.com")) return "international";
  return "general";
}

describe("getAllSearchQueries", () => {
  // `searchCompanyInfo` caps query breadth with `.slice(0, 6)` to stay under
  // the 15s function timeout. If the categories were emitted in blocks (all 4
  // Glassdoor first, then Blind, etc.), that slice would never touch
  // Blind/Reddit/LeetCode/international — leaving most community evidence out
  // of every fresh run. The round-robin order keeps the slice platform-diverse.
  it("round-robins categories so the first 6 queries span platforms", () => {
    const queries = getAllSearchQueries("Acme", "Engineer", "US");
    const firstSix = queries.slice(0, 6).map(classify);

    expect(new Set(firstSix).size).toBe(6);
    expect(firstSix).toEqual([
      "glassdoor",
      "blind",
      "reddit",
      "technical",
      "international",
      "general",
    ]);
  });

  it("preserves the full query set, only reordering", () => {
    const queries = getAllSearchQueries("Acme", "Engineer", "US");
    // 4 glassdoor + 4 blind + 4 reddit + 3 technical + 3 international + 3 general
    expect(queries.length).toBe(21);
  });
});
