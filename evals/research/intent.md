# Offline research evaluation intent

Approved for this implementation by the repository owner in the Codex chat on
2026-11-09: “Please treat them as approved. If any conflict, please use your best
judgement”. This authorizes evaluation-only implementation and expert resolution
of the supplied design v2 and opportunity/rubric package v0.3.0 conflicts.
It does not establish independent human annotations or empirical calibration.

Create a small offline evidence-integrity demonstration for OpenAI — Applied AI
Architect, Large Enterprise — London, UK. Use frozen snapshots in native Prepio
plan paths. Detect record/reference errors deterministically; report semantic
judgments with their actual annotation owners. Never infer interview history
from the job posting, or represent illustrative material as a captured run.

## Resolved scope

- Apply design v2's single-source, counts-only Phase A contract. The package's
  five-case/seven-variant suite is future work; do not invoke/emulate the pipeline.
- Preserve upstream `EVAL-AAA-02`, opportunity ID and `S02`. Identify our shortened
  JD-only example with a separate `phase-a-jd-excerpt-v1` variant. It omits the
  original fictional CV, guide and full posting, so it is not a replay of that case.
- Freeze two verbatim S02 passages and exact pasted request text. Store the
  original fixture, source-register, rubric and snapshot hashes as lineage.
  There is one canonical London posting; its ATS URL is the same posting.
- Preserve native `official_job` with `url:null`; bind its excerpt/snippet to the
  pasted JD with main's whitespace/truncation semantics, not URL equality.
- Include one intentionally unsupported factual interview-history assertion.
  Its external illustrative annotation must produce a finding with exit 0.
- Apply strict run-level grounding. Job evidence cannot support interview-history
  labels. No company-wide guide is included here; the wider rubric's scoped-medium
  broad-stage policy is not exercised. Specific assessment formats remain unknown.
- Keep ranking and numerical pass thresholds inactive. Human 0–4 ratings, when
  supplied by declared independent human owners, are descriptive only. An AI
  grader cannot be a human rater. The bundled annotations are model-authored,
  from the output's author, and are never independently verified ground truth.
- Use `N/A`/JSON `null` with reasons for unavailable metrics, including missing
  interview ground truth, execution telemetry and empty human denominators.
- Version the data, annotation contract and preserved rubric. Preserve the
  original v0.3.0 rubric bytes/status as historical provenance; this harness
  does not rename it 1.0.0 or claim calibration occurred.

## Acceptance contract

Strictly reject missing, malformed, duplicate, unknown or inconsistently bound
cases, outputs, annotations, citations, passages, native fields and human scores.
Cover every claim-bearing text path with exactly one external judgment. Reject
self-grading fields and unsupported attempts to upgrade provenance. Full captured
Prepio runs require a future capture manifest/full-plan validator and are rejected
in this version, even if renamed to look real.

Repeated inputs produce byte-identical JSON and Markdown. Hash UTF-8 text with LF
line endings and canonical JSON sorted recursively by key, excluding only the
record's own top-level `sha256`. Reports contain input dates and hashes, never
runtime timestamps or output paths. No default baseline or quality thresholds.

CLI exits: 0 = valid records evaluated (findings allowed); 2 = invalid input,
configuration or I/O error, with JSON on stderr; 1 reserved, unused. Create reports
only in a new output directory with exclusive file creation.

Run adversarial tests before implementation, record legacy defect probes and
verification failures/revisions, then run focused tests and applicable repository
checks. Open a draft PR, request independent review on its exact final commit and
leave it unmerged. PREPIO-148 remains deferred; this does not establish a baseline.

## Boundaries

Only `evals/research/` and minimal test-environment wiring may change. No application,
prompt, orchestration, auth, database, Edge Function, deployment configuration,
production service, personal data, credential or paid provider access. The scorer
uses only Node standard library and explicitly supplied local JSON.

The separate Phase A Linear sub-issue could not be created: automatic approval
review rejected exporting its scope/approval payload without explicit Linear
destination authorization. Use a branch without PREPIO-148 rather than linking
that deferred issue to completion. No issue status was changed.

Publication authorization update, 2026-11-09: the owner explicitly approved the
Linear destination/payload and this draft PR's automatic Vercel preview only.
The retried Linear creation was rejected because the workspace has reached its
free issue limit. No issue or billing change was made; retain the separate Phase A
branch without a PREPIO-148 completion link. No deployment settings may change,
and no production deployment, automatic merge or other deployment is authorized.

## Trustworthiness revision — 2026-11-09

The owner explicitly requested implementation of the reviewed improvement plan:
retain human ratings, reconcile declared identities across the dataset, withhold
grounding aggregates contradicted by any declared independent human unsupported
interview-history finding, and preserve raw ratings with adjudication reasons.
Model annotations alone do not trigger that human-review rule. Independence is
output-specific; identity authentication and alias inference remain outside scope.

Report schema 2 binds the actual scorer and unchanged rubric bytes and archives
the supplied snapshots plus both artifacts for offline replay. The evaluator now
reads those two bundled artifacts as well as explicitly supplied local JSON;
input snapshot schemas and valid-with-findings exit 0 remain unchanged. Expected
corpus selection, captured runs, semantic calibration, telemetry and release gates
remain deferred. The dated audit of `fc28e13` remains a historical record.

## Validity revision — 2026-11-13

An adversarial review of `4eb7b2f` reproduced validity failures: a plan stating
fabricated interview history at high confidence could be reported with zero
findings, every check passed and 4/4 human ratings. The owner approved the
reproduction matrix and the corrections below; this section supersedes earlier
text where they conflict.

- **Reversed:** "Model annotations alone do not trigger that human-review rule."
  Any annotated finding now conflicts with a grounding rating above its rubric
  ceiling, whoever owns the annotation. An unverified finding is reported as an
  unresolved conflict, never as a human confirmation.
- **Changed:** human aggregates need two declared independent human raters for
  every output, carried in a snapshot that is not model-owned. Otherwise the
  aggregate is N/A with counts and missing case/output IDs. Raw ratings stay.
- **Added:** the preserved rubric's posting-only checks (D4, D5) as deterministic
  findings with their caps; keyword screening warnings; a stage-path rule so the
  interview-history guard no longer depends on the annotation's `claimType`.
  The earlier "a lexicon must never substitute for semantic review" still holds:
  screening hits ask for review and create no findings.
- **Changed:** chronology compares full timestamps; future dates are checked
  only against an explicit `--as-of`; the source-hash check is named for what it
  verifies (internal consistency). Report schema is 3. Input snapshot schemas,
  the three fixture files, the rubric bytes and exit codes are unchanged.

Still out of scope: authentication of sources or people, semantic verification,
captured runs, corpus selection, calibration, thresholds and release gates. This
remains an illustrative demonstration with no measured Prepio quality.
