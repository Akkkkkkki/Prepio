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
for unavailable interview ground truth. The final suite contains 54 harness tests.

## Repository checks

Local environment: Node v25.8.1, lockfile-installed Vitest v4.1.9. CI uses Node 22;
local success does not assert that remote CI ran. No dependencies were added.

| Check | Observed result |
|---|---|
| Focused harness tests | 54 passed, included in full run |
| `npm test` | 548 tests / 59 files passed; legacy-schema, answer-feedback-schema and design-token checks passed |
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
