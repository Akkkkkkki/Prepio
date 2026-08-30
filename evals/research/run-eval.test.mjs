import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { evaluateGates, scoreRun } from "./run-eval.mjs";

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

describe("research eval scorer", () => {
  it("scores every fixture deterministically and detects no self-regression", async () => {
    const [corpus, run, thresholds] = await Promise.all([
      load("./corpus/published-reports.v1.json"), load("./runs/current-production.json"), load("./thresholds.json"),
    ]);
    const metrics = scoreRun(corpus, run);
    expect(metrics.caseCount).toBe(8);
    expect(metrics.top5HitRate).toBe(1);
    expect(metrics.recallMissCount).toBe(0);
    expect(metrics.degradedRunRate).toBe(0.125);
    expect(evaluateGates(metrics, metrics, thresholds).filter((gate) => gate.gate.startsWith("regression.")).every((gate) => gate.pass)).toBe(true);
  });

  it("rejects snapshots that omit corpus cases", async () => {
    const [corpus, run] = await Promise.all([load("./corpus/published-reports.v1.json"), load("./runs/current-production.json")]);
    expect(() => scoreRun(corpus, { ...run, cases: run.cases.slice(1) })).toThrow("missing cases");
  });
});
