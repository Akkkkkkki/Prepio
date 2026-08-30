import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const defaults = {
  corpus: resolve(root, "corpus/published-reports.v1.json"),
  baseline: resolve(root, "runs/current-production.json"),
  thresholds: resolve(root, "thresholds.json"),
  out: resolve(root, "artifacts"),
};

const ratio = (numerator, denominator) => denominator === 0 ? 1 : numerator / denominator;
const round = (value) => Math.round(value * 10000) / 10000;
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((p / 100) * sorted.length) - 1];
};
const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export function scoreRun(corpus, run) {
  if (run.corpusVersion !== corpus.corpusVersion) throw new Error(`Corpus mismatch: ${run.corpusVersion}`);
  const byId = new Map(run.cases.map((item) => [item.id, item]));
  const missing = corpus.cases.filter((item) => !byId.has(item.id)).map((item) => item.id);
  if (missing.length) throw new Error(`Run is missing cases: ${missing.join(", ")}`);

  let reported = 0, hits = 0, recallMisses = 0, expectedStages = 0, correctStages = 0;
  let predictedStages = 0, unsupportedStages = 0, citations = 0, preciseCitations = 0;
  let resolvedCitations = 0, questions = 0, specificQuestions = 0, failures = 0, repairs = 0;
  let weakCorrect = 0, realQuestionYield = 0;
  const latency = [], costs = [], tokens = [], calls = [], credits = [], positioning = [];

  for (const fixture of corpus.cases) {
    const result = byId.get(fixture.id);
    const expected = new Set(fixture.expectedStages);
    const matched = new Set(result.topQuestions.map((q) => q.match).filter(Boolean));
    reported += fixture.reportedQuestionThemes.length;
    hits += fixture.reportedQuestionThemes.filter((theme) => matched.has(theme)).length;
    recallMisses += fixture.reportedQuestionThemes.filter((theme) => !matched.has(theme)).length;
    realQuestionYield += matched.size;
    expectedStages += expected.size;
    correctStages += result.stages.filter((stage) => expected.has(stage)).length;
    predictedStages += result.stages.length;
    unsupportedStages += result.stages.filter((stage) => !expected.has(stage)).length;
    citations += result.citations.length;
    preciseCitations += result.citations.filter((c) => c.resolved && c.relevant).length;
    resolvedCitations += result.citations.filter((c) => c.resolved).length;
    questions += result.topQuestions.length;
    specificQuestions += result.topQuestions.filter((q) => q.specific).length;
    failures += Number(result.validation.failed);
    repairs += Number(result.validation.failed && result.validation.repaired);
    const shouldBeWeak = fixture.evidenceCondition !== "normal";
    weakCorrect += Number(result.weakSignal === shouldBeWeak);
    latency.push(result.latencyMs); costs.push(result.estimatedOpenAICostUsd);
    tokens.push(result.tokens); calls.push(result.tavilyCalls); credits.push(result.tavilyCredits);
    positioning.push(result.positioningUsefulness);
  }

  const count = corpus.cases.length;
  return {
    caseCount: count,
    top5HitRate: round(ratio(hits, reported)),
    recallMissCount: recallMisses,
    citationPrecision: round(ratio(preciseCitations, citations)),
    citationResolutionRate: round(ratio(resolvedCitations, citations)),
    stageAccuracy: round(ratio(correctStages, expectedStages)),
    unsupportedStageRate: round(ratio(unsupportedStages, predictedStages)),
    degradedRunRate: round(ratio(run.cases.filter((item) => item.degraded).length, count)),
    realQuestionYield: round(realQuestionYield / count),
    questionSpecificity: round(ratio(specificQuestions, questions)),
    semanticValidationFailureRate: round(ratio(failures, count)),
    semanticRepairRate: round(ratio(repairs, failures)),
    weakSignalCalibration: round(ratio(weakCorrect, count)),
    positioningUsefulness: round(average(positioning)),
    latencyMs: { p50: percentile(latency, 50), p95: percentile(latency, 95) },
    modelTokens: { total: tokens.reduce((a, b) => a + b, 0), average: round(average(tokens)) },
    estimatedOpenAICostUsd: { total: round(costs.reduce((a, b) => a + b, 0)), average: round(average(costs)) },
    tavily: { calls: calls.reduce((a, b) => a + b, 0), credits: credits.reduce((a, b) => a + b, 0) },
  };
}

