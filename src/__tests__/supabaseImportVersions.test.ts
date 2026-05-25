import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const supabaseImportPattern = /https:\/\/esm\.sh\/@supabase\/supabase-js@([^"'?]+)/g;

function packageSupabaseVersion(): string {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const declaredVersion = packageJson.dependencies?.["@supabase/supabase-js"];

  if (typeof declaredVersion !== "string") {
    throw new Error("package.json is missing @supabase/supabase-js in dependencies");
  }

  return declaredVersion.replace(/^[^\d]*/, "");
}

function collectTypescriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectTypescriptFiles(fullPath);
    }

    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });
}

describe("Supabase CDN import versions", () => {
  it("keeps Deno Supabase imports aligned with package.json", () => {
    const expectedVersion = packageSupabaseVersion();
    const scannedFiles = [
      path.join(repoRoot, "supabase", "functions"),
      path.join(repoRoot, "tests"),
    ].flatMap(collectTypescriptFiles);

    const mismatches = scannedFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(supabaseImportPattern)]
        .filter((match) => match[1] !== expectedVersion)
        .map((match) => `${path.relative(repoRoot, file)} imports ${match[1]}`);
    });

    expect(mismatches).toEqual([]);
  });
});
