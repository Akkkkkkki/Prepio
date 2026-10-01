# Recurring hygiene review — 2026-09-30

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio.

**Headline: the most productive remediation window in the audit's history — three
of the standing findings that dominated the last several runs are now closed in the
repo, verified by reading the merged code (not just commit messages, per run #27's
lesson).** The window `e3a283b..a08ca05` (HEAD) carries nine merges beyond run #27's
own note (#346). Three touch product source (`src/` or `supabase/functions/`), one is
a dependency major, two are CI/scripts, two are tests-only:

- **[PREPIO-143] `security: enforce interview research search ownership` (#337)** —
  **closes the carried cross-tenant-write BOLA High**, and the fix is correctly wired.
  A new [`authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  `authorizeSearch` helper is **fail-closed**: `service` callers pass; a JWT user must
  match the body `userId` (403 on mismatch) **and** own the persisted `searches` row
  (`select id … eq(id) eq(user_id) maybeSingle()`, **404 for both an absent row and a
  foreign-owned one** so ownership can't be enumerated; 500 on query error). Critically,
  it is invoked in the `serve` handler
  ([index.ts:1333](../../supabase/functions/interview-research/index.ts)) **after**
  `authorizeRequest` + field validation but **before** `processInterviewResearch`
  (which does every service-role, RLS-bypassing write) is constructed and dispatched —
  the exact gate placement the finding demanded. Covered by
  [`authorization.test.ts`](../../supabase/functions/interview-research/authorization.ts)
  (+91 lines). **Verified in code this run: PREPIO-143 is genuinely fixed in the repo.**
  (Production remains gated on deploy via PREPIO-124 — a repo merge alone does not
  repair prod.)
- **`security: upgrade pdfjs-dist 5 to 6` (#350)** — **closes the carried `pdfjs-dist`
  high advisory** (GHSA-hq66-cqwq-w95j, crafted-PDF arbitrary-JS). The bump to
  `pdfjs-dist@6` removes the `eval()`/`Function` codepath the advisory exploited (the
  advisory's own fix). The one source change
  ([resumeUpload.ts](../../src/lib/resumeUpload.ts)) drops the now-redundant
  `isEvalSupported: false` defence-in-depth with a clear explanatory comment; it keeps
  `useWorkerFetch: false` and remains **text-extraction-only, never renders**. Sound.
  **This surface is now doubly closed** — see the freeze note below.
- **[PREPIO-172] `Upgrade react-router-dom 6 → 7` (#353)** — **closes both carried
  `react-router` advisories** (open-redirect GHSA-wrjc-x8rr-h8h6 and the SSR-hydration
  GHSA-337j-9hxr-rhxg that never applied to this CSR-only SPA). Manifest + lockfile
  only, no routing source change; v7 compat is covered by the full green suite (471
  tests, incl. the new #357 frozen-routing-boundary test) and the **now-blocking**
  Playwright landing smoke (#348).
- **`fix: lock Prepio to the invite-only frozen core` (#354)** — large owner-authored
  freeze-scope change (Auth, `useAuth`, Navigation, App, new `GuestSample`,
  `frozenProduct.ts`). Reviewed for security/PII regression only (product scope is the
  owner's call, per `FREEZE_RELEASE.md`): the new
  [`GuestSample.tsx`](../../src/components/GuestSample.tsx) makes **no** network/Supabase
  calls (a genuinely deterministic local sample — no real-data leak), and the two resume
  file-upload inputs in [`Home.tsx`](../../src/pages/Home.tsx) (lines ~827, ~1004) are
  now both gated behind `{FROZEN_PRODUCT.resumeUpload && …}` (`false`), so the pdf.js
  parsing path is **no longer UI-reachable**. Net-positive on attack surface.
- **`restore Edge Function typecheck ratchet after ownership guard` (#351)**,
  **`ci: make Playwright landing smoke a blocking gate` (#348)** — CI/scripts hardening;
  #351 also lowered the app tsc ratchet baseline 62 → **61**. Positive.
- **#345 / #357** — tests-only (short-name evidence classification; frozen routing
  boundary). No product-surface change.

**Sibling-function re-audit (run #27 next-focus #1) — resolved.** With PREPIO-143's
orchestrator gate in place, the fan-out functions `company-research` and `job-analysis`
are each hard-gated by `ensureServiceCaller` (they reject every non-service caller
outright), so a client cannot drive them with a foreign `searchId` directly; the only
client-reachable functions verify identity themselves — `cv-analysis` checks body
`userId` == JWT (403 on mismatch), generates its own `searchId`, and operates only on
the caller's own CV text; `answer-feedback` (paid, out of active freeze scope) uses
`authorizeRequest`. **No new object-ownership BOLA found.**

**Two carried code-level Mediums re-verified still open** (both are service-source
edge-function changes needing adversarial tests and a Deno typecheck this proxy-limited
environment cannot run, so both stay deferred, not fixed in this docs-only run):

1. Evidence-ledger `official_company` attacker-subdomain over-trust —
   [`evidence-ledger.ts:176`](../../supabase/functions/interview-research/evidence-ledger.ts)
   still returns `official_company` when any company token is a `.includes()` substring
   of the whole normalized host (`acme.attacker.example` → `acmeattackerexample` →
   matches `acme`). The code comment (lines ~182–194) explicitly defers PSL-aware
   registrable-label matching as follow-up.
2. PREPIO-179 `SEARCH_COMPLETE` PII leak —
   [`company-research/index.ts:317`](../../supabase/functions/company-research/index.ts)
   still calls `logger.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)` where `result`
   carries `search_results[].query` = the raw note-derived Tavily query (built at
   line 248, `query: result.query`); the generic `SearchLogger.log` does not strip it.

**One carried High unchanged: PREPIO-145.** The production-CV PII is still recoverable
from Git history — re-verified this run (see the finding). Owner-attended history
rewrite, out of scope for an unattended run.

**`npm audit` picture changed but stayed at 5.** The two runtime-relevant advisories
that ran the last several notes (`pdfjs-dist` high, `react-router` ×2) are **gone**
(closed by #350/#353). What remains — `undici` (high, via `jsdom` **test env**),
`brace-expansion` (high, build tooling), `fast-uri` (moderate, via
`vite-plugin-pwa → workbox-build → ajv`, **build time**), `@vitest/mocker` (moderate,
via `vitest`, **dev/test**) — are **all off the production browser bundle**. `npm audit
fix` (even `--dry-run`) aborts with the documented npm `edgesOut` resolver bug
(triggered by the `overrides` field), so automated remediation is blocked in this
environment exactly as in prior runs; deferred to Dependabot.

**One small doc-accuracy fix made** (see below): corrected two stale numbers in
`CLAUDE.md` that would misdirect a maintainer running the gates.

Baselines (measured against HEAD `a08ca05`; deltas vs 2026-09-12):
lint **50** problems (**41** errors, 9 warnings; **−2 errors** vs run #27's 43 — the
freeze removed some `any`-typed code paths). Typecheck **pass** (app tsc **61**,
node **0**; the ratchet baseline was lowered 62 → 61 in #351). Build **pass** —
**41** precache entries / **1242.25 KiB** (down sharply from 62 / 2280.54 KiB: the
freeze-lock dropped code and the pdfjs/router majors trimmed the graph). Tests
**471** passing / **56** files (up from 461 / 52). `npm audit` **5** (3 moderate,
2 high) — the two runtime advisories cleared, replaced by dev/test/build-time ones.

## Commands run

- `npm install`: **pass** (via SessionStart hook — `up to date, audited 748 packages`).
- `npm run lint`: **50 problems (41 errors, 9 warnings).** −2 errors vs 2026-09-12; the
  41 errors and 9 warnings are all pre-existing (`@typescript-eslint/no-explicit-any` in
  tests/edge functions; the `react-refresh/only-export-components` fast-refresh
  warnings). Lint is informational in CI, not a gate.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass.** App **61** (configured `APP_BASELINE=61`), node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports (the script reports
  `SKIPPED — this is not a pass`; exit 0 locally, `exit 1` under `$CI`). This run pushes
  no `supabase/functions` source; the window's edge-function merges (#337) passed the
  real CI `verify` gate at merge time (#351 restored the deno ratchet to baseline).
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1242.25 KiB**).
- `npm test`: **pass** (**56** files, **471** tests), incl. the schema/design-token
  checks.
- `npm audit`: **5** (3 moderate, 2 high) — all dev/test/build-time (see Summary and the
  Low findings). `npm audit fix --dry-run` aborts on the npm `edgesOut` resolver bug.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; re-verified still exposed this run.)*
  - Evidence: PR #342 replaced ten screenshots with placeholders in the working tree,
    but the pre-redaction blobs remain in history. Re-confirmed against the object store
    this run: `docs/audits/assets/2026-07-09/11-d-new-interview.png` has two versions —
    the redacted **23,025-byte** blob (current working tree) and the original
    **146,389-byte** blob still resolvable at commit **`cb48205`** via
    `git cat-file -s cb48205:<path>` (the `5585fd4` SHA the run #27 note cited is simply
    not present in this shallow clone; a different reachable commit holds the same
    original blob, so the exposure is unchanged). The nine other paths listed in
    [`docs/security/freeze-pii-paths.txt`](../../docs/security/freeze-pii-paths.txt) are
    the same shape. **This is a public repository**, so those blobs are retrievable by
    anyone with the commit SHA. *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified blobs
    + coordinated force-push, preserving a backup ref off the public remote, plus the
    PR/comment exposure review the issue calls for. Do **not** run a history rewrite
    unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, owner-assigned). Already tracked
    with a full remediation plan; no new issue filed. Out of scope for an unattended
    hygiene run (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from run #27; re-verified
  still open in code this run. Outside PREPIO-144's `official_job` scope.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    `.includes()` substring of it. So for company "Acme", a role link
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`, matches
    `acme`, and is classified `official_company`/high. The comment at lines ~182–194
    explicitly defers PSL-aware registrable-label matching as follow-up (the
    conservative branch for that case falls through to `market_heuristic`, but the loose
    token `.includes()` at line 176 is unchanged). #340's NFKD folding also widened this
    for accented brand names (`"L'Oréal"` → token `oreal` → `oreal.attacker.example`
    over-trusted), per run #27.
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted
    as high-trust "official company" evidence, biasing generated prep. Content-integrity,
    not cross-tenant read. Gating: the row must enter the ledger via the caller's own
    `roleLinks` or a Tavily result ranked for the company query. *(The compounding
    `searchId` BOLA that made this more serious is now closed by #337, reducing the blast
    radius to the caller's own search.)*
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the ATS
    exact/suffix approach `isJobPosting` uses; add adversarial tests rejecting
    `company-token.attacker.example`; verify legitimate employer domains still classify.
  - Owner / next step: file as `Bug` + `area:research-pipeline` (Quality & Maintenance),
    cross-linked to PREPIO-144, this audit — **when the Linear free-issue cap clears**
    (the same intake blocker prior audits recorded). A service-role edge-function change,
    out of scope for a docs-only hygiene run and not Deno-validatable in this proxy env.

- [ ] **PREPIO-179 partial — the `SEARCH_COMPLETE` console log still leaks raw
  note-derived query strings.** *(Carried from run #27; re-verified still open this run.)*
  - Evidence: in
    [`company-research/index.ts`](../../supabase/functions/company-research/index.ts),
    line 248 builds the payload with `query: result.query` (the raw Tavily query, which
    for `user-note-*`/contextual queries embeds note-derived interviewer/team names) and
    line 317 calls `logger.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)`. The generic
    `SearchLogger.log` ([`_shared/logger.ts`](../../supabase/functions/_shared/logger.ts))
    does **not** strip `query` (only `logTavilySearch` does, redacted in #344) and
    `console.log`s the whole payload. This path runs on every research request — the
    confirmed remaining leak. (The `ops.tavily_searches` DB-writer path in
    `tavily-client.ts` attempts the same but is inert against the checked-in schema, per
    run #27's analysis — a separate code/migration mismatch.)
  - Risk: the PII-in-logs class PREPIO-141 → PREPIO-179 set out to close is still live
    via the aggregate console log. Same interviewer/team-name exposure into first-party
    edge-function logs.
  - Recommended fix: redact `query` from each `search_results[]` entry before the
    `SEARCH_COMPLETE` log (or log counts/sources only); add a test asserting no free-text
    query reaches the logger; separately reconcile the `searchTavily` →
    `ops.tavily_searches` insert with its schema and redact `query_text` when doing so.
  - Owner / next step: reopen PREPIO-179 (its #344 fix is partial) or file a follow-up —
    **blocked this run by the Linear free-issue cap**; recorded here. Service-role
    edge-function change, out of scope for a docs-only run and not Deno-validatable here.

- [ ] **`undici` high advisory (10 GHSAs) via the `jsdom` test environment.** *(New this
  window — `pdfjs-dist`/`react-router` cleared, this surfaced in their place.)*
  - Evidence: `npm audit` reports `undici 7.0.0 - 7.29.0` high (DoS ×several, TLS cert
    bypass, cross-user cookie disclosure, response splitting). Dependency path is
    `jsdom@29.1.1 → undici@7.29.0` — jsdom is the **vitest test DOM environment**, not a
    production or build-output dependency. No production browser-bundle exposure.
  - Risk: **test-time only.** None of the advisories are reachable from shipped code.
  - Recommended fix: let Dependabot's `jsdom`/`undici` security update carry it (its
    full-tree resolution isn't subject to the local `--package-lock-only`/`audit fix`
    crash), or a maintainer bumps it outside this proxy sandbox. `npm audit fix` is
    blocked here by the `edgesOut` resolver bug.
  - Owner / next step: Deferred — Dependabot-surfaced, dev/test-only. **Verify repo-level
    "Dependabot security updates" is enabled** (see the Low finding below) — with version
    updates paused (`open-pull-requests-limit: 0`), that toggle is the only automated
    channel for this and the other dev advisories.

### Low / clean-up

- [ ] **`brace-expansion` high + `fast-uri` moderate + `@vitest/mocker` moderate — all
  dev/build/test-time.** *(Carried/new mix; none on the production path.)*
  - Evidence: `brace-expansion 2.0.0 - 2.1.6 || 4.0.0 - 5.0.11` high (quadratic-expansion
    DoS, via build tooling); `fast-uri 3.0.0 - 3.1.7` moderate (host-normalization, via
    `vite-plugin-pwa → workbox-build → ajv`, **build time**); `@vitest/mocker 2.1.0 -
    4.1.10` moderate (path-traversal via redirect mock, via `vitest@4.1.9`, **dev/test**).
  - Recommended fix: Dependabot security updates; `npm audit fix` is blocked locally by
    the `edgesOut` resolver bug and manual multi-package transitive lockfile surgery
    (parents are `jsdom`/`workbox-build`/`vitest`) is fragile and unwarranted for
    off-production-path advisories.

- [ ] **Dependabot version updates are paused (`open-pull-requests-limit: 0`) on both
  ecosystems — confirm repo-level security updates are enabled.** *(Observation, new
  emphasis this run.)*
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml) sets
    `open-pull-requests-limit: 0` for `npm` and `github-actions` (a deliberate freeze
    choice; the file comment states security updates remain enabled and ignore the
    schedule). Per GitHub semantics that is correct — `open-pull-requests-limit` caps
    only *version* updates, not security updates — **but security-update PRs require the
    repo-level "Dependabot security updates" setting to be on**, which lives in repo
    settings, not this file. No Dependabot security PR is currently open for the new
    `undici`/`fast-uri`/`brace-expansion` advisories (the only open PR is #360,
    owner-authored), so with version updates paused this is now the *sole* automated
    advisory channel and worth confirming.
  - Recommended fix: a maintainer verifies Settings → Code security → "Dependabot
    security updates" is enabled. If it is and PRs still aren't opening, these transitive
    advisories may need a parent bump Dependabot can't isolate — a manual bump outside
    this sandbox. CI-policy/settings call, not a hygiene-run change.

- [ ] **`isEvalSupported: false` defence-in-depth removed with the pdf.js 6 upgrade
  (#350).** *(Observation, not a regression — recorded for traceability.)*
  - Evidence: [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) dropped
    `isEvalSupported: false` on the `getDocument` call, with a comment that pdf.js 6
    removed the eval codepath the advisory exploited so the flag is no longer needed.
    That reasoning is sound (and the upload path is now freeze-gated off anyway); the
    only note is that keeping the option would have preserved defence-in-depth at
    zero cost had it still been honoured in v6. Not worth a change while resume upload
    is frozen off.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged from prior runs.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, test, and (now) the Playwright smoke — not
    `npm audit`. Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **`CLAUDE.md` doc-accuracy fix** — corrected two stale gate numbers that would
  misdirect a maintainer: the test-count line `427 tests / 49 files` → **`471 tests /
  56 files`** (current green suite) and `app baseline 62` → **`app baseline 61`** (the
  ratchet's configured `APP_BASELINE`, lowered 62 → 61 by #351). Documentation-only,
  no product source touched.
- **No product-source change.** The three source-touching merges this window were
  reviewed and are security-neutral-to-positive; the two remaining code-level Mediums
  (`official_company` over-trust, `SEARCH_COMPLETE` leak) are service-role edge-function
  changes needing adversarial tests and a Deno typecheck this proxy-limited environment
  cannot run, so both stay deferred rather than pushed unvalidated. The dev/build/test
  advisories are blocked from local remediation by the npm `edgesOut` resolver bug and
  are off the production path.

## Deferred items

Tracked, Dependabot-surfaced, or awaiting the Linear cap to file:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + PII/credential exposure review (High/Urgent, Todo). Working-tree slice done
  (#342); history remains exposed on the public repo (re-verified at `cb48205`).
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium, carried)
  — land the registrable-label (PSL-aware) fix with adversarial tests; file against
  Quality & Maintenance when the Linear free-issue cap clears.
- **PREPIO-179 follow-up — `SEARCH_COMPLETE` console log leaks raw query strings**
  (Medium, carried) — redact `query` from the aggregate log; reconcile the
  `ops.tavily_searches` insert with its schema. Reopen PREPIO-179 or file a follow-up
  when the cap clears.
- **`undici` (high, jsdom test env), `brace-expansion` (high, build tooling), `fast-uri`
  (moderate, build tooling), `@vitest/mocker` (moderate, dev/test)** — all
  off-production-path; Dependabot security updates (verify the repo toggle is on). Local
  `npm audit fix` blocked by the `edgesOut` resolver bug.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **`react-refresh/only-export-components` lint warnings** (Low, cosmetic/DX) — noted for
  a follow-up cleanup, not filed.

## Questions for product owner

- **Linear is at its free-issue cap** (the same intake blocker noted since 2026-07-29),
  so the two carried code-level Mediums (`official_company` over-trust; PREPIO-179
  `SEARCH_COMPLETE` follow-up) still cannot be filed and are recorded in full above.
  Clearing the cap would let hygiene findings be tracked in Linear rather than only in
  the audit trail. Not otherwise blocking — the one open High (PREPIO-145) has an owner
  and a documented plan.
- **Confirm repo-level "Dependabot security updates" is enabled.** With version updates
  paused (`open-pull-requests-limit: 0`), it's the only automated advisory channel, and
  no security PR is currently open for the three new dev/build advisories.

## Next review focus

1. **PREPIO-145 Git-history purge** — now the single highest-residual-risk open item
   (PREPIO-143 and the two dependency majors closed this window). Track the
   owner-attended `filter-repo`/BFG + force-push and verify the identified blobs are gone
   from all refs afterward.
2. **The two carried research-pipeline Mediums** (file once the Linear cap clears):
   (a) evidence-ledger `official_company` registrable-label fix with adversarial
   `company-token.attacker.example` tests + the deferred `official_job` short-name
   follow-up; (b) PREPIO-179 `SEARCH_COMPLETE` redaction + the `ops.tavily_searches`
   schema reconciliation. Both are edge-function changes needing a runnable Deno gate.
3. **PREPIO-124 deploy reconciliation** — with the BOLA fix (#337) and the two dependency
   majors now merged, confirm they reach production (a repo merge alone doesn't repair
   prod), following the migration-repair runbook in CLAUDE.md/PREPIO-124.
4. **Dependabot health** — verify security updates are opening PRs for the new
   `undici`/`fast-uri`/`brace-expansion` advisories now that the runtime ones are cleared;
   if transitive-parent bumps block them, plan a manual pass outside the proxy sandbox.
5. **Next source-touching merge** — re-run the full baseline against it and read the
   *merged* code, not commit messages, when assessing any security-relevant change
   (run #27's #340 lesson, reaffirmed by this run's clean verification of #337).
