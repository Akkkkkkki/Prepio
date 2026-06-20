# Recurring hygiene review — 2026-06-20

## Summary

Eighth recurring codebase hygiene & security review for Prepio.

The four PRs merged since 2026-06-17 — `PREPIO-11` answer feedback
display ([#154](https://github.com/akkkkkkki/prepio/pull/154)),
`PREPIO-72` Dashboard mobile footer hook
([#156](https://github.com/akkkkkkki/prepio/pull/156)),
[#162](https://github.com/akkkkkkki/prepio/pull/162) (answer-feedback
service test coverage), and `PREPIO-89` honest guest sample framing
([#165](https://github.com/akkkkkkki/prepio/pull/165)) — all landed
cleanly. The new `answer-feedback` paid-coaching surface (the largest
single change at +1,272 lines across 15 files) was reviewed end-to-end
for authn/authz, entitlement gating, RLS, and information disclosure;
no findings (details in *Security review of the answer-feedback
surface* below).

Headline status:

1. **`npm audit` is still clean.** 0 vulnerabilities, same as
   2026-06-17.
2. **Test count grew by 25.** 285 → 310 tests across 38 → 40 files, all
   passing. The new tests are concentrated on the answer-feedback
   surface (`searchService` contract, `AnswerFeedbackCard`,
   `SessionSummary` extension, mobile footer behaviour on Home and
   Dashboard).
3. **The 2026-06-14 Dependabot wave is still entirely unmerged.** All
   seven PRs ([#142, #143, #144, #145, #146, #148, #159](https://github.com/akkkkkkki/prepio/pulls?q=is%3Apr+is%3Aopen+author%3Aapp%2Fdependabot))
   are open with no Linear tracking issues filed. This is the explicit
   thing 2026-06-17 flagged as the next-review focus and warned could
   become a recurring smell — and it now is. This run files the Linear
   tickets the previous audit promised would be there (see *Small
   fixes* and *Deferred items*).
4. **`dependabot.yml` still has `day: monday` paired with
   `interval: monthly`** — second recurrence, still a silent no-op per
   the Dependabot schedule spec.
5. **`lovable-tagger` dep decision is still pending the product owner.**
   Third recurrence; tracked Linear issue now exists so it stops
   appearing as a free-form finding.

No application code, no schema, no auth, no product flow touched in
this run. No small lint fix made either — the 7-error / 8-warning
baseline is the same one documented at 2026-06-17.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (unchanged from
  2026-06-17).
- `npm run lint`: 15 problems (7 errors, 8 warnings). Identical to
  2026-06-17 baseline; same files, same lines.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite 7.3.5 + PWA, 50 precache entries,
  ~2.16 MiB — one entry / ~0.06 MiB larger than 2026-06-17 because of
  the new `AnswerFeedbackCard` chunk).
- `npm test`: pass (40 test files, 310 tests; +25 vs. 2026-06-17's
  285). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: **0 vulnerabilities.**

## Security review of the answer-feedback surface (one-off this run)

PR [#154](https://github.com/akkkkkkki/prepio/pull/154) introduced
`AnswerFeedbackCard` and wired the existing `answer-feedback` edge
function into both the Practice session summary and the History
session detail. This is paid AI coaching over user-submitted answers,
so it touches enough sensitive surface area to be worth its own
checklist. Verified against
[`supabase/functions/answer-feedback/index.ts`](../../supabase/functions/answer-feedback/index.ts),
[`supabase/functions/answer-feedback/handler.ts`](../../supabase/functions/answer-feedback/handler.ts),
and
[`supabase/migrations/20260525120000_answer_feedback.sql`](../../supabase/migrations/20260525120000_answer_feedback.sql).

- **AuthN.** `index.ts:89-101` calls `authorizeRequest` on the user
  JWT and rejects anything that isn't a `kind === "user"` context with
  a usable `userId`. Service-role calls are explicitly not accepted on
  this endpoint.
- **AuthZ — ownership.** `handler.ts:250-262` re-reads the practice
  session row and rejects the request with a 404 if
  `sessionResult.data.user_id !== req.userId`. `handler.ts:300-302`
  re-binds the question to the search via `search_id` to prevent a
  caller from supplying someone else's answer ID paired with a
  question from their own search.
- **AuthZ — entitlement.** `handler.ts:225-229` re-checks the paid
  entitlement server-side via `getEntitlement` before any model call.
  The 403 returns the structured `paid_entitlement_required` code the
  client renders honestly. Free users can never trigger the model.
- **RLS.**
  [`migrations/20260525120000_answer_feedback.sql:70-79`](../../supabase/migrations/20260525120000_answer_feedback.sql)
  enables RLS with `auth.uid() = user_id` for SELECT and a separate
  service-role policy for writes. The client's
  `getAnswerFeedbackForAnswers` (`searchService.ts:1670-1703`) reads
  through the anon client, so RLS is the actual gate, not the query
  filter.
- **Information disclosure — `generation_metadata.input_snapshot`.**
  `handler.ts:340` writes the full model input (candidate profile,
  question, search, answer) into the `answer_feedback.generation_metadata`
  JSONB column. This is the user's own data on their own row, and RLS
  scopes reads to that user, so the disclosure surface matches the rest
  of the user's practice data. Flagged here so future maintainers don't
  expand the column's reach (e.g. analytics export, admin views) without
  re-checking.
- **Concurrent regeneration race — graceful fallback claim was
  wrong, see Low finding below.** The
  `idx_answer_feedback_current` unique partial index
  (`migrations/20260525120000_answer_feedback.sql:59-61`) is the
  hard enforcement that there is exactly one non-superseded feedback
  per `practice_answer_id`. The first draft of this audit asserted the
  client gracefully recovers from a concurrent collision via the
  `feedback_already_exists` cached-read path. That is wrong — see
  *Findings → Low → answer-feedback concurrent-request race
  surfaces as 500*. The actual collision returns `internal_error`.
- **Prompt-injection blast radius.** The model input is the user's own
  question / answer / profile / search. Even if a malicious answer
  attempts a prompt-injection, the function only writes structured
  feedback to a row keyed to that user, so the worst case is
  self-targeted. No external system is reachable from the model output.
- **Logging.** `index.ts:143` and `handler.ts:227,238,257,292,327,360,
  370,379,384` log structured events; nothing logs the answer text,
  candidate-profile text, or model output. Only IDs, model name, and
  error messages.

One Low finding from this review — *answer-feedback concurrent
request race* — see *Findings → Low*. Surfaced by the Codex automated
PR review (PR #167); the original audit text incorrectly described the
race as gracefully handled and has been corrected above.

## Findings

### Critical

None this run.

### High

None this run.

### Medium

None this run.

### Low / clean-up

- [ ] **`answer-feedback` concurrent-request race surfaces as `500
  internal_error` instead of falling back to cached feedback** — new
  this review, found by Codex review on PR #167
  - Evidence: Two concurrent calls for the same
    `practice_answer_id` can race past the pre-model existence check
    at
    [`handler.ts:304-306`](../../supabase/functions/answer-feedback/handler.ts).
    The unique partial index
    `idx_answer_feedback_current`
    ([`migrations/20260525120000_answer_feedback.sql:59-61`](../../supabase/migrations/20260525120000_answer_feedback.sql))
    then rejects the second insert (no-existing case) or the second
    `superseded_by = null` mark-current update (concurrent-regenerate
    case). Both error paths go through
    [`handler.ts:359-361`](../../supabase/functions/answer-feedback/handler.ts)
    or
    [`:378-380`](../../supabase/functions/answer-feedback/handler.ts)
    and return `{ status: 500, error: "internal_error" }`. The
    client's `feedback_already_exists` cached-read path
    ([`searchService.ts:1729-1738`](../../src/services/searchService.ts),
    [`SessionList.tsx:120-129`](../../src/components/history/SessionList.tsx),
    [`Practice.tsx:332-352`](../../src/pages/Practice.tsx)) only
    triggers on the `feedback_already_exists` code, so the second
    caller sees the generic error toast instead of the freshly-saved
    feedback the first caller produced.
  - Risk: Low. Trigger surface is narrow — same-user double-click on
    "Get coaching" / "Regenerate", or two tabs hitting the same
    answer at once. No data corruption (the unique index guarantees
    state stays consistent); the user just sees a misleading error
    they could refresh past.
  - Recommended fix: In the insert and mark-current error paths,
    detect Postgres unique-constraint violations
    (`error.code === "23505"`) and either (a) re-read the now-current
    feedback and return it as a success with a
    `concurrent_regeneration: true` flag, or (b) map to `status: 409,
    error: "feedback_already_exists"` so the existing client cached-
    read path takes over. Option (b) is the smaller change. Add a
    handler-level test for the race using a fake supabase that fails
    the second insert with a 23505.
  - Owner / next step: Tracked in
    [PREPIO-97](https://linear.app/qiuyue/issue/PREPIO-97).

- [x] **Dependabot wave Linear-tracking gap** — second recurrence,
  fixed this run
  - Evidence: All seven PRs from 2026-06-14 — [#142](https://github.com/akkkkkkki/prepio/pull/142),
    [#143](https://github.com/akkkkkkki/prepio/pull/143),
    [#144](https://github.com/akkkkkkki/prepio/pull/144),
    [#145](https://github.com/akkkkkkki/prepio/pull/145),
    [#146](https://github.com/akkkkkkki/prepio/pull/146),
    [#148](https://github.com/akkkkkkki/prepio/pull/148),
    [#159](https://github.com/akkkkkkki/prepio/pull/159) — are still
    open. None had a Linear-tracking issue at the start of this run,
    despite 2026-06-17 *Deferred items* asserting they were "tracked
    in Linear under the **Quality & Maintenance** project so they
    don't have to be re-discovered next review."
  - Risk: Low individually; the missing-tracking gap is the actual
    problem — a deferred-but-untracked list defeats the audit doc's
    own contract.
  - Recommended fix: File the tickets the prior audit said were
    there. Done in this run — see *Small fixes* for the Linear issue
    IDs.
  - Owner / next step: The PO disposition question (bulk-merge vs.
    focused-upgrade for the React and Radix groups) is still open;
    each ticket carries that as the first question to answer.

- [ ] **`dependabot.yml` `day: monday` is a silent no-op with
  `interval: monthly`** — second recurrence, still deferred to the
  cadence-question answer
  - Evidence:
    [`.github/dependabot.yml:13-15`](../../.github/dependabot.yml) and
    [`:53-55`](../../.github/dependabot.yml). Same as 2026-06-17 —
    GitHub's docs say `day` is ignored when `interval: monthly`. The
    only way to verify: the wave landed on 2026-06-14 (Saturday), not
    a Monday.
  - Recommended fix: One-line edit per the prior audit. Now tracked
    in Linear; will land alongside the cadence-question answer.
  - Owner / next step: See *Small fixes* for the Linear issue ID. The
    monthly-vs-weekly cadence question is still in *Questions for
    product owner* for the third run in a row.

- [ ] **`lovable-tagger` dep decision pending** — third recurrence
  - Evidence:
    [`package.json:100`](../../package.json) still lists
    `lovable-tagger@^1.1.7`; the `"esbuild": "^0.28.1"` override in
    [`package.json:113-115`](../../package.json) is the workaround
    that keeps it safe. The plugin is only loaded in `vite.config.ts`
    development mode for Lovable.dev's component tagger.
  - Risk: Low. The override holds esbuild at a safe version, so this
    is a maintenance-surface concern, not a security one.
  - Recommended fix: PO answers the "is the Lovable.dev tagger still
    in use?" question — if no, drop the dep + `componentTagger()`
    import + override entry. Now tracked in Linear; see *Small
    fixes*.

- [ ] **Lint baseline is unchanged but covers test files that aren't
  user-facing** — informational, no recommended fix
  - Evidence: 4 of the 7 lint errors live in
    [`tests/unit/test_edge_functions/`](../../tests/unit/test_edge_functions)
    and
    [`tests/integration/test_workflows/`](../../tests/integration/test_workflows)
    — all the same `@typescript-eslint/no-explicit-any` violations the
    last review documented. These tests target Deno edge functions and
    were never migrated to the project's TS strictness.
  - Recommended fix: None. Either the suite gets rewritten (
    out-of-scope for hygiene) or these errors stay as documented
    baseline.

## Small fixes made in this run

The only "small fix" this run is filing the Linear tickets the
2026-06-17 audit said would already exist. No code, no docs, no config
changes pushed against `main`. Tickets:

- **[PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91)** — Merge
  dev-only Dependabot PRs #159 (testing group) and #148
  (lint-and-format group). Covers the safest dispositions from the
  2026-06-17 audit.
- **[PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92)** — Land
  the three GitHub Actions major bumps (#142 checkout, #143
  upload-artifact, #144 setup-node) one at a time so a CI break is
  bisectable.
- **[PREPIO-93](https://linear.app/qiuyue/issue/PREPIO-93)** — Scope
  the React 19 upgrade (#146) as focused work with a Home / Dashboard
  / Practice / Profile smoke test, instead of merging the bulk
  Dependabot PR.
- **[PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94)** — Scope
  the Radix-UI batch upgrade (#145, 27 packages) as deployed-preview
  QA work, instead of merging the bulk Dependabot PR.
- **[PREPIO-95](https://linear.app/qiuyue/issue/PREPIO-95)** — Fix
  the `day: monday` no-op in
  [`.github/dependabot.yml`](../../.github/dependabot.yml) (drop the
  key, or switch to weekly). Decide alongside the cadence question.
- **[PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)** — Decide
  whether `lovable-tagger` is still needed; if not, remove the dep,
  the `componentTagger()` import in `vite.config.ts`, and the
  `esbuild` overrides entry that exists to hold its nested pin safe.
- **[PREPIO-97](https://linear.app/qiuyue/issue/PREPIO-97)** — Fix
  the `answer-feedback` concurrent-request race so a unique-constraint
  collision returns `feedback_already_exists` (or a cached-read
  success) instead of `internal_error`. Surfaced by Codex review on
  this audit's PR (#167).

All seven issues are in **Quality & Maintenance**, labelled `Chore` +
the matching Area label, and cross-link back to this audit doc and
the relevant PR / config line.

## Deferred items

Now tracked exclusively in Linear (no free-form bullets to re-
discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge (#159 + #148).
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors (#142, #143, #144).
- [PREPIO-93](https://linear.app/qiuyue/issue/PREPIO-93) — React 19
  focused upgrade (close #146 in favour of scoped work).
- [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) — Radix-UI
  focused upgrade (close #145 in favour of scoped work).
- [PREPIO-95](https://linear.app/qiuyue/issue/PREPIO-95) — Dependabot
  `day: monday` no-op fix.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision.
- [PREPIO-97](https://linear.app/qiuyue/issue/PREPIO-97) —
  `answer-feedback` concurrent-request race fix.

## Questions for product owner

- **Dependabot cadence — keep monthly, or tighten to weekly?**
  Third run asking. Monthly produced one 7-PR pile-up that nobody
  triaged for 6 days; weekly would smooth the cadence at the cost of
  more frequent triage. PREPIO-95 will close as soon as this is
  answered.
- **Is the Lovable.dev component tagger (`lovable-tagger`) still in
  use?** Third run asking. Answer unblocks PREPIO-96 (a small cleanup
  PR + the ability to drop the `esbuild` overrides entry).
- **OK to close #145 (Radix-UI 27-package bump) and #146 (React 19
  group) in favour of focused-upgrade tickets (PREPIO-94 and
  PREPIO-93)?** The audit recommendation has been the same for two
  reviews now — confirm so the Dependabot PRs can be closed instead
  of sitting open.

## Next review focus

1. **Whether the new Linear tickets (PREPIO-91 → 96) are moving.**
   The whole point of filing them was so the next review wouldn't
   have to re-describe the same Dependabot wave; first check next
   time is "did any of them merge / get a disposition."
2. **Lint baseline composition.** If the test-suite `any`s get
   cleaned up (or the Deno tests get rewritten), the documented
   7-error baseline shifts. Not urgent, just track the diff so it
   doesn't get re-flagged as a regression.
3. **`answer-feedback` once it has production traffic.** This run did
   the static review (above). The first deployed-traffic review
   should sanity-check the
   `generation_metadata.input_snapshot` payload size (it includes the
   full candidate profile + question + answer per row — could matter
   for JSONB storage cost at scale) and confirm no model-output text
   accidentally lands in logs.
