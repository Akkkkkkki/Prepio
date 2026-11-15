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
  --out /tmp/prepio-eval-new-report \
  --as-of 2026-11-13T00:00:00Z \
  --manifest /path/to/manifest.json   # optional; needed for any human aggregate

npx vitest run evals/research/
```

The output directory must not already exist; its parent must exist. Reports are
`results.json` (report schema 4) and `summary.md`. Case and output snapshots are
schema 1; annotations are schema 1, or schema 2 when they carry screening decisions.
The directory also contains byte-for-byte copies of the supplied JSON files at
`inputs/cases.json`, `inputs/outputs.json` and `inputs/annotations.json` (and
`inputs/manifest.json` when one was supplied), plus
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
The four path options are mandatory; unknown/repeated options fail. Files may contain
one record or arrays of records, with exactly one output/annotation per case.

`--as-of` is optional and takes a full UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`).
The scorer never reads the clock: with `--as-of`, any record dated later is
rejected and the value is stored in `provenance.evaluation.asOf`; without it,
`checks.futureDates` is `not_evaluated`. Pass the same value to replay a bundle.

`--manifest` is optional. It names a JSON array of
`{ "caseId", "outputId", "outputSha256" }`: the outputs that were expected,
fixed before scoring. The report compares it with what was supplied
(`corpus.missing`, `corpus.unexpected`, `checks.corpusCompleteness`). Without a
manifest the check is `not_evaluated`. A human aggregate is produced only when
the check is `pass`, so an output that was dropped cannot disappear silently.
Commit the manifest before the outputs are scored; it cannot show a case that
was never listed.

Replay a bundle from any location with Node 22+, without installing dependencies:

```sh
cd /tmp/prepio-eval-new-report
node score.mjs --case inputs/cases.json --output inputs/outputs.json \
  --labels inputs/annotations.json --out ../prepio-eval-replayed
```

