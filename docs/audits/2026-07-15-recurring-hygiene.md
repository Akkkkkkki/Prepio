# Recurring hygiene review — 2026-07-15

## Summary

Fifteenth recurring codebase hygiene & security review for Prepio.

Two commits merged to `main` in the four days since 2026-07-11: one
docs commit ([#239](https://github.com/akkkkkkki/prepio/pull/239) —
2026-07-12 UX review routine run #6) and one runtime feature
([#228](https://github.com/akkkkkkki/prepio/pull/228) —
[PREPIO-53](https://linear.app/qiuyue/issue/PREPIO-53) target
retrieval from user note signals, landed 2026-07-12 22:31 UTC by the
maintainer). This is the quietest merge window since 2026-07-01.

Merged this window:

- **Runtime**
  - [#228](https://github.com/akkkkkkki/prepio/pull/228) —
    **[PREPIO-53] Target research queries from interviewer and team
    notes.** The prior audit called this out as "watch list, may
    warrant a retro-audit." It landed cleanly the next day. Change
    is confined to
    [`supabase/functions/company-research/query-planner.ts`](../../supabase/functions/company-research/query-planner.ts)
    (+73/−27) plus two new tests
    ([`query-planner.test.ts`](../../supabase/functions/company-research/query-planner.test.ts)
    +41 lines, two new `it()` blocks). Behavior change:
    `extractUserNoteSignals` now returns a structured
    `{ labels, targeted }` shape; when the note mentions an
    interviewer name ("Meeting Alex Chen") or a team ("the Payments
    team"), the planner emits three attributed queries
    (`user-note-linkedin`, `user-note-blog`, `user-note-talk`) that
    quote the extracted signal and constrain by
    `site:linkedin.com` / `site:medium.com OR site:substack.com` /
    `site:youtube.com OR site:speakerdeck.com`, and adds those four
    domains to `includeDomains` for the Tavily request. Non-targeted
    labels (case interview, system design, financial modeling) still
    flow through the original `user-note` source. Retro-audit clean
    — see below.

- **Docs**
  - [#239](https://github.com/akkkkkkki/prepio/pull/239) — 2026-07-12
    UX review routine run #6 (414-line doc + 27 screenshots for run
    #6). Docs-only.

Headline status:

1. **The one Medium carried from 2026-07-08 and 2026-07-11 is still
   Medium.** The `Practice.mobile.test.tsx` CI-flake mitigation
   (`{ retry: 2 }` on the three affected blocks) held again — all 369
   tests passed cleanly on this run's `npm test` with no retries
   observed. Still no Linear ticket filed, still no maintainer-side
   instrumentation. Prior audit prescribed **file the ticket now** as
   Quality & Maintenance, `Chore` + `area:practice`; that's the third
   audit-doc mention with no ticket action. Same pattern as the
   PREPIO-119 typecheck ratchet took three audits to file — worth
   flagging for the product owner.
2. **`npm audit` is still clean** — 0 vulnerabilities, eleventh
   consecutive run. Dependency tree: 248 prod / 554 dev / 78 optional
   / 8 peer (dev went 577 → 554, a −23 drift from the deduped Radix
   patch bumps `npm install` performed on this run against the
   locked resolutions — no direct-dep change).
3. **Lint baseline unchanged at 54 problems (46 errors, 8 warnings).**
   No net drift since PREPIO-53's edge-function-only change didn't
   touch any file with a react-hooks-7 violation.
4. **Typecheck ratchet holding at baseline** — app: 381, node: 0.
   PREPIO-53 shipped with a `test: keep needs-work assertions within
   typecheck baseline` follow-up commit inside the PR (per the
   commit-message trailer), so the +2 test additions absorbed within
   the same baseline. The ratchet doing its job on its first
   post-landing PR.
5. **Bundle unchanged.** PWA precache 60 entries / 2265.65 KiB today,
   identical to 2026-07-11. Expected — PREPIO-53 is edge-function-only,
   no frontend bundle touch.
6. **Test count 367 → 369** (+2 tests, file count unchanged at 46 —
   both new tests are the two `it()` blocks added to
   [`query-planner.test.ts`](../../supabase/functions/company-research/query-planner.test.ts)).
   All green in `npm test`.
7. **Bot-PR pile 18 → 19 (+1 net).** One new github-actions-bot PR
   opened this window
   ([#240](https://github.com/akkkkkkki/prepio/pull/240) —
   "PREPIO-62: Resolve moderate esbuild/vite advisory
   (GHSA-67mh-4wv8-2f99) — requires breaking vite@8 upgrade",
   docs-only test-guard PR opened 2026-07-14, draft). No merges,
   no closes. Composition today: 18 github-actions + 1 cursor = 19
   (up from 17 + 1 = 18).
8. **Advisory GHSA-67mh-4wv8-2f99 already mitigated in
   [`package.json`](../../package.json).** The
   [`overrides.esbuild = "^0.28.1"`](../../package.json) block
   (landed in PR #152, 2026-06-17) forces esbuild past the vulnerable
   range regardless of what vite pins transitively — `npm audit
   --json` returns `"total": 0` with the override in place.
   PR #240 is a lockfile *test guard* (adds
   `src/__tests__/buildToolSecurity.test.ts` to assert
   `esbuild >= 0.25`), not a Vite@8 upgrade. Landing #240 is
   safe-to-merge; a full Vite@8 upgrade is *not* required and would
   be out of scope for this hygiene run.
9. **Two open human PRs stable:**
   [#215](https://github.com/akkkkkkki/prepio/pull/215) (mockup
   adoption, ready-for-review since 2026-07-05, no new activity) —
   [#228](https://github.com/akkkkkkki/prepio/pull/228) (PREPIO-53
   target retrieval) landed 2026-07-12 so it drops out of this
   list. Neither this audit's concern to land.

No small code fix made in-tree this run — the one substantive change
in the window (PR #228) retro-audited clean, no new small hygiene
issue surfaced, and the standing Medium (`Practice.mobile.test.tsx`
flake) still needs a maintainer-side CI investigation, not an in-tree
patch.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (eleventh consecutive
  clean run).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged
  from 2026-07-11 — same 39 react-hooks-7 rule violations plus the
  standing 15-problem baseline.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0
  errors (baseline 0). Ratchet matches — no regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.65
  KiB** — identical to 2026-07-11; PREPIO-53 is edge-function-only).
- `npm test`: pass (46 test files, **369 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green.
- `npm audit`: **0 vulnerabilities** (`"total": 0` in
  `npm audit --json` output).
- `npm outdated`: 46 packages have a newer version available (same
  count as 2026-07-11; steady Radix-UI 2-week patch cadence — 24 of
  the 46 are Radix patches x.y.z+1 today, up 3 from the 21 seen
  2026-07-11). None map to an active security advisory. Same
  standing major-upgrade drift as 2026-07-11.

## Review focus this run

### Retro-audit of the query-planner user-note targeting ([#228](https://github.com/akkkkkkki/prepio/pull/228), PREPIO-53, landed 2026-07-12)

The one runtime change this window. It builds directly on
`extractUserNoteSignals` — the same code the 2026-07-01 audit
retro-audited as clean when PREPIO-80 shipped it. This audit checks
whether the *targeting* extension introduces new surface: prompt-
injection routes, cross-tenant data flow, ReDoS-style regex risk,
sensitive-log drift.

Files reviewed:

- [`supabase/functions/company-research/query-planner.ts`](../../supabase/functions/company-research/query-planner.ts)
  diff (+73/−27)
- [`supabase/functions/company-research/query-planner.test.ts`](../../supabase/functions/company-research/query-planner.test.ts)
  diff (+41 lines, 2 new `it()` blocks — 10 tests total on the file)
- [`supabase/functions/company-research/index.ts`](../../supabase/functions/company-research/index.ts)
  (unchanged in this PR, spot-checked call-site and logging
  posture)

Findings:

- **Regex tightening is intentional and safer.** The old
  `interviewerMatch` allowed `{0,2}` additional capitalized words —
  a single first name like "Alex" matched and would have been
  emitted as an interviewer signal, then quoted into a Tavily query.
  The new pattern requires `{1,2}` additional words (i.e. 2–3 total)
  before it fires, which cuts false-positive interviewer signals
  from stray capitalization in the note. The old preceding-team
  regex (`teamMatch` split across two patterns) is collapsed into
  one anchored bounded-repetition pattern with `{0,2}` intermediate
  words — same 40-char bound as the 2026-07-01 audit noted, and the
  quantifier product `{0,2}` × single-character class `[A-Z][A-Za-z0-9&-]*`
  is linear-time under standard regex engines. No new ReDoS surface.
- **`userNote` is not logged in raw form anywhere in the diff.** The
  planner logs nothing on its own. The upstream caller in
  [`supabase/functions/company-research/index.ts:593`](../../supabase/functions/company-research/index.ts)
  still emits `hasUserNote: !!userNote` (boolean only). The
  extracted signals *are* returned in `plan.signals.userNote` as
  proper-noun labels (`["Alex Chen", "Payments team"]`), but they
  flow back only to the request-owner via the same
  `research_result` row — no cross-tenant exposure, no log surface.
- **Query interpolation is bounded to proper-noun capture.** The
  `targeted` array populates from the interviewer/team regexes,
  which extract only `[A-Z][A-Za-z'-]+` runs — quotes, backticks,
  and shell metacharacters cannot survive the regex. So even a
  malicious note like `"Meeting X" OR site:evil.com` cannot escape
  into the outer Tavily query beyond the user's own search scope.
  And since the search targets `site:linkedin.com` /
  `site:medium.com` / `site:youtube.com`, an adversary who *could*
  inject would only reshape their own research request — no cross-
  tenant, no service-role, no SQL/shell surface.
- **`TARGETED_USER_NOTE_DOMAINS` (medium/substack/youtube/speakerdeck)
  is a static allow-list.** Only merged into `includeDomains` when
  `userNoteSignals.targeted.length > 0`. All four are Tavily-friendly
  content hosts. No user-controlled data reaches `includeDomains`.
- **Budget preservation is tested.** The `preserves role-family
  coverage inside the production query budget` test locks the case
  where `maxQueries: 6` still emits the three role-family queries
  (`blind`, `leetcode`, `levels`) alongside the new
  `user-note-linkedin` — so the targeting doesn't crowd out the
  baseline research the pipeline depends on.
- **Deterministic dedupe still holds.** The planner still
  `JSON.stringify`/`JSON.parse`-based dedupes the query list before
  the `slice(0, maxQueries)` truncation, so a note that produces the
  same targeted signal twice (e.g. "Payments team" mentioned twice
  in different phrasings) only emits three targeted queries, not
  six.

Verdict: **clean, well-tested, correct.** No hygiene action. The
new targeted-search surface adds no security or reliability risk
beyond what PREPIO-80 already established.

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-07-11.

- **`.env.example`** contains only placeholders (`sb_publishable_...`,
  `eyJhbGciOi...`, `sk-proj-...`, `tvly-...`, `sk_test_...`,
  `pk_test_...`, `whsec_...`, `price_...`). No real key material
  committed.
- **`.gitignore`** excludes `.env`, `.env.local`, `.env.*.local`,
  `*.key`, `secrets.json`. Untracked scan (`git ls-files -o
  --exclude-standard`) is empty.
- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.SUPABASE_SERVICE_ROLE_KEY`,
  `import.meta.env.OPENAI_API_KEY`, `import.meta.env.STRIPE_SECRET_KEY`,
  `import.meta.env.TAVILY_API_KEY` in `src/` returns nothing.
- **Built assets are clean.** Grep across
  `dist/` for `sk-proj-|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET|tvly-`
  returns zero hits.
- **Server logs still scrub user content.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)`
  patterns touching `question_text|answer_text|transcript_text|notes|user_input|userNote|user_note`
  returns zero hits. Same clean pattern as every prior audit — the
  PREPIO-53 diff did not introduce any new logging.

## Findings

### Critical

- None.

### High

- None.

### Medium

- [ ] **`Practice.mobile.test.tsx` CI flake — third audit-doc
  mention with no Linear ticket filed** — carried from 2026-07-08
  and 2026-07-11.
  - Evidence: The `{ retry: 2 }` mitigation added in PR #226 remains
    on the three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 369 tests passed cleanly on this run's `npm test` — no flake
    observed in this session. No maintainer-side instrumentation has
    landed. No Linear ticket filed in the two audits since it was
    prescribed. Same pattern as
    [PREPIO-119](https://linear.app/qiuyue/issue/PREPIO-119)
    (typecheck ratchet), which took three audits to file before
    landing.
  - Risk: The retry mitigation is unblocking CI but hides the
    underlying stall of the Quick-Start → breathing-screen
    transition under CI resource contention. If the underlying race
    ever escalates (retries no longer sufficient), the failure will
    look identical to a genuine regression and be harder to triage.
    The "audit-doc-only, no Linear ticket" state also means each new
    audit has to rediscover the context.
  - Recommended fix: **File the Linear ticket this window.** Quality
    & Maintenance, `Chore` + `area:practice`, cross-linked to PR
    #226 and this + prior audits. If the maintainer's workflow keeps
    surfacing this only in audit docs, escalate to a product-owner
    question about who owns the CI-flake investigation.
  - Owner / next step: Product owner to assign — the ticket-filing
    step needs a human decision on whether Quality & Maintenance is
    the right project home given the maintainer's cadence.

### Low / clean-up

- [ ] **Bot-PR pile 18 → 19 (+1 net) —
  [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) scope
  updated to 19 PRs** — informational.
  - Evidence: One new github-actions-bot PR opened this window
    ([#240](https://github.com/akkkkkkki/prepio/pull/240) —
    "PREPIO-62: Resolve moderate esbuild/vite advisory
    (GHSA-67mh-4wv8-2f99)", 2026-07-14, draft). No merges, no
    closes. Composition today: 18 github-actions + 1 cursor = 19.
    Cursor pile still at 1 after the 2026-07-10 batch clearance —
    the remaining 18 github-actions PRs are Linear auto-scaffold
    PRs (codex-prepio-* branches), largely untouched since their
    open date.
  - Recommended fix:
    [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) scope
    updated to **19** PRs. Auto-close-after-30-days question still
    open for the product owner (sixth audit asking).

- [ ] **PR [#240](https://github.com/akkkkkkki/prepio/pull/240) is a
  test-guard, not a vite@8 upgrade — safe-to-merge** —
  informational.
  - Evidence: The PR title reads "requires breaking vite@8 upgrade"
    but the diff adds only a Vitest lockfile guard
    (`src/__tests__/buildToolSecurity.test.ts` asserting
    `esbuild >= 0.25`). The advisory GHSA-67mh-4wv8-2f99 is already
    mitigated by the [`overrides.esbuild = "^0.28.1"`](../../package.json)
    block landed in PR #152 (2026-06-17); `npm audit --json` returns
    `"total": 0` with the override in place.
    [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62)'s framing
    is stale — the "breaking Vite@8 upgrade" is *not* required to
    close the advisory, and the guard-only patch in #240 makes the
    override durable against future lockfile drift.
  - Recommended fix: Product owner review — the guard is a
    reasonable defense-in-depth measure but not urgent. If merged,
    close PREPIO-62 as Done (advisory was closed by #152; #240 just
    locks in the guard).

- [ ] **`lovable-tagger` keep-or-drop decision** — tenth audit
  waiting.
  - Evidence: Unchanged from 2026-07-11.
    [`vite.config.ts:33`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`. `npm outdated`
    shows the package at 1.3.0 → 1.3.1 patch drift, unchanged from
    prior audit.
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.

- [ ] **Typecheck backlog 381 → 381 — ratchet holding on its
  first post-landing PR** — informational.
  - Evidence: PR #228 shipped with a `test: keep needs-work
    assertions within typecheck baseline` follow-up commit inside
    the same PR (per the merge commit trailer). The ratchet flagged
    the initial +2 test additions and the author absorbed them
    within the same baseline before landing. The +73/−27 in
    [`query-planner.ts`](../../supabase/functions/company-research/query-planner.ts)
    (product source) landed with zero net delta —
    [`searchService.ts`](../../src/services/searchService.ts)
    stayed at 22 errors, [`Practice.tsx`](../../src/pages/Practice.tsx)
    stayed at 15 errors. First live demonstration that the ratchet
    prevents drift without slowing product work.
  - Recommended fix: None from this audit. The
    `tsconfig.test.json` cleanup question (product-owner question
    #3 from 2026-07-08 and 2026-07-11) still open.

## Small fixes made in this run

None. The one substantive change (PR #228) retro-audited clean, and
the standing Medium (`Practice.mobile.test.tsx` flake) still needs a
Linear ticket + maintainer-side CI investigation, not an in-tree
patch.

Explicitly *not* touched this run:

- **The 381-error typecheck backlog.** Same reasoning as
  2026-07-08 and 2026-07-11 — draining it is a coordinated cleanup
  pass, not a hygiene-runner scope. Wait for the product owner's
  answer on the `tsconfig.test.json` question.
- **Any of the 39 react-hooks 7 rule violations.** Same reasoning
  as 2026-07-08 and 2026-07-11 — appropriate scope is a follow-on
  chore, not a hygiene run.
- **PR #240 merge / PREPIO-62 close.** Product-owner call, not
  hygiene-run scope.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to re-discover):

- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Tenth audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **19** PRs (18
  github-actions + 1 cursor).
- **`Practice.mobile.test.tsx` environment-wide CI flake — still
  not in Linear.** Prior audits (2026-07-08 and 2026-07-11) both
  prescribed filing this in Linear (Quality & Maintenance, `Chore` +
  `area:practice`). Still not filed. **Third audit asking.** If the
  next audit finds it still absent, escalate as a product-owner
  question about who owns audit-recommendation follow-up.

## Questions for product owner

- **Stale bot-PR cleanup (PREPIO-110)** — accept a one-time triage
  pass, or set up an Action that auto-closes bot-authored PRs older
  than 30 days with no human-author commits on the branch? Sixth run
  asking. Pile is now at 19.
- **Is the `lovable-tagger` component tagger still in use?** Tenth
  run asking. One-line cleanup blocked on this.
- **Should the typecheck backlog be drained with a
  `tsconfig.test.json` split (moves ~85% of the errors out of
  scope), or is a bulk `ts-expect-error` sweep of the product-code
  errors acceptable first?** Third run asking. The 381 → 55
  product-source-only cut would let the ratchet enforce a
  meaningfully tight bound.
- **Who owns filing audit-recommended Linear tickets?** Two audits
  in a row have prescribed filing the `Practice.mobile.test.tsx`
  flake ticket, and neither has landed. Same pattern as the
  typecheck ratchet, which took three audits to file before
  PREPIO-119 opened. If the maintainer is the intended owner, is a
  hygiene-run-authored ticket acceptable, or does it need a human
  scoping decision first?

## Next review focus

1. **Whether the `Practice.mobile.test.tsx` flake ticket lands in
   Linear.** Third audit asking. If still absent at the next
   audit, treat this as a policy-level product-owner question.
2. **Whether PR [#215](https://github.com/akkkkkkki/prepio/pull/215)
   (mockup adoption) or PR [#240](https://github.com/akkkkkkki/prepio/pull/240)
   (PREPIO-62 test guard) merges.** #215 is now open ≥10 days; #240
   is docs/test-only and safe to merge but requires a product-owner
   call. Either would warrant a retro-audit next window.
3. **Typecheck ratchet baseline drift.** Held at 381 through the
   first post-ratchet product change (PR #228). Continue watching
   for the first PR that legitimately needs to raise it — the
   `scripts/check-typecheck-baseline.sh` hint on reductions is
   worth checking manually if a cleanup pass lands.
4. **Whether any of the 18 stale github-actions-bot PRs get closed
   or merged.** No movement on the pile since 2026-07-10's cursor
   batch. If the maintainer's cadence remains "review-and-merge
   selected work, leave the rest," a `stale.yml` Action would end
   the noise mechanically without waiting on individual
   dispositions.
5. **PREPIO-53 in production** — this window's runtime change,
   analogous to PREPIO-47 last window. Watch whether the targeted
   search patterns (`site:linkedin.com`, `site:medium.com` OR
   `substack.com`, `site:youtube.com` OR `speakerdeck.com`) return
   useful evidence in real research runs, or whether the four
   allow-listed domains produce noisy/thin results that should be
   trimmed.
