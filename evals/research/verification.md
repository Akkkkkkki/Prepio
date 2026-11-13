# Verification record

Source inspected: current remote main `a33093906c7e3bb1d191f0e769efbadf570b9999`,
its `CLAUDE.md`, native plan/request interfaces and pure evidence-ledger compacting;
PR #318 runner at `18aae8ca08ed42a95cbdd8d42a4c6e5b8c34b710`.
Implementation approval: owner follow-up in this Codex chat, 2026-11-09.
Checkout: isolated `codex/offline-research-eval-phase-a` branch. The original
checkout's pre-existing `.github/dependabot.yml` edit was not touched.

## Test-first evidence and revisions

Tests and frozen fixture records were written before `score.mjs`. The original
main has no scorer. Initial execution using the original checkout's older
node_modules stalled; a native-config attempt failed because main's Vite config
uses `__dirname`. A locked `npm ci --ignore-scripts` in the isolated checkout
resolved that tooling mismatch without changing the dependency files.

Standalone assertions against the unchanged, inspected PR #318 runner reproduced:

- Empty citation denominator: expected unavailable (`null`), got `1`.
- Duplicate run case IDs: expected a duplicate-ID exception; no exception occurred.

The new harness's absence is a different boundary: with `score.mjs` withheld,
47 contract tests failed. This demonstrates missing functionality, not 47 existing
product bugs. An initial extra parenthesis in the test file was corrected before
that run. The negative-test helper imports the module outside error assertions,
so missing-module messages cannot masquerade as successful validation tests.

On implementation, 46/47 initially passed. The missing-output test first exposed
an unsafe test-helper binding assumption; after that was corrected, it exposed
an unknown-annotation-output error preceding the more useful missing-case-output
error. Validation now checks missing case outputs before annotation links; 47/47
passed.

A further adversarial pass added five tests. Three failed meaningfully against
the initial implementation: unannotated prose in summary industry metadata,
annotations predating output creation, and outputs predating source capture.
Industry is now constrained to this case's `tech` metadata, and chronology is
checked at the stored dates' day granularity. Missing run metadata and malformed
record tests also pass. Sorting uses code-unit comparisons, avoiding ICU locale
variation. Two additional tests verify native long-JD truncation and require explicit `null`
for unavailable interview ground truth. The final suite contains 60 harness tests after independent-review regressions.

## Repository checks

Local environment: Node v25.8.1, lockfile-installed Vitest v4.1.9. CI uses Node 22;
local success does not assert that remote CI ran. No dependencies were added.

| Check | Observed result |
|---|---|
| Focused harness tests | 65 passed, included in final full run |
| `npm test` | 559 tests / 59 files passed after independent-review revisions; legacy-schema, answer-feedback-schema and design-token checks passed |
| `npm run typecheck` | Passed ratchet: app 61, node 0 existing type errors |
| `npm run typecheck:functions` | Passed ratchet: 19 existing errors; static checks only, no functions executed |
| `npm run build` | Passed; existing large-chunk warning remains |
| `npm run lint` | Exit 1: 40 errors, 9 warnings in unchanged files; informational under existing CI policy |
| ESLint on `vitest.setup.ts` | Passed |
| `node --check` on scorer/tests; `git diff --check` | Passed |
| Source lineage | Both stored passages are verbatim in supplied S02; original snapshot SHA and unchanged rubric SHA match |
| CLI | Exit 0; one case, seven annotated paths, one unsupported-interview-history finding; metrics and human ratings N/A |
| Repeated report bytes | JSON and Markdown identical across two fresh output directories (CLI test) |
| Browser smoke | 3 passed. Initial sandbox localhost-bind and missing-Chromium failures resolved with local-server permission and a lockfile-matched browser in a temporary directory; provider requests blocked. |

## Review and provenance limitations