const lowerIsBetter = new Set(["degradedRunRate", "unsupportedStageRate", "semanticValidationFailureRate"]);
export function evaluateGates(baseline, candidate, thresholds) {
  const gates = [];
  for (const [metric, rule] of Object.entries(thresholds.absolute)) {
    const value = candidate[metric];
    const pass = rule.min === undefined ? value <= rule.max : value >= rule.min;
    gates.push({ gate: `absolute.${metric}`, pass, actual: value, threshold: rule });
  }
  for (const metric of ["top5HitRate", "citationPrecision", "stageAccuracy", "questionSpecificity", "positioningUsefulness", "weakSignalCalibration", "semanticRepairRate"]) {
    gates.push({ gate: `regression.${metric}`, pass: candidate[metric] >= baseline[metric] - thresholds.relative.qualityMetricMaxDrop, actual: candidate[metric], baseline: baseline[metric] });
  }
  for (const metric of lowerIsBetter) {
    gates.push({ gate: `regression.${metric}`, pass: candidate[metric] <= baseline[metric] + thresholds.relative.rateMetricMaxIncrease, actual: candidate[metric], baseline: baseline[metric] });
  }
  const relativeGate = (gate, actual, prior, maxIncrease) => ({ gate, pass: prior === 0 ? actual === 0 : actual <= prior * (1 + maxIncrease), actual, baseline: prior });
  gates.push(relativeGate("regression.p95Latency", candidate.latencyMs.p95, baseline.latencyMs.p95, thresholds.relative.p95LatencyMaxIncrease));
  gates.push(relativeGate("regression.estimatedCost", candidate.estimatedOpenAICostUsd.total, baseline.estimatedOpenAICostUsd.total, thresholds.relative.estimatedCostMaxIncrease));
  gates.push(relativeGate("regression.tavilyCredits", candidate.tavily.credits, baseline.tavily.credits, thresholds.relative.tavilyCreditsMaxIncrease));
  return gates;
}

function parseArgs(args) {
  const options = { ...defaults, candidate: defaults.baseline };
  let candidateProvided = false;
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i].replace(/^--/, "");
    if (!(key in options)) throw new Error(`Unknown option: ${args[i]}`);
    options[key] = resolve(args[++i]);
    if (key === "candidate") candidateProvided = true;
  }
  return { options, candidateProvided };
}

function markdown(result) {
  const headline = ["top5HitRate", "citationPrecision", "stageAccuracy", "degradedRunRate"];
  const rows = headline.map((key) => `| ${key} | ${result.baseline.metrics[key]} | ${result.candidate.metrics[key]} |`).join("\n");
  const failed = result.gates.filter((gate) => !gate.pass).map((gate) => `- ${gate.gate}`).join("\n") || "- None";
  return `# Research eval summary\n\nCorpus: \`${result.corpusVersion}\` (${result.candidate.metrics.caseCount} cases)\n\n| Headline | Baseline | Candidate |\n|---|---:|---:|\n${rows}\n\n- Recall misses: ${result.candidate.metrics.recallMissCount}\n- p50 / p95 latency: ${result.candidate.metrics.latencyMs.p50} / ${result.candidate.metrics.latencyMs.p95} ms\n- Tokens / estimated cost: ${result.candidate.metrics.modelTokens.total} / $${result.candidate.metrics.estimatedOpenAICostUsd.total}\n- Tavily calls / credits: ${result.candidate.metrics.tavily.calls} / ${result.candidate.metrics.tavily.credits}\n\n## Failed Cycle 4 gates\n\n${failed}\n`;
}

async function main() {
  const { options, candidateProvided } = parseArgs(process.argv.slice(2));
  const load = async (path) => JSON.parse(await readFile(path, "utf8"));
  const [corpus, baselineRun, candidateRun, thresholds] = await Promise.all([load(options.corpus), load(options.baseline), load(options.candidate), load(options.thresholds)]);
  const baseline = scoreRun(corpus, baselineRun), candidate = scoreRun(corpus, candidateRun);
  const gates = evaluateGates(baseline, candidate, thresholds);
  const result = { schemaVersion: 1, corpusVersion: corpus.corpusVersion, thresholdsLockedOn: thresholds.cycle4TargetsLockedOn, baseline: { runId: baselineRun.runId, metrics: baseline }, candidate: { runId: candidateRun.runId, metrics: candidate }, gates, passed: gates.every((gate) => gate.pass) };
  await mkdir(options.out, { recursive: true });
  await Promise.all([writeFile(resolve(options.out, "results.json"), `${JSON.stringify(result, null, 2)}\n`), writeFile(resolve(options.out, "summary.md"), markdown(result))]);
  process.stdout.write(markdown(result));
  if (candidateProvided && !result.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
