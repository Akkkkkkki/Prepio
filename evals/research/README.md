# Research quality evaluation

This directory contains the versioned, PII-free backtest used before changing the
research model, prompts, API, or orchestration. The first input adapter is a curated
published-report corpus. A future debrief adapter can produce the same case shape
without changing the scorer.

Run the captured production baseline against itself:

```bash
npm run eval:research
```

Compare a candidate snapshot against the fixed baseline:

```bash
npm run eval:research -- --candidate path/to/candidate-run.json --out artifacts/research-eval
```

The command writes `results.json` (stable-key JSON for automation and diffs) and
`summary.md`. It exits non-zero when a Cycle 4 gate fails. Snapshots are deliberately
separate from live execution: collect candidate outputs with the same case IDs, redact
them, then score them here. This makes the benchmark repeatable in CI without OpenAI,
Tavily, Supabase, or production access.

## Snapshot contract

Each case result supplies the five ranked questions shown to a user, predicted stages,
citations, validation telemetry, confidence/degraded state, positioning score (a
curated 0–1 review label), latency, token/cost data, and Tavily usage. See
`runs/current-production.json`. Question `match` values and citation `relevant` labels
are corpus annotations, not model claims.

Thresholds live in `thresholds.json`. The baseline and Cycle 4 targets are fixed in git;
targets must not be lowered. Corpus changes require a version bump and a new baseline.

