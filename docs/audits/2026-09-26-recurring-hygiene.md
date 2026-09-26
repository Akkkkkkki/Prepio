# Recurring hygiene review — 2026-09-26

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio.

**Headline: a healthy, remediation-heavy window.** Every source-touching merge
since the 2026-09-12 base (`e3a283b`) is security-neutral-to-positive, and three
findings that prior runs carried as open are now resolved at the repository level:

- **[PREPIO-143] `searchId` cross-tenant write (BOLA) — fixed (#337).** The
  carried High from 2026-08-12 landed. A new fail-closed ownership gate
  ([`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts))
  runs **synchronously before** the background research promise is constructed
  ([`interview-research/index.ts:1330–1344`](../../supabase/functions/interview-research/index.ts)),
  so it precedes every service-role (RLS-bypassing) write. Service callers are
  exempt (`authContext.kind === "service"`); a JWT user must match both the body
  `userId` (403 on mismatch) and own the persisted `searches` row
  (`select id … eq id … eq user_id … maybeSingle()`), with a missing row and a
  foreign-owned row returning an **identical 404** (no existence oracle) and a
  query error failing closed at 500. Covered by
  [`authorization.test.ts`](../../supabase/functions/interview-research/authorization.test.ts)
  (91 lines: owner allow, foreign-ID reject, service bypass, DB-error 500).
  **#351** followed up to restore the Edge Function typecheck ratchet the new
  file perturbed. Repo-level closure only — production remediation still tracks
  under PREPIO-124 (a repo merge does not repair production).
- **`pdfjs-dist` high advisory (GHSA-hq66-cqwq-w95j) — fixed (#350).**
  `package.json` now pins `~6.3.289` and `pdfjs-dist@6.3.289` is installed,
  clearing the carried Medium (arbitrary JS execution on opening a crafted PDF).
  #350 also **removed** the prior `isEvalSupported: false` defence-in-depth from
  [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) (and its test assertion):
  pdf.js 6 eliminated the `eval()`/`Function` codepath GHSA-hq66-cqwq-w95j
  exploited — the advisory's fix — so that option is no longer needed (see the
  in-code comment at `resumeUpload.ts:118–122`). The remaining surface is small
  and unchanged: the parser runs in an isolated worker
  (`GlobalWorkerOptions.workerSrc`), extracts text only, and never renders.
- **`react-router` two advisories (open-redirect + SSR-hydration) — fixed (#353,
  PREPIO-172).** `react-router-dom@7.18.4` is installed (manifest `^7.18.4`),
  clearing both carried Low advisories.

The window's remaining source merges are also non-regressing: **#354** (lock to
the invite-only frozen core) is a net **−1,017-line scope reduction** that removes
billing UI, file-upload, and voice controls — an attack-surface *reduction*, and
the cause of the ~45% bundle drop below; **#345** adds evidence-origin
short-name classification test coverage (tests only, cursor-authored); **#348**
makes the Playwright landing smoke a blocking CI gate (CI/DX hardening).

**Two carried research-pipeline Mediums remain open and code-verified this run**
(both are service-role edge-function changes, not validatable in this
proxy-limited environment where `typecheck:functions`/Deno cannot resolve remote
imports, and consistently deferred by prior runs): the evidence-ledger
`official_company` loose-`.includes()` attacker-subdomain over-trust, and the
`SEARCH_COMPLETE` console log still leaking raw note-derived query strings. The
`@vitest/mocker` dev-only moderate also persists (dev/test-only, no production
bundle exposure). **No product-source change was warranted this run** — the two
Mediums are out of scope for a docs-only hygiene run and unvalidatable here; the
note + the `docs/audits/README.md` index row are the deliverable.

Baselines (measured against HEAD `9d9b711`; deltas vs 2026-09-12):
lint **50** problems (**41** errors / 9 warnings) — **−2 errors** (fewer test
files carrying `@typescript-eslint/no-explicit-any` after the #354 scope
reduction; warnings flat). Typecheck **pass at baseline** (app **61**, node
**0**; −1 app error, same cause). Build **1,242.25 KiB** / **41** precache
entries — **down ~45%** from 2,280.54 KiB / 62 (the #354 freeze removed
billing/upload/voice code paths). Tests **467** passing / **55** files (up from
461 / 52 — the range's merges carried added coverage). `npm audit` **2**
moderate (down from 5) — only the dev-only `@vitest/mocker`/`vitest` advisory
remains; the `pdfjs-dist` high and both `react-router` advisories are cleared.

## Commands run

- `npm install`: **pass** (via SessionStart hook; 2 moderate advisories reported).
- `npm run lint`: **50 problems (41 errors, 9 warnings).** Informational in CI
  (not a gate). −2 errors vs 2026-09-12; the remaining errors are the pre-existing
  `@typescript-eslint/no-explicit-any` in tests/edge functions and the 9
  fast-refresh warnings. This run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the
  script reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under
  `$CI`). This run pushes no `supabase/functions` source; the range's
  edge-function merges (#337, #351) each passed the real CI `verify` gate at merge
  time (#351 exists precisely to restore the deno ratchet after #337).
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1,242.25 KiB**).
- `npm test`: **pass** (**55 files, 467 tests**), incl. the schema/design-token
  checks.
- `npm audit`: **2** moderate — both the `@vitest/mocker`/`vitest` dev-only
  advisory; no production-path advisory.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; the owner-attended history-purge
  slice. Re-verified still exposed this run.)*
  - Evidence: PR #342 replaced ten screenshots with placeholders in the working
    tree, but the pre-redaction blobs remain in history. The ten affected paths
    are now enumerated in
    [`docs/security/freeze-pii-paths.txt`](../../docs/security/freeze-pii-paths.txt)
    (added by #354). Confirmed still resolvable this run:
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` has both the redacted
    blob at `da47d9e` and the original **146,389-byte** blob at `5585fd4`
    retrievable via `git rev-parse 5585fd4:<path>`. **This is a public
    repository**, so those blobs are fetchable by anyone with the commit SHA.
    *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the paths in
    `freeze-pii-paths.txt` + coordinated force-push, preserving a backup ref off
    the public remote, plus the PR/comment exposure review the issue calls for. Do
    **not** run a history rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, assigned to owner). Tracked
    with a full remediation plan; the path manifest is now checked in. Out of scope
    for an unattended hygiene run (force-push history rewrite of a shared public
    repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12;
  re-verified open in the merged code this run. Outside PREPIO-144's `official_job`
  scope.)*
  - Evidence:
    [`evidence-ledger.ts:172–178`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust via `trustWeightFor`) when **any**
    `companyTokens(company)` entry is a substring of it (`.includes(token)`). So for
    company "Acme", a caller-supplied or search-surfaced role link
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`, which
    `.includes("acme")` → **`official_company`/high**. There is no
    registrable-domain / public-suffix / exact-label check — the code comment
    (lines 180–186) explicitly defers PSL-aware short-name/employer-domain matching
    as follow-up. #345 added short-name *test coverage* around this classifier but
    did not change the `.includes()` behavior.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Content-integrity, not cross-tenant read.
    Gating: the row must enter the ledger via the caller's own `roleLinks`
    (self-inflicted) or a Tavily result ranked for the company query. The
    now-closed `searchId` BOLA (PREPIO-143, #337) reduces the compounding cross-tenant
    concern the prior run flagged.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the
    ATS exact/suffix approach `isJobPosting` now uses; add adversarial tests that
    reject `company-token.attacker.example` subdomains, and verify legitimate
    employer domains (incl. short names and multi-label suffixes) still classify.
  - Owner / next step: **Linear intake is unavailable this session (the connector is
    unauthenticated here, and prior runs record the workspace at its free-issue
    cap).** Recorded in full here; file as `Bug` + `area:research-pipeline` (Quality
    & Maintenance), cross-linked to PREPIO-144, this audit, and the audit PR, when
    intake is available. A substantive service-role edge-function change, out of
    scope for a docs-only hygiene run and not Deno-validatable in this proxy-limited
    environment.

- [ ] **PII-in-logs: the `SEARCH_COMPLETE` console log still leaks raw
  note-derived query strings (PREPIO-179 follow-up).** *(Carried from 2026-09-12;
  re-verified open this run.)*
  - Evidence: in
    [`company-research/index.ts`](../../supabase/functions/company-research/index.ts),
    the per-search `SearchPayload` is built with `query: result.query` (line 248 —
    the raw Tavily query, which for `user-note-*`/contextual queries embeds
    note-derived interviewer/team names), those roll into `result.search_results`,
    and line 317 calls `logger?.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)`.
    The generic `SearchLogger.log`
    ([`_shared/logger.ts:37–58`](../../supabase/functions/_shared/logger.ts))
    routes the whole payload into `logEntry.metadata` (the operation name matches
    none of the INPUT/OUTPUT/RESULT branches) and `console.log`s it — it does
    **not** strip `query` (only `logTavilySearch` does, which #344 hardened). This
    path executes on every run. `logger.test.ts` covers only `logTavilySearch`,
    not this path. (The prior run also noted a second `ops.tavily_searches` DB-writer
    path attempting the same insert but inert against the checked-in schema; that
    code/migration mismatch is unchanged and still worth reconciling.)
  - Risk: the PII-in-logs class PREPIO-141 → PREPIO-179 set out to close is still
    live via the aggregate console log; interviewer/team-name exposure into
    edge-function logs.
  - Recommended fix: redact `query` from each `search_results[]` entry before the
    `SEARCH_COMPLETE` log (or log counts/sources only); add a test asserting no
    free-text query reaches the logger on this path; and separately reconcile the
    `searchTavily` → `ops.tavily_searches` insert with its schema
    (`user_id`/`response_payload` mismatch), redacting `query_text` when doing so.
  - Owner / next step: **reopen PREPIO-179 or file a follow-up** — blocked on Linear
    intake this session (see above); recorded in full here. A service-role
    edge-function change, out of scope for a docs-only hygiene run and not
    Deno-validatable in this environment.

### Low / clean-up

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9) — path traversal /
  arbitrary file read via redirect mock.** *(Carried; dev/test-only.)*
  - Evidence: `npm audit` reports `@vitest/mocker 2.1.0 - 4.1.10` moderate, via
    `vitest@4.1.9`. The fix is `vitest ≥ 4.1.11`, within the existing `^4.1.8`
    manifest range — a pure lockfile patch bump. Prior runs recorded that
    `npm update vitest --package-lock-only` aborts locally with the documented npm
    `edgesOut` resolver bug triggered by the `overrides` field; not re-attempted
    this run (dev-only advisory, no production-bundle exposure).
  - Recommended fix: let Dependabot's `vitest` bump carry it (full-tree resolution
    is not subject to the local `--package-lock-only` crash), or a maintainer runs
    it outside this proxy sandbox.

- [ ] **Lint is informational, not a CI gate; 41 errors / 9 warnings persist.**
  *(Observation, unchanged in kind.)*
  - Evidence: the errors are pre-existing `@typescript-eslint/no-explicit-any` in
    tests/edge functions; the 9 warnings are `react-refresh/only-export-components`
    fast-refresh hints. None are correctness/security/bundle issues. Count dropped
    −2 errors this window purely from the #354 scope reduction.
  - Recommended fix: none required for hygiene; a maintainer cleanup if desired.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged from prior runs.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates
    lint, typecheck, typecheck:functions, build, test, and (now, via #348) the
    Playwright landing smoke — not `npm audit`. Advisory response relies on
    Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **None.** Every source-touching merge in the window is security-neutral-to-positive
  (three prior findings resolved: PREPIO-143 BOLA #337, `pdfjs-dist` #350,
  `react-router` #353). The two carried research-pipeline Mediums are service-role
  edge-function changes, out of scope for a docs-only hygiene run and not
  Deno-validatable in this proxy-limited environment; the standing `vitest` patch is
  a dev-only advisory blocked by the npm `edgesOut` bug. The dated note and the
  `docs/audits/README.md` index row are this run's deliverable.

## Deferred items

Tracked, Dependabot-surfaced, or recorded here (Linear intake unavailable this
session):

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs (now enumerated in `docs/security/freeze-pii-paths.txt`) + PII/credential
  exposure review (High/Urgent, Todo). Working-tree slice done (#342); history
  remains exposed on the public repo.
- **PREPIO-124 deployment of the PREPIO-143 fix** — #337 closed the BOLA at the repo
  level; production remains unrepaired until deployed via the freeze runbook.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium,
  carried) — land the registrable-label (PSL-aware) fix with adversarial
  `company-token.attacker.example` tests; file in Linear (Quality & Maintenance,
  `Bug` + `area:research-pipeline`) when intake is available.
- **PREPIO-179 follow-up — the `SEARCH_COMPLETE` console log still leaks raw query
  strings** (Medium, carried) — redact `query` before the aggregate log, add a test,
  and reconcile the `ops.tavily_searches` insert schema mismatch. Reopen PREPIO-179
  or file a follow-up when intake is available.
- **`@vitest/mocker` `vitest ≥ 4.1.11`** (Low, dev-only) — let Dependabot carry it.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.

## Questions for product owner

- **Linear intake is unavailable to this session** (the connector is unauthenticated
  here; prior runs also record the workspace at its free-issue cap), so the two
  carried research-pipeline Mediums cannot be filed/reopened as issues — both are
  recorded in full in this note instead. Authorizing the Linear connector (or
  clearing the issue cap) would let hygiene findings be tracked in Linear rather than
  only in the audit trail. Not otherwise blocking: the one carried High (PREPIO-145)
  has an owner and a documented plan.

## Next review focus

1. **PREPIO-124 deployment of the PREPIO-143 fix.** #337 closed the `searchId` BOLA in
   the repo; verify it reaches production via the freeze runbook (a merge alone does
   not repair production). Then re-audit `company-research`, `job-analysis`, and
   `answer-feedback` for the same missing object-ownership check.
2. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV
   PII is still publicly fetchable from history. Track the owner-attended
   filter-repo/BFG + force-push against `freeze-pii-paths.txt` and verify the blobs
   are gone from all refs afterward.
3. **The two carried research-pipeline Mediums** — (a) evidence-ledger
   `official_company` over-trust: land the registrable-label (PSL-aware) fix + the
   deferred short-name/employer-domain follow-up with adversarial subdomain tests;
   (b) PREPIO-179 follow-up: redact `query` from the `SEARCH_COMPLETE` aggregate log
   and reconcile the `ops.tavily_searches` insert schema mismatch, with tests on each
   path. Both need a maintainer able to run the Deno `typecheck:functions` gate.
4. **Next source-touching merge.** Re-run the full baseline against it and read the
   *merged* code, not commit messages, when assessing a security fix.
</content>
</invoke>
