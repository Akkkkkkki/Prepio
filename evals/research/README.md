# Offline research evidence-integrity demonstration

This is an **illustrative offline harness**, not a measured Prepio baseline.
Its canonical fixture has one deliberately unsupported claim. A successful
execution detects that finding; it says nothing about current model quality.
See [intent.md](intent.md) for the approved scope and conflict resolutions.

## Run

From the repository root with Node 22+:

```sh
node evals/research/score.mjs \
  --case evals/research/cases/openai-london.v1.json \
  --output evals/research/examples/openai-london-illustrative.v1.json \
  --labels evals/research/labels/openai-london-illustrative.v1.json \
  --out /tmp/prepio-eval-new-report

npx vitest run evals/research/score.test.mjs
```

The output directory must not already exist; its parent must exist. Reports are
`results.json` (report schema 2) and `summary.md`. Input snapshot schemas remain 1.
The directory also contains byte-for-byte copies of the supplied JSON files at
`inputs/cases.json`, `inputs/outputs.json` and `inputs/annotations.json`, plus
`score.mjs` and `rubric.v0.3.0.md`. The output snapshot includes the complete
supplied plan, so reviewers can inspect the text behind each judgment.
Use an output directory outside the repository and preserve the whole bundle.
The scorer reads its own bundled code/rubric once at module load; record calculation
and the synchronous `evaluate(dataset)` API use that captured context. It never
loads `.env`, imports app code, fetches URLs or invokes providers.
Existing `npm test` automatically discovers the tests. Two guards in
`vitest.setup.ts` let Node tests skip browser-only window mocks.

0 = structurally valid evaluation, including findings; 2 = input/config/I/O error.
Errors are one JSON object on stderr. 1 is reserved; no quality gate is active.
All four options are mandatory; unknown/repeated options fail. Files may contain
one record or arrays of records, with exactly one output/annotation per case.

Replay a bundle from any location with Node 22+, without installing dependencies:

```sh
cd /tmp/prepio-eval-new-report
node score.mjs --case inputs/cases.json --output inputs/outputs.json \
  --labels inputs/annotations.json --out ../prepio-eval-replayed
```

The replay destination must also be new. Unchanged bundled artifacts and inputs
produce byte-identical JSON and Markdown, independently of directory paths.

## Snapshot contracts

- **Case:** `schemaVersion`, `fixtureVersion`, `caseId`, `variantId`, lineage,
  frozen request, JD hash, exactly one London source with frozen passage hashes,
  original capture metadata and `interviewGroundTruth:null`.
- **Output:** case hash/version/variant binding, `outputId`, `claimLevel:illustrative`,
  `authoredBy`, `fixtureCompleteness:illustrative_excerpt`, native `plan`, and
  construction metadata (`prepioExecuted:false`, `runId:null`). The source SHA is
  context for the schema, not proof of any execution. Captured runs are rejected.
- **Annotations:** output hash/ID and case/variant binding, `rubricVersion`, owner
  identity/type/independence/date, one judgment per native claim-bearing path,
  and an optional `humanScores` array. Unknown fields and paths are errors.

The fixtures are executable examples of these strict contracts. They deliberately
use a subset of the native `PrepPlanOutput` fields and require each listed field;
this is not the full 40-question production validator. Identity/enums/references
are structural metadata; all other user-facing text (including arrays, stage
names, rationales, candidate positioning and practice sequence) requires annotation.
Native optional production fields are outside this version's excerpt contract.

Paths are relative to `plan`, for example `stageRoadmap[0].whyLikely` and
`questionPlan.coreMustPractice[0].question`. Paths are looked up in a generated
allow-list, never evaluated as code. Classification belongs only in annotations.
A resolved `ev-*` reference establishes ledger membership and frozen-text binding;
it does **not** establish that a claim is semantically supported. Pasted-JD
ledger metadata is fixed to the native builder: source label/title are
`Pasted job description`, platform is `user`, and relevance/trust weight are
both `high`. Resealing cannot turn that entry into a different source attribution.

Judgment types: `role_requirement`, `suggested_practice`,
`reported_interview_question`, `interview_process_claim`, `other`. Presentations:
`factual`, `hypothetical`, `ambiguous`. Decisions: `supported`, `contradicted`,
`insufficient_evidence`, `not_applicable`. Supported/contradicted decisions require
registered source and passage IDs. A factual claim cannot be `not_applicable`.
Supported interview history is invalid because this contract has no interview
source. Unsupported factual claims and contradictions become annotated findings.
A lexicon or citation resolution must never substitute for semantic review.

## Human ratings and unavailable metrics