The author reviewed all new paths, source binding, annotation coverage, N/A
handling, provenance upgrade rejection and exclusive report output. This is not
independent review. Independent review must name its exact commit; any findings,
revisions and final reviewer result are recorded on the draft PR/review request.
No claim of independent approval is made in this record.

The sample is model-authored with same-author illustrative annotations. It has no
actual Prepio invocation, independently authenticated human labels, verified
interview ground truth, telemetry, calibrated ranking/thresholds, representative
corpus or measured baseline. Declared human ownership is not authenticated by the
evaluator. Original full source captures are not redistributed. Approval of the
implementation does not certify source authenticity or turn annotations into
verified ground truth.

A Linear sub-issue creation attempt was rejected by automatic approval review
because sending the scope/approval payload to Linear was not explicitly authorized.
No Linear issue was created or updated. The branch avoids PREPIO-148 auto-completion.

## Independent review and revisions

A separate read-only reviewer inspected the complete diff at commit
`729854b9efac56f69deaed02ce52615fa72c53fe` against `a330939`. All 54 tests passed,
but the reviewer reproduced four P2 findings with resealed snapshots:

1. Uppercase URL schemes bypassed the prose citation scanner. Match schemes
   case-insensitively and normalize scheme/host via the URL parser.
2. A JD-only source could be labeled as contradicting interview history despite
   missing ground truth. Reject both supported and contradicted historical
   decisions; preserve insufficient evidence rather than inferring absence.
3. A one-item array was coerced into a matching source SHA by RegExp. Validate
   the type explicitly before checking the format.
4. Ratings 0 and 4 were averaged to 2 without adjudication. Preserve raw scores,
   flag same-output disagreements greater than one point and withhold aggregates
   as N/A/requires_adjudication, as required by the preserved rubric.

Six regression/control tests were added first: four failed against that commit
and 56 passed. The implementation was then corrected. Final verification and a
new independent review target are recorded on the PR/review request. Final
focused tests: 60 passed. Full `npm test`: 554 tests / 59 files plus all schema
and design-token checks passed. CLI determinism tests and syntax/diff checks
passed; the canonical report remains one expected finding with N/A metrics.
Typecheck, build and local browser smoke results above remain applicable: the
revisions touch evaluation files only and do not affect their inputs. The reviewer
did not authenticate sources, human identities or semantic annotation correctness.

## Publication authorization update

On 2026-11-09 the owner explicitly approved this draft PR's automatic Vercel
preview only and creation of the Phase A issue in the stated Linear destination
with scope/validation/approval context. The retried issue creation returned
“exceeded the free issue limit”; no issue, status or billing change was made.
The branch remains separate from PREPIO-148. The earlier approval rejection above
is historical, not an outstanding permission request.

Code commit `92fa3b96605cc66db49f40d00063269e0d2a16ce` was independently
re-reviewed: no remaining actionable findings; all 60 focused tests and original
review probes passed. This publication follow-up changes evaluation documentation
only. Request independent review again on the final publication commit. Keep the
PR draft and unmerged; do not change deployment configuration or deploy production.

## GitHub review follow-up

