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
