import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/check-deno-baseline.sh is an error-count ratchet with a documented
// soundness contract (PREPIO-169). It exposes two seams that make the contract
// testable without a real `deno`: DENO_BIN (which binary to run) and
// DENO_ERROR_BASELINE (the ceiling). We point DENO_BIN at a stub that emits a
// canned `deno check` transcript and exit code, and assert how the wrapper
// classifies each one.
const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "check-deno-baseline.sh",
);

let stubDir: string;
let stubBin: string;

beforeAll(() => {
  stubDir = mkdtempSync(join(tmpdir(), "deno-baseline-stub-"));
  stubBin = join(stubDir, "deno");
  // Ignore the (long) argument list of `.ts` sources and just replay the
  // transcript and exit code the test asked for.
  writeFileSync(
    stubBin,
    `#!/usr/bin/env bash\nprintf '%s' "$STUB_OUTPUT"\nexit "\${STUB_EXIT:-0}"\n`,
  );
  chmodSync(stubBin, 0o755);
});

afterAll(() => {
  rmSync(stubDir, { recursive: true, force: true });
});

function run(opts: {
  output: string;
  exit: number;
  baseline?: number;
  ci?: boolean;
}) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Start from a clean slate so the ambient CI/DENO_* of the host runner cannot
  // leak in and flip a case.
  delete env.CI;
  delete env.DENO_BIN;
  delete env.DENO_ERROR_BASELINE;

  env.DENO_BIN = stubBin;
  env.STUB_OUTPUT = opts.output;
  env.STUB_EXIT = String(opts.exit);
  if (opts.baseline !== undefined) {
    env.DENO_ERROR_BASELINE = String(opts.baseline);
  }
  if (opts.ci) {
    env.CI = "true";
  }

  return spawnSync("bash", [SCRIPT], { env, encoding: "utf8" });
}

describe("check-deno-baseline.sh", () => {
  it("fails an unclassified nonzero exit even when it surfaced sub-baseline diagnostics", () => {
    // The gap PREPIO-169 closes: a hard failure (here a parse error) that dies
    // before printing a `Found N errors.` summary but still emitted a few
    // countable `TS.. [ERROR]` lines. The count (3) is under the baseline, so
    // the old `count == 0` guard let it fall through to a false "below baseline"
    // pass. It must be rejected instead.
    const output = [
      "error: The module's source code could not be parsed: Unexpected token",
      "TS2339 [ERROR]: Property 'a' does not exist on type 'X'.",
      "TS2339 [ERROR]: Property 'b' does not exist on type 'X'.",
      "TS2339 [ERROR]: Property 'c' does not exist on type 'X'.",
    ].join("\n");

    const r = run({ output, exit: 1, baseline: 10 });

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/did not run to completion/);
  });

  it("still fails a hard failure that emitted no countable diagnostic", () => {
    // The case the earlier version already caught — kept to prove the
    // generalized guard did not regress it.
    const r = run({
      output: "error: failed to load the lockfile 'deno.lock'",
      exit: 1,
      baseline: 10,
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/did not run to completion/);
  });

  it("passes at baseline when the completion summary explains the nonzero exit", () => {
    const output = [
      "TS18046 [ERROR]: 'e' is of type 'unknown'.",
      "Found 10 errors.",
    ].join("\n");

    const r = run({ output, exit: 1, baseline: 10 });

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/at baseline/);
  });

  it("fails when the completed check reports more errors than the baseline", () => {
    const r = run({ output: "Found 11 errors.", exit: 1, baseline: 10 });

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/exceed the baseline/);
  });

  it("treats a below-baseline count from a clean run as an inspect signal, not a silent pass", () => {
    // Summary present => the run completed and the drop is trustworthy. It still
    // passes (exit 0, mirroring the typecheck ratchet) but the signal goes to
    // stderr so an improvement is not lost in a green log.
    const r = run({ output: "Found 3 errors.", exit: 1, baseline: 10 });

    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/BELOW the baseline/);
    expect(r.stderr).toMatch(/lock it in/);
  });

  it("passes a clean zero-error run", () => {
    const r = run({ output: "", exit: 0, baseline: 10 });

    expect(r.status).toBe(0);
  });

  it("skips (exit 0) on a network resolution failure off CI", () => {
    const output = [
      "error: Import 'https://esm.sh/x' failed.",
      "    0: error trying to connect: tcp connect error",
    ].join("\n");

    const r = run({ output, exit: 1 });

    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/SKIPPED/);
  });

  it("fails the same network skip when running under CI", () => {
    const output = [
      "error: Import 'https://esm.sh/x' failed.",
      "    0: error trying to connect: tcp connect error",
    ].join("\n");

    const r = run({ output, exit: 1, ci: true });

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/FAILURE/);
  });
});
