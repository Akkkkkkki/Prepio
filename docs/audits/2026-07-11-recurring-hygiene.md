# Recurring hygiene review — 2026-07-11

## Summary

Fourteenth recurring codebase hygiene & security review for Prepio.

Seventeen commits merged to `main` in the three days since 2026-07-08.
This was a **backlog-clearance window**: both of the highest-priority
open findings from the 2026-07-08 audit closed on their own tickets,
five stale cursor-bot test PRs were rebased-and-merged in a single
morning batch, the last two Dependabot Actions majors landed, and a
new product-visible flag change shipped end-to-end with a matching
migration.

Merged this window:

- **Runtime**
  - [#233](https://github.com/akkkkkkki/prepio/pull/233) — **fix:
    allow question flags to coexist.** Product bug — the old
    `user_question_flags` unique key was `(user_id, question_id)`, so
    marking a question as `favorite` silently overwrote a previous
    `needs_work` flag on the same question (and vice versa). Fix ships
    end-to-end: [migration
    `20260710203000_question_flags_per_type.sql`](../../supabase/migrations/20260710203000_question_flags_per_type.sql)
    drops the old constraint and adds
    `(user_id, question_id, flag_type)`;
    [`supabase/schema.sql`](../../supabase/schema.sql) updated in
    lockstep;
    [`src/services/searchService.ts`](../../src/services/searchService.ts)
    and
    [`src/services/search/practice.ts`](../../src/services/search/practice.ts)
    change the map shape from `Record<qid, {flag_type, id}>` to
    `Record<qid, Partial<Record<flag_type, {flag_type, id}>>>` and
    thread new `hasQuestionFlag` / `getQuestionFlagTypes` helpers into
    [`Practice.tsx`](../../src/pages/Practice.tsx),
    [`History.tsx`](../../src/pages/History.tsx), and
    [`components/history/SessionList.tsx`](../../src/components/history/SessionList.tsx).
    65 lines of new test coverage in
    [`searchService.test.ts`](../../src/services/searchService.test.ts)
    +
    [`Practice.mobile.test.tsx`](../../src/pages/__tests__/Practice.mobile.test.tsx).
    Retro-audit clean — see below.
  - [#231](https://github.com/akkkkkkki/prepio/pull/231) — **feat: add
    in-session needs-work toggle.** PREPIO-120 — surfaces the existing
    `needs_work` flag as a button next to the favorite star on both
    the mobile and desktop practice screens, so users can flag mid-
    session instead of only from Session Summary. 57 lines in
    `Practice.tsx`, 39 lines in tests. Uses the (still-single-flag)
    map shape at merge time; #233 landed a day later and rewrote both
    read sites to the new coexist-safe helpers — no dangling old-shape
    code left. Also adds `aria-pressed` / `aria-label` on both the new
    button and the existing favorite button.
  - [#232](https://github.com/akkkkkkki/prepio/pull/232) —
    **[PREPIO-121] Unify new-prep CTA copy to 'Prep a new
    interview'.** Five different labels ("New interview", "Start a
    new research run", "Start New Search" ×4, "Start new research")
    all pointing at the same destination collapsed to one. Also
    changed the History empty-state link from `/` (which redirects
    signed-in users to `/interviews`) to `/new-interview` so the CTA
    label matches where you actually land. Touches
    [`Dashboard.tsx`](../../src/pages/Dashboard.tsx),
    [`History.tsx`](../../src/pages/History.tsx),
    [`Home.tsx`](../../src/pages/Home.tsx),
    [`Interviews.tsx`](../../src/pages/Interviews.tsx),
    [`Practice.tsx`](../../src/pages/Practice.tsx). Copy-only, no
    logic drift.
  - [#234](https://github.com/akkkkkkki/prepio/pull/234) —
    **[PREPIO-122] Give the mobile nav hamburger a 44x44 touch
    target.** [`Navigation.tsx:127`](../../src/components/Navigation.tsx)
    switched from `size="sm"` (36×~42) to `size="icon"` (44×44). Adds
    a regression test asserting `h-11 w-11` on the trigger button.
    One-line product change with matching test.

- **CI / typecheck infra**
  - [#236](https://github.com/akkkkkkki/prepio/pull/236) —
    **[PREPIO-119] Replace no-op CI typecheck with an error-count
    ratchet.** The 2026-07-04 and 2026-07-08 Medium finding closed.
    `npm run typecheck` now runs
    [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh),
    which invokes `tsc -p tsconfig.app.json` and
    `tsc -p tsconfig.node.json` for real and compares the error count
    against pinned baselines (app: **381**, node: **0**). The ratchet
    fails on any regression above the baseline and prints a friendly
    "lower the baseline to lock in the improvement" hint on any
    reduction. Big win: real type regressions can no longer silently
    land, and the +20 backlog delta from PREPIO-47 / #231 / #233 is
    now the ceiling to burn down from.

- **Docs**
  - [#226](https://github.com/akkkkkkki/prepio/pull/226) — 2026-07-08
    recurring hygiene review.
  - [#229](https://github.com/akkkkkkki/prepio/pull/229) — 2026-07-09
    UX review routine run #5 (357-line doc + screenshots for run #5).
  - [#227](https://github.com/akkkkkkki/prepio/pull/227) —
    **[PREPIO-118] Align CLAUDE.md routes and primary flow with
    shipped router.** Small docs correction to keep CLAUDE.md
    reflecting the real routing (Interviews-first for signed-in
    users).
  - [#223](https://github.com/akkkkkkki/prepio/pull/223) — **[PREPIO-91]
    Restore accurate eslint 10 lint baseline (54 problems).** The
    2026-07-08 High finding closed — human PR landed as flagged,
    restoring the correct 54-problem count and reinstating the
    react-hooks-7 untriaged breakdown in
    [`docs/TESTING.md`](../../docs/TESTING.md).

- **Tests (batch merge of stale cursor-bot PRs on 2026-07-10)**
  - [#84](https://github.com/akkkkkkki/prepio/pull/84) — cover
    answer-feedback failure guards.
  - [#207](https://github.com/akkkkkkki/prepio/pull/207) — cover
    Tavily fallback shim behavior (new
    [`duckduckgo-fallback.test.ts`](../../supabase/functions/_shared/duckduckgo-fallback.test.ts),
    89 lines).
  - [#230](https://github.com/akkkkkkki/prepio/pull/230) — cover
    practice follow-up defaults.
  - [#134](https://github.com/akkkkkkki/prepio/pull/134) — cover
    non-blocking practice audio transcription.
  - [#192](https://github.com/akkkkkkki/prepio/pull/192) — regression
    coverage for interview states.
  - [#235](https://github.com/akkkkkkki/prepio/pull/235) — cover
    desktop needs-work toggle.

- **Dependencies (both remaining Actions majors)**
  - [#143](https://github.com/akkkkkkki/prepio/pull/143) —
    `actions/upload-artifact` 4 → 7.0.1.
  - [#144](https://github.com/akkkkkkki/prepio/pull/144) —
    `actions/setup-node` 4.4.0 → 6.4.0.

Headline status:

1. **Both prior-audit findings closed.** The 2026-07-08 High
   ([PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) lint
   baseline) landed via #223 (94a0c6b, 2026-07-09). The 2026-07-08
   Medium (CI typecheck no-op) landed via #236 (de3d7da, 2026-07-10).
   **Two clean audit windows in a row** if you count from where these
   started drifting.
2. **`npm audit` is still clean** — 0 vulnerabilities, tenth
   consecutive run. Dependency tree: 248 prod / 577 dev / 78 optional
   / 8 peer (unchanged).
3. **Lint baseline unchanged at 54 problems (46 errors, 8 warnings).**
   No net drift since the react-hooks 7 upgrade landed; #223's docs
   restore matches the live count today.
4. **Typecheck ratchet holding at baseline** — app: 381, node: 0. Up
   from the 2026-07-08 measured 361 by +20; the delta breaks down as
   test-file additions from #192 (+12 in
   [`Interviews.test.tsx`](../../src/pages/__tests__/Interviews.test.tsx)),
   #230 (Practice.followup test errors), #231, and #233 test coverage.
   **Zero of the +20 landed in product source files** —
   [`Practice.tsx`](../../src/pages/Practice.tsx) stayed at 15,
   [`searchService.ts`](../../src/services/searchService.ts) stayed at
   22. Good signal that the flag-shape refactor was type-safe on the
   product side.
5. **Bundle essentially flat.** PWA precache 60 entries / 2265.65 KiB
   today vs 60 entries / 2264.64 KiB on 2026-07-08 (+1.01 KiB). No
   drift from any of the runtime changes.
6. **Test count 351 → 367** (+16 tests, file count 45 → 46 with the
   new
   [`duckduckgo-fallback.test.ts`](../../supabase/functions/_shared/duckduckgo-fallback.test.ts)).
   All green in `npm test`.
7. **Dependabot pile 2 → 0.** #143 (upload-artifact 7.0.1) and #144
   (setup-node 6.4.0) both merged 2026-07-10.
   [**PREPIO-92**](https://linear.app/qiuyue/issue/PREPIO-92) can
   close as Done alongside PREPIO-91.
8. **Bot-PR pile 22 → 18 (−4 net).** Five cursor-bot test PRs
   rebased-and-merged in the 12:44 batch on 2026-07-10 (a fresh
   consequence of the maintainer's willingness to accept cursor-bot
   work after review); one new github-actions-bot PR opened
   ([#237](https://github.com/akkkkkkki/prepio/pull/237) —
   "PREPIO-98: Plan remaining major dependency migrations", docs-only,
   2026-07-10, draft). Composition today: 17 github-actions + 1 cursor
   = 18 (down from 16 + 6 = 22).
9. **Two human PRs still open:** [#215](https://github.com/akkkkkkki/prepio/pull/215)
   (mockup adoption, ready-for-review since 2026-07-05) and
   [#228](https://github.com/akkkkkkki/prepio/pull/228) (PREPIO-53
   target retrieval from note signals, ready-for-review 2026-07-11).
   Neither this audit's concern to land.

No small code fix made in-tree this run — the two prior findings
closed on their own tickets and no new small hygiene issue surfaced
that fits the "single reviewable PR" scope.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (tenth consecutive clean
  run).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Same
  breakdown as 2026-07-08 — 39 react-hooks 7 rule violations plus the
  standing 15-problem baseline. Matches
  [`docs/TESTING.md`](../../docs/TESTING.md) since #223 landed.
- `npm run typecheck` (now real, backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0
  errors (baseline 0). Ratchet script matches — no regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.65
  KiB** — +1.01 KiB vs 2026-07-08).
- `npm test`: pass (46 test files, **367 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green.
- `npm audit`: **0 vulnerabilities.**
- `npm outdated`: 46 packages have a newer version available (up
  from 41 on 2026-07-08; still Radix-UI's routine 2-week patch
  cadence — 21 of the 46 are Radix patches x.y.z+1). None map to an
  active security advisory. Same standing major-upgrade drift with
  named consumers as 2026-07-08, minus ESLint 10 and react-hooks 7
  which both landed via #148 last window. New this window:
  `@supabase/supabase-js` 2.108.2 → 2.110.2 (minor, within-major
  bump — will land routinely via Dependabot).

## Review focus this run

### Retro-audit of the flag-coexist fix ([#233](https://github.com/akkkkkkki/prepio/pull/233), landed 2026-07-10)

The one substantive product-behavior change this window. Fixes a
data-integrity bug where a user marking a question as `favorite`
would silently delete an existing `needs_work` flag on the same
question (the old unique key was `(user_id, question_id)`, so the
`onConflict: 'user_id,question_id'` upsert overwrote the existing
row).

Files reviewed:

- [`supabase/migrations/20260710203000_question_flags_per_type.sql`](../../supabase/migrations/20260710203000_question_flags_per_type.sql)
  (new, 8 lines)
- [`supabase/schema.sql`](../../supabase/schema.sql) diff (1 line)
- [`src/services/searchService.ts`](../../src/services/searchService.ts)
  diff (+34/−11)
- [`src/services/search/practice.ts`](../../src/services/search/practice.ts)
  diff (+18/−5)
- [`src/pages/Practice.tsx`](../../src/pages/Practice.tsx) diff
  (+26/−20)
- [`src/pages/History.tsx`](../../src/pages/History.tsx),
  [`src/components/history/SessionList.tsx`](../../src/components/history/SessionList.tsx)
  read-site refactors
- [`src/services/searchService.test.ts`](../../src/services/searchService.test.ts)
  (+65 lines) and
  [`src/pages/__tests__/Practice.mobile.test.tsx`](../../src/pages/__tests__/Practice.mobile.test.tsx)
  (+56 lines)

Findings:

- **Migration is safe on existing data.** The old unique constraint
  guaranteed at most one `(user_id, question_id)` row, so every
  existing row is trivially unique under the new
  `(user_id, question_id, flag_type)` key. The migration is idempotent
  (`DROP CONSTRAINT IF EXISTS`) and the schema mirror in
  [`schema.sql`](../../supabase/schema.sql) is in lockstep — no drift.
- **RLS unchanged.** [`schema.sql:812`](../../supabase/schema.sql)
  still enforces `auth.uid() = user_id` on `user_question_flags`, and
  the migration doesn't touch grants or policies. Same security
  surface as before.
- **All read sites migrated to the new helpers.** Every occurrence
  of the old-shape access (`questionFlags[id]?.flag_type === 'foo'`)
  is gone from product source — grep confirms no residual reads that
  would silently fail after the shape change. The new
  `hasQuestionFlag(flags, id, 'favorite')` helper is the single
  choke-point and gets unit-tested in the searchService test.
- **Toggle-off path preserves other flags.** The new
  `handleToggleFlag` clone-then-delete-key branch in
  [`Practice.tsx:1321`](../../src/pages/Practice.tsx) explicitly
  keeps the parent map entry if any other flag type remains — so
  removing `favorite` no longer strips a co-existing `needs_work`.
  Two new tests in the searchService suite cover this exact case.
- **Backwards-compat with pre-migration data.** Not needed — every
  pre-migration row had exactly one flag type, so the map after
  fetch is trivially the new shape. No pre-migration edge case to
  handle.

Verdict: **clean, well-tested, correct.** No hygiene action.

### Retro-audit of the typecheck ratchet ([#236](https://github.com/akkkkkkki/prepio/pull/236), landed 2026-07-10)

Closes the 2026-07-04 and 2026-07-08 Medium finding. `npm run
typecheck` now shells out to
[`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)
instead of the no-op root `tsc --noEmit`.

Files reviewed:

- [`package.json`](../../package.json) diff (1 line — script rewire)
- [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)
  (new, 44 lines)
- [`docs/TESTING.md`](../../docs/TESTING.md) diff (+15 lines
  describing the ratchet)

Findings:

- **Script is defensive under `set -e`.** `count_errors()` captures
  `tsc`'s non-zero exit with `|| true` so the pipeline doesn't
  short-circuit; the `grep -cE 'error TS[0-9]+' || true` on the inner
  count is also `|| true` guarded — a project with zero errors won't
  fail on `grep`'s empty-match exit code. Both branches of the
  behaviour are exercised today (app baseline: 381 errors, node
  baseline: 0 errors — both projects hit their pass-at-baseline
  path).
- **Baselines are the right shape for a ratchet.** App at 381
  matches today's `npx tsc -p tsconfig.app.json --noEmit --pretty
  false 2>&1 | grep -cE 'error TS[0-9]+'` output on a clean `npm
  install`. Node at 0 means any regression there fails immediately
  — the tighter of the two constraints, appropriately.
- **`--pretty false` chosen for stable grep.** Prevents ANSI
  color codes from breaking the pattern match — matters for CI
  environments that force `TERM=dumb`.
- **Docs are honest.** The TESTING.md addendum explicitly frames it
  as a "stop the bleeding, burn down later" gate. Right framing —
  the alternative (make `typecheck` error-out until 381 are fixed)
  would red every open PR overnight.

Verdict: **clean.** The ratchet is exactly the shape we asked for
in the 2026-07-04 audit — no over-scope, no under-scope.

### Secret / client-exposure re-scan

Standard cadence — clean.

- **`.env.example`** contains only placeholders (`sb_publishable_...`,
  `eyJhbGciOi...`, `sk-proj-...`, `tvly-...`, `sk_test_...`,
  `pk_test_...`, `whsec_...`, `price_...`). No real key material
  committed.
- **`.gitignore`** excludes `.env`, `.env.local`, `.env.*.local`,
  `*.key`, `secrets.json`. Untracked scan (`git ls-files -o
  --exclude-standard`) is empty.
- **No server-only env var referenced from `src/`.** `Grep
  'import\.meta\.env\.(?!VITE_)'` in `src/` is empty; all
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET` references live in `supabase/functions/**`.
- **Built assets are clean.** `grep -RlE '(sk-proj-|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET)'
  dist` returns nothing.
- **Server logs still scrub user content.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)`
  patterns touching `question_text|answer_text|transcript_text|notes|user_input`
  returns zero hits. `console.log` calls reference metadata only
  (`📄 Using stored profile resume`, ids, counts, error messages).

## Findings

### Critical

- None.

### High

- None. **Both prior High and Medium findings closed this window.**

### Medium

- [ ] **`Practice.mobile.test.tsx` CI flake — mitigation holding
  but root cause still unknown** — carried from 2026-07-08.
  - Evidence: The `{ retry: 2 }` mitigation added in PR #226 remains
    on the three affected `it()` blocks (lines 996, 1021, 1043 in
    [`src/pages/__tests__/Practice.mobile.test.tsx`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 367 tests passed cleanly on this run's `npm test` — no flake
    observed in this session. No maintainer-side instrumentation has
    landed yet, and no Linear ticket was filed after 2026-07-08 (the
    prior audit's Deferred item ran into the same "waiting for
    ownership" state as the typecheck one that did later close).
  - Risk: Same as 2026-07-08 — the retry mitigation unblocks CI but
    hides the underlying stall of the Quick-Start → breathing-screen
    transition under CI resource contention. If the underlying race
    ever escalates (retries no longer sufficient), the failure will
    look identical to a genuine regression and be harder to
    triage.
  - Recommended fix: **File the Linear ticket now.** Quality &
    Maintenance, `Chore` + `area:practice`, cross-linked to PR #226
    and this audit. The two audit-doc mentions are enough context
    for a maintainer to reproduce the investigation; leaving it in
    the audit trail only means the next hygiene run has to rediscover
    the context.
  - Owner / next step: File in Linear. If the mitigation holds
    across another 5–10 PR cycles with no observed CI failure,
    downgrade to Low next audit.

### Low / clean-up

- [ ] **Dependabot pile 2 → 0 — [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92)
  can close as Done** — informational.
  - Evidence: #143 (`actions/upload-artifact` 4 → 7.0.1) and #144
    (`actions/setup-node` 4.4.0 → 6.4.0) both merged 2026-07-10.
    `.github/workflows/` grep for `@ea165f` (v4 upload-artifact) and
    `@49933ea` (v4 setup-node) returns zero hits — cleanup complete.
    Bumping to `@043fb46d` (v7.0.1 upload-artifact) and `@48b55a01`
    (v6.4.0 setup-node) SHA-pinned in both workflow files.
  - Recommended fix: Close
    [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) as Done.
    Close [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) as
    Done (already resolved by #148, but the ticket state wasn't
    updated after the 2026-07-08 audit prescribed it).

- [ ] **Bot-PR pile 22 → 18 (−4 net) — first real thinning without a
  batch-merge-week** — informational; PREPIO-110 remains open.
  - Evidence: Five cursor-bot test PRs (#84, #134, #192, #207, #230)
    rebased-and-merged in the 12:44 batch on 2026-07-10; one new
    github-actions-bot PR opened (#237, docs-only, draft). Current
    composition: 17 github-actions + 1 cursor = 18. Cursor pile
    shrank 6 → 1 — the maintainer's willingness to review-and-accept
    cursor-bot test PRs is the mechanism doing the work.
  - Recommended fix: [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110)
    scope updated to 18 PRs. Auto-close-after-30-days question still
    open for the product owner.

- [ ] **Typecheck backlog 361 → 381 — but all delta is in test
  files, not product code** — informational; ratchet now catches
  future drift.
  - Evidence: `Practice.tsx` stayed at 15 errors; `searchService.ts`
    stayed at 22 errors across the flag-shape refactor. The +20
    delta is entirely in test files —
    [`Interviews.test.tsx`](../../src/pages/__tests__/Interviews.test.tsx)
    14 → 26 (+12 from #192's regression coverage),
    [`Practice.followup.test.tsx`](../../src/pages/__tests__/Practice.followup.test.tsx)
    0 → 16 (new file / expanded coverage),
    [`Practice.mobile.test.tsx`](../../src/pages/__tests__/Practice.mobile.test.tsx)
    34 → 38 (+4 from #231, #233, #235), plus small drift elsewhere.
  - Recommended fix: None from this audit. When the eventual
    `tsconfig.test.json` cleanup lands (see product-owner question
    #3 from 2026-07-08 — still unanswered), most of these 381 will
    move out of scope, and the app baseline should drop to
    approximately the ~55 product-source errors that remain
    (`searchService.ts` 22 + `Practice.tsx` 15 + a scatter).

- [ ] **`lovable-tagger` keep-or-drop decision** — ninth audit
  waiting.
  - Evidence: Same as 2026-07-08.
    [`vite.config.ts:33`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`. `npm outdated`
    now shows the package at 1.3.0 → 1.3.1 patch drift.
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.

- [ ] **`duckduckgo-fallback.ts` compat shim** — informational.
  Unchanged from 2026-07-08 in behaviour, but PR #207 landed 89
  lines of new test coverage
  ([`supabase/functions/_shared/duckduckgo-fallback.test.ts`](../../supabase/functions/_shared/duckduckgo-fallback.test.ts))
  this window — the shim is now guarded by tests. If PR #209
  (PREPIO-48) eventually ships, the `_shared/` cleanup pass can
  retire the shim confidently with tests as the safety net.

## Small fixes made in this run

None. Both prior-audit findings closed on their own tickets before
this run started (PR #223 for the lint baseline, PR #236 for the CI
typecheck), and no new small hygiene issue surfaced this window that
fits the "single reviewable PR" scope. The one remaining Medium
(Practice.mobile.test.tsx flake) needs a maintainer with CI shell
access, not an in-tree patch.

Explicitly *not* touched this run:

- **The 381-error typecheck backlog.** Draining it is the next
  natural step after PREPIO-119, but it's a coordinated cleanup
  pass, not a hygiene-runner scope. Wait for the product owner's
  answer on the `tsconfig.test.json` question before starting.
- **Any of the 39 react-hooks 7 rule violations.** Same reasoning as
  2026-07-08: PR #223's follow-on chore is the appropriate scope.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to re-discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge. **Close as Done** — resolved by #148 (2026-07-04)
  and #223 (2026-07-09). Ticket state still open, still needs a manual
  close.
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors. **Close as Done** — resolved by #143 and #144 both merging
  2026-07-10.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Ninth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **18** PRs (17
  github-actions + 1 cursor). Cursor pile now essentially cleared
  — remaining scope is largely github-actions-bot Linear
  auto-scaffold PRs.
- [PREPIO-119](https://linear.app/qiuyue/issue/PREPIO-119) — CI
  typecheck no-op. **Close as Done** — resolved by #236 (2026-07-10).
- **New — `Practice.mobile.test.tsx` environment-wide CI flake.**
  Prior audit prescribed filing this in Linear (Quality &
  Maintenance, `Chore` + `area:practice`); no ticket found in the
  team as of this run. **File now**, cross-linked to PR #226 and
  both audits. Root cause still needs maintainer-side CI
  instrumentation.

## Questions for product owner

- **Stale bot-PR cleanup (PREPIO-110)** — accept a one-time triage
  pass, or set up an Action that auto-closes bot-authored PRs older
  than 30 days with no human-author commits on the branch? Fifth
  run asking. Pile is now at 18.
- **Is the `lovable-tagger` component tagger still in use?** Ninth
  run asking. One-line cleanup blocked on this.
- **Should the typecheck backlog be drained with a
  `tsconfig.test.json` split (moves ~85% of the errors out of
  scope), or is a bulk `ts-expect-error` sweep of the product-code
  errors acceptable first?** Second run asking. The 381 → 55
  product-source-only cut would let the ratchet enforce a
  meaningfully tight bound.

## Next review focus

1. **Whether either open human PR (#215 mockup adoption, #228
   PREPIO-53 target retrieval) lands.** Both are substantive runtime
   changes and would warrant a retro-audit in the next window if
   they do.
2. **Whether PREPIO-91, PREPIO-92, PREPIO-119 close in Linear** —
   all three are effectively Done in code. If the tickets are still
   open at the next audit, the pattern is "audit prescribes
   ticket-hygiene, ticket-hygiene doesn't happen" and needs
   escalation with the product owner. Same shape as the typecheck
   ticket that took three audits to file.
3. **`Practice.mobile.test.tsx` flake watch** — confirm the
   `{ retry: 2 }` mitigation is still doing its job (i.e. no CI
   failures against these tests since the mitigation landed). If
   the ticket gets filed and worked, root-cause narrative can
   replace this watch.
4. **Typecheck ratchet baseline drift** — if the app baseline
   creeps above 381 without an explicit "raise the baseline" PR
   comment justifying it, that's a policy violation worth calling
   out in the next audit. Conversely, if a cleanup pass lowers it,
   confirm the baseline in
   [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)
   dropped in the same PR (the script prints a hint when it
   detects an improvement).
5. **PREPIO-47 in production** — carried from 2026-07-08.
   Interviewer follow-up mode still deserves a real-user look;
   watch for `follow_up_questions` shape drift.
