# Recurring hygiene review — 2026-10-17

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio. Measured
against HEAD `a330939`; window is `e3a283b..a330939` (the 2026-09-12 base → now),
**15 commits**, the first substantial functional window in several runs.

**Headline: three of the carried findings closed in this window, no new security
regression, and the freeze lockdown is security-positive.** Four carried items
landed as merged fixes, two carried items remain open and tracked, and the one new
signal (`npm audit` 5 → 18) is **not** a new production exposure — it is
newly-disclosed CVEs against dev/build/test tooling plus the two major bumps
reshaping the transitive tree.

### Source-touching merges reviewed this window

Classified from `git log e3a283b..a330939` (tests/docs/CI excluded from the
"source" count but noted):

- **[PREPIO-143] `security: enforce interview research search ownership` (#337,
  `17e5b08`)** — **closes the carried High.** New
  [`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  adds `authorizeSearch`, a fail-closed ownership gate: service callers pass; a JWT
  user must match both the body `userId` **and** own the persisted `searches` row
  (`select id ... where id = searchId and user_id = authContext.userId`,
  `maybeSingle`), returning a deliberately identical 404 for an absent row and a
  foreign-owned row, 403 on userId mismatch, 500 on query error. Wired at
  [`interview-research/index.ts:1333`](../../supabase/functions/interview-research/index.ts)
  **before** the background `processInterviewResearch` promise is constructed (line
  1346), so the RLS-bypassing service-role writes can't run on an unauthorized
  search. Covered by `authorization.test.ts` (+91 lines). **PREPIO-143 is now Done
  in Linear**; production repair is still tracked under PREPIO-124 (a repo merge does
  not deploy).
- **`security: upgrade pdfjs-dist 5 to 6` (#350, `c4932a9`)** — **closes the carried
  `pdfjs-dist` Medium.** `pdfjs-dist` is now `~6.3.289`
  (GHSA-hq66-cqwq-w95j fixed — pdf.js 6 removed the `eval()`/`Function` codepath the
  advisory exploited). [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) drops the
  now-redundant `isEvalSupported: false` defence-in-depth (the eval path is gone) and
  keeps text-only extraction (no `page.render`, scripting off). Reasonable: the
  advisory's own fix is the major, and the live mitigation posture is preserved.
- **[PREPIO-172] `Upgrade react-router-dom 6 → 7` (#353, `908b8f4`)** — **closes the
  carried `react-router` Low (two advisories).** Now `react-router-dom@^7.18.4`
  (open-redirect GHSA-wrjc-x8rr-h8h6 + SSR-hydration GHSA-337j-9hxr-rhxg cleared; the
  SSR one never applied to this CSR-only SPA).
- **`fix: close freeze gaps found by the final audit and UX reviews` (#360,
  `bccb67c`)** — **security-positive, and closes the carried `SEARCH_COMPLETE`
  PII-in-logs Medium.** A new
  [`company-research/result-aggregation.ts`](../../supabase/functions/company-research/result-aggregation.ts)
  `buildSearchCompleteLogPayload` replaces the raw `result` object at the
  `SEARCH_COMPLETE` log site
  ([`company-research/index.ts:321`](../../supabase/functions/company-research/index.ts))
  with **counts only** (`searchPayloads`, `searchResults`, `extractedContent`,
  `totalUrlsExtracted`) — no user/provider text. This was the exact confirmed leak
  the 2026-09-12 note recorded as open. Tested in `result-aggregation.test.ts`.
- **[PREPIO-180] `Disclose that pasted CV text is saved with the prep plan` (#363,
  `8696991`)** — honest-copy addition to the `/new-interview` paste area
  ([`Home.tsx`](../../src/pages/Home.tsx)). Aligns copy to reality (CLAUDE.md
  guardrail); no new data flow. Done in Linear.
- **`fix: lock Prepio to the invite-only frozen core` (#354, `9d9b711`)** —
  **security-positive.** Public `signUp` is removed from
  [`useAuth.ts`](../../src/hooks/useAuth.ts) (invite-only), and the auth-link flow is
  hardened: an expired/reused/bare invite or recovery link that leaves no session
  carrying its **own** `access_token` now shows an honest "invalid or expired" error
  instead of presenting a set-password form to whoever is already signed in (guards
  an account-confusion / stale-session hijack of the password-set flow); `flow=recovery`
  is separated from signup verification. New
  [`frozenProduct.ts`](../../src/lib/frozenProduct.ts) holds release-boundary flags
  deliberately not overridable from the browser/env. Covered by `useAuth.test.ts`,
  `Auth.test.tsx`, `App.routing.test.tsx`, `frozenProduct.test.ts`.
- **`fix: restore Edge Function typecheck ratchet after ownership guard` (#351)** and
  **`ci: make Playwright landing smoke a blocking gate` (#348, PREPIO-135)** — CI/DX
  hardening (deno ratchet restored after #337; Playwright landing smoke promoted to a
  blocking gate). Positive.

Tests-only (#370 auth recovery path, #368 frozen offline resume guidance, #364
frozen provider boundaries, #357 frozen app routing, #345 short-name evidence
origin), docs-only (#373 RUNBOOK call-graph correction, #346 the 2026-09-12 note).

### What the `npm audit` jump means

`npm audit` is **18** (10 moderate, 8 high), up from **5** on 2026-09-12 — but the
delta is **not** new product risk. The previously-reported `pdfjs-dist` high and the
two `react-router` moderates **cleared** (the #350/#353 majors). Every one of the 18
is in **dev/build/test tooling or a non-reachable transitive path**:

- **`undici` (8 of the high count, 10 GHSAs)** — transitive of **`jsdom@29.1.1`**, the
  Vitest DOM test environment. Dev/test only; not in the production bundle. Newly
  disclosed since the last run (undici published a batch of advisories), not a new
  dependency. `fixAvailable` is non-breaking.
- **`mammoth` → `argparse` → `sprintf-js` (moderate)** — `mammoth@1.12.0` is the DOCX
  resume parser (a production dep), but the vulnerable `sprintf-js` DoS is reached
  only through `argparse`'s CLI-help formatting, which the browser DOCX **text
  extraction** path does not exercise. npm's suggested "fix" is `mammoth@0.3.29`, a
  nonsensical major **downgrade** — so there is no real forward fix; practically
  inert on the app's path.
- **tailwind / postcss / micromatch / braces / chokidar / fast-glob / brace-expansion
  / source-map-js / fast-uri / postcss-nested / postcss-selector-parser** — Tailwind
  v3 + PostCSS + Vite build-time tooling. Build/dev only, not shipped to the runtime.
- **`vitest` / `@vitest/mocker`** — dev/test only (carried).

So the raw count rose but the **production-reachable** surface did not. No code or
dependency change was made this run (see *Small fixes*).

Baselines (vs 2026-09-12): lint **49** problems (40 errors, 9 warnings; down from 52
— the freeze lockdown deleted code). Typecheck **pass at baseline** (app **61**, down
from 62; node **0**). Build **pass**, **1243.41 KiB** / 41 precache entries (down from
2280.54 KiB / 62 — the freeze removed billing/paid-feedback/voice/import surfaces).
Tests **494 passing / 58 files** (up from 461/52). `npm audit` **18** (10 moderate, 8
high) — reshaped by the majors + newly-disclosed tooling CVEs, no production-reachable
new exposure.

## Commands run

- `npm install`: **pass** (via SessionStart hook; `npm audit` reported 18 at install).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** Down from 52 — the freeze
  lockdown removed source. Informational in CI (not a gate); this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (down from 62), node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)): **not
  runnable here** — the agent proxy blocks `esm.sh`/`deno.land`, so Deno can't resolve
  the edge functions' remote imports (the script reports `SKIPPED — this is not a
  pass`; exit 0 locally, `exit 1` under `$CI`). The window's edge-function merges
  (#337, #351, #360) each passed the real CI `verify` gate at merge time (#351 restored
  the deno ratchet to baseline after #337).
- `npm run build`: **pass** (Vite + PWA, 41 precache entries, **1243.41 KiB**).
- `npm test`: **pass** (**58 files, 494 tests**), incl. the schema/design-token checks.
- `npm audit`: **18** (10 moderate, 8 high) — all dev/build/test tooling or
  non-reachable transitive paths (see Summary); `pdfjs-dist`/`react-router` cleared.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; owner-attended history purge.
  Re-verified still exposed this run, within shallow-clone limits.)*
  - Evidence: PR #342 replaced the audit screenshots with redacted placeholders in the
    working tree, but the pre-redaction blobs remain in history. This session's clone
    is **shallow (50 commits)**, so the specific commit the 2026-09-12 note cited
    (`5585fd4`) is outside the window — but the **original 146,389-byte blob
    (`3a6f18c65cc448482d16ff58a2f257b2850a26f2`) is still reachable** for
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` within the history present
    locally (the redacted working-tree version is 23,025 bytes). This is a **public
    repository**, so those blobs are retrievable by anyone with the commit SHA. *(PII
    not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten; a
    freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified
    blobs + coordinated force-push, preserving a backup ref off the public remote, plus
    the exposure review the issue calls for. Do **not** run a history rewrite
    unattended.
  - Owner / next step: **PREPIO-145** (Todo, Urgent, owner-assigned). Already tracked
    with a remediation plan; no new issue filed. Out of scope for an unattended
    hygiene run (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12;
  re-verified still open. Now tracked in Linear as PREPIO-184.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    substring of it (`.includes(token)`). For company "Acme", a caller-supplied or
    search-surfaced link `https://acme.attacker.example/job` normalizes to
    `acmeattackerexample`, which `.includes("acme")` → `official_company`/high. The
    code comment (lines 180–186) explicitly defers PSL-aware registrable-label matching
    as follow-up. #345 added short-name classification tests but did **not** change the
    substring match.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence, biasing generated prep. Gated
    on the row entering the ledger via the caller's own `roleLinks` or a Tavily result
    ranked for the company query. Content-integrity, not a cross-tenant read. The
    compounding `searchId` BOLA is now **closed** (#337), which reduces the blast
    radius vs the 2026-09-12 framing.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the ATS
    exact/suffix approach `isJobPosting` uses; add adversarial tests rejecting
    `company-token.attacker.example` subdomains.
  - Owner / next step: **PREPIO-184** (In Progress) — now tracked (it could not be
    filed on 2026-09-12 due to the Linear free-issue cap). A substantive service-role
    edge-function change, out of scope for a docs-only hygiene run and not validatable
    in this proxy-limited environment (`typecheck:functions` can't resolve remote
    imports here).

- [ ] **`tavily-client` op-logging insert does not match the `ops.tavily_searches`
  schema — silently broken write, and a latent PII-in-storage path if reconciled
  naively.** *(Carried from the 2026-09-12 PREPIO-179 follow-up; re-verified still
  present. Could not file a Linear issue — free-issue cap; recorded in full here.)*
  - Evidence:
    [`_shared/tavily-client.ts`](../../supabase/functions/_shared/tavily-client.ts)
    inserts `user_id`, `query_text: request.query`, and `response_payload` into
    `tavily_searches` on both the success (~lines 98–104) and error (~lines 175–181)
    paths. The checked-in schema
    ([`20260329000000_v2_clean_schema.sql:186`](../../supabase/migrations/20260329000000_v2_clean_schema.sql),
    moved to `ops` by `20260409000000`) defines only
    `id, search_id, api_type, query_text, response_status, results_count,
    request_duration_ms, credits_used, error_message, created_at` — **no `user_id`,
    no `response_payload`**, and no later migration adds them. The insert is wrapped in
    a swallowing try/catch, so against the checked-in schema it fails and persists
    nothing.
  - Risk: (1) **Reliability** — either Tavily op-logging is silently broken in
    production, or the prod schema has drifted out of the migration history (same
    production-reconciliation theme as PREPIO-124/173). (2) **Latent PII** — if the
    writer is reconciled by *adding* the columns, `query_text: request.query` (the raw
    Tavily query, which for `user-note-*`/contextual queries embeds note-derived
    interviewer/team names) and `response_payload` would then persist to a queryable
    table. The `SEARCH_COMPLETE` console leak this item was paired with on 2026-09-12
    is now **fixed** (#360); this DB-writer half remains.
  - Recommended fix: decide the intended shape of `ops.tavily_searches` and make code
    + schema agree (one migration + the insert edit); redact `query_text` (store a
    source label / hash, not the raw query) and drop/redact `response_payload` on both
    inserts; add a test asserting no free-text query reaches the writer.
  - Owner / next step: file as `Chore` + `area:research-pipeline` (Quality &
    Maintenance), related to PREPIO-179 (Done), PREPIO-124, PREPIO-173 — **blocked this
    run by the Linear free-issue cap** (attempted; `exceeded the free issue limit`).
    Recorded in full here until the cap clears.

- [ ] **`mammoth` → `argparse` → `sprintf-js` moderate advisory on a production dep.**
  *(New this run; the only `npm audit` entry on a production-runtime package.)*
  - Evidence: `npm audit` flags `sprintf-js` (DoS via unbounded precision specifiers,
    GHSA-hp3w-g68c-fv3c) under `mammoth@1.12.0` (the DOCX resume parser) via
    `argparse@1.0.10`. npm's only offered fix is `mammoth@0.3.29` — a major
    **downgrade**, i.e. not a real fix.
  - Risk: **low/not practically reachable** — `sprintf-js` is used by `argparse`'s
    CLI-help formatting, which the browser DOCX **text-extraction** path does not
    invoke; no attacker-controlled format string reaches it on the app's path.
  - Recommended fix: track for a future `mammoth` upgrade that drops the old
    `argparse`; no action warranted now. The DOCX-upload surface-lock (if it lands
    under the freeze) would remove the dependency's reachability entirely.
  - Owner / next step: Deferred — Dependabot-tracked; re-evaluate when `mammoth`
    publishes a fixed line.

### Low / clean-up

- [ ] **`undici` high advisories (10 GHSAs) via the `jsdom` test environment.** *(New
  this run; dev/test only.)*
  - Evidence: `npm audit` reports `undici 7.0.0 - 7.29.0` high (10 advisories:
    DoS/response-splitting/cookie-disclosure/TLS-bypass) transitive of `jsdom@29.1.1`,
    the Vitest DOM env. `fixAvailable` is non-breaking.
  - Risk: **none on the production runtime** — `jsdom`/`undici` are a devDependency
    (test env), not in the shipped bundle.
  - Recommended fix: let Dependabot's bump carry it (its full-tree resolution isn't
    subject to the local npm `edgesOut --package-lock-only` crash prior runs hit); not
    worth manual lockfile surgery for a dev-only path, and dependency churn is
    discouraged under the freeze (CLAUDE.md).

- [ ] **Build/dev tooling advisories (tailwind / postcss / vite chain).** *(Carried
  family + new disclosures; build-time only.)*
  - Evidence: `tailwindcss`, `@tailwindcss/typography`, `tailwindcss-animate`,
    `postcss-nested`, `postcss-selector-parser`, `micromatch`, `braces`, `chokidar`,
    `fast-glob`, `brace-expansion`, `source-map-js`, `fast-uri` — all in the Tailwind
    v3 / PostCSS / Vite build toolchain.
  - Risk: build/dev only; not shipped to the runtime.
  - Recommended fix: Dependabot-tracked; several would need Tailwind/PostCSS majors.
    No hygiene-run action.

- [ ] **`@vitest/mocker` / `vitest` moderate (dev/test only).** *(Carried.)*
  - Evidence: `@vitest/mocker 2.1.0 - 4.1.10` (path-traversal via redirect mock,
    GHSA-82fw-gwwq-j7x9); installed `vitest@4.1.9`. Fix is `vitest ≥ 4.1.11` (within
    the `^4.1.8` manifest range).
  - Recommended fix: Dependabot's full-tree `vitest` bump; the local
    `--package-lock-only` path aborts on the npm `edgesOut` resolver bug (documented in
    prior runs). Dev-only; no production exposure.

- [ ] **`react-refresh/only-export-components` lint warning from #338.** *(Carried;
  cosmetic/DX.)*
  - Evidence: `QuestionInsightsPanel.tsx` exports both a component and the
    `hasQuestionInsightsContent` helper (9 such fast-refresh warnings in `lint`).
  - Risk: cosmetic/DX only; lint is informational in CI.
  - Recommended fix: move `hasQuestionInsightsContent` into a helper module. Touches
    already-merged product source — out of scope for a docs-only run; noted for a
    maintainer cleanup.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, test, and (new, #348) the Playwright
    landing smoke — not `npm audit`. Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers.

## Small fixes made in this run

- **None to product source or dependencies.** Consistent with the freeze and the
  CLAUDE.md guardrail ("Do not add features, recurring audits or routine dependency
  PRs"): three carried findings were closed by merges *within this window* (#337,
  #350, #353, plus the #360 `SEARCH_COMPLETE` redaction), the remaining opens are each
  tracked or Dependabot-surfaced, and the one clean non-breaking dependency candidate
  (`undici` via `npm audit fix`) is a dev/test-only path best left to Dependabot. The
  note + the `docs/audits/README.md` index row are the deliverable.
- **Attempted** to file the `tavily-client` ↔ `ops.tavily_searches` schema-mismatch
  Medium in Linear (Quality & Maintenance, `Chore` + `area:research-pipeline`) — the
  create was rejected: *"exceeded the free issue limit for this workspace."* Recorded
  in full in the Medium finding above.

## Deferred items

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + exposure review (High/Urgent, Todo). Working-tree redaction done (#342);
  history still exposed on the public repo (re-verified).
- **PREPIO-184** — evidence-ledger `official_company` attacker-subdomain over-trust
  (Medium, In Progress). Now tracked (was blocked by the Linear cap on 2026-09-12).
  Needs the PSL-aware registrable-label fix + adversarial tests; a service-role
  edge-function change out of scope for a docs-only run.
- **`tavily-client` ↔ `ops.tavily_searches` schema mismatch + `query_text` redaction**
  (Medium, new-tracking) — **could not be filed (Linear free-issue cap)**; recorded in
  full above. File as `Chore` + `area:research-pipeline` (Quality & Maintenance),
  related to PREPIO-179/124/173, when the cap clears.
- **`mammoth`/`sprintf-js`** (Medium, not practically reachable) and the **`undici`**,
  **tailwind/postcss**, **`@vitest/mocker`/`vitest`** advisories (Low, dev/build/test
  only) — all Dependabot-surfaced; no hygiene-run action under the freeze.
- **`react-refresh` lint warning** (Low, cosmetic/DX) — helper-module move; maintainer
  cleanup.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **PREPIO-124 production reconciliation** — #337 (BOLA) is merged but a repo merge is
  not a deploy; the ownership fix (and the rest of the frozen core) still needs the
  attended `db:push`/`functions:deploy` runbook. Production remains unreconciled per
  CLAUDE.md / FREEZE_RELEASE.md.

## Questions for product owner

- **Linear is at its free-issue cap again** (PREPIO-184 was filed in a brief clear
  window, but a create attempt this run was rejected with *"exceeded the free issue
  limit"*). So the one new-tracking Medium — the `tavily-client` ↔
  `ops.tavily_searches` schema mismatch — could not be filed and is recorded in full
  in this note instead. Upgrading or clearing the cap would let hygiene findings be
  tracked in Linear rather than only in the audit trail. Not otherwise blocking: the
  carried High (PREPIO-145) and the carried Medium (PREPIO-184) both have owners and
  active tracking.

## Next review focus

1. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV PII
   is still publicly fetchable from history. Track the owner-attended filter-repo/BFG +
   force-push and verify the identified blobs are gone from all refs afterward.
2. **PREPIO-184 (`official_company` over-trust)** — land the registrable-label
   (PSL-aware) fix with adversarial `company-token.attacker.example` tests, fold in the
   deferred `official_job` short-name/employer-domain follow-up, and re-audit the whole
   `classifyRetrievedSource` trust map.
3. **`tavily-client` ↔ `ops.tavily_searches` reconciliation** — file it once the Linear
   cap clears; reconcile code + schema (one migration + the insert edit), redact
   `query_text`, and add a no-free-text-to-writer test. Compounds the
   production-reconciliation work under PREPIO-124/173.
4. **PREPIO-124 production deploy** — confirm the merged BOLA fix (#337) and the frozen
   core actually reach production via the attended runbook; a green repo is not a
   deployed one. Re-audit `company-research`/`job-analysis`/`answer-feedback` for the
   same object-ownership gate #337 added to `interview-research`.
5. **Next source-touching merge** — re-run the full baseline against it rather than
   re-verifying carried findings, and read the *merged* code (not commit messages) when
   assessing a security fix.
