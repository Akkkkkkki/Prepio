# Recurring hygiene review — 2026-10-03

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio, measured
against HEAD `bccb67c` (origin/main tip), deltas vs the 2026-09-12 run (`e3a283b`).

**Headline: this is a large remediation window — four previously-open findings
closed in code and every one of the five source-touching merges is
security-neutral-to-positive, with no new secret, PII-in-logs, or access-control
regression.** Since the last audit the window landed, in `e3a283b..bccb67c`:

- **[PREPIO-143] `security: enforce interview research search ownership` (#337,
  `17e5b08`)** — **the carried High BOLA fix, now merged and verified sound in
  code.** A new fail-closed `authorizeSearch`
  ([`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts))
  runs **synchronously before** the service-role background promise is
  constructed ([`index.ts`](../../supabase/functions/interview-research/index.ts)):
  service callers are trusted; a JWT user must match the body `userId` **and** own
  the persisted `searches` row (`select id … eq(id).eq(user_id)`), with a **404
  that is deliberately identical for an absent row and a foreign-owned row** (no
  enumeration oracle). The old bare body-`userId` == JWT check was removed from
  `processInterviewResearch`. Covered by focused authorization regression tests.
  **Closes the PREPIO-143 cross-tenant-write BOLA in the repo** (Linear
  PREPIO-143 = **Done**). Production repair still depends on the PREPIO-124 deploy
  — a repo merge alone does not fix the live function.
- **[PREPIO-179 follow-up] `SEARCH_COMPLETE` log now records counts only (#360,
  `bccb67c`)** — **closes the confirmed PII-in-logs Medium the last two runs
  tracked.** `company-research` previously `console.log`-ed the whole `result`
  (raw Tavily queries embedding note-derived interviewer/team names + provider
  page text) through the generic un-redacting `logger.log`. A new
  `buildSearchCompleteLogPayload`
  ([`company-research/result-aggregation.ts`](../../supabase/functions/company-research/result-aggregation.ts))
  now emits only counts (`searchPayloads`, `searchResults`, `extractedContent`,
  `totalUrlsExtracted`); nothing user- or provider-derived reaches the log.
  Covered by `result-aggregation.test.ts` (payload asserts counts only, no query /
  URL / page text). (Linear PREPIO-179 = **Done**.)
- **`security: upgrade pdfjs-dist 5 → 6` (#350, `c4932a9`)** — **clears the
  carried `pdfjs-dist` high advisory** (GHSA-hq66-cqwq-w95j). `package.json` now
  pins `pdfjs-dist ~6.3.289`. The merge also **removed the `isEvalSupported:
  false` defence-in-depth** on the `getDocument` call
  ([`resumeUpload.ts`](../../src/lib/resumeUpload.ts)) with the rationale that
  pdf.js 6 removed the eval()/Function codepath that flag was guarding — accurate
  for v6, so not a regression. Worker isolation + text-only extraction remain. PDF
  upload itself is still live and guest-reachable (surface-lock pending
  PREPIO-27/PREPIO-140), but the *advisory* is gone.
- **[PREPIO-172] `Upgrade react-router-dom 6 → 7` (#353, `908b8f4`)** — **clears
  both carried `react-router` advisories** (open-redirect GHSA-wrjc-x8rr-h8h6 +
  SSR-hydration GHSA-337j-9hxr-rhxg). `react-router-dom ^7.18.4`. This upgrade
  plus the freeze lock also shrank the production bundle dramatically (see
  baselines).
- **`fix: lock Prepio to the invite-only frozen core` (#354, `9d9b711`)** —
  the freeze-scope lock across the frontend. Its one **security-positive**
  edge-function change: `authorizeRequest`
  ([`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts)) now rejects
  `data.user.is_anonymous` users, implementing the freeze's "core provider
  functions reject anonymous Auth users". It introduced an auth-link regression
  (below), fixed in the same window by #360.
