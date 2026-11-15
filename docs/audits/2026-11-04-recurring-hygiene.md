# Recurring hygiene review — 2026-11-04

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio. First
hygiene run since 2026-09-12 (#27, measured against HEAD `e3a283b`); this run is
measured against HEAD `a330939`.

**Range reviewed: `e3a283b..a330939`, fifteen merges.** Nine touch source
(`src/` or `supabase/functions/`, excluding tests), four are test-only, two are
docs/CI. The window is dominated by the **invite-only freeze lockdown** and by
**three dependency/security merges that close four findings carried into this run**:

- **`security: enforce interview research search ownership` (#337, PREPIO-143)** —
  **closes the carried High BOLA.** The fix landed as a dedicated
  [`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  module (`authorizeSearch`) plus a reordered handler. Verified in the merged code
  this run: the handler authenticates the caller (`authorizeRequest`), then runs a
  **fail-closed** ownership check — `select id from searches where id = searchId and
  user_id = authContext.userId`, **404 on miss (identical for an absent row and a
  foreign-owned row), 403 on body-`userId` ≠ JWT user, 500 on query error** — and
  this gate **completes before the background work promise is constructed**
  ([index.ts:1331](../../supabase/functions/interview-research/index.ts)), so the
  RLS-bypassing service-role pipeline clients cannot start writing `prep_plans` /
  `interview_stages` / `interview_questions` / `searches` for a search the caller
  does not own. Service callers remain trusted. This is exactly the fix PREPIO-143
  specified. (The *production* repair still rides on the deploy track — PREPIO-124 —
  a repo merge alone does not repair prod.)
- **`security: upgrade pdfjs-dist 5 to 6` (#350)** — **closes the carried
  `pdfjs-dist` High advisory (GHSA-hq66-cqwq-w95j).** `package.json` now pins
  `pdfjs-dist: ~6.3.289`; `npm audit` no longer reports a `pdfjs-dist` advisory.
- **`[PREPIO-172] Upgrade react-router-dom 6 → 7` (#353)** — **closes the carried
  `react-router` advisory pair** (open-redirect + SSR-hydration). `package.json` now
  pins `react-router-dom: ^7.18.4`; `npm audit` no longer reports a `react-router`
  advisory.
- **PREPIO-179 `SEARCH_COMPLETE` leak — closed.** The carried Medium (the aggregate
  `logger.log('SEARCH_COMPLETE', …)` in `company-research` still printed the full
  `result`, whose `search_results[].query` retained raw note-derived interviewer/team
  names) is now routed through
  [`buildSearchCompleteLogPayload`](../../supabase/functions/company-research/result-aggregation.ts)
  ([index.ts:321](../../supabase/functions/company-research/index.ts)), which emits
  **counts only** (`searchPayloads` / `searchResults` / `extractedContent` /
  `totalUrlsExtracted`) — no query text, no provider page text. Test-covered in
  `result-aggregation.test.ts`. The confirmed PREPIO-179 remaining leak is closed.

**Freeze-lockdown merges** (`#354` lock to the invite-only frozen core, `#360`
close freeze gaps from the final audit/UX reviews, `#363`/PREPIO-180 disclose that
pasted CV text is saved with the prep plan, plus `#357`/`#364`/`#368`/`#370` test
coverage and `#373`/PREPIO-153 a RUNBOOK call-graph correction) are
**security-reductive or security-neutral**: they remove or gate surfaces (voice,
billing, upload, public signup) rather than add them. Spot-checks this run found no
new unauthenticated surface, no new secret, and no new PII-in-logs regression. The
most visible effect is the **production bundle shrinking from 2280.54 KiB / 62
precache entries to 1243.41 KiB / 41 entries** — a ~46% reduction, consistent with
the frozen scope removing whole feature surfaces from the build.

**Headline: no new security, access-control, secret, or PII-in-logs regression was
introduced this window; four carried findings (PREPIO-143 High, `pdfjs-dist` Medium,
`react-router` Low ×2 as one advisory group, PREPIO-179 Medium) are closed.** Two
findings carry forward unchanged — the **`official_company` attacker-subdomain
over-trust** (now tracked as **PREPIO-184**, In Progress) and the **owner-attended
Git-history CV-PII purge** (**PREPIO-145**). The one genuinely new signal is a
**large `npm audit` spike (5 → 32)**, which triage shows is **entirely dev/build/test
toolchain plus one unused direct dependency — no shipped production-runtime
dependency is affected** (details in Findings).

Baselines (measured against HEAD `a330939`; deltas vs 2026-09-12 `e3a283b`):
lint **49** problems (40 errors, 9 warnings) — **−3 errors, warnings flat**; the
#338 `react-refresh/only-export-components` warning is still among the 9. Typecheck
**pass at baseline** (app tsc **61** — the committed ratchet baseline was lowered
62 → 61 since #27; node **0**). Build **1243.41 KiB / 41 precache entries** (down
from 2280.54 KiB / 62 — the freeze lockdown). Tests **494 passing / 58 files** (up
from 461 / 52). `npm audit` **32** (3 low, 24 moderate, 5 high) — up from 5; see the
triage below.

## Commands run

- `npm install`: **pass** (via SessionStart hook; `up to date, audited 748 packages`).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** −3 errors vs 2026-09-12
  (52 / 43 errors). All remaining are pre-existing (`@typescript-eslint/no-explicit-any`
  in tests/edge functions, `no-require-imports` in `tailwind.config.ts`, the 9
  `react-refresh`/`set-state-in-effect` warnings incl. the #338 one). Lint is
  informational in CI, not a gate.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (= committed baseline), node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the script
  reports `SKIPPED — this is not a pass`. This run pushes no new `supabase/functions`
  source. The window's edge-function merges (#337, and the freeze gating) each passed
  the real CI `verify` gate at merge time (#351 explicitly restored the deno ratchet
  after the #337 ownership guard).
- `npm run build`: **pass** (Vite + PWA, **41 precache entries, 1243.41 KiB**).
- `npm test`: **pass** (**58 files, 494 tests**), incl. the schema/design-token checks.
- `npm audit`: **32** (3 low, 24 moderate, 5 high) — up from 5. Triaged below; the
  non-breaking `npm audit fix` is **blocked by the known npm `edgesOut` resolver bug**
  (see the Low finding).

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history (PREPIO-145).**
  *(Carried from #27; owner-attended, out of scope for an unattended hygiene run. Not
  re-verified blob-by-blob this run — status unchanged, no merge touched it.)*
  - Evidence: PR #342 redacted ten audit screenshots in the working tree, but the
    pre-redaction blobs remain resolvable in history on a **public** repo (#27
    confirmed e.g. `docs/audits/assets/2026-07-09/11-d-new-interview.png` had both the
    23,025-byte redacted blob and the 146,389-byte original still fetchable by SHA).
    *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge + coordinated
    force-push, preserving an off-remote backup ref, plus the PR/comment exposure
    review the issue calls for. **Do not run a history rewrite unattended.**
  - Owner / next step: **PREPIO-145** (Urgent, Todo, owner). Tracked with a full
    remediation plan; no new issue filed.

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from #27; re-verified still
  present in the merged code this run. Now tracked in Linear.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    still computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    substring of it (`.includes(token)`). So for company "Acme" a role link
    `https://acme.attacker.example/job` → `acmeattackerexample` → `.includes("acme")`
    → `official_company`/high. The code comment at line ~182 still defers PSL-aware
    registrable-label matching as follow-up; no exact-label / public-suffix check has
    landed.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence, biasing generated prep. Gated
    by the row entering the ledger via the caller's own `roleLinks` or a Tavily result
    ranked for the company query. Content-integrity, not cross-tenant read. Note the
    PREPIO-143 BOLA that compounded it is now **closed** (#337), reducing — not
    eliminating — the blast radius.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting` already
    uses; add adversarial tests rejecting `company-token.attacker.example`.
  - Owner / next step: **PREPIO-184** (In Progress, `Chore` + `area:research-pipeline`).
    Already filed and cross-linked to PREPIO-144/143; no new issue needed. A
    service-role edge-function change, out of scope for a docs-only hygiene run and not
    validatable in this proxy-limited environment.

### Low / clean-up

- [ ] **`npm audit` spiked 5 → 32, but every advisory is dev/build/test toolchain or
  an unused direct dependency — no shipped production-runtime dependency is affected.**
  *(New this run. The non-breaking fix is blocked locally by the npm `edgesOut` bug.)*
  - Evidence & triage (5 high / 24 moderate / 3 low):
    - **Build/dev tooling (not in the shipped bundle):** `vite` (high, direct — build
      tool), `vite-plugin-pwa` / `workbox-build` / `@trickfilm400/rollup-plugin-off-main-thread`
      / `@rollup/plugin-node-resolve` / `source-map-js` / `postcss-selector-parser`
      (build), `vitest` / `@vitest/mocker` (test), the entire ESLint stack
      (`eslint`, `@eslint/js`, `@eslint-community/eslint-utils`, `@eslint/config-array`,
      `typescript-eslint` + its sub-packages, `eslint-plugin-react-refresh`), and the
      transitive utility chain they share (`brace-expansion` high, `minimatch`, `glob`,
      `ejs` / `jake` / `filelist`, `fast-uri`, `deepmerge`, `serialize-javascript`).
    - **`undici` (high, 9 advisories):** via `jsdom@29.1.1` → **test-only** (jsdom is the
      Vitest DOM environment). Not in `dependencies`, not in the browser bundle.
    - **`zod` (high, GHSA-mrhx-c7xc-m3w5):** a **direct dependency (`^3.23.8`) that is
      not used** — `grep` finds **0 `from "zod"` imports in `src/`**, no `zodResolver`
      usage, and `zod` does **not** appear in the built `dist/assets/*.js`. So the zod
      advisory has **no production-runtime exposure** for Prepio, and `zod` is itself an
      unused-dependency cleanup candidate (see below).
    - **None of the shipped runtime dependencies** (React, Radix UI, `@supabase/supabase-js`,
      `@tanstack/react-query`, `pdfjs-dist@6`, `react-router-dom@7`, `mammoth`, `recharts`,
      `date-fns`, `sonner`, …) appears in the advisory set.
  - Why the spike: these are newly-**published** advisories since 2026-09-12 (notably the
    9-advisory `undici` cluster and the `vite`/`launch-editor` set), not a dependency
    change Prepio made. The `pdfjs-dist` and `react-router` advisories that *were* in the
    count at #27 are now **gone** (closed by #350 / #353).
  - Attempted this run: `npm audit fix --dry-run --package-lock-only` **aborts** with
    `Cannot read properties of null (reading 'edgesOut')` — the documented npm resolver
    bug triggered by the `overrides` field (`esbuild: ^0.28.1`), the same blocker prior
    runs hit. Working tree left clean; no lockfile surgery attempted (fragile, and for
    dev/build/test-only advisories not worth it).
  - Recommended fix: let Dependabot's full-tree resolution carry the `vite` / `vitest` /
    `undici`(jsdom) / toolchain bumps (it is not subject to the local `--package-lock-only`
    crash), or a maintainer runs `npm audit fix` outside this sandbox. **Given the active
    invite-only freeze ("do not add … routine dependency PRs"), none of these warrant a
    hand-made dependency PR from this run** — they are dev/build-time with no production
    exposure.
  - Owner / next step: Dependabot-tracked; no new issue filed (routine dependency churn
    is out of scope under the freeze). Recorded here for the trail.

- [ ] **`zod` is an unused direct dependency.** *(New this run.)*
  - Evidence: `zod: ^3.23.8` in `package.json` `dependencies`, but 0 imports in `src/`,
    no `zodResolver` usage (`@hookform/resolvers` is used without its zod resolver), and
    not present in `dist/assets/*.js`.
  - Recommended fix: a maintainer removes `zod` from `dependencies` and regenerates the
    lockfile outside this sandbox (the local `npm install`/lockfile regen hits the same
    `edgesOut` resolver bug, so it was **not** attempted in-run). Removing it also clears
    the zod advisory from `npm audit`. Low priority; defer under the freeze.

- [ ] **`react-refresh/only-export-components` lint warning from #338 (carried).** The
  `hasQuestionInsightsContent` non-component export in
  [`QuestionInsightsPanel.tsx`](../../src/components/practice/QuestionInsightsPanel.tsx)
  still trips the rule (1 of the 9 lint warnings). Cosmetic / DX only; lint is
  informational in CI. Fix: move the helper to a `questionInsights.ts` module. Out of
  scope for a docs-only run.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged.)* `ci.yml` gates
  lint, typecheck, typecheck:functions, build, test, and the Playwright landing smoke
  (now blocking, #348) — not `npm audit`. Advisory response relies on Dependabot. An
  optional non-blocking `npm audit --audit-level=high` step is a maintainer policy call.

## Small fixes made in this run

- **Corrected two stale baseline numbers in [`CLAUDE.md`](../../CLAUDE.md)** (the
  developer/agent reference a new maintainer reads first): the `npm test` line now reads
  **494 tests / 58 files** (was 427 / 49) and the `npm run typecheck` line now reads
  **app baseline 61** (was 62 — the committed ratchet in
  `scripts/check-typecheck-baseline.sh` was lowered to 61 since #27). Documentation-only;
  no product source touched.
- No other code change was warranted: the one standing security Medium
  (`official_company` over-trust) is a service-role edge-function change tracked under
  **PREPIO-184** and not validatable in this proxy-limited environment; the `npm audit`
  spike is dev/build/test-only and the non-breaking fix is blocked by the npm `edgesOut`
  resolver bug; and the freeze ("do not add … routine dependency PRs") makes hand-made
  dependency bumps out of scope.

## Deferred items

Tracked, Dependabot-surfaced, or recorded here:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + exposure review (High/Urgent, Todo). Working-tree slice done (#342); history
  still exposed on the public repo.
- **PREPIO-184** — evidence-ledger `official_company` attacker-subdomain over-trust
  (Medium, In Progress). Land the registrable-label (PSL-aware) fix with adversarial
  `company-token.attacker.example` tests; fold in the deferred `official_job`
  short-name/employer-domain follow-up; re-audit the whole `classifyRetrievedSource`
  trust map.
- **PREPIO-124** — deploy track. The PREPIO-143 ownership fix (#337) is merged but a
  repo merge alone does not repair production; the fix is live only once deployed.
- **`npm audit` toolchain spike (5 → 32)** — dev/build/test-only, Dependabot-tracked,
  no production exposure; local `npm audit fix` blocked by the `edgesOut` resolver bug.
  No hand-made dependency PR under the freeze.
- **`zod` unused direct dependency** — remove + regenerate lockfile outside this
  sandbox; clears the zod advisory. Low, deferred under the freeze.
- **`#338` `react-refresh/only-export-components` lint warning** — move
  `hasQuestionInsightsContent` to a helper module. Cosmetic/DX; not filed.
- **`npm audit` as a non-blocking CI step** — maintainer policy call.

## Questions for product owner

- None blocking. The two open findings both have owners and Linear tracking
  (PREPIO-145 owner-attended plan; PREPIO-184 In Progress). The Linear free-issue cap
  that blocked intake in earlier runs is cleared (PREPIO-184 and recent PREPIO-180 both
  filed since).

## Next review focus

1. **PREPIO-124 deploy verification.** The PREPIO-143 ownership fix (#337), the
   `pdfjs-dist@6` / `react-router@7` bumps, and the freeze lockdown are all merged to
   `main`; confirm they reach production (edge-function redeploy + migration state), since
   a repo merge alone does not repair the long-standing prod-deploy gap prior UX runs
   logged. Re-audit `company-research` / `job-analysis` / `answer-feedback` for the same
   object-ownership check pattern #337 established.
2. **PREPIO-184** — land the PSL-aware `official_company` registrable-label fix and the
   adversarial subdomain tests, then re-audit the full `classifyRetrievedSource` trust map.
3. **PREPIO-145 Git-history purge** — the highest-residual-risk open item; verify the
   identified blobs are gone from all refs after the owner-attended rewrite.
4. **Next source-touching merge after the freeze lifts.** Re-run the full baseline against
   it and read the *merged* code (not commit messages). Watch whether Dependabot clears the
   toolchain `npm audit` spike, and whether a maintainer removes the unused `zod` dep.
