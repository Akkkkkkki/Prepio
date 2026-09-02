# Recurring hygiene review — 2026-09-02

## Summary

Twenty-sixth recurring codebase hygiene & security review for Prepio.

**First functional window since run #23.** The two intervening runs (#24 on
2026-08-22 and #25 on 2026-08-26) were docs-only — run #23 (2026-08-19) itself
merged functional commits (#300, #301) plus the in-run credential-removal fix,
so the docs-only stretch was #24–#25, not #23–#25. The last hygiene run (#25,
base `d0377e8`) explicitly flagged "the next merge that touches source is the one
to review closely." Since then `main` advanced `d0377e8 → 44dca2c` (9 commits)
and, unlike the two docs-only windows, several carry real source changes. I
reviewed the full functional diff rather than only re-verifying carried findings.

**The merged source changes this window are clean — no new security,
authorization, or data-flow risk was introduced.** What changed:

- **Accessibility heading semantics** (#315, PREPIO-171): `CardTitle` gained an
  `asChild`/Radix `Slot` escape hatch ([`card.tsx`](../../src/components/ui/card.tsx))
  so the guest landing and preview surfaces render real `<h1>`/`<h2>` elements
  ([`Home.tsx`](../../src/pages/Home.tsx),
  [`InterviewBriefPreview.tsx`](../../src/components/preview/InterviewBriefPreview.tsx)).
  `@radix-ui/react-slot` is a **declared** dependency (`^1.3.0`, package.json:53) —
  not a phantom transitive. Presentational only.
- **Honest transcription-failure toast** (#311): a fire-and-forget transcribe
  failure now raises a non-blocking "Transcription unavailable / Your answer was
  still saved." notice instead of vanishing silently
  ([`Practice.tsx:1480`](../../src/pages/Practice.tsx)). A successful-but-empty
  transcript stays silent. Reliability/UX-honesty improvement, aligned to
  `docs/DESIGN_PRINCIPLES.md`; no new data reaches logs or the client.
- **Dead-code deletion** (#319, PREPIO-155): removed the unused
  `duckduckgo-fallback` shim and its Deno test. Pure removal; the Vitest suite is
  unaffected (48 files / 426 tests, was 49/426 — the deleted file was a Deno test,
  not part of the JS suite).
- **PII-in-logs bound** (#308): the `parseJsonResponse` raw-response preview cap
  reviewed and fixed in run #25 landed this window
  ([`openai-client.ts:89`](../../supabase/functions/_shared/openai-client.ts)).

**One small fix was made this run** — I resolved a **new** `browserslist`
**high**-severity advisory with a clean, lockfile-only patch bump (details below).
This is the one open finding that was both in-scope for a hygiene run and safely
fixable in this environment.

**New signal this window:** `npm audit` gained a `browserslist <=4.28.6` **high**
advisory pair (GHSA-c83g-rgw3-j3cx unbounded memory growth; GHSA-73wf-gq98-2v4g
crash/prototype-write via untrusted `browserslist-stats.json`). Unlike the two
carried majors, its fix is a **patch within the existing transitive semver
range** (`npm audit fix` non-force), so I applied it: `browserslist 4.28.2 →
4.28.8` plus the caniuse data-package refreshes. `browserslist` is a build-time
transitive (autoprefixer / babel / workbox-build); no runtime code path and no
`browserslist-stats.json` in this repo, so exploitability here was low even
before the fix — but a zero-risk lockfile patch is worth taking.

Baselines (measured at HEAD `44dca2c`, after the browserslist fix):
lint **51** problems (43 errors, 8 warnings, flat). Typecheck **pass at baseline**
(app tsc **62**, node **0**, flat). Build **2278.88 KiB** / 62 precache entries
(byte-flat before and after the fix). Tests **426** passing (48 files). `npm audit`
**3** findings (2 react-router moderate + 1 pdfjs-dist high) — down from 4; the
browserslist high is cleared.

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **51 problems (43 errors, 8 warnings).** Flat vs the 2026-08-26
  baseline. The merged source changes introduced no lint delta; the errors are the
  same pre-existing `no-explicit-any` / `react-hooks` / `no-require-imports` set
  (CI treats lint as informational — see CLAUDE.md).
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: **62** errors. Node: **0**. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the
  script reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under
  `$CI`). No edge-function source changed this window except the run-#25 log
  bound (plain TS, no new imports), which the real CI `verify` job covers.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries, **2278.88 KiB**).
  Byte-flat before and after the browserslist fix.
- `npm test`: **pass** (48 test files, **426 tests**). Re-run after the lockfile
  fix — still 426/426 green.
- `npm audit`: **3** (2 react-router moderate + 1 pdfjs-dist high) after the fix;
  was **4** (adding the browserslist high) before. `npm audit fix` non-force is a
  no-op for the two remaining runtime advisories (both need a breaking major).

## Findings

### Critical

- None.

### High

- [ ] **`interview-research` never verifies `searchId` ownership — cross-tenant
  write (BOLA) via the service-role client.** *(Carried from 2026-08-12;
  re-verified still open. Pre-existing, not a regression. Tracked as
  [PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143), Backlog / High.)*
  - Evidence: the only identity check is body `userId` == JWT user
    ([interview-research/index.ts:1096](../../supabase/functions/interview-research/index.ts)).
    `searchId` (line 1085) is taken from the request and never checked against the
    caller, yet every downstream write keys off it with the service-role client
    (resume snapshot, stage upserts, status update). `interview-research/index.ts`
    was **not** touched this window, so the finding stands unchanged.
  - Risk: a signed-in user supplying their own `userId` but another tenant's
    `searchId` can drive writes against a search row they do not own. Service-role
    writes bypass RLS, so the DB will not stop it.
  - Recommended fix: before any write, `select user_id from searches where id =
    searchId` and reject when absent or `!= userId`. Land with a
    cross-tenant-rejection test; confirm the normal create → invoke flow still
    passes. Then re-audit `company-research`, `job-analysis`, and `answer-feedback`
    for the same missing object-ownership check.
  - Owner / next step: **PREPIO-143** (a substantive edge-function change, out of
    scope for a hygiene run and not validatable in this proxy-limited environment).
    Deferred to a dedicated fix PR. Related: **PREPIO-144** (Low) covers the
    evidence-ledger trust-grant on unvalidated `roleLinks`.

### Medium

- [ ] **`pdfjs-dist` high-severity advisory (GHSA-hq66-cqwq-w95j) — arbitrary JS
  execution on opening a malicious PDF.** *(Carried; re-verified. Tracked as
  [PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140), Backlog / High.)*
  - Evidence: `npm audit` reports `pdfjs-dist >=5.6.83 <6.2.108` high; the app
    parses user-uploaded resumes client-side via the `pdf-*` chunk.
  - Risk: a crafted resume PDF could execute script in the parsing context.
    Materially mitigated by pdf.js worker isolation, but the highest-CVSS open
    advisory.
  - Recommended fix: bump `pdfjs-dist` to `>=6.2.108` (a 5 → 6 major) behind a
    resume-upload regression check (PDF **and** DOCX parse paths). Dependabot will
    open the PR; it needs a human to validate the major.
  - Owner / next step: **PREPIO-140** — dependency major (also Dependabot-surfaced),
    needs a human to validate the resume-upload (PDF + DOCX) regression surfaces.
    Not a lockfile-only fix.

### Low / clean-up

- [x] **New `browserslist` high advisory (GHSA-c83g-rgw3-j3cx +
  GHSA-73wf-gq98-2v4g).** *(New this window; **fixed this run**.)*
  - Evidence: `npm audit` flagged `browserslist <=4.28.6` high (installed 4.28.2)
    — unbounded memory growth via distinct query results, and a crash /
    prototype-write via untrusted `browserslist-stats.json` custom stats.
  - Fix: targeted lockfile-only update — `browserslist 4.28.2 → 4.28.8`, plus the
    caniuse data packages it pulls (`caniuse-lite`, `electron-to-chromium`,
    `node-releases`, `update-browserslist-db`, `baseline-browser-mapping`). No
    direct-dependency version change, no breaking change; the diff is 6 version
    bumps (23 ins / 23 del) with zero new `node_modules` keys. I used `npm update
    <pkgs>` rather than `npm audit fix` deliberately: the latter also tried to add
    74 optional cross-platform binary packages (rollup/swc/napi-rs for
    win32/darwin/etc.), unrelated lockfile churn the security fix does not need.
  - Verification: build byte-flat (2278.88 KiB), `npm test` 426/426 green, `npm
    audit` down 4 → 3 with `browserslist` cleared.
  - Note: `browserslist` is a build-time transitive with no runtime path and there
    is no `browserslist-stats.json` in the repo, so exploitability here was low —
    but the patch is zero-risk and within range.

- [ ] **Two `react-router` advisories (open-redirect GHSA-wrjc-x8rr-h8h6;
  SSR-hydration constructor injection GHSA-337j-9hxr-rhxg) — moderate.** *(Carried;
  re-verified. SSR one does not apply to this CSR-only app. Tracked as
  [PREPIO-172](https://linear.app/qiuyue/issue/PREPIO-172), Backlog / Low.)*
  - Evidence: `npm audit` attaches both to `react-router 6.0.0 - 7.17.0`. Prepio
    ships a client-only `BrowserRouter` SPA (no `hydrateRoot`/`StaticRouter`
    anywhere in `src/`), so the SSR-hydration exploit path does not apply; the
    open-redirect one is the substantive residual.
  - Recommended fix: react-router v7 major (`>7.17.0`), outside the `^6.26.2`
    manifest constraint — a breaking bump behind a routing/redirect regression
    check. `npm audit fix` non-force is a no-op.
  - Owner / next step: **PREPIO-172** — dependency major (also Dependabot-surfaced).

- [ ] **`check-deno-baseline.sh` is a total-count ratchet with an
  import-resolution soundness gap.** *(Carried from 2026-08-22; re-verified.
  Tracked as [PREPIO-169](https://linear.app/qiuyue/issue/PREPIO-169), Backlog /
  Low — filed during the 2026-08-29 alignment review; the duplicate PREPIO-174
  was closed on discovery.)*
  - Evidence: the wrapper fails only on `count > BASELINE` (19), a
    network-classified skip under `$CI`, or a nonzero `deno` exit with `count ==
    0`. A non-connection import error whose text misses the network-skip regex,
    leaving 1–19 countable diagnostics, would exit 0.
  - Risk: low — the real CI `verify` job runs a genuine blocking `deno check`, so
    this is a soundness gap in the *proof of completeness*, not an active
    false-green.
  - Recommended fix: reject any unclassified nonzero `deno` exit (not just `count
    == 0`), and treat a below-baseline count as inspect-not-pass.
  - Owner / next step: **PREPIO-169** — a CI-gate hardening change beyond the
    hygiene mandate's approval scope.

## Small fixes made in this run

- **Bumped the `browserslist` transitive tree to clear a new high-severity
  advisory** (`package-lock.json` only). `browserslist 4.28.2 → 4.28.8` plus its
  caniuse data packages, via a targeted `npm update` that avoids the 74-package
  optional-binary churn `npm audit fix` would have added. Build byte-flat, `npm
  test` 426/426 green, `npm audit` 4 → 3. Shipped in the same PR as this note.

## Deferred items

Discrete, actionable items, each already tracked in Linear:

- **[PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143)** —
  `interview-research` `searchId` BOLA fix PR (High). Highest-value follow-up.
- **[PREPIO-144](https://linear.app/qiuyue/issue/PREPIO-144)** — evidence-ledger
  trust grant on unvalidated `roleLinks` (Low). Same object-ownership audit family.
- **[PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140)** — `pdfjs-dist` 5 → 6
  major (Medium/High), and **[PREPIO-172](https://linear.app/qiuyue/issue/PREPIO-172)**
  — `react-router` v7 major (Low, two advisories). Both are also Dependabot-surfaced
  majors needing human validation; no lockfile-only fix.
- **[PREPIO-169](https://linear.app/qiuyue/issue/PREPIO-169)** —
  `check-deno-baseline.sh` import-resolution soundness hardening (Low, a CI-gate
  change beyond the hygiene mandate's approval scope).
- **[PREPIO-141](https://linear.app/qiuyue/issue/PREPIO-141)** — observability
  decision on whether any raw model content should be logged at all. The run-#25
  `parseJsonResponse` bound is a bound, not a policy answer.

No **new** Linear issue is owed from this run: the one item that lacked a fix
(the browserslist advisory) was fixed rather than filed, and every remaining open
is already tracked (PREPIO-143, PREPIO-144, PREPIO-140, PREPIO-172, PREPIO-169,
PREPIO-141).

## Questions for product owner

- None blocking. All open findings have an owner or a clear next action.

## Next review focus

1. **[PREPIO-143](https://linear.app/qiuyue/issue/PREPIO-143) (`searchId` BOLA)
   fix PR** — still the highest-value open item. When scheduled, verify the
   ownership check lands with a cross-tenant-rejection test and the normal create
   → invoke flow still passes, then re-audit `company-research`, `job-analysis`,
   and `answer-feedback` (and PREPIO-144's `roleLinks` path) for the same missing
   object-ownership check.
2. **react-router v7 ([PREPIO-172](https://linear.app/qiuyue/issue/PREPIO-172)) /
   pdfjs-dist 6 ([PREPIO-140](https://linear.app/qiuyue/issue/PREPIO-140)) majors.**
   If Dependabot has opened the security PRs, spend a review validating the
   resume-upload (PDF+DOCX) and routing/redirect regression surfaces so the majors
   can actually land instead of accumulating advisories.
3. **Keep watching the functional windows.** This was the first source-touching
   window since #23 and it was clean; the next merges to review closely are any
   that touch edge functions, auth, or the research pipeline (where the open BOLA
   family lives) rather than presentational/UX changes.
