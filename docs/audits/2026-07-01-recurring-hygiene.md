# Recurring hygiene review — 2026-07-01

## Summary

Eleventh recurring codebase hygiene & security review for Prepio.

Only **one** commit has merged to `main` in the four days since
2026-06-27 — [#171](https://github.com/akkkkkkki/prepio/pull/171)
(chore(deps): bump the radix-ui group across 1 directory with 27
updates). No application code, no schema, no auth flow, no edge
function was touched by this merge.

Headline status:

1. **`npm audit` is still clean** — 0 vulnerabilities, seventh
   consecutive run.
2. **Test count grew by 7** — 340 → 347 across 43 → 44 files, all
   passing. **The 2026-06-27 audit undercounted:** those +7 tests
   and +1 file (`supabase/functions/company-research/query-planner.test.ts`)
   were actually already on `main` when that audit was written —
   PREPIO-80 ([#198](https://github.com/akkkkkkki/prepio/pull/198))
   merged 37 minutes before the audit-note PR ([#199](https://github.com/akkkkkkki/prepio/pull/199))
   on 2026-06-27, but the audit doc was still narrating #198 as
   "open, worth flagging for the next review." Ledger correction:
   the +7 tests / +1 file belong to PREPIO-80, not to this window.
3. **Only merge this window is a Radix-UI patch bump.** #171 shifted
   25 `@radix-ui/*` packages by patch (mostly `1.x.13 → 1.x.15`,
   with one minor `avatar 1.1.12 → 1.2.1` and one minor
   `slot 1.2.5 → 1.3.0`). All patch/minor semver ranges, no security
   advisory involved, build + tests + lint all pass on the new
   lockfile. **PREPIO-94 (Radix-UI 27-package bump) is now resolved
   by merge** — move it to Done in Linear.
4. **Follow-up on the 2026-06-27 "next review focus":** the audit
   flagged that if PR #198 (PREPIO-80, role-family-aware query
   planning) landed, this run should re-audit the research pipeline.
   It landed. Retro-audit follows below in *Review focus this run* —
   clean, no new external exposure.
5. **Dependabot pile 7 → 8 net.** #171 merged (Radix), but two new
   Dependabot PRs opened on 2026-07-01: #202 (openai/codex-action
   1.8 → 1.9) and #203 (@tanstack/react-query 5.101.0 → 5.101.2).
   Two other PRs already tracked in the ledger (#146, #148, #159)
   also got `updated_at` bumps this morning as Dependabot rebased
   them against the Radix merge — no new work, just churn.
6. **Bot-PR pile 16 → 18.** Two new drafts opened this window:
   [#200](https://github.com/akkkkkkki/prepio/pull/200) (PREPIO-60,
   Account/Settings surface, github-actions[bot], 2026-06-28) and
   [#201](https://github.com/akkkkkkki/prepio/pull/201) (PREPIO-51,
   Restore URL deduplication / scraped-content caching,
   github-actions[bot], 2026-06-30). Full breakdown: 13 github-
   actions[bot] + 5 cursor[bot] = 18. Update PREPIO-110 scope.
7. **No new lint regressions.** 15 problems (7 errors / 8 warnings)
   — identical to 2026-06-24 / 2026-06-27 baseline. Same files,
   same lines.
8. **Build slimmed by ~1 KiB.** PWA precache went from 60 entries /
   2213.65 KiB on 2026-06-27 → 60 entries / 2212.94 KiB today — no
   entry-count change, and the Radix patch bumps didn't move the
   bundle needle.

No application code, no schema, no auth flow, no product behaviour
touched in this run. No small lint fix made — the baseline holds.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (seventh consecutive
  clean run, 249 prod / 577 dev / 78 optional / 8 peer dependencies).
- `npm run lint`: 15 problems (7 errors, 8 warnings). Identical to
  2026-06-27 baseline; same files, same lines. Baseline files:
  `src/components/ui/command.tsx`, `src/components/ui/textarea.tsx`,
  `tailwind.config.ts`, four `tests/**` `no-explicit-any` errors,
  plus 8 `react-refresh/only-export-components` warnings across
  `src/components/{AuthProvider,ui/badge,ui/button,ui/form,ui/navigation-menu,ui/sidebar,ui/sonner,ui/toggle}.tsx`.
- `npm run typecheck`: pass.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2212.94
  KiB** — ~1 KiB lighter than 2026-06-27's 2213.65 KiB, no entry
  count change).
- `npm test`: pass (44 test files, 347 tests). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh`
  all green.
- `npm audit`: **0 vulnerabilities.**
- `npm outdated`: 35 packages have a newer version available. Same
  major-upgrade drift as 2026-06-27 (React 19, ESLint 10,
  TypeScript 6, Tailwind 4, Zod 4, Vite 8, pdfjs-dist 6,
  react-router-dom 7). None map to an active security advisory.

## Review focus this run

### Retro-audit of PREPIO-80 ([#198](https://github.com/akkkkkkki/prepio/pull/198), landed 2026-06-27)

Deferred from the 2026-06-27 "next review focus." The PR modifies
the `interview-research` orchestrator + rewrites the
`company-research` query-building path.

Files reviewed:

- [`supabase/functions/company-research/query-planner.ts`](../../supabase/functions/company-research/query-planner.ts)
- [`supabase/functions/company-research/query-planner.test.ts`](../../supabase/functions/company-research/query-planner.test.ts)
- [`supabase/functions/company-research/index.ts`](../../supabase/functions/company-research/index.ts)
  (diff, focused on the two new intake fields)
- [`supabase/functions/interview-research/index.ts`](../../supabase/functions/interview-research/index.ts)
  (diff, focused on the `level`/`userNote` forward)
- [`supabase/functions/_shared/duckduckgo-fallback.ts`](../../supabase/functions/_shared/duckduckgo-fallback.ts)
  (now a compat shim; 37 lines, all Tavily-proxy)

Findings:

- **Trust boundary unchanged.** `interview-research` still calls
  `company-research` via a service-role internal fetch
  (`Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`); the new
  body just carries two extra fields (`level`, `userNote`). No new
  RPC, no new client-facing endpoint, no service-role reach into a
  new table.
- **Query interpolation is safe.**
  `buildFamilyQueries` interpolates `company`, `role`, `userNote`
  signals into Tavily search-query strings. These strings only ever
  reach Tavily (`searchTavily` HTTP call) — never SQL, never a
  shell, never a prompt template. No injection surface.
- **User-note logging is defense-in-depth clean.** The request-entry
  log line
  [`logger.log('REQUEST_INPUT', 'VALIDATION', { company, role, country, level, hasUserNote: !!userNote, searchId })`](../../supabase/functions/company-research/index.ts)
  deliberately logs a **boolean** (`hasUserNote: !!userNote`) rather
  than the raw text. The follow-up `QUERY_PLAN` log DOES contain the
  extracted signals and full query strings — those flow through
  `SearchLogger`, which in production writes to `console.log`
  (edge-function logs, service-role only). Same trust boundary as
  all pre-existing Tavily query logging; no new customer-visible
  leak.
- **`extractUserNoteSignals` is scoped.** Extracts at most **3**
  signals per note, each capped at 40 chars by the underlying
  regex character class (`[A-Z][A-Za-z0-9& -]{1,40}`), and dedupes
  before slicing. Bounded — no unbounded log fanout from a
  malicious user note.
- **`classifyRoleFamily` regression fix in-tree.** The commit
  history shows the bare-`analyst` misclassification was caught and
  fixed inside the same PR (see the "fix: require finance qualifier
  for analyst role classification" commit), with new coverage in
  `query-planner.test.ts`. No follow-up owed.
- **Tavily `includeRawContent` flipped `false → true`.** Now returns
  full page HTML per result. Not a security regression — the raw
  content is only used to build the aggregated search payload — but
  it does grow the transient in-memory payload and the log body.
  Worth watching for storage / log-size drift if practice traffic
  ramps; no action this run.
- **DuckDuckGo fallback is fully gone.** `duckduckgo-fallback.ts`
  is now a 37-line Tavily-proxy shim kept only for import
  compatibility. Cleaner supply-chain surface (one fewer third-party
  data path). Worth deleting the shim entirely next time an
  `_shared` cleanup pass touches this file; no risk in leaving it.

Verdict: **clean.** Move the retro-audit item off the "next review"
list.

### Review of the only in-window merge ([#171](https://github.com/akkkkkkki/prepio/pull/171))

- **Nature.** Dependabot group PR bumping 25 `@radix-ui/*`
  primitives. `package.json` diff is 25 semver-range bumps
  (24 patch, one minor `1.1.12 → 1.2.1` on `avatar`, one minor
  `1.2.5 → 1.3.0` on `slot`); `package-lock.json` reflects same.
  No source-code diff, no config diff.
- **Verification.**
  `npm run typecheck` / `npm run build` / `npm test` / `npm audit`
  all pass on the new lockfile with no output diffs beyond the
  expected build-manifest hash churn.
- **Blast radius.** Radix primitives underpin most `src/components/ui/*`
  files — accordion, dialog, dropdown, popover, select, tabs,
  toast, tooltip, etc. Patch-level Radix bumps historically ship
  a11y fixes and no behavioural changes; a smoke sweep isn't owed
  from the hygiene runner.
- **Linear.** PREPIO-94 was the placeholder tracking this bump.
  Close it as Done — the merge resolved the entire ticket.

## Findings

### Critical

- None.

### High

- None.

### Medium

- [ ] **Bot-PR pile grew from 16 → 18** — re-flagged
  - Evidence:
    `mcp__github__list_pull_requests --state open` returns **18**
    open bot PRs: 13 `github-actions[bot]` + 5 `cursor[bot]`. New
    since 2026-06-27:
    [#200](https://github.com/akkkkkkki/prepio/pull/200)
    (github-actions[bot], "PREPIO-60: Account/Settings surface",
    2026-06-28, draft) and
    [#201](https://github.com/akkkkkkki/prepio/pull/201)
    (github-actions[bot], "PREPIO-51: Restore URL deduplication /
    scraped-content caching", 2026-06-30, draft).
  - Risk: Same as prior runs — process noise, not security.
    Triage cost keeps growing.
  - Recommended fix: Same as 2026-06-27 — one cleanup pass on
    [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110), now
    correctly scoped to 18 PRs.
  - Owner / next step: Update PREPIO-110 description to reflect the
    corrected count (13 github-actions[bot] + 5 cursor[bot] = 18)
    and re-scope PREPIO-60 / PREPIO-51 handling — those two are
    genuine backlog tickets, not stale scaffolding, so they should
    stay open even during a bot-PR triage sweep.

### Low / clean-up

- [ ] **Dependabot pile 7 → 8 (net); Radix bump merged and
  supersedes PREPIO-94**
  - Evidence: Current open Dependabot PRs: #143 (upload-artifact
    7.0.1), #144 (setup-node 6.4.0), #146 (react group), #148
    (dev-deps lint-and-format), #159 (dev-deps testing), #170
    (checkout 7.0.0), #202 (openai/codex-action 1.9), #203
    (@tanstack/react-query 5.101.2). Total: 8. Delta since
    2026-06-27: `–1` (#171 merged) `+2` (#202, #203 new).
  - Recommended fix: Close
    [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) as Done
    (resolved by #171 merge). Slot #202 (routine action bump) into
    PREPIO-92. #203 is a fresh Dependabot group and doesn't map to
    any existing PREPIO-9x ticket — either add it to
    [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) scope or
    file a small triage line item. No code review owed from the
    hygiene runner.

- [ ] **2026-06-27 audit undercounted the test suite** —
  informational, no fix
  - Evidence: 2026-06-27 stated `329 → 340` across `42 → 43` files.
    Current run measures `44 files / 347 tests`. The delta belongs
    to PREPIO-80 (`query-planner.test.ts`, +86 lines, +7 tests) —
    which merged 37 minutes before the 2026-06-27 audit-note PR.
    The audit-note author's baseline snapshot was taken **before**
    #198 merged. Not a live issue — the correct running total is
    `347 tests / 44 files` and should be the baseline for the next
    run.
  - Recommended fix: None. Documented here so the next audit doesn't
    treat +7 as this-window growth.

- [ ] **Lint baseline unchanged** — informational, no recommended
  fix
  - Evidence: Same 7 errors / 8 warnings as 2026-06-24 / 2026-06-27.
    4 of the 7 errors live in `tests/{unit,integration}/**`
    (`@typescript-eslint/no-explicit-any` on a Deno-style test
    suite). The other 3 are in `src/components/ui/*` (shadcn-derived
    files with `@typescript-eslint/no-empty-object-type`) plus the
    `tailwind.config.ts` `require()` rule.
  - Recommended fix: None. Documented baseline; CI tolerates lint
    errors (1) but fails on parse errors (2) — that contract is
    intact.

- [ ] **`duckduckgo-fallback.ts` is now a 37-line compat shim** —
  informational, no fix needed this run
  - Evidence:
    [`supabase/functions/_shared/duckduckgo-fallback.ts`](../../supabase/functions/_shared/duckduckgo-fallback.ts)
    only re-exports `searchTavily`; the `duckduckgo` name is
    retained solely for import compatibility. `grep -riE 'duckduckgo'`
    in the runtime tree finds only this file, plus a couple of log
    strings in `company-research/index.ts` that name the removed
    fallback ("fallbackEngaged: false, reason:
    duckduckgo_instant_answer_fallback_removed") for observability.
  - Recommended fix: Delete the shim + rename the log fields next
    time an `_shared` cleanup pass touches this file. No risk in
    leaving it — the surface is inert and no new caller can
    accidentally hit "the DuckDuckGo path" because there isn't one.

## Small fixes made in this run

None this run.

The audit doc itself plus the README index entry are the only
changes to `main` this run. No application code, no schema, no auth
flow, no product behaviour touched.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to
re-discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge (#148 + #159). Unchanged for four audits. Consider
  folding #203 (@tanstack/react-query) here or filing a sibling.
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors. Current PR set: #143 (upload-artifact 7.0.1), #144
  (setup-node 6.4.0), #170 (checkout 7.0.0), #202
  (openai/codex-action 1.9 — **new since 2026-06-27**). Unchanged
  for four audits.
- [PREPIO-93](https://linear.app/qiuyue/issue/PREPIO-93) — React 19
  scoped upgrade (#146 still open). Unchanged for four audits.
- [PREPIO-94](https://linear.app/qiuyue/issue/PREPIO-94) — **Close
  as Done.** Resolved by [#171](https://github.com/akkkkkkki/prepio/pull/171)
  merging 2026-07-01.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Sixth audit waiting.
  `componentTagger` still wired in
  [`vite.config.ts:33`](../../vite.config.ts) but gated on
  `mode === 'development'` — no production exposure.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **18** PRs (13
  github-actions + 5 cursor).

## Questions for product owner

- **Is the Lovable.dev component tagger (`lovable-tagger`) still in
  use?** Sixth run asking. One-line cleanup blocked on this.
- **Dependabot cadence — keep monthly, or tighten to weekly?**
  Sixth run asking. The pile crept up again this window (7 → 8),
  and Dependabot's group PRs rebase-churn on every merge, so weekly
  with the same `open-pull-requests-limit: 5` would amortise the
  triage cost instead of letting it bunch.
- **Stale bot-PR cleanup (PREPIO-110)** — accept the cleanup as a
  one-time triage pass (close + comment), or set up an Action that
  auto-closes bot-authored PRs older than 30 days with no
  human-author commits on the branch? Second run asking.
- **PREPIO-93 status.** 2026-06-27 audit flagged that the 2026-06-24
  audit may have prematurely closed PREPIO-93. Was it reopened?
  #146 (React 19) is still open on GitHub.

## Next review focus

1. **Whether the still-open PREPIO-9x tickets and PREPIO-110 move.**
   Fourth audit asking on -91/-92/-93/-96, third on -110.
2. **`answer-feedback` once it has production traffic with the
   atomic RPC.** Still owed from 2026-06-20 / 2026-06-24 / 2026-06-27
   — sanity-check `generation_metadata.input_snapshot` payload size
   and confirm no model-output text accidentally lands in logs under
   the new code path. No way to do this without traffic, so it stays
   parked until the team can ship the answer-feedback gate to real
   users.
3. **If any of the 18 draft bot-PRs (#200 PREPIO-60 Account/Settings,
   #201 PREPIO-51 URL-dedup, #196 PREPIO-59 gap analysis, #183
   PREPIO-105 one-tap practice, #177 PREPIO-101 collapse nav, #163
   PREPIO-88 conversion panel) ships to `main` before the next
   run**, that surface should get a first-pass hygiene review —
   several of them touch new user-owned data (Account/Settings) or
   the research pipeline (URL dedup restore) and warrant the same
   attention PREPIO-80 got this run.