The preserved [v0.3.0 rubric](rubric.v0.3.0.md) provides the 0–4 anchors. Rating
dimension IDs are `roleRelevance`, `evidenceGrounding`, `prioritization`,
`handlingUncertainty`, `practicalUsefulness`. Each score needs integer `value`
0–4, `raterId`, `authorType:human`, `independence:independent`, `reviewedAt`,
`rubricVersion:0.3.0` and a nonempty `reason`. Duplicate rater/dimension records
are errors. Scores have equal weight and report a descriptive mean and rating
count per dimension; there is no total, pass mark or quality headline. Differences greater than one
point for the same output/dimension require adjudication under the preserved
rubric: all raw ratings remain, the aggregate is N/A with
`status:requires_adjudication`, and disputed output IDs are reported.

A declared independent human `unsupported_interview_history` finding also conflicts
with every positive evidence-grounding rating (1–4) for that output, whether the
rater is the annotation owner or another reviewer. EG=0 remains consistent. A
model-authored or non-independent finding does not trigger this human-review rule.
Either conflict withholds the entire affected dimension across the dataset; no
disputed output is silently dropped from its denominator. Other dimensions remain
descriptive when consistent. `humanReview.adjudicationIssues` identifies the
`rating_disagreement` or `grounding_finding_conflict`, dimension, output, affected
`raterIds`, relevant `findingPaths` and reason. Markdown explains the same issues;
`humanReview.records` retains all original values and rating metadata.

An annotation owner may be `human` or `model`; independence is `independent`,
`same_author` or `unknown`. Independent annotations must declare a human owner
whose ID differs from the output author. Metadata is an attestation, not identity
authentication: aliases and false declarations require human audit.
After individual record validation, exact identity strings are reconciled across
all annotation owners, typed source-review attributions and human ratings. An ID
declared both model and human is rejected, even across cases. An output's author
or an annotation owner declaring `same_author` cannot rate that output as an
independent human. Independence is output-specific: a human author may review a
different output. Unknown independence alone is not treated as a contradictory
declaration. The evaluator does not infer aliases or split prose attribution strings.

Adjudication requires a new explicitly reviewed, resealed annotation snapshot and
a new report bundle. Preserve the previous bundle with its original ratings and
findings. There is no override field or automatic rewriting of ratings to zero.

No human scores are included in the canonical example. Its same-author model
annotations illustrate mechanics and never become verified ground truth. Human
scores with zero ratings and every performance metric return `status:N/A`,
`value:null`, and a reason. A nonexistent observation is not a measured zero.
Source hashes prove frozen bytes, not source authenticity, currentness or review.

## Reproducibility and lineage

Normalize CRLF/CR to LF in all strings; serialize JSON recursively with sorted
keys and compact separators, then SHA-256 its UTF-8 bytes. Exclude only each
record's top-level `sha256` when sealing. Bind case → output → annotations; any
change requires resealing dependent snapshots. Passage hashes cover text, not
JSON. Native pasted-JD compacting collapses whitespace, trims, and for >700 UTF-16
code units takes 699 units, trims and appends `…`, matching main at `a330939`.

Separately, `provenance.evaluator` records `scorerSha256`, `rubricVersion` and
`rubricSha256`, hashed from the actual raw file bytes without newline normalization.
Each case's `lineage.rubricSha256` must equal the bundled rubric's raw-byte hash;
resealing snapshots cannot bypass a mismatch. The preserved v0.3.0 rubric is
unchanged. Artifact hashes detect differences and enable replay; they do not
authenticate an artifact or approve a changed scoring policy. The original
opportunity/source-register hashes remain declared lineage because their full
original files are not bundled.

Only two short S02 quotations are redistributed. The source register describes an
Ashby capture on 2026-11-08 and a separate archived/live official-page recheck.
Original full snapshot and package hashes are retained as lineage; their original
bytes are not bundled or fetched at evaluation time. The supplied package's
reported recheck is model-authored. No new source authentication is asserted.

PR #318 at `18aae8c` was inspected: reuse is conceptual only (versioned inputs,
pure offline scoring, JSON/Markdown). Its arithmetic over self-scored flags,
thresholds, synthetic baselines and production naming are not reused.

To support actual captured runs later, independently approve a full native-plan
validator, exact input and raw/failure output snapshots, real run ID/time, source
commit, prompt/model/configuration, execution environment and trace hashes.
Quality metrics additionally need independent interview evidence/annotations;
latency/cost need observed telemetry. A single run still is not representative.
Before comparisons, also fix the expected corpus independently of selected results,
record exclusions and all attempted/failed runs, and pin configuration provenance.
This milestone adds neither comparison mode nor a release gate.
See [verification.md](verification.md) for test evidence and review limitations.
