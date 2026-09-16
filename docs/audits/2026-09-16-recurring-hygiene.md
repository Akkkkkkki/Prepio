# Recurring hygiene review — 2026-09-16

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio.

**Range reviewed: `e3a283b..f9b0454` (HEAD), the window since run #27's base.** Four
merges landed, of which **one touches service source** (`supabase/functions/`,
excluding tests):

- **`security: enforce interview research search ownership` (#337, PREPIO-143)** —
  **the headline of this run, and run #27's #1 next-review-focus item: it merged.**
  This closes the long-carried High `searchId` BOLA. A new
  [`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  `authorizeSearch` gate now runs **synchronously in the `serve` handler before the
  background research promise is constructed**
  ([index.ts:1327–1349](../../supabase/functions/interview-research/index.ts)), so
  no service-role (RLS-bypassing) write starts until ownership is proven. The gate:
  (a) short-circuits `ok` for `kind === "service"` callers (trusted internal
  callers); (b) returns **403** when the body `userId` ≠ the JWT user, *without*
  querying; (c) selects `searches` filtered by **both** `id` **and**
  `user_id = authContext.userId` and returns an **identical 404** for a missing row
  and a foreign row (no ownership oracle); (d) **fails closed with 500** on a DB
  error. Well tested — [`authorization.test.ts`](../../supabase/functions/interview-research/authorization.test.ts)
  covers the owned/foreign/missing/mismatch/DB-error/service paths, asserts the
  foreign and missing responses are byte-identical, and asserts the mismatch and
  service paths never hit the DB. **Security-positive, no regression.** *Caveat: a
  repo merge does not repair production* — the fix is live only once
  `interview-research` is redeployed under [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)
  (see the freeze note in CLAUDE.md); recorded as a deploy carry-forward below.
- **`test: cover short-name evidence origin classification` (#345)** — **test-only.**
  Adds two `evidence-ledger.test.ts` cases: (1) company "GO" against
  `digital.go.jp/...` stays `market_heuristic`/low (the ≥3-char `companyTokens`
  filter drops the 2-char "GO", so no over-promotion via a multipart public suffix),
  and (2) the accented-name positive case ("L'Oréal" matches its ASCII `loreal`
  domain). **Does not change classification code** — `classifyRetrievedSource` still
  uses the loose `.includes()` company-token match, so the `official_company`
  attacker-subdomain over-trust Medium from run #27 **remains open** (see below; #345
  locks in the short-name and accented-positive behavior but not the attacker-subdomain
  rejection).
- **`ci: make Playwright landing smoke a blocking gate` (#348, PREPIO-135)** —
  **CI/DX-positive.** Wires the pre-existing deterministic `e2e/smoke.spec.ts`
  landing-shell check into `ci.yml` as a blocking step (it was defined but ran in no
  job — false confidence), scoped to a chromium-only install; also removed committed
  `.playwright-cli/` scratch artifacts and synced `docs/TESTING.md`. No product source,
  data flow, or access surface. Positive release-readiness guard for the freeze.
- **`docs(audits): record 2026-09-12 security and hygiene review` (#346)** — run #27's
  own note (docs), not re-reviewed.

**Sibling-function re-audit (run #27 next-focus #1): clean.** Run #27 asked to
re-audit `company-research`, `job-analysis`, and `answer-feedback` for the same
missing object-ownership check that PREPIO-143 fixed. **None share the BOLA:**

- [`company-research`](../../supabase/functions/company-research/index.ts) and
  [`job-analysis`](../../supabase/functions/job-analysis/index.ts) both gate on
  `ensureServiceCaller(authResult.context)` — they are **service-role-only**, not
  directly user-callable — and derive `userId` by selecting `user_id` from the
  `searches` row (`.select("user_id").eq("id", searchId)`) rather than trusting a
  body value. An end user cannot invoke them with a foreign `searchId`.
- [`answer-feedback`](../../supabase/functions/answer-feedback/index.ts) requires
  `context.kind === "user"`, passes `userId: authResult.context.userId` (the
  authenticated user, never body-supplied), and its handler returns **404
  `practice_answer_not_found`** when the answer's session belongs to another user —
  covered by `handler.test.ts` (the `user_id: "other-user"` case). Correctly scoped.

**Headline: the one source-touching merge (#337) is a well-tested, fail-closed fix
that closes the carried High `searchId` BOLA; the sibling re-audit found no
equivalent gap; no new secret, PII-in-logs, or access-control regression was
introduced this window.** No code change was warranted this run — the remaining
substantive findings (the `official_company` over-trust, the `SEARCH_COMPLETE` PII
leak) are service-source edge-function changes that cannot be validated with
`typecheck:functions` in this proxy-limited environment and are out of scope for a
docs-only hygiene run; the one dependency candidate (the dev-only `vitest` patch bump)
is still blocked by the npm `edgesOut` resolver bug (re-verified this run).

Baselines (measured against HEAD `f9b0454`; deltas vs 2026-09-12):
lint **52** problems (43 errors, 9 warnings; flat). Typecheck **pass at baseline**
(app tsc **62**, node **0**, flat). Build **2280.54 KiB** / 62 precache entries
(flat). Tests **467** passing / **53** files (up from 461/52 — the +6 tests / +1 file
are #337's `authorization.test.ts` and #345's two evidence cases). `npm audit` **5**
(4 moderate, 1 high) — all known-deferred, **no new advisory** this window.

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **52 problems (43 errors, 9 warnings).** Flat vs 2026-09-12. All
  pre-existing (`@typescript-eslint/no-explicit-any` in tests/edge functions; nine
  `react-refresh/only-export-components` fast-refresh warnings incl. the #338 one).
  Lint is informational in CI; this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **62**, node **0**. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). This run pushes
  no `supabase/functions` source. **Correction to the usual "passed CI at merge time"
  note: #337 did NOT — its `main` push run is `failure` on the deno ratchet (19 → 21),
  so `main`'s `verify` has been red since it landed. See the new High finding.**
- `npm run build`: **pass** (Vite + PWA, 62 precache entries, **2280.54 KiB**).
- `npm test`: **pass** (**53 files, 467 tests**), incl. the schema/design-token checks.
- `npm audit`: **5** (4 moderate, 1 high) — all carried/deferred; no new advisory since
  run #27.

## Findings

### Critical

- None.

### High

- [ ] **`main`'s `verify` CI gate is red repo-wide — the merged PREPIO-143 fix (#337)
  broke the `typecheck:functions` deno ratchet and merged anyway.** *(New this run;
  discovered via the CI failure on this PR's own `verify` run and confirmed against
  `main`'s push runs.)*
  - Evidence: `verify` runs the deno error-count ratchet
    ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh),
    `BASELINE=19`); HEAD reports **21 errors**. The two over baseline are both in #337's
    `authorizeSearch` call:
    [`interview-research/index.ts:1333`](../../supabase/functions/interview-research/index.ts)
    (`TS2589` — type instantiation excessively deep) and `:1334` (`TS2345` — the
    service-role `SupabaseClient` is not assignable to the `SearchOwnershipClient`
    parameter, because the real supabase-js `.maybeSingle()` returns a `PostgrestBuilder`
    thenable, not a `Promise`, so it lacks `catch`/`finally`/`Symbol.toStringTag`). This
    code is on `main` (17e5b08), so the ratchet fails identically on the base branch —
    confirmed via the GitHub Actions API: the `main` push runs for **17e5b08 (#337) and
    f9b0454 (#346) are both `failure`**, while 4598c89/9987fc1/e3a283b before them are
    `success`. So `main`'s `verify` has been **red since #337 landed** — #337 raised the
    deno count 19 → 21 and merged red. *(Note: prior audits, incl. this one's own initial
    draft, recorded `typecheck:functions` as "not runnable in this environment / passed CI
    at merge time" — the proxy blocks deno's remote imports so the hygiene env can't run
    it, which is exactly why this regression was invisible to the review until a live CI
    run surfaced it. Lesson: check the base branch's actual CI conclusion via the API, not
    just the local skip.)*
  - Risk: every PR branched off `main` (including this docs-only one) inherits a red
    `verify`; the blocking gate is effectively down until #337's typing is fixed, and the
    next genuine edge-function regression could ride in unnoticed behind the existing red.
  - Recommended fix: a **one-line cast at the call site**, mirroring the existing
    `answer-feedback/index.ts:123` pattern (`supabase as unknown as SupabaseLike`):
    `authorizeSearch(supabase as unknown as SearchOwnershipClient, …)`. That clears both
    TS2345 and the TS2589 cascade and restores the count to baseline 19, without weakening
    the gate or its tests. Must land in a **dedicated edge-function PR** and be validated
    with `typecheck:functions` in an env with `esm.sh`/`deno.land` egress — **not** in this
    docs-only note (widening) and **not** from the hygiene env (can't validate deno here).
  - Owner / next step: posted the diagnosis + proposed patch as a top-level comment on
    **PR #349** (drive-to-green: base-inherited failure, no fix PR exists yet, deterministic
    so no re-run). Needs a maintainer to land the one-liner. File as `Bug` +
    `area:research-pipeline` / `area:infra` when the Linear cap clears; cross-link PREPIO-143
    and #337.

- [ ] **Production CV PII is still recoverable from Git history despite the working-tree
  redaction (PREPIO-145).** *(Carried; the owner-attended history-purge slice.
  Re-verified still exposed this run.)*
  - Evidence: PR #342 replaced ten screenshots with placeholders in the working tree,
    but the pre-redaction blobs remain in history. Re-confirmed against the object
    store this run: `docs/audits/assets/2026-07-09/11-d-new-interview.png` still has two
    versions — the redacted **23,025-byte** blob at `da47d9e` and the original
    **146,389-byte** blob at `5585fd4`, still resolvable via
    `git cat-file -s 5585fd4:<path>`. The nine other paths listed in #342 (full name,
    phone, email, LinkedIn, location, CV filename) are the same shape. **This is a
    public repository**, so those blobs are retrievable by anyone with the commit SHA.
    *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten; a
    freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified blobs
    + coordinated force-push, preserving a backup ref off the public remote, plus the
    PR/comment exposure review the issue calls for. Do **not** run a history rewrite
    unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, assigned to owner). Already tracked
    with a full remediation plan; no new issue filed. Out of scope for an unattended
    hygiene run (force-push history rewrite of a shared public repo).

- [x] **`interview-research` `searchId` cross-tenant write (BOLA) — FIXED IN REPO by
  #337 (PREPIO-143).** *(Was the carried High from 2026-08-12; verified closed in the
  code this run. Now a deploy carry-forward, not an open code finding.)*
  - Evidence: `authorizeSearch`
    ([authorization.ts](../../supabase/functions/interview-research/authorization.ts))
    now runs before any service-role write
    ([index.ts:1327–1349](../../supabase/functions/interview-research/index.ts)) and
    fails closed; the old bare body-`userId` == JWT check inside
    `processInterviewResearch` was removed. Regression tests
    ([authorization.test.ts](../../supabase/functions/interview-research/authorization.test.ts))
    cover the owned/foreign/missing/mismatch/DB-error/service paths and assert the
    missing-vs-foreign responses are identical. Re-read the *merged* code (not just the
    commit message) per run #27's lesson: the gate is genuine and correctly placed.
  - Residual: **the fix is not live in production until `interview-research` is
    redeployed under PREPIO-124** — the backend is frozen and this function is on the
    core-five deploy manifest. A repo merge alone does not repair production.
  - Owner / next step: **PREPIO-124** (Urgent) — deploy `interview-research` (with the
    other four core functions + pending migrations) to make the fix live. Tracked;
    out of scope for a hygiene run.

### Medium

- [ ] **`pdfjs-dist` high-severity advisory (GHSA-hq66-cqwq-w95j) — arbitrary JS
  execution on opening a malicious PDF.** *(Carried; re-verified. Needs a 5 → 6 major.)*
  - Evidence: `npm audit` reports `pdfjs-dist >=5.6.83 <6.2.108` high; the app parses
    user-uploaded resumes client-side. Fix is `pdfjs-dist@6.3.289` (breaking). PDF
    upload is still live: [`Home.tsx`](../../src/pages/Home.tsx) accepts
    `application/pdf`/`.pdf` and calls `extractResumeText(file)` **before** the
    `if (!user)` check, so even a signed-out guest reaches the pdf.js parser; the
    PREPIO-27 surface-lock is still pending, not landed.
  - Risk: a crafted resume PDF could execute script in the parsing context. Live
    mitigations remain pdf.js worker isolation **and** `isEvalSupported: false` on the
    `getDocument` call ([`resumeUpload.ts:125`](../../src/lib/resumeUpload.ts)) — the
    parser extracts text only, never renders/scripts — but the upload path itself is
    reachable.
  - Recommended fix: bump behind a resume-upload regression check (PDF **and** DOCX);
    Dependabot surfaces the PR, needs a human to validate the major. Landing the
    PREPIO-27 PDF surface-lock removes the exposure in the interim.
  - Owner / next step: Deferred — dependency major, Dependabot-tracked; interim
    surface-lock tracked under PREPIO-27/PREPIO-140.

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from run #27; re-verified
  still open. #345 added tests but did **not** change the classification code.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    substring of it (`.includes(token)`). For company "Acme",
    `acme.attacker.example` normalizes to `acmeattackerexample`, which
    `.includes("acme")` → **`official_company`/high**. There is no
    registrable-domain / public-suffix / exact-label check — the code comment
    (lines 180–186) now explicitly defers PSL-aware short-name/employer-domain matching
    as follow-up. #345 covers the ≥3-char short-name case ("GO" → low) and the accented
    ASCII-domain **positive** case, but not the attacker-subdomain **rejection**, which
    is still permitted for names ≥3 chars (incl. the accented `oreal.attacker.example`
    case run #27 attributed to #340's NFKD folding).
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted
    as high-trust "official company" evidence in the grounded-evidence ledger, biasing
    generated prep. Content-integrity, not cross-tenant read. **The compounding with the
    `searchId` BOLA is now reduced** — #337 closes the cross-tenant write path in repo
    (deploy pending) — but the self-inflicted (`roleLinks`) and Tavily-ranked vectors
    remain.
  - Recommended fix: match the company against the host's **registrable label** (exact,
    PSL-aware) rather than `.includes()` on the whole host, mirroring the ATS
    exact/suffix approach `isJobPosting` now uses; add adversarial tests that reject
    `company-token.attacker.example` subdomains. Verify legitimate employer domains
    (incl. short names and multi-label suffixes) still classify correctly.
  - Owner / next step: **File as `Bug` + `area:research-pipeline` (Quality &
    Maintenance)** cross-linked to PREPIO-144, PREPIO-143, this audit, and PR #345 —
    **blocked again this run by the Linear free-issue cap** (recorded here in full).
    A substantive service-role edge-function change, out of scope for a docs-only
    hygiene run and not validatable in this proxy-limited environment.

- [ ] **PII-in-logs is only partially closed — the `SEARCH_COMPLETE` console log still
  leaks raw note-derived query strings (PREPIO-179 follow-up).** *(Carried from run #27;
  re-verified still present this run.)*
  - Evidence: in
    [`company-research/index.ts`](../../supabase/functions/company-research/index.ts),
    the `SearchPayload` built at line ~247 carries `query: result.query` (the raw Tavily
    query, which for `user-note-*`/contextual queries embeds note-derived
    interviewer/team names); those roll into `result.search_results`, and line ~317
    calls `logger.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)`. The generic
    `SearchLogger.log` ([`_shared/logger.ts`](../../supabase/functions/_shared/logger.ts))
    does **not** strip `query` (only `logTavilySearch`, redacted by #344, does) and
    `console.log`s the whole payload. This path executes on every company-research run —
    confirmed present in the current code. (The second `ops.tavily_searches` DB-writer
    path in `tavily-client.ts` remains inert against the checked-in schema — its
    `user_id`/`response_payload` columns don't exist — a code/migration mismatch, unless
    prod has drifted; unchanged from run #27.)
  - Risk: the PII-in-logs class PREPIO-141 → PREPIO-179 set out to close is still live
    via the aggregate console log. Same interviewer/team-name exposure into
    edge-function logs.
  - Recommended fix: redact `query` from each `search_results[]` entry before the
    `SEARCH_COMPLETE` log (or log counts/sources only); add a test asserting no
    free-text query reaches the logger on that path; separately reconcile the
    `searchTavily` → `ops.tavily_searches` insert with the checked-in schema.
  - Owner / next step: **reopen PREPIO-179** (its #344 fix is partial) or file a
    follow-up — **blocked this run by the Linear free-issue cap**, recorded here in full.
    A service-source change, out of scope for a docs-only hygiene run and not validatable
    in this proxy-limited environment.

### Low / clean-up

- [ ] **`react-refresh/only-export-components` lint warning from #338.** *(Carried from
  run #27; unchanged — still 9 warnings.)*
  - Evidence: #338 added `export const hasQuestionInsightsContent` (a non-component
    export) to
    [`QuestionInsightsPanel.tsx:53`](../../src/components/practice/QuestionInsightsPanel.tsx),
    which also exports its component — the rule warns because mixing the two breaks Vite
    fast refresh.
  - Risk: **cosmetic / DX only.** Lint is informational in CI (not a gate).
  - Recommended fix: move `hasQuestionInsightsContent` into a small helper module and
    import it back. A ~2–3-file move; out of scope for a docs-only run.

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9).** *(Carried; the fix is
    in range but still blocked by the npm resolver bug — re-verified this run.)*
  - Evidence: `@vitest/mocker 2.1.0 - 4.1.10` moderate; installed `vitest@4.1.9`. The
    fix (`vitest ≥ 4.1.11`) is within the existing `^4.1.8` manifest range, so it should
    be a pure lockfile patch bump.
  - Attempted this run: `npm update vitest @vitest/mocker --package-lock-only` again
    aborts with `Cannot read properties of null (reading 'edgesOut')` — the documented
    npm resolver bug triggered by the `overrides` field. Working tree left clean; no
    change committed. Not worth manual multi-package lockfile surgery for a **dev/test-only**
    advisory with no production-bundle exposure.
  - Recommended fix: let Dependabot's `vitest` bump carry it (its full-tree resolution
    isn't subject to the local `--package-lock-only` crash), or a maintainer runs it
    outside this proxy sandbox.

- [ ] **`react-router` two advisories (open-redirect + SSR-hydration constructor
  injection) — needs the v7 major.** *(Carried; re-verified. SSR one does not apply to
  this CSR-only SPA.)*
  - Evidence: `react-router 6.0.0 - 7.17.0`; fix is now `react-router-dom@7.18.4`
    (breaking). Prepio ships a client-only `BrowserRouter`
    ([`src/App.tsx`](../../src/App.tsx)), so the `deserializeErrors()` SSR-hydration path
    (GHSA-337j-9hxr-rhxg) is not reachable; the open-redirect (GHSA-wrjc-x8rr-h8h6) is
    the live concern.
  - Owner / next step: Deferred — Dependabot-tracked v7 major; needs routing/redirect
    regression validation.

- [ ] **`npm audit` is not a CI gate.** *(Observation, not filed — unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, test, and now the Playwright landing smoke
    (#348) — not `npm audit`. Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **Posted a drive-to-green diagnosis comment on PR #349** after its own `verify` run
  went red: established the failure is base-inherited (`main`'s deno ratchet red since
  #337), gave the exact one-line proposed patch, and explained why it lands in a dedicated
  edge-function PR rather than this docs-only note (see the new High above). No code push —
  the fix can't be validated with `typecheck:functions` in this proxy-limited env.
- **No source fix.** The one source-touching merge (#337) is a security-positive BOLA fix
  whose *runtime* behavior is sound and well-tested; its only defect is the compile-time
  typing regression recorded as the new High. The sibling re-audit found no equivalent gap. The remaining
  substantive findings (`official_company` over-trust, `SEARCH_COMPLETE` PII leak) are
  service-source edge-function changes not validatable with `typecheck:functions` in this
  proxy-limited environment and out of scope for a docs-only hygiene run. The only
  standing dependency candidate (the `vitest` patch bump) is still blocked by the npm
  `edgesOut` resolver bug (re-verified). This note + the `docs/audits/README.md` index
  row are the deliverable.

## Deferred items

Tracked, Dependabot-surfaced, or blocked-on-intake:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot blobs
  + PII/credential exposure review (High/Urgent, Todo). Working-tree slice done (#342);
  history remains exposed on the public repo (re-verified this run).
- **PREPIO-124** — deploy `interview-research` (core-five manifest + pending migrations)
  so the merged #337 BOLA fix becomes live in production. A repo merge alone does not
  repair the frozen backend.
- **`pdfjs-dist` 5 → 6 major** (Medium) and **`react-router` v7 major** (Low, two
  advisories) — Dependabot-surfaced breaking bumps needing human validation of the
  resume-upload (PDF+DOCX) and routing/redirect surfaces.
- **`vitest` ≥ 4.1.11 for the `@vitest/mocker` advisory** (Low, dev-only) — blocked
  locally by the npm `edgesOut` bug; let Dependabot carry it.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium, carried
  from run #27) — `classifyRetrievedSource` matches company tokens with a loose
  `.includes()` on the whole host; #345 added tests but not the fix. **Still could not
  file the Linear issue — the workspace is at its free-issue cap** (to be filed against
  Quality & Maintenance, cross-linked to PREPIO-144/143 and PR #345, when the cap clears).
- **PREPIO-179 follow-up — the `SEARCH_COMPLETE` console log still leaks raw query
  strings** (Medium, carried) — the #344 redaction is partial. **Reopen PREPIO-179 or
  file a follow-up — blocked this run by the Linear free-issue cap**; recorded in full
  above.
- **`#338` `react-refresh/only-export-components` lint warning** (Low, cosmetic/DX) —
  move `hasQuestionInsightsContent` to a helper module; noted for a follow-up cleanup.
- **PDF surface-lock (PREPIO-27/PREPIO-140)** — landing it removes the live `pdfjs-dist`
  exposure in the interim before the 5 → 6 major; already tracked.

## Questions for product owner

- **Linear is still at its free-issue cap**, so the **two carried Medium findings**
  (the evidence-ledger `official_company` attacker-subdomain over-trust and the
  PREPIO-179 `SEARCH_COMPLETE` PII-in-logs follow-up) again could not be filed — both
  are recorded in full in this note. The same intake blocker has been noted since
  2026-07-29. Upgrading or clearing the cap would let hygiene findings be tracked in
  Linear rather than only in the audit trail. Not otherwise blocking: the one remaining
  open High (PREPIO-145) has an owner and active tracking, and the previously-carried
  PREPIO-143 High is now fixed in repo (deploy pending under PREPIO-124).

## Next review focus

0. **Restore `main`'s `verify` gate (highest priority).** Land the one-line
   `authorizeSearch(supabase as unknown as SearchOwnershipClient, …)` cast in a dedicated
   edge-function PR, validated with `typecheck:functions` in an env with `esm.sh` egress, to
   bring the deno ratchet back to baseline 19. Until then every PR's `verify` is red. Then
   confirm the ratchet is enforced as a genuine merge blocker — #337 merged red, so the gate
   was clearly not blocking at merge time.
1. **PREPIO-124 deploy of the #337 fix.** The BOLA fix is merged but the backend is
   frozen — confirm `interview-research` (and the rest of the core-five manifest +
   pending migrations) actually deploys so the ownership gate becomes live in
   production. A repo merge alone does not repair prod.
2. **PREPIO-145 Git-history purge** — now the highest-residual-risk open item, since
   PREPIO-143 is fixed in repo: real CV PII is still publicly fetchable from history
   (`5585fd4` blob re-verified this run). Track the owner-attended filter-repo/BFG +
   force-push and verify the identified blobs are gone from all refs afterward.
3. **Two carried research-pipeline Mediums (file once the Linear cap clears).**
   (a) Evidence-ledger `official_company` over-trust — land the registrable-label
   (PSL-aware) fix with adversarial `company-token.attacker.example` tests (building on
   #345's coverage), fold in the deferred `official_job` short-name/employer-domain
   follow-up, and re-audit the whole `classifyRetrievedSource` trust map. (b) PREPIO-179
   follow-up — redact `query` from the `SEARCH_COMPLETE` aggregate log, reconcile the
   `searchTavily` → `ops.tavily_searches` insert with the checked-in schema, and audit
   every generic `logger.log` payload / DB writer carrying `query`, with tests on each
   path.
4. **`pdfjs-dist` 6 / `react-router` v7 / `vitest` ≥ 4.1.11 Dependabot PRs, and the
   PREPIO-27 PDF surface-lock.** PDF upload is live and reaches the vulnerable parser
   (guests included), so landing the surface-lock is the interim mitigation; validate
   the resume-upload and routing/redirect surfaces so the majors can land instead of
   accumulating.
5. **Next source-touching merge.** Re-run the full baseline against it rather than
   re-verifying carried findings — and read the *merged* code, not just commit messages,
   when assessing a security fix.
