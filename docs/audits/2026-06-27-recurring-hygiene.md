# Recurring hygiene review — 2026-06-27

## Summary

Tenth recurring codebase hygiene & security review for Prepio.

Nine merges have landed in the three days since 2026-06-24, all of
them UX / docs / test work tied to the [PREPIO-99 "interview as
object" epic](https://linear.app/qiuyue/issue/PREPIO-99) or the
parallel design-token lock-down:

- [#197](https://github.com/akkkkkkki/prepio/pull/197) PREPIO-114 —
  interview-card "needs work" line becomes a Practice CTA (adds
  `searchService.getLowRatedQuestionIds` + a `focus=needs_work`
  filter wired through `Practice.tsx`).
- [#195](https://github.com/akkkkkkki/prepio/pull/195) post-research
  interviews-copy regression test.
- [#194](https://github.com/akkkkkkki/prepio/pull/194) PREPIO-103 —
  Dashboard plan de-densified (priority strip + leverage card
  dropped).
- [#193](https://github.com/akkkkkkki/prepio/pull/193) Dashboard
  breadcrumb target fix.
- [#191](https://github.com/akkkkkkki/prepio/pull/191) PREPIO-112 —
  post-research copy now points to "Your interviews."
- [#190](https://github.com/akkkkkkki/prepio/pull/190) 2026-06-25 UX
  routine note (run #2) + PREPIO-111 / 112 / 113 filed.
- [#189](https://github.com/akkkkkkki/prepio/pull/189) design-token
  surface lock — radius / badge / label helpers in
  [`src/lib/designTokens.ts`](../../src/lib/designTokens.ts), rolled
  through Dashboard / Practice / Home / History / profile views.
- [#188](https://github.com/akkkkkkki/prepio/pull/188) navigation
  history-fetch skip assertion.
- [#187](https://github.com/akkkkkkki/prepio/pull/187) corrected the
  2026-06-24 audit counts.

Headline status:

1. **`npm audit` is still clean** — 0 vulnerabilities, sixth
   consecutive run.
2. **Test count grew by 11** — 329 → 340 across 42 → 43 files, all
   passing. New coverage concentrates on `Interviews.test.tsx`
   needs-work CTA wiring, `searchService.test.ts`
   `getLowRatedQuestionIds`, the design-token guards in
   [`src/lib/__tests__/designTokens.test.ts`](../../src/lib/__tests__/designTokens.test.ts),
   and the navigation history-fetch skip.
3. **No schema, auth, edge function, or RLS change in this window.**
   Every merge is UI / state / docs / tests; nothing crosses the
   trust boundary, so no SECURITY DEFINER or service-role review is
   owed this run.
4. **Dependabot pile crept back up** — 6 → 7 open PRs after #146
   opened on 2026-06-22 (React 18→19 group upgrade). Same four
   PREPIO-9x tickets (-91, -92, -94, -96) still sit untouched in
   **Quality & Maintenance**; PREPIO-110 (stale bot PR cleanup) is
   also untouched.
5. **Stale bot-PR pile grew further** — 11 → 16. The 2026-06-24
   count only included `github-actions[bot]` and the
   `cursor/missing-test-coverage-...` branch-name pattern; the full
   set is **11 github-actions[bot] + 5 cursor[bot] = 16**, including
   the four-week-old [#84](https://github.com/akkkkkkki/prepio/pull/84)
   ("test: cover answer feedback failure guards", opened 2026-06-01)
   that earlier audits missed. One new addition this window
   ([#192](https://github.com/akkkkkkki/prepio/pull/192) cursor[bot]
   "Add regression coverage for interview states" opened 2026-06-25).
   Re-flagged on PREPIO-110.
6. **No new lint regressions.** 15 problems (7 errors / 8 warnings)
   — identical to 2026-06-24 baseline. Same files, same lines.
7. **One open maintainer PR worth flagging for the next review** —
   [#198](https://github.com/akkkkkkki/prepio/pull/198) (PREPIO-80,
   role-family-aware research query planning) touches the research
   pipeline; merge it before 2026-06-30 and the next hygiene run
   should re-audit the `interview-research` orchestrator the way
   2026-06-24 audited `create_answer_feedback_atomic`.

No application code, no schema, no auth flow, no product behaviour
touched in this run. No small lint fix made — the baseline holds.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (sixth consecutive
  clean run).
- `npm run lint`: 15 problems (7 errors, 8 warnings). Identical to
  2026-06-24 baseline; same files, same lines.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 60 precache entries, 2213.65
  KiB — one entry more and ~2 KiB lighter than 2026-06-24 because of
  the new `Interviews` regression-test code-split balanced by the
  `Dashboard` de-densification in PREPIO-103).
- `npm test`: pass (43 test files, 340 tests; +11 vs. 2026-06-24's
  329). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: **0 vulnerabilities.**
- `npm outdated`: 60 packages have a newer minor/major available; six
  Dependabot PRs already wrap up the obvious upgrade waves, with #146
  (React 18→19) as the new addition. None of the remaining drift maps
  to an active security advisory.

## Review focus this run

Because no edge function, schema, or auth surface moved this window
the security-focused part of the review is necessarily light. The
only new server-facing code path is
[`searchService.getLowRatedQuestionIds`](../../src/services/searchService.ts)
(PR #197). Spot-check:

- **Auth boundary.** Calls `getCurrentUser()` and scopes the
  `practice_sessions` lookup with both `user_id` and `search_id`;
  the follow-up `practice_answers` query is then restricted to the
  returned `session_id` set. RLS on both tables already enforces the
  same scoping, so this is defense-in-depth at the client layer.
  Clean. No information disclosure delta — the data is a strict
  subset of what
  [`buildInterviewSummaries`](../../src/services/searchService.ts)
  already exposes on `/interviews`.
- **Logging.** Failure path uses `console.error("Error loading
  low-rated question ids:", error)` — same shape as the rest of
  `searchService.ts`. No PII or rating value leaked even on error.
- **Trust boundary.** No new RPC, no service-role-key path, no
  edge-function entry-point. The function is a thin read from
  signed-in user-owned tables.

The PR also adds a `focus=needs_work` URL parameter to
[`Practice.tsx`](../../src/pages/Practice.tsx). That parameter is
read into local React state and used only as a client-side filter;
it does not influence any server request, so no injection surface to
audit.

## Findings

### Critical

- None.

### High

- None.

### Medium

- [ ] **Bot-PR pile grew from 11 → 16 with PREPIO-110 still
  untouched** — re-flagged
  - Evidence:
    `mcp__github__list_pull_requests --state open` returns **16**
    open bot PRs: 11 `github-actions[bot]` (codex / cursor branches)
    + 5 `cursor[bot]` (regression-coverage drafts). New since
    2026-06-24:
    [#192](https://github.com/akkkkkkki/prepio/pull/192) (cursor[bot],
    "Add regression coverage for interview states", opened
    2026-06-25). Also: the 2026-06-24 count missed the four-week-old
    [#84](https://github.com/akkkkkkki/prepio/pull/84) (cursor[bot],
    "test: cover answer feedback failure guards", opened 2026-06-01)
    — flagging it now so PREPIO-110's scope is honest.
  - Risk: Same as 2026-06-24 — process noise, not security.
    Triage cost grows linearly with the pile.
  - Recommended fix: Same as 2026-06-24 — one cleanup pass on
    [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110), now
    correctly scoped to 16 PRs not 11.
  - Owner / next step: PREPIO-110 still open in **Quality &
    Maintenance**; update its description to reflect the corrected
    count (and the four-week age on #84).

- [ ] **Dependabot pile crept 6 → 7; React 18→19 group upgrade is
  the new entry** — re-flagged
  - Evidence:
    [#146](https://github.com/akkkkkkki/prepio/pull/146) (chore(deps):
    bump the react group across 1 directory with 4 updates, opened
    2026-06-22) joins the still-open #143, #144, #148, #159, #170,
    #171.
  - Risk: React 18→19 is a major upgrade with breaking renderer
    changes — not a routine bump. Hidden in the Dependabot pile it
    will sit unmerged and rot until someone decides whether the
    project is ready. Same risk profile as the date-fns v4 upgrade
    that took three audits to land.
  - Recommended fix: Split — close #146 as "we'll decide React 18→19
    separately" and file a Linear issue for the React 19 decision so
    Dependabot stops re-opening it after the upgrade window closes.
    The other six (#143/#144/#170 actions, #148/#159 dev-deps, #171
    radix-ui) can land per the original PREPIO-91 / -92 / -94 plan.
  - Owner / next step: PO decides on React 19 timing (block on
    PREPIO-99 epic completion first, or punt — either is fine, just
    not "Dependabot decides for us by leaving the PR open").

### Low / clean-up

- [ ] **Four PREPIO-9x deferred tickets still untouched** —
  re-flagged (third consecutive audit)
  - Evidence:
    [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) (dev-deps
    merge — #148 + #159 still open),
    [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) (Actions
    majors — #143, #144, #170 still open),
    [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) (Radix-UI
    27-package bump — #171 still open),
    [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    (`lovable-tagger` keep-or-drop — fourth audit waiting).
  - Recommended fix: Same as 2026-06-24 — PO answers the open
    questions below and the tickets land. None require code review
    from the hygiene runner.

- [ ] **Lint baseline unchanged but still covers test files that
  aren't user-facing** — informational, no recommended fix
  - Evidence: Same 7 errors / 8 warnings as 2026-06-24. 4 of the 7
    errors live in
    [`tests/unit/test_edge_functions/`](../../tests/unit/test_edge_functions)
    and
    [`tests/integration/test_workflows/`](../../tests/integration/test_workflows)
    (`@typescript-eslint/no-explicit-any` on a Deno-style test
    suite). The other 3 are in `src/components/ui/*` (shadcn-derived
    files with `@typescript-eslint/no-empty-object-type`) plus the
    `tailwind.config.ts` `require()` rule.
  - Recommended fix: None. Documented baseline; CI tolerates lint
    errors (1) but fails on parse errors (2) — that contract is
    intact.

- [ ] **`npm outdated` shows 60 entries; most are minor** —
  informational
  - Evidence: 60 lines from `npm outdated`. Of those, ~30 are the
    Radix-UI patch bumps already bundled in Dependabot #171. Major
    upgrades worth noting: `react`/`react-dom` 18→19 (#146),
    `eslint` 9→10, `@types/react` 18→19, `typescript` 5→6,
    `tailwindcss` 3→4, `zod` 3→4, `vite` 7→8, `pdfjs-dist` 5→6,
    `react-router-dom` 6→7. None map to an open security advisory
    today; flagging the list so the next audit doesn't re-derive
    it.
  - Recommended fix: None this run. Worth bundling under a single
    "Q3 majors decision" Linear ticket if the PO wants any of these
    on the roadmap before they accumulate.

## Small fixes made in this run

None this run.

The audit doc itself plus the README index entry are the only
changes to `main` this run. No application code, no schema, no auth
flow, no product behaviour touched.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to
re-discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge (#148 + #159). Unchanged for three audits.
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors. Current PR set: #143 (upload-artifact 7.0.1), #144
  (setup-node 6.4.0), #170 (checkout 7.0.0). Unchanged for three
  audits.
- [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) — Radix-UI
  27-package bump (#171). Unchanged for three audits.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Fourth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope corrected to 16 PRs (11 github-actions
  + 5 cursor) — see *Findings — Medium*.

## Questions for product owner

- **React 18→19 upgrade (#146)** — defer until after PREPIO-99
  ships, take it now, or punt for the cycle? New question this run.
  Same pattern that bit us on date-fns v4: if no one decides,
  Dependabot opens it, closes it stale, and re-opens it next month
  ad infinitum.
- **Is the Lovable.dev component tagger (`lovable-tagger`) still in
  use?** Fifth run asking. One-line cleanup blocked on this.
- **Dependabot cadence — keep monthly, or tighten to weekly?**
  Fifth run asking. The pile crept up again this window (6 → 7);
  weekly with the same `open-pull-requests-limit: 5` would amortise
  the triage cost instead of letting it bunch.
- **Stale bot-PR cleanup (PREPIO-110)** — accept the cleanup as a
  one-time triage pass (close + comment), or set up an Action that
  auto-closes bot-authored PRs older than 30 days with no
  human-author commits on the branch?

## Next review focus

1. **Whether the four still-open PREPIO-9x tickets and PREPIO-110
   move.** Third audit asking on -91/-92/-94/-96, second on -110.
2. **Re-audit the research pipeline if PR
   [#198](https://github.com/akkkkkkki/prepio/pull/198) (PREPIO-80,
   role-family-aware research query planning) lands.** It modifies
   the `interview-research` orchestrator — the same surface
   2026-06-24 reviewed the new SECURITY DEFINER RPC against.
3. **`answer-feedback` once it has production traffic with the
   atomic RPC.** Still owed from 2026-06-20 / 2026-06-24 — sanity-
   check `generation_metadata.input_snapshot` payload size and
   confirm no model-output text accidentally lands in logs under
   the new code path. No way to do this without traffic, so it
   stays parked until the team can ship the answer-feedback gate to
   real users.
