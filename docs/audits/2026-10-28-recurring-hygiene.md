# Recurring hygiene review — 2026-10-28

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio. First run
since **2026-09-12** (run #27); a ~6-week gap during which the **invite-only freeze
lockdown** landed, so the review window is wide and the product surface is materially
smaller than at run #27.

**Headline: the two carried freeze-exit blockers split — one High and one Medium are
now closed in code, one High and one Medium remain open.** Of run #27's open findings:

- **PREPIO-143 (High — `searchId` BOLA / cross-tenant write) → RESOLVED.** PR #337
  landed a dedicated fail-closed `authorizeSearch` guard
  ([`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts)),
  called in the serve handler **before** the background pipeline promise is
  constructed. A JWT caller must match the body `userId` **and** own the persisted
  `searches` row; a missing row and a foreign row return an identical opaque `404`
  (no enumeration), errors fail closed (`500`), and `userId` mismatch is `403`.
  Service callers bypass (trusted internal). Linear **PREPIO-143 is Done**. (Deploy
  still rides PREPIO-124; a repo merge alone does not repair production.)
- **PREPIO-179 follow-up (Medium — `SEARCH_COMPLETE` console log leaked raw
  note-derived Tavily query strings) → RESOLVED.** `company-research/index.ts:321` now
  logs `buildSearchCompleteLogPayload(result)`
  ([`result-aggregation.ts:100`](../../supabase/functions/company-research/result-aggregation.ts)),
  which returns **counts only** (`searchPayloads`, `searchResults`, `extractedContent`,
  `totalUrlsExtracted`) — no `query`, no `search_results[].query`. The confirmed leak
  path run #27 flagged is closed.
- **`pdfjs-dist` 5 → 6 (Medium) → RESOLVED.** PR #350 bumped to `~6.3.289`; the
  high-severity `pdfjs-dist` advisory no longer appears in `npm audit`. Additionally
  the freeze keeps PDF/DOCX upload **out** (pasted CV text only — see
  [FREEZE_RELEASE.md](../FREEZE_RELEASE.md)), so the parser surface is doubly reduced.
- **`react-router` v7 (Low — open-redirect + SSR advisories) → RESOLVED.** PR #353
  upgraded `react-router-dom` to `^7.18.4`; the two `react-router` advisories are gone
  from `npm audit`.
- **PREPIO-145 (High — production CV PII recoverable from Git history) → STILL OPEN.**
  Re-verified this run: the original **146,389-byte** pre-redaction screenshot blob
  (`3a6f18c6…`, `docs/audits/assets/2026-07-09/11-d-new-interview.png`) is **still
  reachable from `origin/main`** (introduced at `79c2097`, carried through the
  working-tree redaction `da47d9e`/#342). The SHA run #27 cited (`5585fd4`) is gone
  after intervening rebases, but the PII *content* persists under the same path. This
  is a **public repo**, so the blob is fetchable by anyone. Linear **PREPIO-145 is
  Todo/Urgent** — the owner-attended `git filter-repo`/BFG history purge + force-push
  is still pending. **Out of scope for an unattended hygiene run** (never rewrite the
  history of a shared public repo unattended).
- **Evidence-ledger `official_company` attacker-subdomain over-trust (Medium) → STILL
  OPEN, unchanged.** [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
  still returns `official_company`/high trust when **any** company token is a
  `.includes()` substring of the whole normalized host, with the comment at line 182
  still deferring Public-Suffix-List-aware registrable-label matching as follow-up. So
  `acme.attacker.example` is still over-trusted for company "Acme". A service-role
  edge-function change, not validatable in this proxy-limited environment; carried.

Everything source-touching this window is the freeze lockdown (#354, #360), freeze
test coverage (#357/#364/#368/#370), CV-disclosure copy (#363/PREPIO-180), the
security fix (#337), and docs (#346/#373). Nothing introduced a new secret, PII
channel, or access-control regression that this run could find. **Two small in-scope
fixes made this run** (a flaky test and an unused production dependency — see below).

Baselines (measured against HEAD `a330939`; deltas vs 2026-09-12):
lint **49** problems (40 errors, 9 warnings; −3 vs 52 — freeze removed surfaces).
Typecheck **pass at baseline** (app tsc **61** / node **0**; app baseline tightened
62 → 61 with the freeze). Build **pass, 1243.41 KiB / 41 precache entries** (down from
2280.54 KiB / 62 — the freeze unrouting/hiding of billing, paid feedback, profile
settings, upload and voice). Tests **494** passing / **58** files (up from 461/52,
all added freeze coverage) **after the flake fix below**. `npm audit` **15**
(5 low, 5 moderate, 5 high) — up from 5, but see the audit finding: **all 15 are
build/dev/test-time tooling; none ship in the production browser bundle or run in the
edge-function runtime against untrusted input.**

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** Informational in CI (not a
  gate); all pre-existing `@typescript-eslint/no-explicit-any` (tests/edge functions)
  and `react-refresh/only-export-components` warnings. −3 vs run #27.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)): **not
  runnable here** — the agent proxy blocks `esm.sh`/`deno.land`, so Deno cannot resolve
  the edge functions' remote imports; the script reports `SKIPPED — this is not a
  pass`. This run pushes no `supabase/functions` source; the window's edge-function
  merges each passed the real CI `verify` gate at merge time.
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1243.41 KiB**).
- `npm test`: **494 tests / 58 files.** One test (`Profile.test.tsx > …without import
  controls`) **flaked on the first full-suite run** and passed on re-run and in
  isolation — fixed this run (see below). Green 3/3 after the fix.
- `npm audit`: **15** (5 low, 5 moderate, 5 high). All dev/build/test tooling — see
  the Low finding.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history (PREPIO-145).**
  *(Carried from run #27; re-verified still exposed this run.)*
  - Evidence: the original **146,389-byte** pre-redaction blob
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` (`3a6f18c6…`) is still
    reachable from `origin/main` (`git rev-list origin/main --objects` lists it;
    introduced at `79c2097`, present through `da47d9e`/#342). The working-tree
    redaction (#342) swapped the checked-out copy for a 23,025-byte placeholder but
    left the prior blob in history. The nine other paths in #342 (full name, phone,
    email, LinkedIn, location, CV filename) are the same shape. Public repo → fetchable
    by commit SHA. *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified blobs
    + coordinated force-push (preserve an off-remote backup ref), plus the PR/comment
    exposure review the issue calls for. Do **not** run a history rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, owner-assigned). Remediation plan
    already tracked; no new issue. Out of scope for an unattended hygiene run.

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from run #27; re-verified
  unchanged. Outside PREPIO-144's `official_job` scope.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    `.includes()` substring of it. For company "Acme", a caller-supplied or
    search-surfaced role link `https://acme.attacker.example/job` normalizes to
    `acmeattackerexample`, which `.includes("acme")` → `official_company`/high. The
    comment at line 182 still defers PSL-aware registrable-label matching as follow-up.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence ledger,
    biasing generated prep. Content-integrity, not cross-tenant read. Less acute now
    that the `searchId` BOLA (PREPIO-143) is closed, but still a trust-classification
    bug.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting` already
    uses; add adversarial tests rejecting `company-token.attacker.example`. Verify
    legitimate employer domains (short names, multi-label suffixes) still classify
    correctly.
  - Owner / next step: file as `Bug` + `area:research-pipeline` (Quality &
    Maintenance), cross-linked to PREPIO-144, PREPIO-143, and this note — **if the
    Linear free-issue cap (run #27) has cleared**; recorded here in full otherwise. A
    service-role edge-function change, out of scope for a docs-only hygiene run and not
    validatable in this proxy-limited environment.

- [ ] **`searchTavily` → `ops.tavily_searches` insert is mismatched with the
  checked-in schema (reliability).** *(Carried from run #27's PREPIO-179 sub-finding;
  not re-deep-verified this run — recorded for continuity.)*
  - Evidence (per run #27): the insert in
    [`_shared/tavily-client.ts`](../../supabase/functions/_shared/tavily-client.ts)
    references `user_id`/`response_payload` columns absent from the checked-in
    `ops.tavily_searches` schema. Either op-logging silently fails in production (the
    insert is in a swallowing try/catch) or production schema has drifted from the
    migration history.
  - Risk: silent Tavily op-logging failure (reliability/observability), and — only if
    prod schema has the extra columns — durable persistence of the raw `query_text`
    (PII). On the checked-in schema the insert is inert.
  - Recommended fix: reconcile the insert with the `ops.tavily_searches` schema; store
    the query `source`/hash rather than the raw string when doing so; add a test.
  - Owner / next step: fold into the PREPIO-179 follow-up when the Linear cap clears;
    service-role edge-function + schema work, out of scope for a docs-only run.

### Low / clean-up

- [x] **Flaky `Profile.test.tsx` test — sync assertion on async-fetched entitlement
  copy. FIXED THIS RUN.**
  - Evidence: `Profile page > shows loading state then renders the main profile view
    without import controls` asserted `screen.getByText("Free plan. Upgrade when you
    want detailed AI coaching.")` **synchronously**. That copy is the free-tier branch
    of `billingStatusCopy`
    ([`ProfileMainView.tsx:150–165`](../../src/pages/profile/ProfileMainView.tsx)),
    which reads `"Checking your subscription..."` until the async `getEntitlement`
    fetch resolves. The test awaits only the `Profile` heading, so under full-suite
    load the assertion can fire before the entitlement settles → `Unable to find an
    element with the text: Free plan…`. Reproduced once in a full `npm test`; passed in
    isolation and on re-run — a genuine async race in the test, not a product
    regression.
  - Fix: changed the assertion to `await screen.findByText(...)`, matching the existing
    `findByText` billing-copy pattern already used elsewhere in the same file
    (line ~182). Green 3/3 full-suite runs after the change. No product code touched.
- [x] **Unused `zod` production dependency. REMOVED THIS RUN.**
  - Evidence: `zod` (`^3.23.8`) was a direct **production** dependency in
    `package.json` but had **zero imports** anywhere in `src/`, `supabase/`, scripts, or
    config (confirmed by repo-wide grep — the only reference was the `package.json`
    line). It also never entered the production bundle (build precache unchanged at
    1243.41 KiB after removal). `zod` is still present as a **dev-only transitive**
    dep via `eslint-plugin-react-hooks → zod-validation-error`, so removing the direct
    declaration is pure dead-weight cleanup.
  - Fix: `npm uninstall zod` — a clean 2-line lockfile delta, no other package version
    changed, no `overrides`/resolver churn. lint/typecheck/build/test all stay green.
    Note the high-severity `zod` advisory (GHSA-mrhx-c7xc-m3w5, fix = zod **4.x**
    major) remains in `npm audit` via the dev-only transitive path — it is **not
    production-reachable** (nothing invokes zod validation) and the major bump is a
    Dependabot/maintainer call, not an in-run change.
- [ ] **`npm audit` count rose 5 → 15, but every advisory is build/dev/test tooling —
  none ship in production.** *(Observation; the growth is from the react-router v7 +
  pdfjs 6 major upgrades reshaping the transitive dev tree, plus new advisories
  published during the 6-week gap.)*
  - Evidence: the 15 — `vite`, `vitest`, `@vitest/mocker`, `workbox-build`,
    `vite-plugin-pwa`, `@rollup/plugin-node-resolve`, `serialize-javascript`,
    `brace-expansion`, `deepmerge`, `fast-uri`, `@tailwindcss/typography`,
    `source-map-js`, `postcss-selector-parser`, `undici`, `zod`. Classification:
    `undici` (high) is pulled by `jsdom` (test env); `zod` (high) by
    `eslint-plugin-react-hooks` (dev); `vite` (high) is the dev build tool
    (Windows-only `launch-editor` issue); `source-map-js` + `postcss-selector-parser`
    appear in the prod tree only via **Tailwind's build-time PostCSS**
    (`tailwindcss-animate → tailwindcss → postcss`) and are **not referenced in
    `dist/`** (grep confirmed); the rest are Vite/Rollup/Workbox/Vitest build+test
    chain. None execute in the shipped browser runtime or the edge-function runtime
    against untrusted input.
  - Risk: low — supply-chain/CI hygiene, not a runtime exposure. The raw count is
    misleading in isolation.
  - Recommended fix: let Dependabot carry the dev-tooling patches; the two breaking
    majors with no production reach (`zod` 4, and any `vitest ≥ 4.1.11` for
    `@vitest/mocker`) are maintainer calls. Consider a **non-blocking**
    `npm audit --audit-level=high` CI step so the count is visible without gating
    (carried observation from run #26/#27).

## Small fixes made in this run

Two, both in this audit PR (hygiene + reliability, no product behavior change):

1. **Fixed a flaky `Profile.test.tsx` assertion** — `getByText` → `await
   findByText` on the async-fetched free-plan billing copy, matching the existing
   pattern in the file. Removes a full-suite non-determinism; green 3/3 after.
2. **Removed the unused `zod` production dependency** — zero imports repo-wide, never
   in the bundle, still available dev-transitively; clean 2-line lockfile delta.

All gates re-run green after both changes: lint 49 (unchanged), typecheck pass@61,
build pass (1243.41 KiB / 41 entries), test **494/58**.

## Deferred items

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + PII/credential exposure review (High/Urgent, Todo). Working-tree slice done
  (#342); history remains exposed on the public repo. **Highest residual risk.**
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium,
  carried) — `classifyRetrievedSource` matches company tokens with a loose
  `.includes()` on the whole host; needs PSL-aware registrable-label matching +
  adversarial tests. File in Linear (`Bug`/`area:research-pipeline`,
  cross-link PREPIO-144/143) **once the free-issue cap clears**.
- **`searchTavily` → `ops.tavily_searches` insert / schema mismatch** (Medium,
  reliability, carried) — reconcile the insert with the checked-in schema and redact
  `query_text`; fold into the PREPIO-179 follow-up.
- **`zod` 4.x major** (dev-only high advisory) and **`vitest ≥ 4.1.11`** for the
  `@vitest/mocker` moderate — Dependabot/maintainer calls; no production reach.
- **Non-blocking `npm audit --audit-level=high` CI step** (Low, process) — maintainer
  call; would surface the (dev-only) advisory count without gating.
- **Linear free-issue cap** — if still in force (run #27), the new/carried Mediums
  above cannot be filed and live in this note until it clears.

## Questions for product owner

- **Is the Linear free-issue cap still in force?** Run #27 (2026-09-12) could not file
  two Medium findings because the workspace was at its free-issue cap. The same two
  carry forward here (`official_company` over-trust; the `ops.tavily_searches` schema
  mismatch). If the cap has cleared, they should be filed in Quality & Maintenance;
  otherwise they remain tracked only in the audit trail. Not otherwise blocking — the
  one open High (PREPIO-145) already has an owner and an Urgent Linear issue.

## Next review focus

1. **PREPIO-145 Git-history purge** — the only open High and the highest residual risk:
   real CV PII is still publicly fetchable from `origin/main`. Track the owner-attended
   `filter-repo`/BFG + force-push and verify the identified blobs are gone from **all**
   refs afterward (`git rev-list --all --objects` clean).
2. **Evidence-ledger trust map** — land the PSL-aware registrable-label fix for
   `official_company` with adversarial `company-token.attacker.example` tests, fold in
   the deferred `official_job` short-name/employer-domain follow-up, and re-audit the
   whole `classifyRetrievedSource` trust map.
3. **PREPIO-124 deploy reconciliation** — PREPIO-143's ownership fix is merged but a
   repo merge does not repair production; confirm the migration-history repair +
   deploy runbook lands so the fix is actually live. Re-audit `company-research`,
   `job-analysis`, and `answer-feedback` for the same object-ownership pattern while
   there.
4. **Next source-touching merge** — re-run the full baseline against it; read the
   *merged* code, not commit messages, when assessing any security fix (run #27's #340
   lesson).
