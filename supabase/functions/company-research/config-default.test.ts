import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `_shared/config.ts` calls `Deno.env.get` at module load, so we can't import
// it from a Vitest (Node) test. Read the source and assert the literal flag
// value instead — this is sufficient to lock the default and catch a casual
// flip.
const CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../_shared/config.ts",
);

describe("RESEARCH_CONFIG defaults", () => {
  // PREPIO-77: native scrapers in `_shared/native-scrapers.ts` return
  // hard-coded mock interview experiences. While the flag is on, that
  // fabricated data flows through `conductHybridResearch` into
  // `analyzeCompanyData` as "REAL candidate experiences". Pin the default
  // off so a casual flip can't silently reintroduce fabricated evidence.
  it("keeps enableHybridScraping off until PREPIO-77 is resolved", () => {
    const source = readFileSync(CONFIG_PATH, "utf8");
    expect(source).toMatch(/enableHybridScraping:\s*false/);
    expect(source).not.toMatch(/enableHybridScraping:\s*true/);
  });
});
