# Recurring hygiene review — 2026-06-24

## Summary

Ninth recurring codebase hygiene & security review for Prepio.

Eight merges have landed since 2026-06-20: a clutch of UX-restructure
work for the "interview-as-object" epic ([#180](https://github.com/akkkkkkki/prepio/pull/180)
"Your interviews" home, [#178](https://github.com/akkkkkkki/prepio/pull/178)
Dashboard Start-here marker), a Practice autosave label fix
([#182](https://github.com/akkkkkkki/prepio/pull/182), PREPIO-108), the
date-fns v3→v4 Dependabot bump merged with a compatibility patch
([#181](https://github.com/akkkkkkki/prepio/pull/181)), and three
`answer-feedback` reliability fixes — [#169](https://github.com/akkkkkkki/prepio/pull/169)
(race-handling), [#179](https://github.com/akkkkkkki/prepio/pull/179)
(PREPIO-97 concurrent-regeneration + rollback) and the follow-up
[#184](https://github.com/akkkkkkki/prepio/pull/184) which moves the
insert + supersede sequence into a `create_answer_feedback_atomic`
SECURITY DEFINER RPC.

Headline status:

1. **`npm audit` is still clean** (0 vulnerabilities, fifth run in a
   row).
2. **Test count grew by 19.** 310 → 329 tests across 40 → 42 files,
   all passing. Concentration is on the new `Interviews` page,
   `answer-feedback` handler atomic-RPC mocking, and a mobile-Auth
   redirect-target test (`/dashboard` → `/interviews`).
3. **One new SECURITY DEFINER RPC merged this cycle.** Reviewed in
   detail below; clean — `SET search_path = ''`, REVOKE from
   `PUBLIC, anon, authenticated`, GRANT only to `service_role`.
4. **Three of the seven PREPIO-9x deferred tickets closed since
   2026-06-20.** PREPIO-95 (#168), PREPIO-97 (#179 + #184), and
   PREPIO-93 partially-resolved-by-Dependabot-superseding-itself.
   The other four (PREPIO-91, -92, -94, -96) still sit untouched in
   **Quality & Maintenance**.
5. **The Dependabot pile-up the last three audits flagged finally
   moved.** date-fns v4 ([#181](https://github.com/akkkkkkki/prepio/pull/181))
   is merged with the compat patch; one open PR pile reduced from 7
   to 6 (and two of those — #142 and #145 — were superseded by fresh
   #170 and #171 because the originals went stale).
6. **No new lint regressions.** 7 errors / 8 warnings baseline is
   unchanged for the third consecutive review (same files, same
   lines).
7. **Stale codex-bot / cursor-bot scaffold PRs still accumulating** —
   11 PRs from `github-actions[bot]` / `cursor[bot]` on
   `codex/...` or `cursor/missing-test-coverage-...` branches sit
   open with no recent activity (oldest #110, newest #163). New
   finding for this run; filed as PREPIO-110 for a cleanup pass.

No application code, no schema, no auth flow, no product behaviour
touched in this run. No small lint fix made — the 7-error / 8-warning
baseline holds.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (unchanged from
  2026-06-20).
- `npm run lint`: 15 problems (7 errors, 8 warnings). Identical to
  2026-06-20 baseline; same files, same lines.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 59 precache entries, 2216.01 KiB —
  nine entries more than 2026-06-20 because of the new `Interviews`
  page + `Calendar`/etc. test asset).
- `npm test`: pass (42 test files, 329 tests; +19 vs. 2026-06-20's
  310). Includes vitest + `check-legacy-schema.sh` +
  `check-answer-feedback-schema.sh`.
- `npm audit`: **0 vulnerabilities.**

## Security review of the `create_answer_feedback_atomic` RPC (one-off this run)

PR [#184](https://github.com/akkkkkkki/prepio/pull/184) extracted the
insert + supersede sequence into a new PostgreSQL function and the
handler now calls it via `supabase.rpc(...)`. RPCs that wrap writes
warrant their own checklist because they bypass the read/write
boundaries normally enforced by table grants. Verified against
[`supabase/migrations/20260623210533_answer_feedback_atomic_rpc.sql`](../../supabase/migrations/20260623210533_answer_feedback_atomic_rpc.sql)
and
[`supabase/functions/answer-feedback/handler.ts`](../../supabase/functions/answer-feedback/handler.ts).

- **Execute grants.** `REVOKE ALL ... FROM PUBLIC, anon,
  authenticated; GRANT EXECUTE ... TO service_role` (migration
  lines 96-103). Only edge functions with the service-role key can
  invoke it. Anon and signed-in users cannot call it directly even
  with a forged PostgREST request.
- **Search-path pinning.** `SET search_path = ''` (line 24). Matches
  the project standard documented in
  [`supabase/migrations/20260515150000_security_hardening_and_resume_rpc.sql`](../../supabase/migrations/20260515150000_security_hardening_and_resume_rpc.sql).
  All in-function table references are fully qualified
  (`public.answer_feedback`), so a poisoned search_path can't shadow
  the target.
- **AuthZ still server-side.** The handler runs the existing
  ownership re-read (`handler.ts:264-276`, `sessionResult.data.user_id
  !== req.userId` → 404) and entitlement re-check (`handler.ts:239-243`,
  `getEntitlement` → 403 `paid_entitlement_required`) **before** the
  RPC fires. The RPC itself is a `service_role`-trusted call —
  ownership is enforced at the edge, not in SQL — which is
  consistent with the rest of `answer-feedback` and the project's
  documented pattern.
- **Optimistic-concurrency check.** The RPC takes
  `p_expected_current_feedback_id` and raises a unique-violation
  (`ERRCODE 23505`) when the current head moved between the handler
  read and the RPC call. The handler maps that to a 409
  `feedback_already_exists` (`handler.ts:374-380`). No partial-write
  rollback is needed because the insert + supersede live in the same
  transaction.
- **No new data surface.** The RPC reads/writes only the
  `answer_feedback` rows that already existed before — same columns,
  same RLS scope on subsequent SELECTs through the handler. No
  information disclosure delta from 2026-06-20.

## Findings

### Critical

- None.

### High

- None.

### Medium

- [ ] **11 stale codex-bot / cursor-bot PRs accumulating** — new
  finding
  - Evidence: `mcp__github__list_pull_requests --state open` returns
    11 PRs from `github-actions[bot]` / `cursor[bot]` whose branches
    are `codex/prepio-...` or `cursor/missing-test-coverage-...`:
    [#110](https://github.com/akkkkkkki/prepio/pull/110),
    [#115](https://github.com/akkkkkkki/prepio/pull/115),
    [#119](https://github.com/akkkkkkki/prepio/pull/119),
    [#127](https://github.com/akkkkkkki/prepio/pull/127),
    [#131](https://github.com/akkkkkkki/prepio/pull/131),
    [#134](https://github.com/akkkkkkki/prepio/pull/134),
    [#135](https://github.com/akkkkkkki/prepio/pull/135),
    [#151](https://github.com/akkkkkkki/prepio/pull/151),
    [#158](https://github.com/akkkkkkki/prepio/pull/158),
    [#161](https://github.com/akkkkkkki/prepio/pull/161),
    [#163](https://github.com/akkkkkkki/prepio/pull/163). Several
    target Linear epics that are already in motion (PREPIO-27, -33,
    -40, -56, -57, -76, -78, -88); others are speculative test-
    coverage drafts.
  - Risk: Process noise, not security. They show up in every
    Dependabot triage scroll and obscure real review work. Stale
    branches also rot — when the team finally wants to land any of
    them the diff has drifted from `main`.
  - Recommended fix: One-pass review by the product owner: close the
    ones whose Linear ticket is being done differently, mark the
    rest as drafts with a comment promising a date. Don't merge
    them as-is without rebasing.
  - Owner / next step: [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110/stale-codex-bot-cursor-bot-pr-cleanup-pass)
    filed in **Quality & Maintenance** to schedule the cleanup pass.

### Low / clean-up

- [ ] **Four PREPIO-9x deferred tickets still untouched** — re-flagged
  - Evidence:
    [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) (dev-deps
    merge — #148 + #159 still open),
    [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) (Actions
    majors — replaced by #170 and previously-#143 and #144),
    [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) (Radix-UI
    focused upgrade — Dependabot opened a fresh #171 superseding
    #145), and
    [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    (`lovable-tagger` keep-or-drop decision — third audit asking).
  - Recommended fix: PO answers the two open product questions
    below and PREPIO-91 / -94 land. PREPIO-96 is one line in
    `package.json` once the answer is in. None require code review
    from the hygiene runner.

- [ ] **Lint baseline is unchanged but covers test files that aren't
  user-facing** — informational, no recommended fix
  - Evidence: 4 of the 7 lint errors live in
    [`tests/unit/test_edge_functions/`](../../tests/unit/test_edge_functions)
    and
    [`tests/integration/test_workflows/`](../../tests/integration/test_workflows)
    — same `@typescript-eslint/no-explicit-any` violations the
    2026-06-20 review documented. These tests target Deno edge
    functions and were never migrated to the project's TS
    strictness.
  - Recommended fix: None. Either the suite gets rewritten (out of
    scope for hygiene) or these errors stay as documented baseline.

- [ ] **`package-lock.json` carries `date-fns@^4.1.0` for a transitive
  dependency** — informational, no action
  - Evidence: `grep '"date-fns"' package-lock.json` shows the direct
    `^4.4.0` plus a `^4.1.0` entry at line 10000 (a nested
    transitive). They resolve to the same v4.x branch so the
    lockfile is internally consistent, but worth noting so a future
    audit doesn't flag this as drift.
  - Recommended fix: None.

## Small fixes made in this run

The only "small fix" this run is filing the new Linear ticket the
*Findings — Medium* section called for:

- **[PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110/stale-codex-bot-cursor-bot-pr-cleanup-pass)**
  — Stale codex-bot / cursor-bot PR cleanup pass (11 open PRs that
  have drifted from `main` and aren't going to age into mergeable
  state on their own). In **Quality & Maintenance**, labelled
  `Chore` + `area:infra`, cross-links back to this audit doc.

The audit doc itself plus the README index entry are the only
changes to `main` this run. No application code, no schema, no auth
flow, no product behaviour touched.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to re-discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge (#148 + #159). Unchanged since 2026-06-20.
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors. Original PRs superseded by fresh Dependabot opens (#170
  checkout 7.0.0, plus #143 upload-artifact 7.0.1 and #144 setup-node
  6.4.0 still open). Update the Linear ticket to reference the
  current PR set.
- [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) — Radix-UI
  27-package bump (now #171, supersedes the closed #145).
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Third audit waiting.
- **New: PREPIO-110** — Stale codex-bot PR cleanup pass (see
  *Findings — Medium*).

## Questions for product owner

- **Stale codex-bot PRs (#110, #115, #119, #127, #131, #134, #135,
  #151, #158, #161, #163)** — keep, close, or rebase? New question
  this run. Most target Linear epics that are already in motion;
  letting them sit in the open list is making real-triage work
  harder.
- **Is the Lovable.dev component tagger (`lovable-tagger`) still in
  use?** Fourth run asking. One-line cleanup blocked on this.
- **Dependabot cadence — keep monthly, or tighten to weekly?** Fourth
  run asking. The 2026-06-21 wave landed cleanly via #181, but the
  pile of 6 still-open Dependabot PRs (and the fact that #142 / #145
  went stale before they got merged) suggests monthly is still too
  loose. Weekly with the same `open-pull-requests-limit: 5` would
  smooth the cadence.

## Next review focus

1. **Whether the four still-open PREPIO-9x tickets move.** -97 closed
   in this window; the rest should be tractable once the PO answers
   the questions above.
2. **The stale codex-bot PR list** — did PREPIO-110 (or whatever the
   PO decides) reduce the open-PR count?
3. **`answer-feedback` once it has production traffic with the new
   atomic RPC.** The static review covered the SECURITY DEFINER
   surface; the deployed-traffic review (still owed from 2026-06-20)
   should sanity-check `generation_metadata.input_snapshot` payload
   size and confirm no model-output text accidentally lands in logs
   under the new code path.
