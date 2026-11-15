import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const functionInvocationPattern = /\/functions\/v1\/([a-z0-9-]+)/g;

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (["__tests__", "interview-question-generator"].includes(entry)) {
        return [];
      }
      return collectSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")
      ? [fullPath]
      : [];
  });
}

function functionInvocations(source: string) {
  return [...source.matchAll(functionInvocationPattern)].map((match) => match[1]);
}

describe("interview-research service-role call graph", () => {
  it("keeps orchestration limited to the documented service subfunctions", () => {
    const source = readRepoFile("supabase/functions/interview-research/index.ts");

    expect(new Set(functionInvocations(source))).toEqual(
      new Set(["company-research", "job-analysis", "cv-analysis"]),
    );
  });

  it("keeps interview-question-generator out of production application callers", () => {
    const productionSources = [
      path.join(repoRoot, "src"),
      path.join(repoRoot, "supabase", "functions"),
    ].flatMap(collectSourceFiles);

    const callers = productionSources.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return functionInvocations(source)
        .filter((name) => name === "interview-question-generator")
        .map(() => path.relative(repoRoot, file));
    });

    expect(callers).toEqual([]);
  });
});
