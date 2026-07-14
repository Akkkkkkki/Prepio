import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type LockfilePackage = {
  version?: string;
};

type PackageLock = {
  packages?: Record<string, LockfilePackage>;
};

function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(version);

  if (!match) {
    throw new Error(`Unsupported esbuild version in package-lock.json: ${version}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeast(
  version: [number, number, number],
  minimum: [number, number, number],
): boolean {
  for (let index = 0; index < version.length; index += 1) {
    if (version[index] !== minimum[index]) {
      return version[index] > minimum[index];
    }
  }

  return true;
}

describe("build tool dependency security", () => {
  it("keeps every locked esbuild version above the GHSA-67mh-4wv8-2f99 range", () => {
    const packageLock = JSON.parse(
      readFileSync(path.join(repoRoot, "package-lock.json"), "utf8"),
    ) as PackageLock;
    const esbuildEntries = Object.entries(packageLock.packages ?? {}).filter(([packagePath]) =>
      packagePath.endsWith("node_modules/esbuild"),
    );

    expect(esbuildEntries.length).toBeGreaterThan(0);

    for (const [packagePath, packageMetadata] of esbuildEntries) {
      expect(packageMetadata.version, `${packagePath} must declare a version`).toBeDefined();
      expect(
        isAtLeast(parseVersion(packageMetadata.version!), [0, 25, 0]),
        `${packagePath}@${packageMetadata.version} is vulnerable to GHSA-67mh-4wv8-2f99`,
      ).toBe(true);
    }
  });
});
