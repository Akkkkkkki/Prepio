# Recurring hygiene review — 2026-07-18

## Summary

Sixteenth recurring codebase hygiene & security review for Prepio.

Only one commit merged to `main` in the three days since 2026-07-15
([#242](https://github.com/akkkkkkki/prepio/pull/242) — 2026-07-16 UX
review routine run #7). The prior audit ([#241](https://github.com/akkkkkkki/prepio/pull/241))
merged in the same window but is the hygiene run itself, not a runtime
change. **Zero runtime PRs merged this window** — the quietest window
in this audit's history, and the first with no product-source diff at
all.

Merged this window:

- **Docs**
  - [#242](https://github.com/akkkkkkki/prepio/pull/242) — 2026-07-16
    UX review routine run #7 (438-line doc + 22 screenshots). Docs +
    assets only, no runtime touch.
  - [#241](https://github.com/akkkkkkki/prepio/pull/241) — the
    2026-07-15 recurring hygiene review note. Docs-only.

Headline status:

1. **The one Medium is now on its fourth audit-doc appearance.** The
   `Practice.mobile.test.tsx` CI-flake mitigation (`{ retry: 2 }` on
   the three affected blocks at
   [`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx))
   held again — all 369 tests passed cleanly on this run's `npm test`
   with no retries observed. Still no Linear ticket filed, still no
   maintainer-side instrumentation. Prior audit escalated the missing
   ticket to a **policy-level product-owner question** (audit-doc-only
   for three runs); this is now four. The 2026-07-16 UX review routine
   independently flagged that two of *its* week-old P1/P2s also never
   got Linear issues filed — same pattern.
2. **`npm audit` is still clean** — 0 vulnerabilities, twelfth
   consecutive run. Dependency tree: 248 prod / 554 dev / 78 optional
   / 8 peer (unchanged from 2026-07-15).
3. **Lint baseline unchanged at 54 problems (46 errors, 8 warnings).**
   No net drift since no product-source changed this window.
4. **Typecheck ratchet holding at baseline** — app: 381, node: 0.
   Nothing tested it this window (no product-code diff), but the
   baseline check itself still passes on the current tree.
5. **Bundle unchanged.** PWA precache 60 entries / 2265.65 KiB today,
   identical to 2026-07-15 (edge functions and source unchanged).
6. **Test count unchanged at 369.** All green in `npm test` (46 test
   files, 369 tests).
7. **Bot-PR pile 19 → 21 (+2 net).** Two new bot PRs opened this
   window ([#243](https://github.com/akkkkkkki/prepio/pull/243) — a
   cursor-bot regression-coverage PR for the co-existing question
   flags fixed in PR #233, and
   [#244](https://github.com/akkkkkkki/prepio/pull/244) — a
   github-actions-bot PR that adds `autoComplete` attributes to the
   Auth-form email/password inputs, PREPIO-123). Composition today:
   19 github-actions + 2 cursor = 21. **PR #244 is a real security /
   UX improvement that would land safely** — see Low findings below.
8. **Advisory GHSA-67mh-4wv8-2f99 still mitigated** — the
   [`overrides.esbuild = "^0.28.1"`](../../package.json) block from
   PR #152 (2026-06-17) continues to force esbuild past the vulnerable
   range regardless of what vite pins transitively. `npm audit --json`
   still returns `"total": 0`. PR #240 (test guard for this override)
   still sitting open, unchanged since 2026-07-14.
9. **One open human PR stable** —
   [#215](https://github.com/akkkkkkki/prepio/pull/215) (mockup
   adoption, ready-for-review since 2026-07-05, no new activity in 13
   days). Not this audit's concern to land.

No small code fix made in-tree this run — no product source changed
in the window, so nothing to retro-audit; the standing Medium
(`Practice.mobile.test.tsx` flake) still needs a maintainer-side CI
investigation, not an in-tree patch; and the two new bot PRs (#243,
#244) are product-owner-call merges, not hygiene-run scope.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (twelfth consecutive
  clean run).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged
  from 2026-07-15 — same 39 react-hooks-7 rule violations plus the
  standing 15-problem baseline.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0
  errors (baseline 0). Ratchet matches — no regressions.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2265.65
  KiB** — identical to 2026-07-15; no product source changed).
- `npm test`: pass (46 test files, **369 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green. No `Practice.mobile.test.tsx` flake observed on this run.
- `npm audit`: **0 vulnerabilities** (`"total": 0` in
  `npm audit --json` output).
- `npm outdated`: 46 packages have a newer version available (same
  count as 2026-07-15; 23 of the 46 are Radix patches x.y.z+1 today,
  vs 24 on 2026-07-15 — one Radix package (`@radix-ui/react-slot`,
  bumped to 1.3.1 in `node_modules`) caught up while the standing
  Radix cadence produced no new patch drift this window). None map
  to an active security advisory. Same standing major-upgrade drift
  as 2026-07-15.

## Review focus this run

### No runtime diff to retro-audit

For the first time in this audit's history, the entire merge window
carries no product-source changes at all. The two merged PRs (#241,
#242) are both docs-only (the prior hygiene note and the UX review
routine run #7). There is no `supabase/functions/*` diff, no `src/*`
diff, no migration, no config touch. Consequently there is no
retro-audit for this run.

### Bot-PR sweep — one substantive review

The bot pile grew by two this window (19 → 21). Both new PRs are
short enough to review in this audit rather than defer.

**[PR #244](https://github.com/akkkkkkki/prepio/pull/244) —
PREPIO-123, adds `autoComplete` attributes to Auth email/password
inputs.** Reviewed the full diff:

- Change is purely additive — nine new `autoComplete="..."` attributes
  on existing `<Input>` elements in [`src/pages/Auth.tsx`](../../src/pages/Auth.tsx),
  plus one new Vitest block in [`src/pages/__tests__/Auth.test.tsx`](../../src/pages/__tests__/Auth.test.tsx)
  asserting the sign-in vs sign-up field identities.
- Semantic values are correct per the [HTML Living Standard autofill
  vocabulary](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill):
  - Sign-in email → `"username"` (correct — sign-in flows use
    `username`, not `email`, so password managers link it to the
    stored credential).
  - Sign-in password → `"current-password"`.
  - Sign-up email → `"email"`, password → `"new-password"`, confirm
    password → `"new-password"` (correct — matched-pair pattern).
  - Reset/verification email → `"email"`.
  - New/confirm-password fields on reset → `"new-password"`
    (correct).
- **Meaningful security posture improvement** — enables
  browser/password-manager integration that most login-flow security
  checklists require (OWASP ASVS V2.1.9, WCAG 2.1 Success Criterion
  1.3.5). Also mitigates the "user types password into the wrong
  field on account switching" class of self-inflicted credential
  leaks. No credential data flow changes.
- **Safe to merge** — no runtime behavior change, no state or effect
  changes, only DOM attribute additions. The added test covers both
  the sign-in and sign-up tab. Would land cleanly.
- **Not merged in this audit** because merging a bot-authored PR is
  outside the recurring-hygiene scope (product-owner call). Flagged
  under Low.

**[PR #243](https://github.com/akkkkkkki/prepio/pull/243) —
cursor-bot, regression coverage for coexisting question flags.**
Test-only, +113/−1 in [`src/pages/__tests__/History.test.tsx`](../../src/pages/__tests__/History.test.tsx).
Extends coverage of the History page's flag-map consumption when a
question is both favorited and marked needs-work — the bug that PR
#233 (2026-07-14) fixed. Safe to merge; noted under Low.

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-07-15.

- **`.env.example`** contains only placeholders (`sb_publishable_...`,
  `eyJhbGciOi...`, `sk-proj-...`, `tvly-...`, `sk_test_...`,
  `pk_test_...`, `whsec_...`, `price_...`). No real key material
  committed. The `VITE_SUPABASE_URL` and `SUPABASE_URL` values are
  the production project host — this is public information
  (Supabase publishable API keys are designed to be client-exposed
  alongside the URL), same posture as every prior audit.
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
  returns zero hits — same clean pattern as every prior audit.

## Findings

### Critical

- None.

### High

- None.

### Medium

- [ ] **`Practice.mobile.test.tsx` CI flake — fourth audit-doc
  mention with no Linear ticket filed** — carried from 2026-07-08,
  2026-07-11, and 2026-07-15.
  - Evidence: The `{ retry: 2 }` mitigation added in PR #226 remains
    on the three affected `it()` blocks
    ([`src/pages/__tests__/Practice.mobile.test.tsx:996,1021,1043`](../../src/pages/__tests__/Practice.mobile.test.tsx)).
    All 369 tests passed cleanly on this run's `npm test` — no flake
    observed in this session. No maintainer-side instrumentation has
    landed. No Linear ticket filed in the three audits since it was
    prescribed. The 2026-07-16 UX review routine independently
    surfaced the same "audit-doc-only, no Linear ticket" pattern for
    two of *its* week-old P1/P2s — this is now a documented
    cross-audit pattern.
  - Risk: The retry mitigation is unblocking CI but hides the
    underlying stall of the Quick-Start → breathing-screen
    transition under CI resource contention. If the underlying race
    ever escalates (retries no longer sufficient), the failure will
    look identical to a genuine regression and be harder to triage.
    The "audit-doc-only, no Linear ticket" state also means each new
    audit has to rediscover the context — this is now the fifth
    audit paying that rediscovery cost.
  - Recommended fix: **The prior audit's recommendation to file the
    Linear ticket this window did not happen — escalate to a
    product-owner question about audit-recommendation follow-up
    ownership.** Escalation is under Questions below. Do not file
    the ticket from this audit — the pattern is now clearly a
    process gap, not a task-authoring gap, and papering over it
    with more audit-authored tickets doesn't fix the process.
  - Owner / next step: Product owner — same policy question as
    2026-07-15; this audit escalates from "file a ticket now" to
    "who owns audit follow-up," since the file-a-ticket path has
    now been rejected three audits in a row.

### Low / clean-up

- [ ] **PR [#244](https://github.com/akkkkkkki/prepio/pull/244) is a
  safe-to-merge security/UX improvement (PREPIO-123)** —
  informational.
  - Evidence: Adds `autoComplete` attributes to Auth email/password
    inputs (see Review focus above). Purely additive DOM attributes,
    correct autofill vocabulary values, includes a test, no state
    changes. Meets OWASP ASVS V2.1.9 / WCAG 1.3.5 posture that most
    login-flow audits will call out.
  - Recommended fix: Product owner review — safe to merge on any
    normal review pass. If merged, close PREPIO-123.

- [ ] **PR [#243](https://github.com/akkkkkkki/prepio/pull/243) is
  a safe-to-merge regression test for the coexisting-question-flags
  fix (PR #233)** — informational.
  - Evidence: Test-only, +113/−1 in
    [`src/pages/__tests__/History.test.tsx`](../../src/pages/__tests__/History.test.tsx).
    Adds coverage for a question that is both favorited and marked
    needs-work — the bug PR #233 (2026-07-14) fixed. Landing this
    reduces the chance of that fix silently regressing.
  - Recommended fix: Product owner review — safe to merge.

- [ ] **Bot-PR pile 19 → 21 (+2 net) —
  [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) scope
  updated to 21 PRs** — informational.
  - Evidence: Two new bot PRs opened this window (#243 cursor,
    #244 github-actions). No merges, no closes among the 19 prior.
    Composition today: 19 github-actions + 2 cursor = 21. The
    remaining 19 github-actions PRs are Linear auto-scaffold PRs
    (codex-prepio-* branches), largely untouched since their open
    date — same posture as 2026-07-15.
  - Recommended fix:
    [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) scope
    updated to **21** PRs. Auto-close-after-30-days question still
    open for the product owner (seventh audit asking).

- [ ] **PR [#240](https://github.com/akkkkkkki/prepio/pull/240) is a
  test-guard, not a vite@8 upgrade — safe-to-merge** — informational,
  unchanged from 2026-07-15.
  - Evidence: Same posture as 2026-07-15. The advisory
    GHSA-67mh-4wv8-2f99 is already mitigated by the
    [`overrides.esbuild = "^0.28.1"`](../../package.json) block landed
    in PR #152 (2026-06-17). PR #240 only adds a Vitest lockfile
    guard.
  - Recommended fix: Product owner review — the guard is a
    reasonable defense-in-depth measure but not urgent. If merged,
    close PREPIO-62 as Done.

- [ ] **`lovable-tagger` keep-or-drop decision** — eleventh audit
  waiting.
  - Evidence: Unchanged from 2026-07-15.
    [`vite.config.ts:33`](../../vite.config.ts) still gates
    `componentTagger` on `mode === 'development'`. `npm outdated`
    shows the package at 1.3.0 → 1.3.3 patch drift (was 1.3.0 →
    1.3.1 last audit — three patches accumulated over eleven
    audits, still unused in production).
  - Recommended fix: [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96)
    still awaiting product-owner call.

- [ ] **Typecheck backlog 381 → 381 — nothing tested it this
  window** — informational.
  - Evidence: No product source changed in the window, so the
    ratchet had no product PR to enforce against. Baseline check
    on the current tree still passes.
    [`searchService.ts`](../../src/services/searchService.ts) still
    at 22 errors, [`Practice.tsx`](../../src/pages/Practice.tsx)
    still at 15 errors.
  - Recommended fix: None from this audit. The
    `tsconfig.test.json` cleanup question (product-owner question
    from 2026-07-08 / 2026-07-11 / 2026-07-15) still open.

## Small fixes made in this run

None. No product source changed in the window, so no retro-audit
finding to fix in-tree. The standing Medium (`Practice.mobile.test.tsx`
flake) is a process gap, not a code gap. The two new bot PRs are
product-owner-call merges, not hygiene-run scope.

Explicitly *not* touched this run:

- **The 381-error typecheck backlog.** Same reasoning as
  2026-07-08 / 2026-07-11 / 2026-07-15 — draining it is a
  coordinated cleanup pass, not a hygiene-runner scope. Wait for
  the product owner's answer on the `tsconfig.test.json` question.
- **Any of the 39 react-hooks 7 rule violations.** Same reasoning
  as prior audits — appropriate scope is a follow-on chore, not a
  hygiene run.
- **PR #244 merge / PREPIO-123 close.** Product-owner call. The
  autocomplete-attributes patch is safe and beneficial but merging
  bot PRs on the hygiene runner's authority would circumvent the
  human review the maintainer's cadence signals is wanted.
- **PR #243 merge.** Same reasoning as #244.
- **PR #240 merge / PREPIO-62 close.** Same as prior audits —
  product-owner call.
- **Filing the `Practice.mobile.test.tsx` flake ticket.** Now
  explicitly *not* doing this from the hygiene runner — the prior
  audit prescribed it, no one filed it, and the pattern is now
  clearly a process gap that filing more tickets won't close.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to re-discover):

- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Eleventh audit waiting.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **21** PRs (19
  github-actions + 2 cursor).
- **`Practice.mobile.test.tsx` environment-wide CI flake — still
  not in Linear.** Prior audits (2026-07-08, 2026-07-11,
  2026-07-15) all prescribed filing this in Linear (Quality &
  Maintenance, `Chore` + `area:practice`). Still not filed.
  **Fourth audit asking.** Now escalated to a product-owner
  question rather than a repeat prescription — see Questions
  below.

## Questions for product owner

- **Who owns filing audit-recommended Linear tickets?** Now the
  primary escalation from this audit. Three consecutive hygiene
  audits (2026-07-08, 2026-07-11, 2026-07-15) prescribed filing
  the `Practice.mobile.test.tsx` flake ticket; the ticket has not
  been filed. The 2026-07-16 UX review routine (run #7)
  independently flagged the same pattern for two of its own
  week-old P1/P2s. This is now a documented cross-audit-doc
  pattern — the recurring reviews are producing recommendations
  that fall through. Options: (a) the hygiene runner is
  authorized to file tickets directly into a triage state (needs
  Linear write access + a product-owner scoping review before
  moving to Todo), (b) the maintainer accepts an SLA to file
  audit-prescribed tickets within N days, or (c) the audits stop
  prescribing tickets and only flag findings, in which case the
  Medium-level `Practice.mobile.test.tsx` flake needs a different
  path to a fix. This is now the fourth run asking; if unresolved
  by the next audit, the flake ticket recommendation will be
  dropped from the Medium section.
- **Should PR [#244](https://github.com/akkkkkkki/prepio/pull/244)
  (Auth-form `autoComplete` attributes) be merged?** Safe,
  additive, meets a genuine security-checklist requirement.
  Product-owner call whether to merge in the next window or
  fold into a broader Auth polish batch.
- **Stale bot-PR cleanup (PREPIO-110)** — accept a one-time triage
  pass, or set up an Action that auto-closes bot-authored PRs older
  than 30 days with no human-author commits on the branch? Seventh
  run asking. Pile is now at 21 (adding ~1/week on average).
- **Is the `lovable-tagger` component tagger still in use?**
  Eleventh run asking. One-line cleanup blocked on this.
- **Should the typecheck backlog be drained with a
  `tsconfig.test.json` split (moves ~85% of the errors out of
  scope), or is a bulk `ts-expect-error` sweep of the product-code
  errors acceptable first?** Fourth run asking. The 381 → 55
  product-source-only cut would let the ratchet enforce a
  meaningfully tight bound.

## Next review focus

1. **Whether the audit-recommendation follow-up process gets a
   product-owner answer.** Primary escalation this run — same
   pattern surfaced by both the hygiene and the UX review routines.
   If no answer by the next audit, the hygiene run will stop
   prescribing tickets and only flag findings.
2. **Whether any bot PR gets merged.** Two safe-to-merge PRs
   (#244 autocomplete-attrs, #243 History coverage) plus the
   older #240 test-guard have accumulated. If the pattern
   continues to be "open a bot PR, never merge," the maintainer's
   cadence effectively defers all bot work indefinitely and
   PREPIO-110's auto-close proposal becomes more urgent.
3. **Whether PR [#215](https://github.com/akkkkkkki/prepio/pull/215)
   (mockup adoption) merges.** Now open ≥13 days, no activity in
   the last 13 days. Same status as 2026-07-15.
4. **First runtime PR after this quiet window.** The typecheck
   ratchet, lint baseline, and bundle size baselines are all
   sitting at their 2026-07-15 values and haven't been exercised
   by any product-code diff since. The next non-docs PR is worth
   watching to confirm the guards continue to catch regressions.
5. **Whether the `Practice.mobile.test.tsx` flake actually
   reproduces in the CI runs this window.** All 369 tests passed
   cleanly in this audit's local `npm test`, but the flake is a
   CI-resource-contention issue that doesn't reproduce
   deterministically outside CI. If the CI logs show zero retries
   consumed since 2026-07-15, the retry mitigation might have
   permanently absorbed the underlying race — worth noting even if
   the ticket-filing question stays open.
