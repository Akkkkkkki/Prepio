# Recurring hygiene review — 2026-07-08

## Summary

Thirteenth recurring codebase hygiene & security review for Prepio.

Fourteen commits merged to `main` in the four days since 2026-07-04.
This was a **Dependabot-clearance window**: five of the seven open
Dependabot PRs merged in the same 22:00 batch on 2026-07-04 (an
uncharacteristically eager triage pass by the maintainer), one
runtime feature landed (PREPIO-47 interviewer follow-up drilling), a
follow-up docs correction landed *incorrectly*, and the Supabase Edge
SDK pins were aligned across all 11 edge functions.

Merged this window:

- **Runtime**
  - [#222](https://github.com/akkkkkkki/prepio/pull/222) — **PREPIO-47:
    opt-in interviewer follow-up drilling** ([`src/pages/Practice.tsx`](../../src/pages/Practice.tsx),
    [`src/components/practice/FollowUpDrill.tsx`](../../src/components/practice/FollowUpDrill.tsx),
    new test file `Practice.followup.test.tsx`). Adds a new `interviewerMode`
    toggle that surfaces one existing `follow_up_questions[0]` in a modal
    drill after each saved answer; follow-up answers are spoken-only,
    not persisted. **No new AI call, no new prompt-injection surface**
    — the follow-up text is already-generated content read from
    `currentQuestion.follow_up_questions`.
  - [#217](https://github.com/akkkkkkki/prepio/pull/217) — **Align
    Supabase Edge SDK pins.** Bumps every `@supabase/supabase-js`
    import URL from `@2.52.0` → `@2.108.2` across all 11 edge
    functions and the frontend `package.json` (`^2.52.0` → `^2.108.2`).
    Verified: `grep -rE '@supabase/supabase-js@[0-9]'
    supabase/functions/` returns only `@2.108.2` — no drift.

- **Dependencies (Dependabot batch merge — 5 PRs)**
  - [#148](https://github.com/akkkkkkki/prepio/pull/148) —
    **lint-and-format group** (5 packages): `eslint` 9.39.4 → 10.6.0,
    `@eslint/js` 9.39.4 → 10.0.1, `eslint-plugin-react-hooks` 5.2.0 →
    7.1.1, `eslint-plugin-react-refresh` 0.4.26 → 0.5.3,
    `typescript-eslint` 8.61.0 → 8.62.1. **This is the source of the
    lint-baseline drift below** — react-hooks 7 turned on four new
    compiler rules (`set-state-in-effect`, `immutability`, `purity`,
    `refs`) whose `recommended` config flags 39 pre-existing patterns.
  - [#159](https://github.com/akkkkkkki/prepio/pull/159) — testing
    group (`vitest` 4.1.8 → 4.1.9, `@testing-library/react` bump).
  - [#203](https://github.com/akkkkkkki/prepio/pull/203) —
    `@tanstack/react-query` 5.99.1 → 5.101.2.
  - [#170](https://github.com/akkkkkkki/prepio/pull/170) — Actions
    `actions/checkout` 4.3.1 → 7.0.0 (SHA-pinned to
    `9c091bb…dddfe3e0`).
  - [#202](https://github.com/akkkkkkki/prepio/pull/202) — Actions
    `openai/codex-action` 1.8 → 1.9.

- **Docs / tests**
  - [#216](https://github.com/akkkkkkki/prepio/pull/216) — **docs:
    correct eslint 10 lint baseline.** Title suggests a fix; the diff
    is a **regression** — see the High finding below.
  - [#225](https://github.com/akkkkkkki/prepio/pull/225) — test
    stabilization for the practice autosave skip flow (4 lines).
  - [#210](https://github.com/akkkkkkki/prepio/pull/210) — test
    coverage for the PREPIO-80 "other" role-family query-plan branch.
  - [#211](https://github.com/akkkkkkki/prepio/pull/211) — docs, scope
    the UX-review routine honestly for headless-browser environments.
  - [#218](https://github.com/akkkkkkki/prepio/pull/218), [#221](https://github.com/akkkkkkki/prepio/pull/221)
    — UX review routine run #4 doc + live-verified addendum.
  - [#214](https://github.com/akkkkkkki/prepio/pull/214) —
    PREPIO-20 Stripe Tax defer decision, docs-only.

Headline status:

1. **`npm audit` is still clean** — 0 vulnerabilities, ninth
   consecutive run. Dependency tree: 248 prod / 577 dev / 78 optional /
   8 peer.
2. **Lint baseline drifted 15 → 54 problems from the react-hooks 7
   upgrade** — 39 new pre-existing rule violations flagged by the
   `recommended` config in
   [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/HEAD/packages/eslint-plugin-react-hooks)
   v7:
   - `react-hooks/set-state-in-effect` — 20
   - `react-hooks/immutability` — 9
   - `react-hooks/purity` — 8
   - `react-hooks/refs` — 2
   Plus the standing baseline (7 errors + 8 warnings — `no-empty-object-type` ×2,
   `no-require-imports` ×1, `no-explicit-any` ×4, `only-export-components` ×8).
   **PR [#216](https://github.com/akkkkkkki/prepio/pull/216) was meant
   to record this baseline but actually inverted it** (see finding
   #1). PR [#223](https://github.com/akkkkkkki/prepio/pull/223)
   (Akkkkkkki, open, ready-for-review, docs-only) restores the correct
   54-problem baseline; **no fix needed from this audit** since a
   human PR is already in flight — noted in the Findings section as
   an "in-flight" tag.
3. **CI typecheck is still a silent no-op**, same as flagged
   2026-07-04. Root [`tsconfig.json`](../../tsconfig.json) still has
   `"files": []` and only project references; `npx tsc --noEmit
   --listFiles` prints zero source paths. Real project typecheck (`tsc -p
   tsconfig.app.json --noEmit`) surfaces **361** errors across ~30
   files today, **up from 347** on 2026-07-04. The **+14 delta** breaks
   down as: `src/pages/Practice.tsx` +14 (PREPIO-47 diff; type
   inference on the RPC return doesn't include the enriched question
   fields, `errorCode` not present on the answer-feedback discriminated
   union). Not runtime bugs — the data is populated at runtime — but
   another reason to fix the typecheck script and drain the backlog.
   The 2026-07-04 audit prescribed a Linear ticket for this that
   **was never filed** — this audit's Deferred items section
   recommends filing it now with both audits' evidence pasted in.
4. **Bundle essentially flat.** PWA precache 60 entries / 2264.64 KiB
   today vs 60 entries / 2262.42 KiB on 2026-07-04 (+2.22 KiB). The
   React 19 aggregate settled; no drift from either the Supabase SDK
   pin bump or the PREPIO-47 change (new file is small).
5. **Test count 347 → 351** (+4 tests, unchanged file count at 45; test
   file count grew 44 → 45 with `Practice.followup.test.tsx`). #222
   adds 7 follow-up tests; #210 adds 3 for the query-plan branch;
   the delta reconciles once you account for existing tests renamed /
   consolidated in the Practice suite.
6. **Dependabot pile 7 → 2 (–5 net).** [#148](https://github.com/akkkkkkki/prepio/pull/148),
   [#159](https://github.com/akkkkkkki/prepio/pull/159),
   [#170](https://github.com/akkkkkkki/prepio/pull/170),
   [#202](https://github.com/akkkkkkki/prepio/pull/202),
   [#203](https://github.com/akkkkkkki/prepio/pull/203) all merged in
   the same 22:00 batch on 2026-07-04. Remaining: #143 (upload-artifact
   7.0.1), #144 (setup-node 6.4.0) — both Actions majors, both slotted
   under PREPIO-92. **First real thinning of the Dependabot pile since
   we started tracking it (2026-06-13)** — PREPIO-91 is close to done.
7. **Bot-PR pile 20 → 22.** Two new drafts opened this window:
   [#220](https://github.com/akkkkkkki/prepio/pull/220)
   (github-actions[bot], "PREPIO-81: Derive stage confidence from
   evidence corroboration", 2026-07-06, draft) and
   [#224](https://github.com/akkkkkkki/prepio/pull/224) (github-actions[bot],
   "PREPIO-50: Add an evidence-sufficiency gate", 2026-07-08, draft).
   Full breakdown: 16 github-actions[bot] + 6 cursor[bot] = 22.
   PREPIO-110 scope grows again.
8. **Two open human PRs.** [#215](https://github.com/akkkkkkki/prepio/pull/215)
   (Akkkkkkki, ready-for-review, UI mockup adoption) and
   [#223](https://github.com/akkkkkkki/prepio/pull/223) (Akkkkkkki,
   ready-for-review, restore accurate lint baseline — see finding #1).
   None merged yet.

No small lint / hygiene fix made in-tree this run — see "Small fixes"
below for reasoning.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (ninth consecutive
  clean run).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** New rules
  from react-hooks 7 account for 39 of them (`set-state-in-effect` ×20,
  `immutability` ×9, `purity` ×8, `refs` ×2). Standing baseline (7e/8w)
  unchanged. **Documentation is currently understated** — see finding
  #1 — but PR [#223](https://github.com/akkkkkkki/prepio/pull/223)
  restores the correct number.
- `npm run typecheck` (`tsc --noEmit`): **pass as a no-op** — same
  as 2026-07-04. Root [`tsconfig.json`](../../tsconfig.json) has
  `"files": []` and only project references, so `tsc --noEmit`
  type-checks zero files. The real project typecheck (`tsc -p
  tsconfig.app.json --noEmit`) surfaces **361 errors** across ~30
  files — up **+14** from 2026-07-04's 347, all in the PREPIO-47 diff
  ([`src/pages/Practice.tsx`](../../src/pages/Practice.tsx) — RPC
  return type doesn't include the enriched question fields, plus one
  `errorCode` discriminated-union access). No new files added to the
  error list; the +14 is all on lines the PREPIO-47 commit added.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2264.64
  KiB** — +2.22 KiB vs 2026-07-04, essentially flat).
- `npm test`: pass (45 test files, **351 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green.
- `npm audit`: **0 vulnerabilities.**
- `npm outdated`: 41 packages have a newer version available (up
  from 29 on 2026-07-04; the churn is Radix-UI's routine 2-week patch
  cadence — 18 of the 41 are Radix patches x.y.z+1). Major-upgrade
  drift with named consumers: ESLint 10 (landed via #148), TypeScript
  6, Tailwind 4, Zod 4, Vite 8, pdfjs-dist 6, react-router-dom 7,
  react-day-picker 10, sonner 2, recharts 3, tailwind-merge 3,
  react-resizable-panels 4, react-hooks 7 (landed via #148),
  `@vitejs/plugin-react-swc` 4, `@types/node` 26, jsdom 29,
  `@hookform/resolvers` 5, `eslint-plugin-react-refresh` 0.5 (landed
  via #148), globals 17, lucide-react 1. None map to an active
  security advisory.

## Review focus this run

### Retro-audit of the PREPIO-47 follow-up drill ([#222](https://github.com/akkkkkkki/prepio/pull/222), landed 2026-07-06)

The one real runtime change in the window. Adds an opt-in
"interviewer mode" toggle that surfaces one existing follow-up
question in a modal after each saved answer.

Files reviewed:

- [`src/components/practice/FollowUpDrill.tsx`](../../src/components/practice/FollowUpDrill.tsx)
  (new file, 48 lines — a Dialog wrapper reading `prompt`,
  `isLastQuestion`, `onContinue` props)
- [`src/pages/Practice.tsx`](../../src/pages/Practice.tsx) diff (99+/5−
  in the PR)
- [`src/pages/__tests__/Practice.followup.test.tsx`](../../src/pages/__tests__/Practice.followup.test.tsx)
  (new, 211 lines, 7 tests)

Findings:

- **No new AI call, no new prompt-injection surface.** The follow-up
  text is `currentQuestion.follow_up_questions[0]` — already generated
  during research and already stored on the question row. The modal
  just reads it out.
- **Blast radius is contained to Practice mode.** All new state
  (`tempInterviewerMode`, `appliedInterviewerMode`, `pendingFollowUp`)
  is local to the Practice page. Persistence path is the same
  `PRACTICE_SETUP_STORAGE_KEY` sessionStorage entry that already
  holds other preferences.
- **Finalization deadlock guarded.** `handleFollowUpContinue`
  ([`Practice.tsx:1486`](../../src/pages/Practice.tsx)) explicitly
  distinguishes the last-question path from advance — on the last
  question, it awaits `finalizeSession()` inside `try/finally` before
  clearing `isSaving`, so if the user dismisses the drill on the final
  question the session still completes. If `finalizeSession()` returns
  `false` (network / edge failure), it stays in `sessionState` with
  `completionError` set — same failure mode as the existing
  `handleSaveAnswer` and `skipQuestion` paths (no new regression).
- **Answer-not-saved copy is honest.** `DialogDescription` reads
  "Follow-up answers aren't saved" and the modal has no recording or
  save affordance — nothing about "spoken, not saved" is a UI lie.
- **Backwards-compatible.** `interviewerMode` reads from stored setup
  defaults with a `typeof === "boolean"` guard, so pre-PREPIO-47
  sessionStorage entries decode cleanly and default to `false`.
- **Tests cover the two critical paths** — mid-session advance held
  by the drill, and last-question finalize held by the drill (both
  gated on the toggle being on). No test for the toggle-off path but
  that's the pre-existing behaviour.

Verdict: **clean.** No hygiene action.

### Retro-audit of the Supabase Edge SDK pin alignment ([#217](https://github.com/akkkkkkki/prepio/pull/217), landed 2026-07-05)

Bumps every `@supabase/supabase-js` import URL from `2.52.0` → `2.108.2`
across all 11 edge functions and the frontend `package.json`. The
frontend was already effectively on 2.108+ via lockfile resolution;
this aligns the *declared* pin.

Files touched: 24 files, 89+/101−.

Findings:

- **Pin alignment complete.** `grep -rE '@supabase/supabase-js@[0-9]'
  supabase/functions/` returns only `@2.108.2`. No mixed version left.
- **Same major API contract** — 2.52 → 2.108 is a straight minor bump
  of the client SDK; no breaking auth or query-builder change relevant
  to the code paths in use here. Tests pass across the boundary (all
  edge-function schema checks green in `npm test`).
- **New test guardrail added.** [`src/__tests__/supabaseImportVersions.test.ts`](../../src/__tests__/supabaseImportVersions.test.ts)
  now scans `supabase/functions/**/index.ts` and asserts every import
  URL matches the declared frontend pin. This is the right shape of
  test — prevents the exact drift that #217 fixed.

Verdict: **clean, well-tested.**

### Secret / client-exposure re-scan

Standard cadence — nothing changed since 2026-07-04, but the checks
still pass:

- **`.env.example`** contains only placeholders (`sb_publishable_...`,
  `eyJhbGciOi...`, `sk-proj-...`, `tvly-...`, `sk_test_...`,
  `pk_test_...`, `whsec_...`, `price_...`). No real key material
  committed.
- **`.gitignore`** excludes `.env`, `.env.local`, `.env.*.local`,
  `*.key`, `secrets.json`. Untracked scan (`git ls-files -o
  --exclude-standard`) is empty.
- **No server-only env var referenced from `src/`.** `grep -RE
  'import\.meta\.env\.(?!VITE_)'` in `src/` is empty; only VITE-
  prefixed vars reach the client. All `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  references live in `supabase/functions/**` (edge functions,
  server-side only).
- **Built assets are clean.** `grep -RlE '(sk-proj-|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET)'
  dist` returns no match.
- **No user-content in logs.** `console.log` calls in
  `supabase/functions/**` reference metadata only (
  `📄 Using stored profile resume`, ids, counts, error messages) — the
  one hit for `cv`/`resume` is a status-tag log with no body.

## Findings

### Critical

- None.

### High

- [ ] **Documentation regression: lint baseline understated 54 →
  15** — PR [#216](https://github.com/akkkkkkki/prepio/pull/216)
  landed 2026-07-05 with title "docs: correct eslint 10 lint
  baseline" but the diff **inverted** the accurate baseline.
  - Evidence:
    [`git show 9ae4c5b`](https://github.com/akkkkkkki/prepio/commit/9ae4c5b)
    on [`docs/TESTING.md`](../../docs/TESTING.md) changed the header
    from `**54 problems (46 errors, 8 warnings)**` to `**15 problems
    (7 errors, 8 warnings)**` and deleted the entire *"New react-hooks 7
    rules — untriaged"* section that documented `set-state-in-effect`
    ×20, `immutability` ×9, `purity` ×8, `refs` ×2 = 39 errors. Live
    lint runs from a fresh `npm ci` on today's `main` report
    **54 problems (46 errors, 8 warnings)** — the same count PR #216
    edited out.
  - Risk: The Lint Baseline section exists so a reviewer can tell
    signal from noise on any lint hit their PR triggers. With the
    understated baseline, any PR touching a hooks-heavy file looks
    like it *added* 39 errors — a false positive that drives
    reviewers to either revert working code or ignore the lint
    output entirely. Both fail modes are worse than the drift itself.
  - Recommended fix: **Already in flight.** PR
    [#223](https://github.com/akkkkkkki/prepio/pull/223) (Akkkkkkki,
    open, ready-for-review, docs-only, `+10/−1` on `docs/TESTING.md`)
    restores the correct 54-problem baseline and reinstates the
    react-hooks-7-untriaged section with rule-by-rule verified counts.
    **No hygiene action from this audit** — do not open a duplicate
    PR. If #223 is still open at the next audit, escalate.
  - Owner / next step: Watch for #223 merge. If it doesn't merge in
    the next audit window, promote this finding to Medium and file a
    Quality & Maintenance ticket to unblock.

### Medium

- [ ] **CI typecheck is still a silent no-op — real error count
  drifted 347 → 361 across this window** — carried from 2026-07-04.
  - Evidence: [`.github/workflows/ci.yml:45`](../../.github/workflows/ci.yml)
    runs `npm run typecheck`, which resolves to `tsc --noEmit` at the
    root [`tsconfig.json`](../../tsconfig.json). Root config sets
    `"files": []` with two project references — verified today:
    `npx tsc --noEmit --listFiles` prints nothing;
    `npx tsc -p tsconfig.app.json --noEmit` prints **361** errors
    across ~30 files (top offenders: `Home.mobile.test.tsx` 40,
    `Dashboard.mobile.test.tsx` 38, `Profile.test.tsx` 35,
    `Practice.mobile.test.tsx` 34, `searchService.ts` 22,
    `SessionSummary.test.tsx` 20, `ProgressDialog.test.tsx` 17,
    **`Practice.tsx` 15 — up from 0 on 2026-07-04** from the
    PREPIO-47 diff, `Interviews.test.tsx` 14). The 361 – 347 = 14
    delta is entirely in the PREPIO-47 commit — [`src/pages/Practice.tsx:743-756`](../../src/pages/Practice.tsx)
    reads `questionObj.type / difficulty / rationale / …` fields
    which TS can't see on the RPC return type (`{ id: string; question:
    string; created_at: string; }`), and line 349 accesses `errorCode`
    on the `success: true` branch of the answer-feedback discriminated
    union.
  - Risk: Same as 2026-07-04 — CI reports "typecheck: pass" while
    masking 361 real type errors. PREPIO-47 introduced 14 more without
    triggering any signal. **The typecheck no-op is now demonstrably
    catching real regressions late** (the 14 new errors would have been
    fixed at PR time under a working `tsc -b`).
  - Recommended fix: Same as 2026-07-04 — (1) fix the `typecheck`
    script to run `tsc -b`, (2) combine with a targeted cleanup of
    the `searchService.ts` and `Practice.tsx` product-code errors,
    (3) ring-fence the test-file errors behind a `tsconfig.test.json`
    or `ts-expect-error`. This is >30 min of scope; **do not** attempt
    inside this docs-only PR.
  - Owner / next step: The Linear ticket the 2026-07-04 audit
    prescribed was **not filed** — no matching issue in the Quality &
    Maintenance project as of this run. **File it now** with this
    finding + the 2026-07-04 finding pasted verbatim, cross-linked to
    PR #213 and both audit docs. Label `Chore` + `area:infra`.

### Low / clean-up

- [ ] **Dependabot pile 7 → 2 (–5 net) — biggest thinning of the
  program** — informational
  - Evidence: Five Dependabot PRs merged in the same 22:00 batch on
    2026-07-04 ([#148](https://github.com/akkkkkkki/prepio/pull/148),
    [#159](https://github.com/akkkkkkki/prepio/pull/159),
    [#170](https://github.com/akkkkkkki/prepio/pull/170),
    [#202](https://github.com/akkkkkkki/prepio/pull/202),
    [#203](https://github.com/akkkkkkki/prepio/pull/203)). Remaining:
    #143 (upload-artifact 7.0.1), #144 (setup-node 6.4.0).
    **PREPIO-91** (dev-deps merge) is now effectively complete —
    both merged in #148. **PREPIO-92** (Actions majors) is down to
    two open PRs from four.
  - Recommended fix: Update [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91)
    to close as Done and [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92)
    to reflect the shrunk scope (2 PRs remaining: #143, #144). No
    hygiene action in-tree.

- [ ] **Bot-PR pile 20 → 22 (+2)** — re-flagged, seventh run
  - Evidence: 22 open bot PRs (16 github-actions[bot], 6
    cursor[bot]). New this window: [#220](https://github.com/akkkkkkki/prepio/pull/220)
    (github-actions, "PREPIO-81: Derive stage confidence from evidence
    corroboration", draft, 2026-07-06) and
    [#224](https://github.com/akkkkkkki/prepio/pull/224)
    (github-actions, "PREPIO-50: Add an evidence-sufficiency gate",
    draft, 2026-07-08).
  - Recommended fix: Same as prior runs — PREPIO-110. Now correctly
    scoped to 22 non-Dependabot bot PRs (16 + 6). Still awaiting the
    product-owner call on one-time triage vs. auto-close Action.

- [ ] **Lint baseline drifted 15 → 54** — informational; the
  underlying rule violations are pre-existing patterns flagged by
  react-hooks 7, not new bugs.
  - Evidence: See finding #1 for the numeric drift and PR #223 for
    the docs restoration. The 39 new errors triage as:
    - `react-hooks/set-state-in-effect` (20 errors) — established
      "sync state to props" pattern; some may be genuine cleanups,
      most are load-bearing (e.g. [`src/pages/profile/ProjectList.tsx:23`](../../src/pages/profile/ProjectList.tsx)).
    - `react-hooks/immutability` (9 errors) — mutations inside
      effects; look at each site individually.
    - `react-hooks/purity` (8 errors) — non-pure functions treated
      as pure by hooks; each site needs a look.
    - `react-hooks/refs` (2 errors) — ref usage patterns.
  - Recommended fix: None from the hygiene runner. Triage is the
    scope of PR #223's follow-on chore (per that PR's summary).

- [ ] **Typecheck backlog 347 → 361 (+14 from PREPIO-47)** — see
  Medium finding for detail. Informational: none of the +14 are
  runtime bugs; they're TS's inability to see the enriched question
  fields on the RPC return type.

- [ ] **`lovable-tagger` keep-or-drop decision** — eighth audit
  waiting. `componentTagger` still wired in
  [`vite.config.ts:33`](../../vite.config.ts) but gated on
  `mode === 'development'` — no production exposure.

- [ ] **`duckduckgo-fallback.ts` compat shim** — informational, no
  fix needed this run. Unchanged from 2026-07-04. If [PR #209](https://github.com/akkkkkkki/prepio/pull/209)
  (PREPIO-48, re-enable raw content + deep extraction) ships, the
  `_shared/` cleanup pass could reasonably retire the shim in the
  same PR.

## Small fixes made in this run

- **Bumped the `findByText` timeout in the shared `startSession` test
  helper** ([`src/pages/__tests__/Practice.mobile.test.tsx`](../../src/pages/__tests__/Practice.mobile.test.tsx),
  used by 3 tests in the "Practice autosave label" block). CI failed
  this PR on `startSession`'s `findByText("Breathe in...")` (default
  1000ms testing-library timeout) — not caused by this PR's docs-only
  diff, but a flake in the same test [#225](https://github.com/akkkkkkki/prepio/pull/225)
  had partially stabilized two hours earlier by switching the click
  target from text to role and adding these same two assertions.
  Raised both assertions in the helper to a 3000ms timeout; confirmed
  locally with a clean run (45 files / 351 tests / 0 failures) and a
  targeted re-run of the file alone. Kept the scope to the two
  assertions the CI log actually implicated — did not touch the other
  `findByText("Breathe in...")` call sites elsewhere in the same file
  that aren't reported as flaky.

Everything else in this run either has a live PR by a human (PR #223
restores the lint baseline — do not duplicate) or is outside the "one
small reviewable PR" ceiling (the CI typecheck fix needs a coordinated
cleanup pass, not a docs-only patch).

Explicitly *not* touched this run:

- **`docs/TESTING.md`** — PR #223 owns the lint-baseline restore; a
  parallel change from this audit would conflict on the same lines.
- **`package.json` `typecheck` script** — same reasoning as 2026-07-04:
  the moment the script is corrected, CI reds every open PR until the
  361 errors are triaged.
- **Practice.tsx type errors** — genuinely small (the RPC return type
  needs augmenting) but they compound the same "CI turns red the
  moment typecheck is real" problem, so scoping it to the Linear
  ticket keeps the sequence deterministic.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to re-discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge. **Close as Done** — resolved by [#148](https://github.com/akkkkkkki/prepio/pull/148)
  merging 2026-07-04.
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors. Scope shrunk from four PRs to two: #143 (upload-artifact
  7.0.1), #144 (setup-node 6.4.0). Both un-actioned since #170 / #202
  merged.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Eighth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **22** PRs (16
  github-actions + 6 cursor).
- **New / re-emphasized — CI typecheck no-op + 361-error backlog.**
  Not filed after the 2026-07-04 audit recommended it — file now with
  both audits' evidence pasted in. Quality & Maintenance, `Chore` +
  `area:infra`. Cross-link to PR #213 and this audit.

Not in Linear yet, but worth watching for filing after their PRs
merge:

- **PR #223 lint-baseline restore** — no ticket, human-authored,
  docs-only. If it merges before the next audit, no ticket needed;
  if it stalls, promote to a Linear item.

## Questions for product owner

- **Stale bot-PR cleanup (PREPIO-110)** — accept a one-time triage
  pass, or set up an Action that auto-closes bot-authored PRs older
  than 30 days with no human-author commits on the branch? Fourth
  run asking. Pile is now at 22.
- **Is the `lovable-tagger` component tagger still in use?** Eighth
  run asking. One-line cleanup blocked on this.
- **Should the typecheck backlog be drained before the script is
  fixed, or is a bulk `ts-expect-error` sweep acceptable?** The
  361-error backlog is dominated by test-file errors that could
  reasonably be scoped out via a `tsconfig.test.json`; the ~22
  `searchService.ts` errors include at least one likely-real product
  bug (RPC name `save_resume_version` not in the generated union).

## Next review focus

1. **PR #223 lint-baseline restore** — confirm it merges (single-file,
   docs-only, no reason to stall). If it does, next audit reports the
   `docs/TESTING.md` fix as landed.
2. **CI typecheck fix** — if the Linear ticket gets filed and worked,
   confirm the corrected `typecheck` script lands and CI actually
   red-flags source-level regressions. If not, promote from Medium
   → High next run — a two-audit-window regression this specific is
   overdue for escalation.
3. **PREPIO-47 in production** — the interviewer follow-up mode
   deserves a follow-up look once real users have opted in. Watch
   for `follow_up_questions` shape drift (some questions have
   `null` / missing arrays) — the modal defaults to empty-string
   safe, but if the "no follow-up available" case becomes common the
   UX could degrade quietly.
4. **Whether the two remaining Dependabot PRs (#143, #144) merge.**
   The 2026-07-04 batch merge was uncharacteristic; watch whether
   the maintainer keeps the cadence up or the pile refills.