GitHub CI passed on `de1b5ef56f44266999a13cec3e181821ac96755e` under Node 22,
including type checks, build, repository tests and browser smoke. The independent
GitHub review of that commit found one further P2 issue:
[ledger source metadata was not bound](https://github.com/Akkkkkkki/Prepio/pull/396#discussion_r4508592927).
A resealed ledger could rename its source label/title/platform to fabricated
interview-source metadata without adding judgment paths.

Five tests were added before fixing the issue: forged sourceLabel, title,
platform, relevance and trustWeight all failed meaningfully (60 passed).
The validator now requires the native pasted-JD builder's fixed label/title,
platform and high/high weights, checked against main's addInlineEntry and
trustWeightFor implementation. All 65 focused tests and 559 repository tests
plus schema/design-token checks pass. The changes are evaluation-only; previous
app build/typecheck/browser results remain applicable.

The final updated commit is independently re-reviewed and explicitly re-requested
on GitHub after push. Final review/check receipts live on PR #396, preserving
this file as an immutable history rather than embedding its own commit hash.

## Trustworthiness revision — 2026-11-09

Implementation commit: `42ec2c268613164bc1301510abea4f19cd659bd9`, based on the
audited `fc28e139c42c3102539aeddbd576fedc3f69d2be`. This follow-up documentation
entry records author verification of that exact implementation; it does not
constitute a new independent audit. The dated PR396 audit is preserved unchanged.

The owner approved retaining optional human ratings and implementing the reviewed
plan. The revision addresses EV396-01 with dataset-wide exact-ID/type reconciliation
and output-specific independence checks. It addresses EV396-02 by retaining raw
scores/findings, emitting structured adjudication issues, and withholding the whole
grounding dimension when positive ratings conflict with any declared independent
human unsupported-history finding for the same output. Model annotations alone
do not trigger that rule. Numerical rating-disagreement handling remains active.

Before changing the scorer, the expanded suite produced 22 failures and 66 passes
against `fc28e13`, including both audit regressions. These failures demonstrate
missing safeguards/report features, not 22 distinct product-quality defects.
The archive tests also exposed silent CLI non-execution through a symlinked entry
path (including macOS temporary-directory aliases). A dedicated symlink regression
was added and the CLI now compares resolved real paths. The final suite has 89
tests, including all original 65 tests.

Environment: Node `v25.8.1`, existing Vitest `4.1.9`; no dependencies installed or
changed. Vitest used a temporary config that imports the checked-in Vite config,
disables environment-file loading, sets two workers and places its cache outside
the repository. The installed Homebrew Node 22 launcher failed before execution
because `libsimdjson.29.dylib` is missing; this revision was not rerun on Node 22.

| Check | Observed result for the implementation commit |
|---|---|
| Focused harness suite | 89 passed |
| Full Vitest suite | 583 tests / 59 files passed |
| Legacy-schema, answer-feedback-schema, design-token scripts | All passed |
| `npm run typecheck` | Passed ratchets: app 61 existing errors, node 0 |
| `npm run typecheck:functions` | Passed ratchet: 19 existing errors; static checks only |
| `npm run build` | Passed; existing chunk-size warning remains |
| `npm run lint` | Exit 1: 40 errors, 9 warnings in unchanged files; informational CI baseline |
| Scorer/test syntax and `git diff --check` | Passed |
| Identity regressions | Same-record, cross-case and typed source-review conflicts rejected with contextual errors; reversing input order preserves results/errors; a human author can review another output |
| Grounding adjudication | EG 1–4 withheld for independent-human unsupported history, including another rater; EG=0 and consistent positive controls remain descriptive; raw ratings and unrelated dimensions preserved |
| Provenance | Resealed incorrect rubric digest and changed/missing bundled rubric rejected; changed scorer bytes produce their actual fingerprint |
| Bundle replay | Exact input/scorer/rubric bytes archived, including CRLF array input; relocating the archive and replaying without dependencies yields identical JSON and Markdown |
| Canonical result | Schema 2; one case, seven annotated paths, one annotation-supported claim, one planted finding; human ratings and all performance metrics remain N/A; CLI exits 0 |

Verified scorer raw-byte SHA-256:
`a82fe1c49d41818052fe39e04fc40c8dd2b14092361ee8ccc687e078f8225da4`.
Unchanged rubric raw-byte SHA-256:
`26ab37cab025eff0220e8915deb7545089f94c5a5743b8e6399dd8f4c87450a6`.

Only evaluation code, tests and documentation changed. No application/prompt,
orchestration, auth, database, Edge Function or deployment changes were made.
Browser smoke was not rerun because application inputs are unchanged. No provider
calls, captured Prepio runs, authenticated human reviews, source authentication,
measured baseline or release gate are established by these checks. Corpus selection
and captured-run comparison work remain deferred as specified in the plan.

## Validity revision — 2026-11-13

Scope: evaluation files only (`score.mjs`, both test files, `README.md`,
`intent.md`, this record). The three fixture JSON files and the rubric are
byte-identical to `4eb7b2f`. This entry is the implementing author's own
verification. It is not an independent audit and establishes no measured Prepio
quality, human validation or source authentication.

### State found before work

- Head was `4eb7b2f642f73b06ae9b3846447a2ca4aa3a900f`, unchanged since review.
- GitHub reported the PR as ready for review although this record, `intent.md`
  and the PR body say to keep it draft. It was returned to draft before any push.
- Codex's P2 thread on day-granularity chronology was open and is addressed here.
- The "dated PR396 audit" cited above for EV396-01/02 is not a file in this PR.
- The text supplied as the adversarial report was the upstream package's build
  narrative, with no probe list. Probes were derived from the owner's seven
  focus areas, the preserved rubric, `intent.md` and the open review thread.

### Red, then green

Tests were written and run before the scorer changed.

| Run | New regression file | Existing `score.test.mjs` |
|---|---|---|
| Red, committed as `15cdf16` against the `4eb7b2f` scorer | 71 tests: 61 failed, 10 passed | 89 passed |
| Final regression file against the `4eb7b2f` scorer | 72 tests: 62 failed, 10 passed | n/a |
| Green, final scorer | 72 passed | 89 passed |

The 10 that passed before the fix are controls and one documented limit:
grounding 2 beside a contradicted or unsupported role claim, grounding 0 beside
an independent-human finding, six malformed-date rejections, and
millisecond-timestamp rejection. Every other test was red for its stated reason:
the old scorer returned `status: evaluated` in each case rather than failing for
an unrelated cause. One test was added after the first red run
(`whatItTests` as a stage-claim path); it is also red against the old scorer.

Before the fix, the compound case rendered through the CLI as "0 finding(s)",
"All deterministic integrity checks passed" and 4 on every human dimension,
exit 0. It was: interview history attributed to a named review site, stated at
high stage and overall confidence, relabelled by a same-author model annotation,
with ten "independent human" ratings of 4 carried in that model-owned record.
The same input now yields four deterministic rubric findings, two unreviewed
screening warnings, no aggregate on any dimension and all ten raw ratings
retained.

### Existing tests changed

No test was deleted and no assertion was loosened to hide a failure. Fourteen
existing tests changed because the approved specification changes the behaviour
they pinned:

| Tests | Change | Why |
|---|---|---|
| "accepts declared independent human scores…", "allows a descriptive mean…", "allows EG=0…", "keeps a consistent positive grounding control…", "allows a human author to independently review a different output" | Second rater and a human-owned snapshot added; expected counts updated | Aggregates need two raters per output and human custody |
| "withholds EG=1–4 contradicted by the same independent human review" (4) | Second rater for the unrelated dimension; stage citation removed | Same, and the canonical stage citation now caps grounding at 1 |
| "withholds the whole dimension across cases…" | Second output made a clean control | A model finding now conflicts, so the uncontrolled second output was disputed too |
| "does not upgrade a non-independent model/human annotation…" (2) | Retitled; now expects the aggregate withheld with an unverified `findingBasis` | Owner-approved reversal: an unverified finding is an unresolved conflict, still never a human confirmation |
| "explains numeric disputes…" | Expects the disagreement and the unverified conflict | Same reversal |
| "reports schema v2…" | Schema 3 | Report schema changed |

### Checks run on the final tree

Environment: Node v22.23.4, Vitest 4.1.9, lockfile dependencies, no installs.

| Check | Observed result |
|---|---|
| Harness tests (`npx vitest run evals/research/`) | 161 passed, 2 files |
| `npm test` | 655 tests / 60 files passed; legacy-schema, answer-feedback-schema and design-token checks passed |
| `npm run typecheck` | Passed ratchets: app 61, node 0 existing errors |
| `npm run typecheck:functions` | Passed ratchet: 19 existing errors |
| `npm run build` | Passed |
| ESLint on the three changed code files | No findings |
| `node --check`, `git diff --check` | Passed |
| Canonical CLI run with `--as-of 2026-11-13T00:00:00Z` | Exit 0; 1 critical annotation finding (unverified model annotation), 1 deterministic finding, 1 screening warning covered by the finding, chronology `date_precision_only`, all human scores and metrics N/A |
| Replay | Existing relocated-bundle test and the new `--as-of` test produce byte-identical JSON and Markdown |

Browser smoke was not run: no application input changed. GitHub CI and the
independent review of the pushed commit are recorded on the PR, not here.

Scorer raw-byte SHA-256:
`bcc0c247412df61f0658d7904507a48fd27af5a8c0a75daa2251be2bbeed7a38`.
Rubric raw-byte SHA-256, unchanged:
`26ab37cab025eff0220e8915deb7545089f94c5a5743b8e6399dd8f4c87450a6`.

### Reproduction matrix after the fix

| Probe | Before | After |
|---|---|---|
| FC1 source link without an http(s) scheme | Evaluated silently | `unregistered_source_reference` warning; unregistered http(s) still rejected |
| FC2/FC3 same-author model labels hide a claim | "0 finding(s)", unqualified | Basis reported as unverified; wording flagged; ambiguous paths counted |
| FC4 interview claim relabelled as a supported role requirement | Evaluated, 2 supported claims | Rejected on the stage path; unsupported is always critical |
| FC5 fabricated quotation | Evaluated | `unverified_quotation` warning |
| CS1–3, HS4–5 confidence and stage citation beyond posting-only evidence | No finding; ratings of 4 reported | Deterministic D4/D5 findings; ratings above the cap withheld |
| CS4 hypothetical counted as supported | Counted | Only factual claims counted; verbatim matches separated |
| HS1 grounding 4 beside a model-authored finding | 4 reported | Withheld as an unresolved, unverified conflict |
| HS2/HS3 grounding 3–4 beside contradicted or unsupported claims | 4 reported | Withheld; critical and minor distinguished |
| EP6 one person as `unknown` owner and `independent` rater | 4 reported | Rejected |
| EP3, RC7 whitespace or case alias | Accepted | Rejected |
| EP4 ratings in a model-owned snapshot | Mean reported | Kept raw, not counted, reason given |
| RC1–RC5 single rater, omitted dissenter, unrated output or dimension | Mean reported | N/A with counts and missing case/output IDs |
| RC6 unequal rater counts | Pooled mean 2.67 | Mean of per-output means, with per-output values |
| TP1–TP4 same-day inversions | Evaluated | Rejected |
| TP5 date-only same-day order | Passed silently | `date_precision_only` with notes |
| TP6 future-dated record | Accepted | Rejected when `--as-of` is supplied; otherwise `futureDates: not_evaluated` |
| EP2 unverifiable capture hash shown as `sourceCaptureHashes: pass` | Shown as pass | Renamed `sourceHashInternalConsistency`; `sourceAuthenticity: not_evaluated` |

### Not fixed, by design

Pinned as "documented limit" tests so the behaviour cannot change unnoticed:
a fabricated passage resealed into a case is not detected (EP1); duplicate case
content under a second ID is counted (EP5); millisecond timestamps are rejected
rather than truncated; a claim that avoids the screening lexicons raises nothing.
Also unchanged: identities are self-declared, so a model can declare itself a
human owner or invent two rater names; the harness reports that it cannot tell.
Rubric lexicon check D7, captured runs, unscorable-output accounting and the
upstream package's predictions about Prepio's own pipeline are out of scope.

One strictness choice to review: the preserved rubric lists D4 as capping
handling-uncertainty at 2 and D5 at 1. A stage citing the posting is treated as
both, following the rubric's WE-3a checker output, so it caps uncertainty at 1.