The replay destination must also be new. Unchanged bundled artifacts and inputs
(and the same `--as-of`, when one was used) produce byte-identical JSON and
Markdown, independently of directory paths.

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
  and an optional `humanScores` array. Schema 2 adds `screeningDecisions`
  (below). Unknown fields and paths are errors.

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
`reported_interview_question`, `interview_process_claim`,
`uncertainty_disclosure`, `other`. Presentations:
`factual`, `hypothetical`, `ambiguous`. Decisions: `supported`, `contradicted`,
`insufficient_evidence`, `not_applicable`. Supported/contradicted decisions require
registered source and passage IDs. A factual claim cannot be `not_applicable`,
except an `uncertainty_disclosure` ("no verified source describes the interview
process"), which must be `not_applicable` and raises no finding: it says evidence
is missing and asserts nothing about the employer.
Supported interview history is invalid because this contract has no interview
source. That rule is enforced on the plan path as well as the label: judgments on
`stageRoadmap[i].stageName`, `.whyLikely`, `.whatItTests[j]` and
`.questionThemes[j]` can never be `supported` or `contradicted`, and a factual,
unsupported judgment there is always `unsupported_interview_history`, whatever
`claimType` the annotation supplies. The one exception is a `role_requirement`
that is verbatim posting text: it may be `supported`, because it states what the
job needs while the stage itself stays a reported prediction. Interview-history
wording on any other path is handled by screening decisions, not by path. Unsupported factual claims and
contradictions become annotated findings. A lexicon or citation resolution must
never substitute for semantic review.

## What each result establishes

The report keeps three things apart that are easy to conflate:

| Layer | Report field | What it means | What it does not mean |
|---|---|---|---|
| Reference existence | `checks.planReferenceIntegrity`, `counts.resolvedCitations` | Every cited evidence, passage and plan-path ID resolves to a supplied record | That the source supports the claim |
| Source hash internal consistency | `checks.sourceHashInternalConsistency` | Supplied records match the hashes stored beside them | Source authenticity: an edited record can be resealed. `checks.sourceAuthenticity` is always `not_evaluated` |
| Semantic claim support | `checks.semanticClaimSupport` (always `not_evaluated`), `semanticReview`, `judgments[].supportBasis` | Support decisions come from annotations; their basis is reported | Verified support. The only check the scorer performs is `verbatim_passage_match`: a claim of four or more words that appears verbatim in a cited frozen passage. Everything else is `annotation_only` |

`semanticReview.basis` and each finding's `annotationBasis` are one of
`unverified_model_annotation`, `unverified_non_independent_annotation` or
`declared_independent_human_annotation` (`mixed` across a dataset). "Declared"
is deliberate: identities are self-declared and unauthenticated.

**Findings from annotations** (`findings`) carry a `severity`. *Critical*
factual-grounding findings are `unsupported_interview_history` (rubric CF2/CF3)
and `contradicted_claim`; `unsupported_claim` is *minor*.
`counts.unresolvedClaimPaths` counts judgments left `ambiguous`.

**Stage predictions** (`stagePredictions`). With `interviewGroundTruth:null`,
every stage is a `role_informed_prediction`; `externallyVerifiedInterviewStages`
is always 0 in this version.

**Deterministic rubric findings** (`deterministicFindings`) apply the preserved
rubric's posting-only rules without annotation. They are reported, not rejected,
and exit 0 is unchanged:

| Type | Path | Rubric | Caps |
|---|---|---|---|
| `posting_cited_as_stage_evidence` | `stageRoadmap[i].evidenceIds` | D4, D5 | grounding ≤ 1, uncertainty ≤ 1 |
| `stage_confidence_exceeds_evidence` | `stageRoadmap[i].confidence` above `low` | D4, D5 | grounding ≤ 1, uncertainty ≤ 1 |
| `overall_confidence_exceeds_evidence` | `summary.overallConfidence` above `low` | D5 | uncertainty ≤ 1 |
| `weak_signal_not_declared` | `summary.weakSignalCase` not `true` | D5 | uncertainty ≤ 1 |

The canonical example's stage cites the posting, so it reports one of these in
addition to its planted annotation finding. The run-02 confidence caps are taken
from the rubric's WE-3a checker output, because the upstream corpus file that
holds them is not bundled.

**Screening warnings** (`screeningWarnings`) are keyword matches over
claim-bearing text: `interview_history_wording`, `candidate_report_wording`,
`unregistered_source_reference` (other URL schemes, protocol-relative links,
`www.` hosts and bare domains on common TLDs that are not the registered
posting) and `unverified_quotation` (a quoted span of six or more words that is
not verbatim in the frozen posting; straight double, curly double and curly
single quotes; a curly single-quoted span ends at its first apostrophe). Unregistered `http(s)` URLs are flagged the same way and no
longer abort the run (rubric D3). No URL fails automatically, reserved test
domains included: a plan may repeat an invented URL to warn the user away from
it, so the flag is decided by a human like any other.

Each warning has a `review` value:

- `unreviewed`: no decision is recorded. Owning the annotation does not review a
  warning.
- `decided_confirmed`, `decided_acceptable`, `decided_false_positive`: a
  declared independent human recorded a decision (rubric H6) in the schema 2
  field `screeningDecisions: [{ path, signal, decision, reason }]`. One entry
  covers every match of that signal on that path. A decision that matches no
  warning, a duplicate, or one under any other owner is rejected.
- `covered_by_finding`: the path already has a finding whose grounding ceiling
  is 0, so confirming the flag could not lower it. A `contradicted_claim`
  (ceiling 2) or a minor finding does not cover a warning.

`confirmed` creates a critical finding, `confirmed_screening_failure` (grounding
ceiling 0), whatever claim type or path the judgment carries. `acceptable` and
`false_positive` are the reviewer's unverified word; the Markdown prints each
with its reason. A lexicon alone still never creates a finding, and a miss is
not evidence of support.

## Human ratings and unavailable metrics

The preserved [v0.3.0 rubric](rubric.v0.3.0.md) provides the 0–4 anchors. Rating
dimension IDs are `roleRelevance`, `evidenceGrounding`, `prioritization`,
`handlingUncertainty`, `practicalUsefulness`. Each score needs integer `value`
0–4, `raterId`, `authorType:human`, `independence:independent`, `reviewedAt`,
`rubricVersion:0.3.0` and a nonempty `reason`. Duplicate rater/dimension records
are errors. There is no total, pass mark or quality headline. Every raw rating is
kept in `humanReview.records`, whatever happens to the aggregate.

An aggregate is reported for a dimension only when all of these hold:

0. **Pinned, complete corpus.** A manifest was supplied and matches the outputs.
   Otherwise every rated dimension is `N/A` and `humanReview.status` is
   `corpus_not_pinned` or `corpus_incomplete`.
1. **Two raters, every output.** Each output in the dataset has at least two
   distinct declared independent human raters for that dimension (rubric §4.3).
   Otherwise the dimension is `status:N/A`, `value:null`, with `count`,
   `eligibleOutputs`, `coveredOutputs` and a `missing` list of
   `{caseId, outputId, eligibleRaters}`. `humanReview.coverage` lists unrated
   outputs and dimensions; `humanReview.status` is `incomplete_coverage`.
2. **Independent human custody.** Ratings count only when the annotation
   snapshot's owner is a declared independent human. Ratings in a model-owned
   (`custody:model_owned_snapshot`) or same-author/unknown human snapshot
   (`custody:non_independent_human_snapshot`) are kept but not counted.
3. **No open adjudication issue** for that dimension on any output. Otherwise it
   is `status:requires_adjudication`, `value:null`, with disputed output IDs.

A reported value is the mean of per-output means, so an output with more raters
does not outweigh another; `humanReview.perOutput` shows each cell. Ratings
describe an illustrative excerpt (`humanReview.scope`), not a full Prepio plan.

`humanReview.adjudicationIssues` identifies each issue with its dimension,
output, `raterIds`, `findingPaths` and reason:

| Type | Raised when |
|---|---|
| `rating_disagreement` | Ratings for one output and dimension differ by more than one point |
| `grounding_finding_conflict`, `severity:critical` | Grounding above 0 beside `unsupported_interview_history`, or grounding 3–4 beside `contradicted_claim` |
| `grounding_finding_conflict`, `severity:minor` | Grounding 3–4 beside `unsupported_claim` |
| `rating_exceeds_rubric_cap` | A rating exceeds the cap from a deterministic rubric finding |
| `unreviewed_screening_signal` | Grounding above 0 beside a screening warning with no recorded decision (a confirmed flag would cap grounding at 0) |
| `unresolved_claim_label` | Grounding 3–4 while any claim on the output is labelled `ambiguous` |
| `critical_failure_disagreement` | Grounding ratings of 0 and 1 for one output: raters disagree on whether a critical failure exists (rubric §4.3) |
| `rating_implies_unrecorded_critical_failure` | A grounding 0 with no critical finding recorded for the output |

A dimension that needs adjudication still lists its `missing` outputs, and the
Markdown always prints unrated outputs and dimensions. When rated outputs carry
critical findings, the Markdown status line says how many; the harness sets no
caps on the other four dimensions.

A grounding conflict is raised whoever owns the annotation. `findingBasis` says
whether the finding comes from a declared independent human or an unverified
annotation; an unverified finding is an unresolved conflict, never a human
confirmation. Any issue withholds the entire affected dimension across the
dataset; no disputed output is silently dropped from its denominator. Other
dimensions remain descriptive when consistent. Markdown explains the same issues.

An annotation owner may be `human` or `model`; independence is `independent`,
`same_author` or `unknown`. Independent annotations must declare a human owner
whose ID differs from the output author. Metadata is an attestation, not identity
authentication: aliases and false declarations require human audit.
After individual record validation, identity strings are reconciled across all
annotation owners, typed source-review attributions and human ratings. They are
compared after Unicode normalisation, trimming, whitespace collapsing and
case-folding, so `rater-a`, `Rater-A` and `rater-a ` are one identity. An ID
declared both model and human is rejected, even across cases. An output's author
cannot rate that output, and an annotation owner who declares `same_author` or
`unknown` cannot also rate that output as an independent human. Independence is
output-specific: a human author may review a different output. The evaluator
does not infer other aliases or split prose attribution strings.

Adjudication requires a new explicitly reviewed, resealed annotation snapshot and
a new report bundle. Preserve the previous bundle with its original ratings and
findings. There is no override field or automatic rewriting of ratings to zero.

No human scores are included in the canonical example. Its same-author model
annotations illustrate mechanics and never become verified ground truth. Human
scores with zero ratings and every performance metric return `status:N/A`,
`value:null`, and a reason. A nonexistent observation is not a measured zero.
Source hashes prove frozen bytes, not source authenticity, currentness or review.

## Chronology

Dates are `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`. Source capture, output
creation, annotation review and each rating are compared at full precision: a
same-day inversion between two timestamps is rejected. A date-only value covers
its whole UTC day, so a certain inversion is still rejected, including one
across a chain: an output dated only by day is bounded below by its source
capture, and reviews and ratings are compared against that bound. A same-day
order that remains undecidable is accepted and recorded: `checks.chronology`
becomes `date_precision_only` and `chronologyNotes` lists each comparison. The
canonical fixtures use date-only output and review dates and report exactly
that. Millisecond and offset timestamps are rejected rather than truncated.

## Explicitly unsupported

The harness does not, and does not claim to:

- authenticate sources, annotators or raters, or detect a fabricated passage
  that has been resealed into a case;
- verify that evidence supports a claim, beyond verbatim passage matches;
- detect fabricated claims that avoid the screening lexicons, obfuscated links
  (homoglyphs, "dot com"), or non-English wording;
- detect duplicate or cherry-picked cases: a manifest shows outputs dropped
  after it was fixed, not a case that was never listed or a manifest edited later;
- check a screening decision: `false_positive` and `acceptable` are reported,
  not verified;
- keep a trace when an annotation is replaced by another owner's;
- detect look-alike rater names (homoglyphs). Zero-width and soft-hyphen aliases
  are normalised, and a declared human whose ID names a model (`gpt`, `codex`,
  `llm`, `model`, `bot`) is rejected, which catches mistakes, not intent;
- pin the scorer: the rubric bytes are pinned in `score.mjs`, the scorer hash is
  only reported;
- score captured Prepio runs, unscorable outputs or attempt accounting;
- measure Prepio research quality, establish a baseline, or act as a gate.

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
