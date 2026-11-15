# Recurring hygiene review — 2026-11-11

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio, and the
first since 2026-09-12 (#27) — a two-month gap in which the **invite-only freeze
lockdown landed** and **four of the previously-carried findings were closed in the
repo**.

**Range reviewed:** `f9b0454..a330939` (the commit after run #27's note PR #346,
through current `origin/main`). Eleven merges, of which the source-touching ones are:

- **`security: upgrade pdfjs-dist 5 → 6` (#350, c4932a9)** — **resolves the carried
  Medium.** `pdfjs-dist` is now `~6.3.289` (verified in `package.json`); `npm audit`
  no longer reports the `pdfjs-dist` high advisory (GHSA-hq66-cqwq-w95j). The
  `resumeUpload.ts` isolation + `isEvalSupported:false` hardening is preserved.
- **`[PREPIO-172] Upgrade react-router-dom 6 → 7` (#353, 908b8f4)** — **resolves the
  carried Low (two advisories).** `react-router-dom` is now `^7.18.4`; the
  open-redirect (GHSA-wrjc-x8rr-h8h6) and SSR-hydration (GHSA-337j-9hxr-rhxg)
  advisories no longer appear in `npm audit`.
- **`fix: restore Edge Function typecheck ratchet after ownership guard` (#351,
  571c6e5)** — introduces [`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts),
  the **PREPIO-143 `searchId` BOLA fix** (the carried High). **Verified correct and
  correctly wired** — see the High section below. This was the landing of the run #27
  "fix PR #337".
- **`fix: lock Prepio to the invite-only frozen core` (#354, 9d9b711)** — the large
  freeze lockdown. Gates billing, answer-feedback, voice, profile, and **resume
  upload** behind the compile-time [`FROZEN_PRODUCT`](../../src/lib/frozenProduct.ts)
  constants (all `false`), strips the disabled surfaces from `Home`/`Practice`/`Auth`,
  and adds a deterministic local `GuestSample`. Reviewed for honesty and access-control
  regressions: **none found** — the removed surfaces are gated by a const the UI can't
  override, the research/practice core is untouched, and the change is heavily
  test-covered (see below).
- **`fix: close freeze gaps found by the final audit and UX reviews` (#360, bccb67c)**
  — **resolves the carried PREPIO-179 follow-up Medium.** The `SEARCH_COMPLETE`
  aggregate console log in
  [`company-research/index.ts:321`](../../supabase/functions/company-research/index.ts)
  now passes `result` through
  [`buildSearchCompleteLogPayload`](../../supabase/functions/company-research/result-aggregation.ts)
  (line 100), which emits **counts only** (`searchPayloads`, `searchResults`,
  `extractedContent`, `totalUrlsExtracted`) — no raw Tavily query string and no
  provider page text reach the logs. Covered by `result-aggregation.test.ts`. The
  confirmed console leak from run #27 is closed.
- **`[PREPIO-180] Disclose that pasted CV text is saved with the prep plan` (#363,
  8696991)** — honest-copy addition in `Home.tsx`; PREPIO-180 is Done. No data-flow
  or access change.
- **`[PREPIO-153] Correct the RUNBOOK ... call graph` (#373)**,
  **`test: cover ...` (#357/#364/#368/#370)**, and **`searchService.ts` 3-line test
  support (#364)** — docs/test-only, security-neutral.

**Headline: the two-month window is strongly security-positive.** Every carried
dependency finding (`pdfjs-dist`, `react-router`) is resolved, the carried High
(PREPIO-143 BOLA) is fixed and correctly gated in the repo, the carried PREPIO-179
PII-in-logs Medium is closed, and the freeze lockdown closed the live resume-upload /
pdf.js parser surface by gating the file-input UI off entirely. No new secret,
client-exposed server var, PII-in-logs, or access-control regression was introduced.

**Two findings remain open**, both already tracked with owners (so no new Linear issue
was filed this run):

1. **PREPIO-184** (Medium, In Progress) — the evidence-ledger `official_company`
   attacker-subdomain over-trust (the `.includes()` host match) is **still present** in
   [`evidence-ledger.ts:176`](../../supabase/functions/interview-research/evidence-ledger.ts).
   The run #27 Medium that the Linear free-issue cap blocked has since been filed as
   PREPIO-184. Code-verified still open this run.
2. **PREPIO-145** (High, owner-attended) — production CV PII in Git history. **Could
   not be verified this run** — the session works from a **shallow clone** (50 commits),
   so the pre-redaction blobs referenced in run #27 are simply absent from the local
   object store rather than demonstrably purged. Carried as open/unverified; the
   working-tree slice is redacted (the current asset is the 23,025-byte placeholder).

**`npm audit` rose 5 → 26** (3 low, 18 moderate, **5 high**). This is **not a
production-bundle regression** — every one of the 26 is **dev/build-time tooling** with
no runtime path, and most are **newly-disclosed 2026 advisories** against common tool
chains that accrued over the two-month gap (see the Medium finding for the full
classification). No code change was warranted this run: the substantive open findings
are service-role edge-function work out of scope for an unattended docs run (and the
`typecheck:functions` Deno gate can't run in this proxy-limited environment), and a
broad `npm audit fix` lockfile churn is exactly what the freeze posture defers to
Dependabot (security updates remain enabled; version bumps are paused — verified in
[`.github/dependabot.yml`](../../.github/dependabot.yml)).

Baselines (measured against HEAD `a330939`; deltas vs 2026-09-12):
lint **49** problems (**40** errors, **9** warnings; −3 errors vs 52/43, freeze code
removal). Typecheck **pass at baseline** (app tsc **61**, down from 62 — one fewer
error after freeze removal; node **0**). Build **1243.41 KiB** / **41** precache
entries (down from 2280.54 KiB / 62 — the freeze lockdown removed billing/profile/
voice/upload surfaces). Tests **494** passing / **58** files (up from 461/52 — the
freeze merges carried added coverage). `npm audit` **26** (3 low, 18 moderate, 5
high) — all dev/build tooling, see below.

## Commands run

- `npm install`: **pass** (via SessionStart hook; `up to date, audited 748 packages`).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** −3 errors vs 2026-09-12.
  All pre-existing classes (`@typescript-eslint/no-explicit-any` in tests/edge
  functions; the fast-refresh `react-refresh/only-export-components` warnings). Lint is
  informational in CI, not a gate; this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (was 62), node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass`. This run pushes no `supabase/functions` source; the
  range's edge-function merges (#351, #360) each passed the real CI `verify` gate at
  merge time (the #351 title records restoring the Deno ratchet to baseline).
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1243.41 KiB**).
- `npm test`: **pass** (**58 files, 494 tests**), incl. the schema/design-token checks.
- `npm audit`: **26** (3 low, 18 moderate, 5 high) — all dev/build tooling; see the
  Medium finding for the per-advisory classification.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII in Git history (PREPIO-145) — carried; NOT verifiable this
  run (shallow clone).**
  - Evidence: run #27 confirmed the pre-redaction screenshot blobs (e.g.
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` at `5585fd4`, 146,389 bytes)
    were still resolvable on the public remote despite #342's working-tree redaction.
    This session runs from a **shallow clone** (`git rev-parse --is-shallow-repository`
    → `true`, 50 commits total), so `5585fd4` resolves as `invalid object name` locally
    — this means "not in the shallow clone," **not** "purged from the remote." The
    working-tree asset is the redacted 23,025-byte placeholder. *(PII not reproduced per
    the review's redaction rule.)*
  - Risk: if the upstream history has not been rewritten, real personal data remains
    publicly fetchable by commit SHA — a freeze-exit release blocker per the issue.
  - Recommended fix: unchanged — owner-attended `git filter-repo`/BFG purge of the
    identified blobs + coordinated force-push, preserving an off-remote backup ref,
    plus the exposure review the issue calls for. Do **not** run a history rewrite
    unattended.
  - Owner / next step: **PREPIO-145** (High/Urgent, owner-attended). Next hygiene run
    should re-verify against a **full clone** (`git fetch --unshallow`) to confirm the
    purge landed or is still pending.

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation (PREPIO-184).** *(Carried from run #27;
  code-verified still open. Now Linear-tracked — the free-issue cap that blocked filing
  last run has cleared.)*
  - Evidence:
    [`evidence-ledger.ts:175–178`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust via `trustWeightFor`) when **any**
    `companyTokens(company)` entry is a substring of it (`.includes(token)`). For
    company "Acme", a caller-supplied `roleLink` or search-surfaced
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`, which
    `.includes("acme")` → `official_company`/high. No registrable-domain / public-suffix
    / exact-label check (the code comment at line 180–186 explicitly defers PSL-aware
    matching as follow-up; the short-name case `X`/`BP`/`3M` falls through to
    `market_heuristic` for the same reason).
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted
    as high-trust "official company" evidence in the grounded-evidence ledger, biasing
    generated prep. Gating: the row must enter via the caller's own `roleLinks`
    (self-inflicted) or via a Tavily result the attacker ranks for the company query.
    Content-integrity, not cross-tenant read. (The run #27 compounding factor with the
    `searchId` BOLA is **reduced** now that PREPIO-143 is fixed — an attacker can no
    longer drive writes into a *victim's* search — but the self-inflicted / search-rank
    over-trust remains.)
  - Recommended fix: match the company against the host's **registrable label** (exact,
    PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting` already uses; add
    adversarial tests rejecting `company-token.attacker.example` subdomains; verify
    legitimate employer domains (incl. short names and multi-label suffixes) still
    classify correctly.
  - Owner / next step: **PREPIO-184** (In Progress). A substantive service-role
    edge-function change requiring the Deno `typecheck:functions` gate that can't run in
    this proxy-limited environment — out of scope for a docs-only hygiene run. Left to
    PREPIO-184's owner.

- [ ] **`npm audit` rose 5 → 26 — entirely dev/build-time tooling, mostly
  newly-disclosed 2026 advisories.** *(New this window; classified in full so a future
  maintainer need not re-triage.)*
  - Evidence: the 5 high are **`brace-expansion`** (quadratic-time regex, dev),
    **`source-map-js`** (event-loop DoS, build-time via PostCSS), **`undici`** (DoS; via
    `jsdom` → test-only, `npm ls undici` → `jsdom@29.1.1`), **`vite`** (the
    `launch-editor` CLI advisories are dev-server/error-overlay only, not the production
    build), and **`zod`** (memory exhaustion; via `eslint-plugin-react-hooks`, `npm ls
    zod` → `zod@3.25.76` — **dev-only; `zod` is not imported anywhere in `src/` or
    `supabase/functions/`**). The 18 moderate are the eslint / typescript-eslint /
    vitest / `@vitest/mocker` / `@tailwindcss/typography` / `vite-plugin-pwa` /
    `workbox-build` chains (lint, test, and build tooling). The 3 low are
    `serialize-javascript`, `deepmerge`, `@rollup/plugin-node-resolve` (build).
  - Risk: **none to the shipped bundle or edge functions** — no advisory is on a
    runtime path. The exposure is to the local dev/CI toolchain (a hostile dependency or
    crafted input during `lint`/`test`/`build`), not to end users. The jump is a
    two-month accrual of newly-published advisories against unchanged tooling, not a
    dependency regression.
  - Recommended fix: let Dependabot's security updates carry these (enabled in
    `dependabot.yml`; version-update PRs are paused for the freeze). `npm audit fix`
    (non-breaking) would clear many, but a broad lockfile churn during the freeze is
    deliberately deferred to Dependabot/a maintainer outside this sandbox — consistent
    with prior runs and the freeze posture. The one breaking fix (`zod@4.6.7`) is
    dev-only and not worth a `--force` major in a hygiene run.
  - Owner / next step: Deferred to Dependabot / maintainer. Not filed (process item,
    no runtime risk).

### Low / clean-up

- [ ] **Resume-upload handler is now dead code behind the freeze flag (intentional).**
  - Evidence: `Home.tsx` still imports `extractResumeText` and defines
    `handleFileUpload` (line 493), but every file-input render site is gated behind
    `FROZEN_PRODUCT.resumeUpload` (`false`), so the control is never mounted and the
    handler is unreachable from the UI. [`frozenProduct.ts`](../../src/lib/frozenProduct.ts)
    documents the surfaces as "deliberately not overridable" and restorable only via a
    reviewed release.
  - Risk: **none** — this is intentional, keeps the restoration path small, and closes
    the live pdf.js parser surface run #27 flagged (the UI can no longer reach
    `extractResumeText`). Noted only so a future maintainer doesn't mistake the retained
    handler for an active upload path.
  - Recommended fix: no action; leave as-is until the surface is restored or the freeze
    lifts.

- [ ] **`npm audit` is still not a CI gate.** *(Observation, unchanged from prior runs.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, and test — not `npm audit`. Advisory response
    relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **None to product source.** The two-month window closed four carried findings in the
  repo (PREPIO-143 BOLA, PREPIO-179 PII-in-logs, `pdfjs-dist` 5→6, `react-router` v7);
  the two still-open findings (PREPIO-184 evidence-ledger over-trust, PREPIO-145 history
  PII) are owner-tracked service-role / history-rewrite work out of scope for an
  unattended docs run and not validatable in this proxy-limited, shallow-clone
  environment. The 26 `npm audit` findings are dev-tooling with no runtime path and are
  deferred to Dependabot per the freeze posture. The deliverable is this note + the
  `docs/audits/README.md` index row.

## Deferred items

Tracked or Dependabot-surfaced:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + exposure review (High). Re-verify next run against a **full clone**.
- **PREPIO-184** — evidence-ledger `official_company` attacker-subdomain over-trust
  (Medium, In Progress) — land the registrable-label (PSL-aware) fix with adversarial
  subdomain tests; fold in the deferred `official_job` short-name/employer-domain case.
- **`npm audit` dev-tooling advisories (26)** — Dependabot security updates (enabled);
  version bumps paused for the freeze. No runtime exposure.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.

## Questions for product owner

- None blocking. The Linear free-issue cap that blocked run #27's intake has cleared
  (PREPIO-184 is filed and In Progress), and both open findings have owners.

## Next review focus

1. **PREPIO-145 against a full clone.** The single remaining High. Re-run with
   `git fetch --unshallow` (or verify on the remote) to confirm whether the history
   purge has landed — it was unverifiable this run.
2. **PREPIO-184 landing.** When the registrable-label fix merges, re-audit the whole
   `classifyRetrievedSource` trust map (incl. the deferred short-name/employer-domain
   case) with adversarial `company-token.attacker.example` tests.
3. **Confirm PREPIO-143 reaches production (PREPIO-124).** The BOLA fix is correct and
   merged in the repo, but a repo merge alone does not repair production — the freeze
   backend manifest deploy (PREPIO-124, In Progress) must ship it. Re-audit
   `company-research`, `job-analysis`, and `answer-feedback` for the same
   object-ownership pattern while confirming.
4. **Next source-touching merge.** Re-run the full baseline against it rather than
   re-verifying carried findings, and read the *merged* code (not commit messages) when
   assessing any security fix.
