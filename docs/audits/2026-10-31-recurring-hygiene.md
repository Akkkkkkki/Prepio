# Recurring hygiene review — 2026-10-31

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio. This is
the first functional window since run #27 (2026-09-12, base `e3a283b`), and it is
an unusually productive one: **three of the four open findings carried into this
run were closed by merges that landed in the window**, and the one remaining
carried High (PREPIO-145, unchanged — no history rewrite landed) plus one carried
Medium (`official_company` over-trust, code re-verified unchanged) are still open.

Review range `e3a283b..HEAD` (`a330939`). Source-touching merges reviewed this
run (reading the *merged* code, not commit messages — run #27's lesson):

- **[PREPIO-143] `security: enforce interview research search ownership` (#337)**
  — **closes the carried `searchId` BOLA High** at the code level. A new
  [`authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  adds `authorizeSearch`, called **synchronously in the request handler before the
  background promise is constructed**
  ([`interview-research/index.ts:1330`](../../supabase/functions/interview-research/index.ts)).
  Service callers stay trusted; a JWT user must match the body `userId` (403 on
  mismatch) **and** own the persisted `searches` row
  (`select id … eq("id", searchId).eq("user_id", authContext.userId)`), with an
  absent row and a foreign row returning an **identical 404** (no existence
  oracle). The ownership query is safe even on the service-role client because it
  is explicitly filtered by `user_id`. Covered by
  [`authorization.test.ts`](../../supabase/functions/interview-research/authorization.test.ts)
  (owner pass / foreign-ID 404 / mismatch 403 / service bypass). The pre-existing
  bare `userId == JWT` check inside `processInterviewResearch` was removed and
  replaced by this stronger gate. **Code-complete; still needs deploy via
  PREPIO-124 — a merge does not repair production.**
- **`security: upgrade pdfjs-dist 5 to 6` (#350)** — **clears the carried
  high-severity crafted-PDF advisory (GHSA-hq66-cqwq-w95j).** `package.json` now
  pins `pdfjs-dist ~6.3.289`; `npm audit` no longer lists pdfjs. The diff also
  **removes the `isEvalSupported: false` defence-in-depth flag** from the
  `getDocument` call in [`resumeUpload.ts`](../../src/lib/resumeUpload.ts),
  with a comment that pdf.js 6 removed the `eval()`/`Function` codepath the
  advisory exploited. **Verified non-regressive:** the string `isEvalSupported`
  no longer appears in the installed `pdfjs-dist@6.3.289` build
  (`node_modules/pdfjs-dist/build/pdf.mjs`), the upstream fix is in the 6.x line
  regardless, and the parser still only extracts text (no `page.render`). Benign
  — recorded as an informational note, not a finding.
- **[PREPIO-172] `Upgrade react-router-dom 6 → 7` (#353)** — **clears both
  carried `react-router` advisories** (open-redirect GHSA-wrjc-x8rr-h8h6 and the
  SSR-hydration one that never applied to this CSR-only SPA). `package.json` now
  pins `react-router-dom ^7.18.4`; `npm audit` no longer lists react-router. The
  app still ships a client-only `BrowserRouter`; lint errors dropped by 3 in the
  window (partly this cleanup).
- **`fix: lock Prepio to the invite-only frozen core` (#354)** — the window's
  largest merge (**+629 / −1646**), implementing the FREEZE_RELEASE scope:
  removes billing/paid/voice/file-upload surfaces from `Home`, `Practice`, `Auth`,
  `Navigation`, adds a deterministic `GuestSample`, and — the security-relevant
  piece — **hardens [`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts)
  to reject anonymous Auth users** (`data.user.is_anonymous`), satisfying the
  freeze requirement that core provider functions reject anonymous callers.
  Security-positive; no new secret/PII/access regression introduced (it *removes*
  surface). It did introduce two auth-UX regressions that were caught and fixed in
  #360 (below).
- **`fix: close freeze gaps found by the final audit and UX reviews` (#360)** —
  **closes the carried `SEARCH_COMPLETE` PII-in-logs Medium** (the open PREPIO-179
  follow-up from run #27). `company-research`'s aggregate completion log now calls
  `buildSearchCompleteLogPayload`
  ([`result-aggregation.ts`](../../supabase/functions/company-research/result-aggregation.ts)),
  which emits **counts only** (`searchPayloads`, `searchResults`, `extractedContent`,
  `totalUrlsExtracted`) — no raw Tavily query strings (note-derived names) and no
  provider page text reach the logs. Covered by a new `result-aggregation.test.ts`
  case. The merge also fixes #354's two auth regressions: signup-verification
  resends land on plain `/auth` (not the recovery form), and — a **genuine auth
  hardening** — password setup is now allowed only for the session the
  invite/recovery link created (reading the link's access token at module load),
  so a reused/expired/bare link opened in a signed-in browser can no longer offer a
  form that would change the signed-in account's password. Adds `autocomplete`
  hints and corrects copy pointing at frozen features (voice record hint, offline
  resume-parse promise, History empty state).
- **[PREPIO-180] `Disclose that pasted CV text is saved with the prep plan`
  (#363)** — privacy-positive UI copy only in `Home.tsx` (+test); tells the user
  pasted CV text is persisted with the plan. No data-flow change.
- **[PREPIO-153] RUNBOOK call-graph correction (#373)** and the test-only merges
  (#357, #364, #368, #370) and CI/ratchet merges (#348 Playwright blocking gate,
  #351 deno ratchet restore, #345 origin-classification test) — docs/tests/CI;
  no product-source or security surface.

**Headline: every source-touching merge this window is security-neutral-to-positive,
and the window closed one High (PREPIO-143, code-level) and two carried advisory
items (pdfjs-dist, react-router) outright, plus the SEARCH_COMPLETE PII Medium.**
The one eye-catching number is `npm audit` rising **5 → 32** — but the growth is
**almost entirely newly-disclosed advisories against the dev/build toolchain**
(eslint, vite, vitest, tailwind, workbox and their transitive trees), refreshed by
the pdfjs-6 / react-router-7 / Node-22 upgrades. The only production-runtime-shaped
high is `zod`, and `zod` is **not imported anywhere in app source** — it reaches
the tree only through the dev-only `eslint-plugin-react-hooks → zod-validation-error`
chain, so it has **no production exposure** and the direct `zod` entry in
`package.json` is effectively unused. No safe automated lockfile fix is possible in
this sandbox: both `npm audit fix --dry-run` and `npm update --package-lock-only`
abort with the known npm `edgesOut` resolver bug (triggered by the `overrides`
field) — re-confirmed this run, as in run #27. **No product-source change was
warranted; this is a documentation run.**

Baselines (measured against HEAD `a330939`; deltas vs 2026-09-12):
lint **49** problems (40 errors, **9** warnings) — **−3 errors** (react-router-7
cleanup), warnings flat. Typecheck **pass at baseline** (app tsc **61** (−1),
node **0**). Build **pass**, **1243.41 KiB / 41 precache entries** — a **large drop
from 2280.54 KiB / 62** (the #354 lockdown removed billing/voice/upload code).
Tests **494 passing / 58 files** (up from 461/52). `npm audit` **32** (3 low,
24 moderate, 5 high) — up from 5, triaged below as dev/build toolchain with no
production-runtime exposure.

## Commands run

- `npm install`: **pass** (via SessionStart hook; 748 packages).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** −3 errors vs
  2026-09-12; the remaining errors/warnings are pre-existing
  (`@typescript-eslint/no-explicit-any` in tests/edge functions, `no-require-imports`
  in `tailwind.config.ts`, the nine fast-refresh warnings incl. #338's
  `hasQuestionInsightsContent`). Lint is informational in CI; this run pushes no
  source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (−1), node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh`/`deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass`. This run pushes no `supabase/functions` source;
  the window's edge-function merges (#337, #354, #360) each passed the real CI
  `verify` gate at merge time (#351 restored the deno ratchet to baseline).
- `npm run build`: **pass** (Vite + PWA, **41 precache entries, 1243.41 KiB**).
- `npm test`: **pass** (**58 files, 494 tests**), incl. schema/design-token checks.
- `npm audit`: **32** (3 low, 24 moderate, 5 high) — up from 5; triaged below.
- `npm audit fix --dry-run`: **aborts** (`Cannot read properties of null (reading
  'edgesOut')`) — the known npm resolver bug from the `overrides` field; no
  automated lockfile fix possible in this sandbox.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried. Could not be re-verified against
  the object store this run — the cloud clone is shallow (50 commits; the
  pre-redaction commit `5585fd4` is not present) — but no history-rewrite work has
  landed, so the exposure run #27 confirmed necessarily still stands.)*
  - Evidence: PR #342 replaced ten audit screenshots with placeholders in the
    working tree only; the pre-redaction blobs remain in history. Run #27
    (2026-09-12) confirmed against a full object store that
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` resolves to the original
    **146,389-byte** blob at `5585fd4:<path>` (vs the redacted 23,025-byte blob at
    `da47d9e`), with the nine other paths in #342 the same shape. This run's clone is
    shallow so `git cat-file 5585fd4:<path>` is not resolvable here; however, the
    only fix is an owner-attended history rewrite, which has **not** happened
    (PREPIO-145 is still Todo and `da47d9e` — the working-tree redaction — is present
    but is not a history purge). **This is a public repository.** *(PII not
    reproduced here per the review redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified
    blobs + coordinated force-push, preserving a backup ref off the public remote,
    plus the PR/comment exposure review the issue calls for. Do **not** run a
    history rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, assigned to owner). Already
    tracked with a full remediation plan. Out of scope for an unattended hygiene run
    (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a
  company token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12;
  re-verified unchanged in the code this run — no PR in the window touched
  `evidence-ledger.ts`.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    still computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is
    a substring of it (`normalizedHost.includes(token)`). For company "Acme", a
    caller-supplied or search-surfaced `https://acme.attacker.example/job`
    normalizes to `acmeattackerexample`, which `.includes("acme")` →
    `official_company`/high. No registrable-domain / public-suffix / exact-label
    check (the code comment still defers PSL-aware matching as follow-up). #340's
    NFKD folding additionally widened this for accented brand names
    (`"L'Oréal"` → token `oreal`), as documented in run #27.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Gating: the row must enter via the caller's own
    `roleLinks` (self-inflicted) or a Tavily result the attacker gets ranked for the
    company query. Content-integrity, not cross-tenant read. **Now that PREPIO-143
    is code-fixed, the compounding `searchId` BOLA path is closing** (pending
    deploy), which reduces — but does not remove — the severity: a self-inflicted
    `roleLink` still over-trusts.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the
    ATS exact/suffix approach `isJobPosting` already uses; add adversarial tests
    rejecting `company-token.attacker.example` subdomains; verify legitimate
    employer domains (short names, multi-label suffixes) still classify correctly.
  - Owner / next step: file as `Bug` + `area:research-pipeline` (Quality &
    Maintenance), cross-linked to PREPIO-144/143 and this audit, **once the Linear
    free-issue cap clears** (the recurring intake blocker, see Questions). A
    substantive service-role edge-function change, out of scope for a docs-only
    hygiene run and not validatable in this proxy-limited environment.

### Low / clean-up

- [ ] **`npm audit` rose 5 → 32 — but every finding is dev/build toolchain with no
  production-runtime exposure.** *(New this window; triaged in full.)*
  - Evidence: the 32 (3 low / 24 moderate / 5 high) are all advisories against
    **dev/build-only** packages (none in the browser bundle), refreshed by the
    pdfjs-6 / react-router-7 / Node-22 upgrades. Verified against the committed
    `package-lock.json` at HEAD `a330939` (correction after Codex review of this PR —
    an earlier draft of this finding read npm audit's `fixAvailable` *version*
    numbers as forward upgrade targets; they are not). The findings split into two
    very different remediation groups:
    - **Forward fix available (`fixAvailable` semver-compatible):** `vite`
      (installed 7.3.5, vuln 7.0.0–7.3.6), `undici` (7.29.0, vuln ≤7.30.0),
      `brace-expansion`, `source-map-js`, and `vitest`/`@vitest/mocker` (4.1.9, fix
      ≥4.1.11, within the `^4.1.8` manifest range). These are genuinely
      Dependabot-carryable / would be `npm audit fix`-able but for the local
      `edgesOut` crash.
    - **No forward fix — installed version is already current/ahead:**
      `vite-plugin-pwa` (installed **1.3.0**, vuln range **`>=1.2.0`**),
      `@eslint/js` (**10.0.1**, vuln `>=10.0.1`), `typescript-eslint` (**8.62.1**,
      vuln `*`), `@tailwindcss/typography` (**0.5.20**, vuln `>=0.5.5`), and the
      transitive cluster under them (`workbox-build`, `ejs`, `jake`, `filelist`,
      `glob`, `@trickfilm400/rollup-plugin-off-main-thread`,
      `@rollup/plugin-node-resolve`, `deepmerge`, `postcss-selector-parser`,
      `eslint`, `minimatch`). For every one of these, npm audit's only offered
      remediation is `isSemVerMajor: true` to an **older** release (e.g.
      `vite-plugin-pwa@1.1.0`, `@eslint/js@9.39.5`) — i.e. a breaking **downgrade**,
      not an upgrade. There is no patched release above the installed version yet;
      the real fix must come from upstream patching the transitive tree.
    - **`zod`** (the lone runtime-*shaped* high) has a forward major fix
      (`zod@4.6.7`) but is **unreachable** in production — see the next finding.
  - Risk: **none on the production runtime** — all are build-time or dev/test
    dependencies. The count is a maintenance signal, not a deployment blocker.
  - Recommended fix: let Dependabot carry the **forward-fixable** group (`vite`,
    `undici`, `vitest`); re-confirmed this run that `npm audit fix` and
    `npm update --package-lock-only` both abort locally with the npm `edgesOut` bug,
    so no in-sandbox lockfile surgery. For the **no-forward-fix** group, do **not**
    downgrade dev tooling to satisfy the advisory — wait for upstream patched
    releases (watch the `vite-plugin-pwa` / `@eslint` / `typescript-eslint` release
    trees); the installed versions are already current. Consider the non-blocking
    `npm audit --audit-level=high` CI step (below) so the production-vs-tooling split
    stays visible each run.
  - Owner / next step: Deferred — forward-fixable bumps via Dependabot; the
    no-forward-fix cluster waits on upstream patches (no action warranted now, and
    no production exposure either way).

- [ ] **`zod` is a direct dependency but unused in app source; its high advisory
  (GHSA-mrhx-c7xc-m3w5) has no production reachability.** *(New this window.)*
  - Evidence: `package.json` lists `"zod": "^3.23.8"` (installed `3.25.76`), but
    `grep -rn` finds **no `zod` import anywhere in `src/` or `supabase/functions/`**.
    `npm ls zod` shows it reaching the tree only via the dev-only
    `eslint-plugin-react-hooks → zod-validation-error → zod` chain. So `zod` is
    **not in the production bundle**, and the direct `package.json` entry is
    effectively dead.
  - Risk: the "high" is dev-tooling-only (memory exhaustion validating oversized
    collections) — not reachable from any shipped code path.
  - Recommended fix: a maintainer can **remove the unused direct `zod` dependency**
    from `package.json` (the transitive copy stays for the eslint plugin, so nothing
    breaks) — a small reviewable clean-up that also drops the direct advisory. Left
    for a reviewed change rather than an unattended package.json edit against a
    public repo; recorded here with the evidence a maintainer needs.

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9) — path traversal /
  arbitrary file read via redirect mock.** *(Carried; still present, dev/test-only.)*
  - Evidence: `@vitest/mocker` moderate; fix is a `vitest` bump within the existing
    manifest range. Blocked locally by the npm `edgesOut` resolver bug (re-confirmed).
  - Recommended fix: let Dependabot's `vitest` bump carry it, or a maintainer runs
    it outside this proxy sandbox. No production-bundle exposure.

- [ ] **`react-refresh/only-export-components` lint warning from #338 persists.**
  *(Carried; cosmetic/DX. 9 warnings, unchanged.)*
  - Evidence: `export const hasQuestionInsightsContent` in
    [`QuestionInsightsPanel.tsx:53`](../../src/components/practice/QuestionInsightsPanel.tsx)
    mixes a non-component export with the component export. Lint is informational in
    CI; non-blocking.
  - Recommended fix: move the helper into a small `questionInsights.ts` module. A
    ~2–3-file move; noted for a follow-up cleanup, not remediated in a docs-only run.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged from prior runs.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates
    lint, typecheck, typecheck:functions, build, test, and now the Playwright smoke
    (#348) — not `npm audit`. Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step — a
    CI-policy call for maintainers, not a hygiene-run change. Especially useful now
    that the raw count (32) overstates risk; a high-only gate would have surfaced
    just the toolchain highs + the unreachable `zod`.

## Small fixes made in this run

- **None (code).** Every source-touching merge this window is
  security-neutral-to-positive and landed its own fix + tests; three carried
  findings were closed by those merges (PREPIO-143 code-level, pdfjs-dist,
  react-router) and one carried Medium by #360 (SEARCH_COMPLETE PII). No new
  fix candidate landed in this docs-only run. The dev-tooling `npm audit` cluster is
  blocked from in-sandbox remediation by the npm `edgesOut` resolver bug
  (re-confirmed via `npm audit fix --dry-run`), and all of it is non-production.
- **Deliverable:** this dated note + the [`docs/audits/README.md`](./README.md)
  index row.

## Deferred items

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + exposure review (High/Urgent, Todo). Working-tree slice done (#342);
  history remains exposed on the public repo. *Highest residual risk.*
- **PREPIO-143 deploy** — the `searchId` BOLA fix is **merged (#337)** and
  re-verified at the code level this run, but **production is only repaired once it
  deploys via PREPIO-124** (freeze deploy of the five core functions + migration
  reconciliation). A repo merge alone does not repair production.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium,
  carried) — PSL-aware registrable-label match + adversarial tests. File against
  Quality & Maintenance when the Linear cap clears.
- **`zod` unused direct dependency removal** (Low, new) — safe maintainer clean-up
  that also drops the direct `zod` high advisory; evidence recorded above.
- **Dev/build `npm audit` cluster** (Low, new) — the forward-fixable part
  (`vite`, `undici`, `vitest` which clears `@vitest/mocker`) via Dependabot; the
  no-forward-fix part (`vite-plugin-pwa` 1.3.0, `@eslint/js` 10.0.1,
  `typescript-eslint` 8.62.1, `@tailwindcss/typography` 0.5.20 and their transitive
  tree — installed versions already current, npm only offers a breaking downgrade)
  waits on upstream patches. None production-runtime.
- **`#338` `react-refresh/only-export-components` warning** (Low, cosmetic) — helper
  module extraction; follow-up cleanup, not filed.
- **`npm audit` as a non-blocking `--audit-level=high` CI step** (Low, process) —
  maintainer call.

## Questions for product owner

- **Linear is still at its free-issue cap**, so the carried `official_company`
  over-trust Medium could not be filed as a tracked issue this run (same intake
  blocker recorded since 2026-07-29). Upgrading or clearing the cap would let
  hygiene findings live in Linear rather than only in the audit trail. Not otherwise
  blocking: the one open High (PREPIO-145) has an owner and plan, and PREPIO-143 is
  merged and tracked for deploy under PREPIO-124.

## Next review focus

1. **PREPIO-143 / PREPIO-124 deploy.** The BOLA fix is merged and code-verified;
   confirm it actually deploys (the freeze runbook: migration `repair` → `db:push`,
   then the five core functions) so production is repaired, not just the repo. Then
   re-audit `company-research`, `job-analysis`, and `answer-feedback` for the same
   missing object-ownership check `authorizeSearch` now gives `interview-research`.
2. **PREPIO-145 Git-history purge** — the highest residual risk: real CV PII is
   still publicly fetchable from history (confirmed in run #27; not re-checkable in
   this run's shallow clone, and no rewrite has landed). Track the owner-attended
   filter-repo/BFG + force-push and verify the blobs are gone from all refs
   afterward — ideally from a full clone.
3. **Evidence-ledger `official_company` PSL-aware fix** (file once the Linear cap
   clears) — land the registrable-label match with adversarial
   `company-token.attacker.example` tests and fold in the deferred `official_job`
   short-name follow-up; re-audit the whole `classifyRetrievedSource` trust map.
4. **Dev-tooling `npm audit` drift** — nudge the forward-fixable Dependabot bumps
   (`vite`, `undici`, `vitest`) through; the larger no-forward-fix cluster
   (`vite-plugin-pwa` / `@eslint/js` / `typescript-eslint` / `@tailwindcss/typography`
   and their transitive tree) is already on current versions and waits on upstream
   patches — do **not** downgrade to clear the advisory. Add the non-blocking
   `--audit-level=high` CI step so the production-vs-tooling split is legible, and
   remove the unused direct `zod` dependency while there.
5. **Next source-touching merge.** Re-run the full baseline against it and read the
   *merged* code, not commit messages, when assessing any security-relevant change.
