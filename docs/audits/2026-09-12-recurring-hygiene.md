# Recurring hygiene review — 2026-09-12

## Summary

Twenty-seventh recurring codebase hygiene & security review for Prepio.

**Coverage note — the full range is broader than one merge (corrected after Codex
review of this PR).** Run #26 (2026-09-09) explicitly *measured* against base
`132816b` — which is the **2026-09-03 UX-review-routine doc (#334)**, not run #26's
own note commit. Run #26 only reviewed the source merges that had landed at or
before `132816b`. Its note PR (#343, `9d18206`) was branched from `132816b`, so the
merges that landed on `main` *between* `132816b` and `9d18206` were reviewed by
**neither** run #26 nor an earlier draft of this note. `git log 132816b..e3a283b`
therefore contains **eight commits**, of which **five touch source** (`src/` or
`supabase/functions/`, excluding tests): #335, #344, #340, #338, #336 (plus #332,
scripts-only, and #342, docs/assets, reviewed as the PREPIO-145 High below; #343 is
run #26's own note). **All five source-touching merges were reviewed this run** —
each is security-neutral-to-positive:

- **`fix: redact model content from JSON parser failure logs` (#335)** — clean,
  well-tested **security improvement**. `parseJsonResponse`
  ([`_shared/openai-client.ts:88`](../../supabase/functions/_shared/openai-client.ts))
  previously logged a 500-char preview of the raw model output **and** the
  `JSON.parse` exception message on a parse failure. Model output for the
  `cv-analysis` / `answer-feedback` / `profile-import` callers can echo user PII
  (CV text, answers, imported profile), and parse-error messages can quote the
  offending substring — so both were PII channels into edge-function logs. The
  catch block now emits structural metadata only (`{ contentType, contentLength }`),
  never a preview or the exception. Covered by
  [`openai-client.test.ts`](../../supabase/functions/_shared/openai-client.test.ts),
  which asserts `console.error` fires exactly once with metadata only and that a
  PII email in the raw content never reaches the logged calls. No query,
  data-access, or auth behavior changed. **Closes the same PII-in-logs class the
  PREPIO-141/179 work targeted, for the JSON-parser path.**
- **[PREPIO-179] Redact raw Tavily query strings from per-search discovery logs
  (#344)** — **security-positive**, and the exact "next review focus" item run #26
  left open. All five per-search discovery log sites in
  [`company-research/index.ts`](../../supabase/functions/company-research/index.ts)
  now emit the query's `source` label + position (`index`/`total`/`roleFamily`)
  instead of the raw `query.query` (which embeds note-derived interviewer/team
  names); the shared `SearchLogger.logTavilySearch`
  ([`_shared/logger.ts`](../../supabase/functions/_shared/logger.ts)) also strips
  `query` from `requestPayload` before logging via non-mutating rest-destructure,
  closing the second leak path. Tested in `_shared/logger.test.ts` (no free-text
  query reaches the logger on success or error; source label still logged; caller
  request not mutated). **Correction (after Codex review of this PR): this does NOT
  fully close the run #26 PII-in-logs Medium.** #344 redacted the five direct
  per-search sites and `logTavilySearch`, but the aggregate
  `logger.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)` at
  [`company-research/index.ts:317`](../../supabase/functions/company-research/index.ts)
  still logs the full `result`, whose `search_results[].query` retains the raw Tavily
  query string (`SearchPayload.query = result.query`, index.ts:248 — embeds the
  note-derived interviewer/team names). The generic `SearchLogger.log`
  ([`_shared/logger.ts`](../../supabase/functions/_shared/logger.ts)) does **not**
  strip `query` (only `logTavilySearch` does) and `console.log`s the whole payload,
  so the names still reach edge-function logs. Recorded as an **open Medium** below;
  PREPIO-179's redaction is partial, not complete.
- **[PREPIO-144] Classify retrieved job rows by origin, not pipeline channel
  (#340)** — **security-positive** for the scope PREPIO-144 actually covered.
  In [`interview-research/evidence-ledger.ts`](../../supabase/functions/interview-research/evidence-ledger.ts)
  it removed the blanket `forcedSourceType` that granted every caller-supplied
  `roleLink` row `official_job`/high trust, and hardened `isJobPosting` so
  `official_job` is granted **only** for known-ATS hosts (exact host or subdomain
  of `greenhouse.io`/`lever.co`/`myworkdayjobs.com`/`smartrecruiters.com`), with a
  regression test proving `jobs.attacker.example` stays `market_heuristic`/low.
  That closes PREPIO-144 as scoped (the `official_job` blanket over-trust).
  **Correction (after Codex review of this PR):** the merged code does *not* contain
  the "exact registrable-label / public-suffix / NFKD / lookalike-subdomain"
  matching an earlier draft of this bullet described — those appear only in the PR's
  intermediate commit messages, not the final `classifyRetrievedSource`, which still
  matches company tokens with a loose `.includes()` on the whole normalized host and
  a comment deferring PSL-aware matching as follow-up. So a **separate, pre-existing**
  over-trust on the `official_company` branch remains open — recorded as a new Medium
  finding below (not a #340 regression; #340 did not touch that branch).
- **[PREPIO-176] Hide the practice coach panel when a question has no guidance
  (#338)** — UI-only conditional render in
  [`Practice.tsx`](../../src/pages/Practice.tsx) / `QuestionInsightsPanel` /
  `MobileCoachModal`, well test-covered (+ answer-guide tests). No data flow, PII,
  or access surface. **One minor cosmetic regression:** its new exported
  `hasQuestionInsightsContent` helper adds a `react-refresh/only-export-components`
  lint warning (informational, non-blocking) — recorded as the Low finding below.
- **[PREPIO-175] Remove forbidden rounded-3xl tokens from the route skeleton
  (#336)** — design-token cleanup in [`App.tsx`](../../src/App.tsx) + a
  `check-design-tokens.sh` guard. Cosmetic; no security/data surface.
- **[PREPIO-169] Harden check-deno-baseline.sh against masked hard failures (#332)**
  — CI/DX hardening of the Deno typecheck wrapper (scripts-only, + a test).
  Reduces the risk of a masked hard failure in the `verify` gate; positive.
- **[PREPIO-145] Redact production CV PII from historical audit screenshots
  (working-tree slice) (#342)** — reviewed as the High finding below (working-tree
  redaction landed; the owner-attended Git-history purge is still pending).

**Headline: all five source-touching merges in the range are
security-neutral-to-positive, and none introduced a new secret, PII-in-logs, or
access-control regression.** Adversarial Codex review of this audit PR was, however,
unusually productive: it corrected **four** over-claims in an initial draft of this
note and surfaced two **pre-existing** Mediums the draft had described as closed —
(1) the evidence-ledger `official_company` attacker-subdomain over-trust, which #340
did not touch, and (2) an **incomplete PREPIO-179 redaction**: raw note-derived query
strings still reach both the `SEARCH_COMPLETE` console log and — more durably — the
persistent `ops.tavily_searches` DB table. Both are now recorded accurately below. **No code change was warranted this run** — the one small
dependency candidate (a `vitest` patch bump for the dev-only `@vitest/mocker`
advisory) is blocked by the known npm `edgesOut` resolver bug and is not worth manual
lockfile surgery, and the substantive findings (`official_company` over-trust, the
`SEARCH_COMPLETE` PII leak, the live PDF surface) are service-source changes out of
scope for a docs-only hygiene run.

Baselines (measured against HEAD `e3a283b`; deltas vs 2026-09-09):
lint **52** problems (43 errors, **9** warnings; **the +1 warning is a new
regression from #338**, not pre-existing — see the Low finding below).
Typecheck **pass at baseline** (app tsc **62**, node **0**, flat). Build
**2280.54 KiB** / 62 precache entries (+0.18 KiB, browserslist-data drift,
immaterial). Tests **461** passing / **52** files (up from 431/48 — the
source merges since run #26's base carried added coverage). `npm audit` **5**
(4 moderate, 1 high) — all known-deferred majors, **no new advisories** this
window.

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **52 problems (43 errors, 9 warnings).** +1 warning vs
  2026-09-09 — a **new `react-refresh/only-export-components` warning from #338**
  (`QuestionInsightsPanel.tsx:53`, the exported `hasQuestionInsightsContent`
  helper), not pre-existing; the 43 errors and the other 8 warnings are unchanged
  and pre-existing (`@typescript-eslint/no-explicit-any` in tests/edge functions,
  the eight prior fast-refresh warnings). Lint is informational in CI; this run
  pushes no source. See the Low finding below.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **62**, node **0**. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the
  script reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under
  `$CI`). This run pushes no new `supabase/functions` source; the range's
  edge-function merges (#335, #344) each passed the real CI `verify` gate at merge
  time (the #344 note records restoring the deno ratchet to baseline).
- `npm run build`: **pass** (Vite + PWA, 62 precache entries, **2280.54 KiB**).
- `npm test`: **pass** (**52 files, 461 tests**), incl. the schema/design-token
  checks.
- `npm audit`: **5** (4 moderate, 1 high) — all carried/deferred; no new
  advisory since run #26.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; the owner-attended history-purge
  slice. Verified still exposed this run.)*
  - Evidence: PR #342 replaced ten screenshots with placeholders in the working
    tree, but the pre-redaction blobs remain in history. Confirmed against the
    object store this run: `docs/audits/assets/2026-07-09/11-d-new-interview.png`
    has two versions — the redacted **23,025-byte** blob at `da47d9e` and the
    original **146,389-byte** blob at `5585fd4` still resolvable via
    `git rev-parse 5585fd4:<path>`. The nine other paths listed in #342 (full
    name, phone, email, LinkedIn, location, CV filename) are the same shape.
    **This is a public repository**, so those blobs are retrievable by anyone with
    the commit SHA. *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified
    blobs + coordinated force-push, preserving a backup ref off the public remote,
    plus the PR/comment exposure review the issue calls for. Do **not** run a
    history rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, assigned to owner). Already
    tracked with a full remediation plan; no new issue filed. Out of scope for an
    unattended hygiene run (force-push history rewrite of a shared public repo).

- [ ] **`interview-research` never verifies `searchId` ownership — cross-tenant
  write (BOLA) via the service-role client (PREPIO-143).** *(Carried from
  2026-08-12; re-verified still open in the code this run.)*
  - Evidence: the only identity check remains a bare body-`userId` == JWT-user
    comparison
    ([interview-research/index.ts:1096](../../supabase/functions/interview-research/index.ts));
    `searchId` (line 1085) is taken from the request and never checked against the
    caller before the service-role client (which bypasses RLS) writes `prep_plans`,
    `interview_stages`, `interview_questions`, and the `searches` status keyed off
    it.
  - Risk: a signed-in user supplying their own `userId` plus another tenant's
    `searchId` can drive writes against a search row they don't own (integrity /
    cross-tenant overwrite; not a read).
  - Recommended fix: fail-closed ownership check (`select id from searches where id
    = searchId and user_id = authContext.userId`, 404 on miss) before any write,
    with owner/foreign-ID regression tests.
  - Owner / next step: **PREPIO-143** (Urgent, In Progress) — **fix PR #337 is open
    and ready for review**, blocked on a GitHub CI approval gate, not on code. No
    new work needed from this run beyond confirming it lands; then deploy via
    PREPIO-124 (a repo merge alone does not repair production).

### Medium

- [ ] **`pdfjs-dist` high-severity advisory (GHSA-hq66-cqwq-w95j) — arbitrary JS
  execution on opening a malicious PDF.** *(Carried; re-verified. Needs a 5 → 6
  major.)*
  - Evidence: `npm audit` reports `pdfjs-dist >=5.6.83 <6.2.108` high; the app parses
    user-uploaded resumes client-side. Fix is `pdfjs-dist@6.3.289` (breaking).
  - Risk: a crafted resume PDF could execute script in the parsing context.
    **Correction (after Codex review of this PR): PDF upload is still live, so the
    surface is NOT reduced by the freeze as an earlier draft of this finding
    claimed.** [`Home.tsx`](../../src/pages/Home.tsx) accepts
    `ACCEPTED_RESUME_TYPES` (which includes `application/pdf` / `.pdf`) and calls
    `extractResumeText(file)` in `handleFileUpload` **before** the `if (!user)`
    check, so even a signed-out guest can reach the pdf.js parser; the surface-lock
    (disabling PDF upload) is still *pending* PREPIO-27/PREPIO-140, not landed. The
    live mitigations are pdf.js worker isolation **and** `isEvalSupported: false` on
    the `getDocument` call ([`resumeUpload.ts:125`](../../src/lib/resumeUpload.ts),
    the 2026-08-08 defense-in-depth hardening) — the parser extracts text only, never
    renders/scripts — but PDF upload itself is reachable.
  - Recommended fix: bump behind a resume-upload regression check (PDF **and**
    DOCX). Dependabot surfaces the PR; needs a human to validate the major. Landing
    the PREPIO-27 PDF surface-lock would remove the exposure in the interim.
  - Owner / next step: Deferred — dependency major, Dependabot-tracked; interim
    surface-lock tracked under PREPIO-27/PREPIO-140.

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(New this run; surfaced by Codex on
  this PR and code-verified. Pre-existing in `classifyRetrievedSource`; **not** a #340
  regression and outside PREPIO-144's `official_job` scope.)*
  - Evidence:
    [`evidence-ledger.ts:174–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust via `trustWeightFor`) when
    **any** `companyTokens(company)` entry is a substring of it
    (`.includes(token)`). `companyTokens` keeps ≥3-char words. So for company
    "Acme", a caller-supplied or search-surfaced role link
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`, which
    `.includes("acme")` → **`official_company`/high**. There is no
    registrable-domain / public-suffix / exact-label check (the code comment
    explicitly defers PSL-aware matching as follow-up).
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Gating: the row must enter the ledger via the
    caller's own `roleLinks` (self-inflicted) or via a Tavily result the attacker
    gets ranked for the company query. Same "unvalidated origin → over-trust" family
    as PREPIO-144, on the company branch instead of the job branch; **more serious
    combined with the open `searchId` BOLA (PREPIO-143)**, where high-trust attacker
    text could land in a victim's plan. Content-integrity, not cross-tenant read.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the
    ATS exact/suffix approach `isJobPosting` now uses; add adversarial tests that
    reject `company-token.attacker.example` subdomains. Verify legitimate employer
    domains (incl. short names and multi-label suffixes) still classify correctly.
  - Owner / next step: **Linear issue could not be filed — the workspace is at its
    free-issue cap** (the same intake blocker prior audits recorded, e.g. 2026-07-29).
    Recorded here in full; file as `Bug` + `area:research-pipeline` (Quality &
    Maintenance), cross-linked to PREPIO-144, PREPIO-143, this audit, and PR #346, as
    soon as the cap clears. A substantive service-role edge-function change, out of
    scope for a docs-only hygiene run and not validatable in this proxy-limited
    environment.

- [ ] **PII-in-logs is only partially closed — raw note-derived query strings still
  reach both the `SEARCH_COMPLETE` console log and a persistent DB table
  (PREPIO-179 follow-up).** *(New this run; surfaced by Codex on this PR across two
  rounds and code-verified. Same class as PREPIO-141/179, deeper — and now including
  durable storage, not just logs.)*
  - Evidence: PREPIO-179 (#344) redacted the five direct per-search log sites and
    `logTavilySearch`, but two other paths still write the raw query:
    - **Console/log store:** in
      [`company-research/index.ts`](../../supabase/functions/company-research/index.ts),
      line 248 builds `SearchPayload` with `query: result.query` (the raw Tavily
      query, which for `user-note-*`/contextual queries embeds note-derived
      interviewer/team names), line ~311 rolls those into `result.search_results`,
      and line 317 calls `logger.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)`. The
      generic `SearchLogger.log`
      ([`_shared/logger.ts`](../../supabase/functions/_shared/logger.ts)) does **not**
      strip `query` (only `logTavilySearch` does) and `console.log`s the whole payload.
    - **Persistent database (more durable than logs):** `searchTavily`
      ([`_shared/tavily-client.ts`](../../supabase/functions/_shared/tavily-client.ts),
      the success insert ~lines 93–104 and the error insert ~lines 170–180) writes
      `query_text: request.query` — the raw query — into the `ops.tavily_searches`
      operational table on **both** success and failure, and also stores the full
      `response_payload` (which echoes the query). This persists the interviewer/team
      names to a queryable table, not just transient logs.
    `logger.test.ts` covers only `logTavilySearch`, neither of these paths.
  - Risk: the exact PII-in-logs class PREPIO-141 → PREPIO-179 set out to close, still
    live via the aggregate console log **and** durably persisted in `ops.tavily_searches`.
    Same interviewer/team-name exposure; the DB writer is the more serious of the two
    because the data is retained and queryable, not ephemeral.
  - Recommended fix: (a) redact `query` from each `search_results[]` entry before the
    `SEARCH_COMPLETE` log; (b) stop persisting the raw query in
    `ops.tavily_searches.query_text` — store the query `source`/hash or a redacted
    form, and redact `response_payload.query` — on both the success and error inserts;
    (c) add tests asserting no free-text query reaches the logger or the DB writer.
    Audit any other generic `logger.log` site or DB writer carrying `query`.
  - Owner / next step: **reopen PREPIO-179** (its #344 fix is partial) or file a
    follow-up — **blocked this run by the Linear free-issue cap**, so recorded here in
    full. A service-role edge-function change, out of scope for a docs-only hygiene
    run and not validatable in this proxy-limited environment.

### Low / clean-up

- [ ] **New `react-refresh/only-export-components` lint warning from #338.** *(New
  this window; surfaced by Codex on this PR and code-verified. Lint delta was
  initially mis-attributed as pre-existing.)*
  - Evidence: #338 (PREPIO-176) added `export const hasQuestionInsightsContent` — a
    non-component export — to
    [`QuestionInsightsPanel.tsx:53`](../../src/components/practice/QuestionInsightsPanel.tsx),
    which itself exports the `QuestionInsightsPanel` component. ESLint's
    `react-refresh/only-export-components` rule warns because mixing a
    component and a plain function export in one file breaks Vite fast refresh.
    Confirmed: `npm run lint` now reports **9** of these warnings vs **8** at the
    2026-09-09 baseline, and the new one is at that file/line.
  - Risk: **cosmetic / DX only** — a fast-refresh hint, not a correctness, security,
    or bundle issue. Lint is informational in CI (not a gate), so it does not block.
  - Recommended fix: move `hasQuestionInsightsContent` (and any sibling non-component
    exports) into a small `questionInsights.ts` helper module and import it back,
    leaving `QuestionInsightsPanel.tsx` exporting only its component. A one-helper
    move touching ~2–3 files; **out of scope for this docs-only PR** (it would widen
    an audit-note PR into already-merged product source), so recorded here for a
    maintainer or a follow-up cleanup rather than remediated in-run.

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9) — path traversal /
  arbitrary file read via redirect mock.** *(Carried; a clean fix is now in range
  but blocked by the npm resolver bug.)*
  - Evidence: `@vitest/mocker 2.1.0 - 4.1.10` moderate; installed `vitest@4.1.9`
    (`@vitest/mocker@4.1.9`). The fix is `vitest ≥ 4.1.11`, which is **within the
    existing `^4.1.8` manifest range** — so this should now be a pure lockfile
    patch bump, not the awkward direct-dep situation run #26 hit.
  - Attempted this run: `npm update vitest --package-lock-only` (and the
    `vitest @vitest/mocker` pair) both abort with `Cannot read properties of null
    (reading 'edgesOut')` — the documented npm resolver bug triggered by the
    `overrides` field (`esbuild: ^0.28.1`). Working tree left clean; no change
    committed. Manual multi-package (`vitest`, `@vitest/mocker`, `@vitest/*`)
    lockfile surgery is fragile and not warranted for a **dev/test-only** advisory
    with no production-bundle exposure.
  - Recommended fix: let Dependabot's `vitest` bump carry it (its full-tree
    resolution isn't subject to the local `--package-lock-only` crash), or a
    maintainer runs it outside this proxy sandbox.

- [ ] **`react-router` two advisories (open-redirect + SSR-hydration constructor
  injection) — needs the v7 major.** *(Carried; re-verified. SSR one does not apply
  to this CSR-only SPA.)*
  - Evidence: `react-router 6.0.0 - 7.17.0`; fix is `react-router-dom@7.18.3`
    (breaking). Prepio ships a client-only `BrowserRouter`
    ([`src/App.tsx`](../../src/App.tsx)), so the `deserializeErrors()` SSR-hydration
    path (GHSA-337j-9hxr-rhxg) is not reachable; the open-redirect
    (GHSA-wrjc-x8rr-h8h6) is the live concern.
  - Owner / next step: Deferred — Dependabot-tracked v7 major; needs
    routing/redirect regression validation.

- [ ] **`npm audit` is not a CI gate.** *(Observation, not filed — unchanged from
  run #26.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates
    lint, typecheck, typecheck:functions, build, and test — not `npm audit`.
    Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step.
    A CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **The five source-touching merges in the range are all security-positive or
  security-neutral and already tested** (see Summary); none introduced a fix
  candidate. The only standing candidate (the `vitest` patch bump) is blocked by
  the npm `edgesOut` resolver bug and is a dev-only advisory not worth manual
  lockfile surgery.
- **This PR's own review corrections (post-Codex, four rounds):** rewrote the Summary
  to state the true `132816b..e3a283b` range and per-commit review outcome (was
  mis-scoped to a "single source-touching merge"); added the missing 2026-09-12 row
  to [`docs/audits/README.md`](./README.md); attributed the +1 lint warning to #338;
  and corrected three over-claims Codex code-verified — the `pdfjs-dist` finding (PDF
  upload is still live, surface-lock pending, not "disabled by the freeze"), the
  `#340`/PREPIO-144 bullet (the `official_company` loose-`.includes()` over-trust is
  not fixed; new Medium), and the PREPIO-179 bullet (the `SEARCH_COMPLETE` aggregate
  log still leaks raw query strings; PREPIO-179 partial, new Medium).
  Documentation-only; no product source touched.

## Deferred items

Tracked, Dependabot-surfaced, or filed this run:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + PII/credential exposure review (High/Urgent, Todo). Working-tree slice
  done (#342); history remains exposed on the public repo.
- **PREPIO-143** — `interview-research` `searchId` BOLA fix (High/Urgent, In
  Progress). PR #337 open; blocked on GitHub CI approval, then merge + deploy via
  PREPIO-124.
- **`pdfjs-dist` 5 → 6 major** (Medium) and **`react-router` v7 major** (Low, two
  advisories) — Dependabot-surfaced breaking bumps needing human validation of the
  resume-upload (PDF+DOCX) and routing/redirect surfaces.
- **`vitest` ≥ 4.1.11 for the `@vitest/mocker` advisory** (Low, dev-only) — blocked
  locally by the npm `edgesOut` bug; let Dependabot carry it.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium, new
  this run — Codex-surfaced) — `classifyRetrievedSource` matches company tokens with
  a loose `.includes()` on the whole host. **Could not file the Linear issue — the
  workspace is at its free-issue cap** (recorded in full in the finding above; to be
  filed against Quality & Maintenance, cross-linked to PREPIO-144/143 and PR #346,
  when the cap clears).
- **`#338` `react-refresh/only-export-components` lint warning** (Low, cosmetic/DX) —
  move `hasQuestionInsightsContent` to a helper module; noted for a follow-up
  cleanup, not filed.
- **PDF surface-lock (PREPIO-27/PREPIO-140)** — landing it would remove the live
  `pdfjs-dist` exposure in the interim before the 5 → 6 major; already tracked.
- **PREPIO-179 follow-up — raw query strings still leak via the `SEARCH_COMPLETE`
  console log and the persistent `ops.tavily_searches` DB table** (Medium, new this
  run — Codex-surfaced across two rounds). PREPIO-179's #344 redaction is partial; the
  DB writer (`query_text: request.query` on both success and error, plus
  `response_payload`) is the more durable exposure. **Reopen PREPIO-179 or file a
  follow-up — blocked this run by the Linear free-issue cap**; recorded in full above.

## Questions for product owner

- **Linear is at its free-issue cap**, so the **two new Medium findings** surfaced
  this run could not be filed — both are recorded in full in this note instead:
  (1) the evidence-ledger `official_company` attacker-subdomain over-trust, and
  (2) the PREPIO-179 follow-up (raw note-derived query strings still leak via the
  `SEARCH_COMPLETE` console log **and** the persistent `ops.tavily_searches` DB table
  — reopen PREPIO-179 or file a follow-up). The same
  intake blocker was noted on 2026-07-29. Upgrading or clearing the cap would let
  hygiene findings be tracked in Linear rather than only in the audit trail. Not
  otherwise blocking: both High findings have owners and active Linear tracking
  (PREPIO-143 open fix PR; PREPIO-145 documented owner-attended plan).

## Next review focus

1. **PREPIO-143 fix PR #337** — confirm it merges (once the CI approval gate clears)
   with the ownership check + cross-tenant-rejection test, then that it's deployed
   via PREPIO-124 (repo merge alone doesn't repair production). Re-audit
   `company-research`, `job-analysis`, and `answer-feedback` for the same
   missing object-ownership check.
2. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV
   PII is still publicly fetchable from history. Track the owner-attended
   filter-repo/BFG + force-push and verify the identified blobs are gone from all
   refs afterward.
3. **Two new research-pipeline Mediums (file once the Linear cap clears).**
   (a) Evidence-ledger `official_company` over-trust — land the registrable-label
   (PSL-aware) fix with adversarial `company-token.attacker.example` tests, fold in
   the deferred `official_job` short-name/employer-domain follow-up, and re-audit the
   whole `classifyRetrievedSource` trust map. (b) PREPIO-179 follow-up — redact
   `query` from the `SEARCH_COMPLETE` aggregate log **and** stop persisting
   `request.query` in `ops.tavily_searches.query_text`/`response_payload` (both the
   success and error inserts in `tavily-client.ts`); audit every generic `logger.log`
   payload and DB writer carrying `query`, with tests on both paths. Both compound
   with the open `searchId` BOLA (PREPIO-143).
4. **`pdfjs-dist` 6 / `react-router` v7 / `vitest` ≥ 4.1.11 Dependabot PRs, and the
   PREPIO-27 PDF surface-lock.** PDF upload is live and reaches the vulnerable parser
   (guests included), so landing the surface-lock is the interim mitigation; validate
   the resume-upload and routing/redirect surfaces so the majors can land instead of
   accumulating.
5. **Next source-touching merge.** Re-run the full baseline against it rather than
   re-verifying carried findings — and read the *merged* code, not just commit
   messages, when assessing a security fix (this run's lesson from the #340 over-claim).