- **`fix: close freeze gaps found by the final audit and UX reviews` (#360,
  `bccb67c`)** — besides the `SEARCH_COMPLETE` redaction above, it fixes a
  **security-sensitive auth-link bug** #354 introduced: an expired / reused / bare
  invite or recovery link, opened in an already-signed-in browser, previously
  showed a password-set form that would have changed the **signed-in** account's
  password.
  [`useAuth.ts`](../../src/hooks/useAuth.ts) now reads the link's `access_token`
  at module load (before supabase-js clears the hash) and allows password setup
  **only** when the current session carries that exact token, or on a genuine
  `PASSWORD_RECOVERY` event; otherwise it shows a fixed expired-link message and
  no form, and `Auth` does not redirect a signed-in browser past it. No text from
  the URL is ever rendered. Verified sound in the current code (Codex-reviewed
  across rounds on the PR). Also: verification resends land on plain `/auth` (only
  recovery uses `?flow=recovery`), autocomplete hints added (PREPIO-123), and copy
  pointing at frozen features (voice, local resume parsing) removed.
- Plus **#351 (`571c6e5`)** restoring the Edge Function typecheck ratchet after
  the ownership guard (CI/DX, scripts/types only).

**Still open and carried** (unchanged in code this window): the PREPIO-145 CV-PII
-in-Git-history High (owner-attended; **not verifiable from this shallow clone** —
see below), the evidence-ledger `official_company` attacker-subdomain over-trust
Medium (explicitly deferred by #360's own description), and the `tavily-client` →
`ops.tavily_searches` code/migration mismatch (latent-PII / reliability).

**No code change was warranted this run.** The remaining `npm audit` advisories
are **all dev/build-time only** (no production-bundle exposure) and the local fix
path is still blocked by the npm `edgesOut` resolver bug (the `overrides` field);
the substantive findings are service-source / history-rewrite / schema work out of
scope for a docs-only hygiene run and not validatable in this proxy- and
shallow-clone-limited environment.

Baselines (HEAD `bccb67c`; deltas vs 2026-09-12 `e3a283b`):
lint **49** problems (**40** errors, 9 warnings; **−3 errors**, warnings flat).
Typecheck **pass at baseline** (app tsc **61**, node **0**; app **−1** from the
#360 derived-view refactor). Build **1242.90 KiB** / **41** precache entries
(**down from 2280.54 KiB / 62** — the react-router v7 major + the freeze lock
removed a large amount of now-unreachable code). Tests **483** passing / **58**
files (up from 461 / 52). `npm audit` **12** (3 moderate, 9 high) — **up from 5
(4 moderate, 1 high)**, but the composition flipped: the `pdfjs-dist` high and the
two `react-router` moderates are **gone**, replaced by newly-disclosed advisories
against **dev/build-time-only** tooling (`undici` via `jsdom`, the Tailwind 3
`braces`/`micromatch`/`chokidar`/`fast-glob` chain, `fast-uri` via workbox,
`brace-expansion` via eslint/workbox, `@vitest/mocker`/`vitest`). **None is on a
production runtime path.**

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** −3 errors vs 2026-09-12
  (the #360 derived-view refactor dropped the set-state-in-effect error #354 had
  added, among others); the 9 warnings are unchanged and pre-existing
  (`react-refresh/only-export-components` ×9, incl. the #338 one). The 40 errors
  are the pre-existing `@typescript-eslint/no-explicit-any` in tests/edge
  functions. Lint is informational in CI; this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the
  script reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under
  `$CI`). This run pushes no `supabase/functions` source; the window's
  edge-function merges (#337, #351, #354, #360) each passed the real CI `verify`
  gate at merge time (#351 explicitly restored the deno ratchet to baseline).
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1242.90 KiB**).
- `npm test`: **pass** (**58 files, 483 tests**), incl. the legacy-schema /
  answer-feedback-schema / design-token checks.
- `npm audit`: **12** (3 moderate, 9 high) — all dev/build-time transitive; see
  the Low finding for the full tree and why no fix was applied.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is (still) recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; owner-attended. **Not
  re-verified this run** — see the environment caveat.)*
  - Evidence: PR #342 replaced ten audit screenshots with placeholders in the
    working tree, but the pre-redaction blobs remained in history (the 2026-09-12
    run confirmed the original **146,389-byte** blob at `5585fd4` still resolvable
    while the redacted **23,025-byte** blob sits at `da47d9e`). **This review ran
    in a shallow clone** (`.git/shallow` present, 50 commits; `5585fd4` is "not a
    valid object name" here), so the history state could not be independently
    confirmed this run. The working-tree file is the 23,025-byte redacted version.
    Linear PREPIO-145 is still **Todo / Urgent**, so the owner-attended purge has
    not been recorded as done. *(PII not reproduced here per the review's redaction
    rule.)*
  - Risk: if the history has not yet been rewritten, real personal data remains
    publicly fetchable from this public repo by commit SHA — a freeze-exit release
    blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified
    blobs + coordinated force-push, preserving a backup ref off the public remote,
    plus the PR/comment exposure review the issue calls for. Do **not** run a
    history rewrite unattended. Verify in a **full** clone that the blobs are gone
    from all refs afterward (this shallow-clone environment cannot).
  - Owner / next step: **PREPIO-145** (Urgent, Todo). Tracked with a full
    remediation plan; out of scope for an unattended, shallow-clone hygiene run.
    Related: **PREPIO-168** (Urgent, Todo) — rotate the exposed test-account
    credential also in Git history; same class, same owner-attended purge.

- [x] **`interview-research` `searchId` ownership BOLA — FIXED in code this window
  (PREPIO-143).** *(Was the carried High; now closed in the repo. Production deploy
  still pending.)*
  - Evidence: #337 (`17e5b08`) added the fail-closed `authorizeSearch` gate,
    awaited before the service-role background work, 404-identical for missing and
    foreign rows, with regression tests (see Summary). Re-read the merged code this
    run — correct and complete for the repo.
  - Residual: the fix must still reach production via the PREPIO-124 deploy (a
    merge does not repair the live function). Also re-audit `company-research`,
    `job-analysis`, and `answer-feedback` for the same object-ownership pattern
    (next-review focus).
  - Owner / next step: **PREPIO-143** (**Done**); deploy tracked under
    **PREPIO-124** (Urgent, Todo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a
  company-name token — attacker-subdomain trust escalation.** *(Carried from
  2026-09-12; re-verified open in the current code. Could not be filed in Linear —
  free-issue cap.)*
  - Evidence:
    [`evidence-ledger.ts:175-177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust, weight 4 via `trustWeightFor`) when **any**
    `companyTokens(company)` entry (words ≥3 chars) is a substring of it
    (`.includes(token)`). For company "Acme", a caller-supplied or search-surfaced
    link `https://acme.attacker.example/job` normalizes to `acmeattackerexample`,
    which `.includes("acme")` → `official_company`/high. The code comment
    (L182-185) explicitly defers Public-Suffix-List-aware matching as follow-up.
    #340's NFKD/combining-mark folding in `companyWords` also widened this for
    accented brand names (`oreal.attacker.example` for "L'Oréal"). #360's own
    description explicitly left this out of scope ("a research-quality issue that
    needs PSL-aware matching").
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Gating: the row must enter via the caller's own
    `roleLinks` (self-inflicted) or a Tavily result the attacker gets ranked for
    the company query. Content-integrity, not cross-tenant read; the compounding
    `searchId` BOLA is now closed in code (PREPIO-143), reducing the combined
    severity vs the 2026-09-12 framing.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the
    exact/suffix ATS approach `isJobPosting` now uses; add adversarial tests that
    reject `company-token.attacker.example` subdomains; verify legitimate employer
    domains (short names, multi-label suffixes) still classify correctly. Fold in
    the deferred `official_job` short-name/employer-domain follow-up.
  - Owner / next step: **Linear issue could not be filed — the workspace is at its
    free-issue cap** (attempted this run; same blocker the 2026-07-29 and
    2026-09-12 runs recorded). File as `Bug` + `area:research-pipeline` (Quality &
    Maintenance), related to PREPIO-144 / PREPIO-143, cross-linked to this note and
    PR #346, when the cap clears. A service-role edge-function change, out of scope
    for a docs-only hygiene run and not deno-typecheckable in this proxy-limited
    environment.

- [ ] **`searchTavily` writes `user_id` / `response_payload` columns that the
  checked-in `ops.tavily_searches` schema does not have — a code/migration
  mismatch that is either a silent reliability failure or a latent raw-query-PII
  persistence.** *(Carried from 2026-09-12; re-verified. Could not be filed in
  Linear — free-issue cap.)*
  - Evidence: all four insert sites in
    [`_shared/tavily-client.ts`](../../supabase/functions/_shared/tavily-client.ts)
    (~L98-104, L175-181, L232-238, L262-268) write `user_id`, `query_text:
    request.query`, and `response_payload`. But the checked-in schema
    ([`20260329000000_v2_clean_schema.sql:186-197`](../../supabase/migrations/20260329000000_v2_clean_schema.sql),
    moved to the `ops` schema by `20260409000000`) defines `tavily_searches` with
    `id, search_id, api_type, query_text, response_status, results_count,
    request_duration_ms, credits_used, error_message, created_at` — **no `user_id`
    and no `response_payload`**, and no later migration adds them. So against the
    checked-in schema these inserts fail on the unknown columns and, being wrapped
    in swallowing try/catch, persist nothing.
  - Risk: two-horned. Either (a) Tavily op-logging silently fails in production
    (cost/analytics gap, a reliability bug), **or** (b) the production schema has
    drifted to add those columns, in which case `query_text: request.query`
    persists the raw note-derived query (interviewer/team names) to a queryable
    table — durable PII. The checked-in repo cannot tell which; both are worth
    closing. (The production-schema-drift class is already flagged broadly under
    PREPIO-173 / PREPIO-124.)
  - Recommended fix: reconcile the insert with the schema (add the columns via
    migration, or drop them from the insert), and when doing so store the query
    `source`/hash rather than the raw string in `query_text`. Add a test asserting
    no free-text query reaches a DB writer.
  - Owner / next step: **could not file — Linear free-issue cap.** Record against
    `Bug`/`Chore` + `area:research-pipeline` (or fold into PREPIO-173's
    schema-drift reconciliation) when the cap clears. Schema + edge-function work,
    out of scope for a docs-only run.

### Low / clean-up

- [ ] **`npm audit` is 12 (3 moderate, 9 high) but every advisory is
  dev/build-time only — no production-bundle exposure.** *(New composition this
  window; the prior pdfjs/react-router items are resolved.)*
  - Evidence (dependency paths traced this run):
    - `undici` (9 highs: WebSocket/DoS/cache/TLS) ← `jsdom@29.1.1` ← **test DOM
      environment only** (vitest).
    - `braces` / `micromatch` / `chokidar` / `fast-glob` / `tailwindcss` /
      `tailwindcss-animate` (high) ← the **Tailwind 3 build toolchain** (fix is a
      SemVer-major `@tailwindcss/typography` downgrade; `tailwindcss-animate` has
      `fixAvailable:false`).
    - `fast-uri` (moderate) ← `vite-plugin-pwa → workbox-build → ajv` (**build-time**).
    - `brace-expansion` (high) ← `eslint` and `vite-plugin-pwa → workbox-build`
      (**dev/build-time**).
    - `@vitest/mocker` / `vitest` (moderate, path-traversal) ← **dev test runner**.
    None of these ship in the production browser bundle; the advisories are
    DoS/path-traversal against tooling that only runs in CI/dev/test.
  - Attempted this run: `npm audit fix --package-lock-only --dry-run` aborts with
    `Cannot read properties of null (reading 'edgesOut')` — the documented npm
    resolver bug triggered by the `overrides` field (`esbuild: ^0.28.1`), same as
    the 2026-09-12 run. Working tree left clean; no change committed. Manual
    multi-package lockfile surgery for dev/build-time-only advisories is fragile
    and not warranted for a hygiene run.
  - Recommended fix: let Dependabot carry the bumps (its full-tree resolution is
    not subject to the local `--package-lock-only` crash), or a maintainer runs the
    fix outside this proxy sandbox. The Tailwind-chain highs specifically want a
    maintainer decision (the audit's suggested fix is a major downgrade, not an
    upgrade).

- [ ] **Nine `react-refresh/only-export-components` lint warnings (incl. the #338
  one).** *(Carried; cosmetic/DX. Unchanged this window.)*
  - Evidence: `npm run lint` reports 9 fast-refresh warnings, including the
    `hasQuestionInsightsContent` non-component export at
    [`QuestionInsightsPanel.tsx`](../../src/components/practice/QuestionInsightsPanel.tsx)
    from #338.
  - Risk: cosmetic / DX only — a Vite fast-refresh hint, not a correctness,
    security, or bundle issue. Lint is informational in CI.
  - Recommended fix: move non-component exports into small helper modules. A
    follow-up cleanup, not an in-run change on a docs-only PR.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates
    lint, typecheck, typecheck:functions, build, test, and (since #348) the
    Playwright landing smoke — not `npm audit`. Advisory response relies on
    Dependabot.
  - Recommended fix: an optional non-blocking `npm audit --audit-level=high` step.
    A CI-policy call for maintainers.

## Small fixes made in this run

- **None to product source — this is a docs-only run.** All five source-touching
  merges in the window were reviewed and found security-neutral-to-positive (four
  of them *closed* previously-open findings; see Summary). The only standing
  dependency candidate (`npm audit fix` for dev/build-time advisories) is blocked
  by the npm `edgesOut` resolver bug and is not worth manual lockfile surgery for
  tooling with no production exposure.
- Deliverables: this note + the [`docs/audits/README.md`](./README.md) index row.
- Attempted to file the `official_company` over-trust Medium in Linear (Quality &
  Maintenance, `Bug` + `area:research-pipeline`); **blocked by the free-issue
  cap** — recorded in full above instead.

## Deferred items

Tracked, Dependabot-surfaced, or cap-blocked this run:

- **PREPIO-145** (High/Urgent, Todo) — owner-attended Git-history purge of the
  production-CV screenshot blobs + PII/credential exposure review. Not verifiable
  from this shallow clone; verify in a full clone after the rewrite.
- **PREPIO-168** (Urgent, Todo) — rotate the exposed test-account credential in
  Git history + migrate the legacy Deno suite off live credentials. Same
  history-rewrite class as PREPIO-145.
- **PREPIO-124** (Urgent, Todo) — deploy the freeze backend manifest so the merged
  PREPIO-143 ownership fix (and the rest) actually reach production.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium) —
  **cap-blocked**; recorded in full above. File when the cap clears.
- **`tavily-client` → `ops.tavily_searches` code/migration mismatch** (Medium) —
  **cap-blocked**; recorded in full above. Relates to the PREPIO-173 schema-drift
  work.
- **npm advisories (12, all dev/build-time)** — Dependabot-carried; local fix
  blocked by the `edgesOut` bug. The Tailwind-3 chain needs a maintainer decision
  (suggested fix is a major downgrade).
- **PDF surface-lock (PREPIO-27/PREPIO-140)** — the `pdfjs-dist` advisory is now
  cleared by the 5→6 bump, but PDF upload is still live/guest-reachable; the
  surface-lock remains the freeze-scope item.
- **`react-refresh` lint warnings (×9)** — cosmetic/DX cleanup; not filed.
- **`npm audit` as a non-blocking CI step** — maintainer process call.

## Questions for product owner

- **Linear is still at its free-issue cap** (confirmed this run by a failed
  create), so the **two open research-pipeline Mediums** — the evidence-ledger
  `official_company` over-trust and the `tavily-client` → `ops.tavily_searches`
  code/migration mismatch — could not be filed and are recorded in full in this
  note instead. Same blocker on 2026-07-29 and 2026-09-12. Upgrading or clearing
  the cap would let hygiene findings live in Linear rather than only the audit
  trail. Not otherwise blocking: the carried High (PREPIO-145) and its sibling
  (PREPIO-168) have owners and active tracking, and the PREPIO-143 BOLA is now
  Done in code.

## Next review focus

1. **PREPIO-124 deploy.** The PREPIO-143 ownership fix (and the pdfjs/react-router
   advisory clears) are merged but **not deployed** — confirm the freeze manifest
   reaches production, then re-audit `company-research`, `job-analysis`, and
   `answer-feedback` for the same missing object-ownership check #337 added to
   `interview-research`.
2. **PREPIO-145 / PREPIO-168 Git-history purge** (highest residual risk) — verify,
   in a **full** clone, that the production-CV blobs and the exposed test-account
   credential are gone from all refs after the owner-attended rewrite.
3. **The two cap-blocked research-pipeline Mediums** — file once the Linear cap
   clears, then land: (a) the `official_company` registrable-label (PSL-aware) fix
   with adversarial subdomain tests, folding in the deferred `official_job`
   short-name follow-up and re-auditing the whole `classifyRetrievedSource` trust
   map; (b) the `tavily-client` ↔ `ops.tavily_searches` reconciliation (add or drop
   the `user_id`/`response_payload` columns; store a query hash/source, never the
   raw string), alongside the PREPIO-173 schema-drift work.
4. **Dependabot dependency wave** — the Tailwind-3 toolchain highs (a maintainer
   decision — the suggested fix is a major downgrade), the `jsdom`/`undici`
   test-only highs, and the `vitest`/`@vitest/mocker` dev advisory; all blocked
   locally by the `edgesOut` bug.
5. **Next source-touching merge** — re-run the full baseline against it and read
   the *merged* code, not commit messages, when assessing any security-relevant
   change.
