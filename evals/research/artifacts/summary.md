# Research eval summary

Corpus: `published-reports-v1` (8 cases)

| Headline | Baseline | Candidate |
|---|---:|---:|
| top5HitRate | 1 | 1 |
| citationPrecision | 0.8235 | 0.8235 |
| stageAccuracy | 1 | 1 |
| degradedRunRate | 0.125 | 0.125 |

- Recall misses: 0
- p50 / p95 latency: 54000 / 76000 ms
- Tokens / estimated cost: 102800 / $0.654
- Tavily calls / credits: 16 / 16

## Failed Cycle 4 gates

- absolute.citationPrecision
- absolute.degradedRunRate
- absolute.unsupportedStageRate
- absolute.questionSpecificity
- absolute.semanticValidationFailureRate
- absolute.semanticRepairRate
