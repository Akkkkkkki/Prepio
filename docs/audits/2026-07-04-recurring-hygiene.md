# Recurring hygiene review — 2026-07-04

## Summary

Twelfth recurring codebase hygiene & security review for Prepio.

Three commits merged to `main` in the three days since 2026-07-01:

- [#205](https://github.com/akkkkkkki/prepio/pull/205) — **React 19
  upgrade with peer dependency fixes (supersedes #146).** The only
  source-code change in the window (`src/App.tsx`, one line:
  `JSX.Element → React.JSX.Element`); everything else is
  `package.json` / `package-lock.json`.
- [#206](https://github.com/akkkkkkki/prepio/pull/206) — docs, UX
  review routine run #3.
- [#208](https://github.com/akkkkkkki/prepio/pull/208) — docs, ROADMAP
  ledger update (paid AI answer feedback moved under Shipped, PREPIO-115).

Headline status:

1. **`npm audit` is still clean** — 0 vulnerabilities, eighth
   consecutive run. Dependency tree: 248 prod / 577 dev / 78 optional
   / 8 peer.
2. **React 19 landed clean, but the initial evidence was wrong —
   corrected in-post.** #205 bumped `react` / `react-dom` 18.3.1 →
   19.2.7 plus peer deps `next-themes` 0.3.0 → 0.4.6 and `vaul`
   0.9.3 → 1.1.2. `next-themes` is used only in
   [`src/components/ui/sonner.tsx`](../../src/components/ui/sonner.tsx)
   (theme lookup); `vaul` only in
   [`src/components/ui/drawer.tsx`](../../src/components/ui/drawer.tsx)
   (single `DrawerPrimitive.` reference, no in-app importer of the
   `drawer.tsx` re-exports). The only source diff is
   [`src/App.tsx:25`](../../src/App.tsx) —
   `children: React.JSX.Element` (React 19 removed the global `JSX`
   namespace). No `ReactDOM.render`, no `React.SFC`, no other React
   18-only API left in `src/`. **Codex flagged on PR #213 that the
   audit's initial `npm run typecheck: pass` line was invalid
   evidence** (see finding #1 below — the script is a no-op). Re-ran
   the real project typecheck (`tsc -b`) across the #205 boundary:
   `348 → 347` errors, i.e. React 19 introduced zero net new type
   regressions. **PREPIO-93 is still resolved by merge — close as
   Done** — but on the corrected evidence path, not the misleading
   one.
3. **Bundle grew ~49 KiB from the React 19 bump.** PWA precache went
   from 60 entries / 2212.94 KiB on 2026-07-01 → 60 entries / **2262.42
   KiB** today. No new entries, no new large chunks — attributable to
   React 19's runtime footprint. Watch for compounding drift when the
   next peer-dep bump lands.
4. **Test count unchanged** — 347 tests across 44 files, all passing,
   same as 2026-07-01. React 19 upgrade didn't touch tests.
5. **No new lint regressions.** 15 problems (7 errors / 8 warnings) —
   identical to 2026-06-24 / 2026-06-27 / 2026-07-01 baseline. Same
   files, same lines. (Human PR
   [#212](https://github.com/akkkkkkki/prepio/pull/212) is in flight
   to refresh the `docs/TESTING.md` lint-baseline header from the
   stale `2026-05-18 · 38 problems (20e/18w)` to the current
   `2026-07-04 · 15 problems (7e/8w)`; not merged yet.)
6. **Dependabot pile 8 → 7.** [#146](https://github.com/akkkkkkki/prepio/pull/146)
   (React 19) was superseded and closed by the
   #205 merge; no new Dependabot PRs opened this window. Remaining:
   #143 (upload-artifact 7.0.1), #144 (setup-node 6.4.0), #148
   (dev-deps lint-and-format), #159 (dev-deps testing), #170
   (checkout 7.0.0), #202 (openai/codex-action 1.9), #203
   (@tanstack/react-query 5.101.2).
7. **Bot-PR pile 18 → 20.** Two new drafts opened this window:
   [#209](https://github.com/akkkkkkki/prepio/pull/209)
   (github-actions[bot], "PREPIO-48: Re-enable raw content + deep
   extraction for top-N highest-signal URLs", 2026-07-03, draft) and
   [#207](https://github.com/akkkkkkki/prepio/pull/207) (cursor[bot],
   "test: cover Tavily fallback shim behavior", 2026-07-02, draft).
   Full breakdown: 14 github-actions[bot] + 6 cursor[bot] = 20.
   [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) scope
   grows again.
8. **Three new human-authored PRs opened this window** (all by
   `Akkkkkkki`, all ready-for-review, none merged yet):
   [#210](https://github.com/akkkkkkki/prepio/pull/210) — test
   coverage for the PREPIO-80 "other" role-family query plan branch;
   [#211](https://github.com/akkkkkkki/prepio/pull/211) — PREPIO-90,
   scope UX review routine honestly around environments without live
   browser access;
   [#212](https://github.com/akkkkkkki/prepio/pull/212) — PREPIO-116,
   refresh the `docs/TESTING.md` lint baseline. All are non-runtime
   (tests + docs); worth watching for merge in the next audit window.

No small lint / hygiene fix made in-tree this run — the baseline
holds, no secret exposure or drift caught, and the one runtime change
(React 19) is already verified.

## Commands run

- `npm install`: pass. **0 vulnerabilities** (eighth consecutive
  clean run, 248 prod / 577 dev / 78 optional / 8 peer dependencies —
  prod count dropped by 1 vs 2026-07-01's 249 as the React 19 tree
  reshuffled peers).
- `npm run lint`: 15 problems (7 errors, 8 warnings). Identical to
  2026-06-24 / 2026-06-27 / 2026-07-01 baseline. Same files, same
  lines: `src/components/ui/command.tsx`,
  `src/components/ui/textarea.tsx`, `tailwind.config.ts`, four
  `tests/**` `no-explicit-any` errors, plus 8
  `react-refresh/only-export-components` warnings across
  `src/components/{AuthProvider,ui/badge,ui/button,ui/form,ui/navigation-menu,ui/sidebar,ui/sonner,ui/toggle}.tsx`.
- `npm run typecheck` (`tsc --noEmit`): pass (**as a no-op** — see
  the new Medium finding below). The root
  [`tsconfig.json`](../../tsconfig.json) has `"files": []` and only
  project references, so `tsc --noEmit` at the root type-checks zero
  files (`tsc --noEmit --listFiles` prints no source paths).
  Codex flagged this on PR #213 and it turned out to be right — the
  audit's initial "typecheck: pass" line was misleading evidence.
  **The real project typecheck** (`tsc -b`, or
  `tsc -p tsconfig.app.json --noEmit`) surfaces **347 pre-existing
  errors** across ~30 files, dominated by test files
  (`src/pages/__tests__/Home.mobile.test.tsx` — 40,
  `Dashboard.mobile.test.tsx` — 38, `Profile.test.tsx` — 35,
  `Practice.mobile.test.tsx` — 32) and one product file
  (`src/services/searchService.ts` — 22, mostly `Json`-conversion
  and RPC-name mismatches). **React 19 did not introduce
  regressions:** the same real typecheck at `e119be4` (the pre-#205
  HEAD) also fails, at **348** errors. `348 → 347` across the React
  19 bump = zero net new type errors from #205.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2262.42
  KiB** — ~49 KiB heavier than 2026-07-01's 2212.94 KiB, no entry
  count change; the delta is React 19's runtime).
- `npm test`: pass (44 test files, **347 tests**). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all
  green. Unchanged from 2026-07-01.
- `npm audit`: **0 vulnerabilities.**
- `npm outdated`: 29 packages have a newer version available (down
  from 35 on 2026-07-01 as React 19 upgrade knocked several off the
  drift list). Remaining major-upgrade drift: ESLint 10, TypeScript
  6, Tailwind 4, Zod 4, Vite 8, pdfjs-dist 6, react-router-dom 7,
  react-day-picker 10, sonner 2, recharts 3, tailwind-merge 3,
  react-resizable-panels 4, react-hooks 7, `@vitejs/plugin-react-swc`
  4, `@types/node` 26, jsdom 29, `@hookform/resolvers` 5,
  `eslint-plugin-react-refresh` 0.5, globals 17, lucide-react 1.
  None map to an active security advisory.

## Review focus this run

### Retro-audit of PREPIO-93 ([#205](https://github.com/akkkkkkki/prepio/pull/205), landed 2026-07-03)

The React 19 upgrade PR — flagged as pending in three prior audits
(2026-06-24, 2026-06-27, 2026-07-01). Superseded the original
Dependabot PR #146.

Files reviewed:

- [`package.json`](../../package.json) diff
- [`package-lock.json`](../../package-lock.json) diff
- [`src/App.tsx`](../../src/App.tsx) diff
- [`src/components/ui/drawer.tsx`](../../src/components/ui/drawer.tsx)
  (vaul consumer)
- [`src/components/ui/sonner.tsx`](../../src/components/ui/sonner.tsx)
  (next-themes consumer)

Findings:

- **Blast radius is tiny.** Only three files: `package.json` (6+/6-),
  `package-lock.json` (35+/50-), `src/App.tsx` (1+/1-). The App diff
  is one line — `children: React.JSX.Element` — because React 19
  removed the global `JSX` namespace.
- **Peer-dep bumps look safe.** `next-themes` 0.3.0 → 0.4.6 is a
  single-file consumer (`sonner.tsx`) using only the `useTheme` hook;
  no behavioural change owed. `vaul` 0.9.3 → 1.1.2 is a major
  SemVer bump but its consumer (`drawer.tsx`) uses only
  `DrawerPrimitive.*` and no in-app file imports from
  `@/components/ui/drawer`, so the blast radius is a single component
  that already type-checks and builds.
- **No React 18-only API left in `src/`.** `grep -RE
  'ReactDOM\.render|React\.SFC|React\.StatelessComponent|React\.ReactChild'`
  is empty. The one `JSX.Element` in `src/App.tsx` was migrated to
  `React.JSX.Element` in the same PR.
- **No new security surface.** No new package added, no new native
  dep, no new peer, no schema/auth/edge-function change.
- **Bundle cost: +49 KiB precache.** The React 19 runtime is heavier
  than 18's — the aggregate jumped from 2212.94 KiB (2026-07-01) to
  2262.42 KiB, unevenly distributed across the main chunk. No new
  entries, no new large chunks. Worth watching for compounding drift
  as more Radix / peer updates land through the year.
- **Codex review of the PR flagged one item** — resolved in-tree by
  the same PR: the peer-dep fixes (next-themes + vaul) were needed
  to unblock the React 19 upgrade cleanly. History shows a follow-up
  commit ("Addresses the Codex review finding on PR #205") landed on
  the same branch before merge.

Verdict: **clean, corrected evidence path.** After Codex flagged the
no-op typecheck on PR #213, I re-ran the real project typecheck (`tsc
-b`) at both HEAD and the pre-#205 commit `e119be4`: **348 → 347**
errors across the React 19 bump, i.e. one *fewer* error post-upgrade
and zero net new regressions. The verdict stands — move PREPIO-93 to
Done — but the evidence is now the real project typecheck delta, not
the misleading root `tsc --noEmit` no-op.

### Secret / client-exposure re-scan

Standard cadence — nothing changed since 2026-07-01, but the checks
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
- **Built assets are clean.** `grep -RlE '(sk-proj-|SUPABASE_SERVICE_ROLE)'
  dist` returns no match.

## Findings

### Critical

- None.

### High

- None.

### Medium

- [ ] **CI typecheck is a silent no-op** — new, **surfaced by Codex
  on PR #213**
  - Evidence:
    [`.github/workflows/ci.yml:45`](../../.github/workflows/ci.yml)
    runs `npm run typecheck`, which resolves to `tsc --noEmit` at the
    root [`tsconfig.json`](../../tsconfig.json). Root config sets
    `"files": []` with two project references — so `tsc --noEmit`
    (unlike `tsc -b`) type-checks **zero** source files, exits 0
    without touching `src/`. Verified locally:
    `npx tsc --noEmit --listFiles` prints nothing;
    `npx tsc -p tsconfig.app.json --noEmit` prints **347** errors
    across ~30 files (top offenders:
    `src/pages/__tests__/Home.mobile.test.tsx` — 40,
    `Dashboard.mobile.test.tsx` — 38, `Profile.test.tsx` — 35,
    `Practice.mobile.test.tsx` — 32,
    `src/services/searchService.ts` — 22 mostly `Json`-cast and
    RPC-name mismatches).
  - Risk: CI has been reporting "typecheck: pass" while masking 347
    real type errors. Any React 19–introduced regression in `src/`
    (or any product code TypeScript error) would slip through
    unnoticed. Cross-check across the #205 boundary shows React 19
    itself introduced **zero** net new errors (`348 → 347`), so this
    audit's PREPIO-93 verdict is still safe — but the same evidence
    is invalid for future upgrades.
  - Recommended fix: Two-step. (1) Fix the `typecheck` npm script to
    invoke the real project — `tsc -b` (build referenced projects)
    or `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json --noEmit`.
    (2) Because that will fail CI on 347 pre-existing errors, land
    it together with (a) a targeted cleanup pass of the ~22
    `searchService.ts` errors (real product bugs — `question_type`
    typo, RPC-name mismatch, `ProfileImport*` cast pattern) and
    (b) either a broad test-file relaxation (`ts-expect-error`
    scaffolding, or a `tsconfig.test.json` that loosens
    `moduleResolution` for tests), matching the existing lint
    baseline pattern (CI tolerates `--exit-on-fatal-error=1` on
    lint).
  - Owner / next step: File a Linear issue against Quality &
    Maintenance (Chore, `area:infra`) with this whole finding
    pasted verbatim, cross-linked to PR #213 and this audit doc.
    Do **not** attempt the fix in this docs-only PR — the moment
    the script is corrected, CI will red for every open PR until
    the 347 errors are triaged, which is a multi-hour scope well
    over the "one small reviewable PR" hygiene-run rule.

- [ ] **Bot-PR pile grew from 18 → 20** — re-flagged, sixth run
  - Evidence: `mcp__github__list_pull_requests --state open` returns
    **30** open PRs total: 3 human (`Akkkkkkki`), 7 dependabot[bot],
    14 github-actions[bot], 6 cursor[bot]. New bot drafts this
    window: [#209](https://github.com/akkkkkkki/prepio/pull/209)
    (github-actions[bot], "PREPIO-48: Re-enable raw content + deep
    extraction for top-N highest-signal URLs", 2026-07-03) and
    [#207](https://github.com/akkkkkkki/prepio/pull/207) (cursor[bot],
    "test: cover Tavily fallback shim behavior", 2026-07-02).
  - Risk: Same as prior runs — triage noise, not security. But the
    pile has drifted from 11 (2026-06-24) → 16 → 18 → **20** over
    four audits with no cleanup pass. Each new merge (React 19 in
    this window) triggers Dependabot / codex rebase churn on all
    open drafts, so the triage cost per merge keeps growing.
  - Recommended fix: Same as prior runs — one cleanup pass on
    [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110), now
    correctly scoped to 20 non-Dependabot bot PRs.
  - Owner / next step: Update PREPIO-110 description to reflect
    the current count (14 github-actions[bot] + 6 cursor[bot] = 20)
    and answer the standing open question from 2026-07-01 — one-time
    triage pass or auto-close Action?

### Low / clean-up

- [ ] **PREPIO-93 (React 19) resolved by #205 merge**
  - Evidence: `react` 18.3.1 → 19.2.7 landed via
    [#205](https://github.com/akkkkkkki/prepio/pull/205) on
    2026-07-03. Original Dependabot PR #146 auto-closed as
    superseded. Peer deps (`next-themes` 0.4.6, `vaul` 1.1.2) came
    along in the same commit. Build + typecheck + test + audit all
    pass on the new lockfile.
  - Recommended fix: Close
    [PREPIO-93](https://linear.app/qiuyue/issue/PREPIO-93) as Done.
    2026-06-24 audit's premature "already resolved" note is now
    correct — just three weeks late.

- [ ] **Dependabot pile 8 → 7 (net); React 19 supersedes PREPIO-93**
  - Evidence: Current open Dependabot PRs: #143 (upload-artifact
    7.0.1), #144 (setup-node 6.4.0), #148 (dev-deps lint-and-format),
    #159 (dev-deps testing), #170 (checkout 7.0.0), #202
    (openai/codex-action 1.9), #203 (@tanstack/react-query 5.101.2).
    Total: 7. Delta since 2026-07-01: `-1` (#146 auto-closed after
    #205 merged), no new opens. **First audit window since
    2026-06-13 with no net Dependabot growth.**
  - Recommended fix: No hygiene action — this is informational.
    #202 still slots into
    [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92); #203 is
    still unhomed (raised 2026-07-01, still no PREPIO ticket). Slot
    it into [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) or
    file a fresh line item.

- [ ] **Bundle grew +49 KiB from React 19** — informational, no fix
  needed this run
  - Evidence: PWA precache 60 entries / 2262.42 KiB today vs 60
    entries / 2212.94 KiB on 2026-07-01. Same entry count, same
    manifest layout — the delta is React 19's runtime. Vite build
    still fires "Some chunks are larger than 550 kB" warnings on the
    three largest bundles (`index-Cg3FfBLH.js` 553.44 KiB / 166.11
    KiB gzip; `index-30PxPKr7.js` 502.11 KiB / 130.93 KiB gzip;
    `pdf-D4X9PViX.js` 469.96 KiB / 143.40 KiB gzip) — same warnings
    as 2026-07-01, just slightly bigger.
  - Recommended fix: None. Watch the number — if it drifts past
    ~2400 KiB before the next real Radix / Vite / Tailwind major
    lands, a code-splitting pass on the top-three chunks (Home,
    pdf.js, main index) becomes worth filing. No action this run.

- [ ] **Lint baseline unchanged, refresh PR in flight** —
  informational
  - Evidence: Same 7 errors / 8 warnings as 2026-06-24 / 2026-06-27
    / 2026-07-01. Human PR
    [#212](https://github.com/akkkkkkki/prepio/pull/212) opened
    2026-07-04 to update the `docs/TESTING.md` header from the stale
    `2026-05-18 · 38 problems (20e/18w)` to the current
    `2026-07-04 · 15 problems (7e/8w)`. Not merged yet — worth
    flagging in the next audit if still open.
  - Recommended fix: None from the hygiene runner. PREPIO-116 is
    the tracker.

- [ ] **`duckduckgo-fallback.ts` is still a 37-line compat shim** —
  informational, no fix needed this run
  - Evidence: Unchanged from 2026-07-01. If [PR #209](https://github.com/akkkkkkki/prepio/pull/209)
    (PREPIO-48, re-enable raw content + deep extraction) ships, the
    `_shared/` cleanup pass could reasonably retire the shim in the
    same PR.
  - Recommended fix: None this run — pin to the PREPIO-48 landing.

## Small fixes made in this run

None this run — audit doc + README index entry only. Deliberately
did **not** fix the `package.json` `typecheck` script in this PR:
correcting it to `tsc -b` will immediately red CI on 347 pre-existing
errors, which is a multi-hour cleanup scope far above the hygiene
runner's "small, reviewable PR" ceiling. Filed as a new Medium
finding and a Linear deferred item instead.

No application code, no schema, no auth flow, no product behaviour
touched.

## Deferred items

Tracked exclusively in Linear (no free-form bullets to re-discover):

- [PREPIO-91](https://linear.app/qiuyue/issue/PREPIO-91) — Dependabot
  dev-deps merge (#148 + #159). Unchanged for five audits. Consider
  folding #203 (@tanstack/react-query) here or filing a sibling.
- [PREPIO-92](https://linear.app/qiuyue/issue/PREPIO-92) — Actions
  majors. Current PR set: #143 (upload-artifact 7.0.1), #144
  (setup-node 6.4.0), #170 (checkout 7.0.0), #202
  (openai/codex-action 1.9). Unchanged for five audits.
- [PREPIO-93](https://linear.app/qiuyue/issue/PREPIO-93) — **Close as
  Done.** Resolved by [#205](https://github.com/akkkkkkki/prepio/pull/205)
  merging 2026-07-03. First real forward progress on the PREPIO-9x
  pile since PREPIO-94 closed on 2026-07-01.
- [PREPIO-96](https://linear.app/qiuyue/issue/PREPIO-96) —
  `lovable-tagger` keep-or-drop decision. Seventh audit waiting.
  `componentTagger` still wired in
  [`vite.config.ts:33`](../../vite.config.ts) but gated on
  `mode === 'development'` — no production exposure.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale
  bot-PR cleanup pass. Scope updated to **20** PRs (14
  github-actions + 6 cursor).
- [PREPIO-116](https://linear.app/qiuyue/issue/PREPIO-116) — Refresh
  `docs/TESTING.md` lint baseline. Opened 2026-07-04 as PR
  [#212](https://github.com/akkkkkkki/prepio/pull/212); watch for
  merge in the next audit.
- **New — CI typecheck is a no-op / 347-error backlog** (see the
  Medium finding above). File under Quality & Maintenance with
  labels `Chore` + `area:infra`, cross-linked to PR #213 and this
  audit doc. Surfaced by Codex on PR #213.

## Questions for product owner

- **Is the Lovable.dev component tagger (`lovable-tagger`) still in
  use?** Seventh run asking. One-line cleanup blocked on this.
- **Dependabot cadence — keep monthly, or tighten to weekly?**
  Seventh run asking. The pile did not grow this window (–1 net) but
  that was only because #146 auto-closed on the React 19 merge, not
  because triage caught up.
- **Stale bot-PR cleanup (PREPIO-110)** — accept the cleanup as a
  one-time triage pass (close + comment), or set up an Action that
  auto-closes bot-authored PRs older than 30 days with no
  human-author commits on the branch? Third run asking. Pile is now
  at 20.

## Next review focus

1. **CI typecheck fix.** If the new Medium finding gets a Linear
   ticket + PR before the next run, confirm the corrected
   `typecheck` script lands and CI actually red-flags source-level
   type regressions. Track the `searchService.ts` cleanup PR
   separately — the ~22 errors there include one likely-real bug
   (RPC name `save_resume_version` isn't in the generated union).
2. **Whether the still-open PREPIO-9x tickets and PREPIO-110 move.**
   Fifth audit asking on -91/-92/-96, fourth on -110. PREPIO-93 and
   PREPIO-94 are now resolved — that's the first real thinning in
   two months.
3. **If any of the 20 draft bot-PRs (especially #209 PREPIO-48 raw
   content deep extraction, #201 PREPIO-51 URL-dedup, #200 PREPIO-60
   Account/Settings) ships to `main` before the next run**, that
   surface should get a first-pass hygiene review. #209 in
   particular touches the research pipeline (`_shared/`
   duckduckgo shim, Tavily extraction depth) and deserves the same
   attention PREPIO-80 got on 2026-07-01.
4. **`answer-feedback` once it has production traffic with the
   atomic RPC.** Still owed from 2026-06-20 / 2026-06-24 / 2026-06-27
   / 2026-07-01 — sanity-check `generation_metadata.input_snapshot`
   payload size and confirm no model-output text accidentally lands
   in logs. No way to do this without traffic, so it stays parked
   until the team can ship the answer-feedback gate to real users.
