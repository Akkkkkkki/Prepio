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
  request not mutated). **Closes the run #26 PII-in-logs Medium.**
- **[PREPIO-144] Classify retrieved job rows by origin, not pipeline channel
  (#340)** — **security-positive** trust-boundary hardening in
  [`interview-research/evidence-ledger.ts`](../../supabase/functions/interview-research/evidence-ledger.ts).
  Removed a blanket `forcedSourceType` that granted every caller-supplied `roleLink`
  row `official_job`/high trust; classification is now per-row by hostname (known-ATS
  allowlist, exact registrable-label employer match with public-suffix stripping and
  NFKD folding, lookalike-subdomain safety). Went through multiple adversarial Codex
  rounds; unrelated/attacker-controlled URLs correctly fall to `market_heuristic`/low.
  This is the PREPIO-144 Low from the 2026-08-12 audit, now fixed.
- **[PREPIO-176] Hide the practice coach panel when a question has no guidance
  (#338)** — UI-only conditional render in
  [`Practice.tsx`](../../src/pages/Practice.tsx) / `QuestionInsightsPanel` /
  `MobileCoachModal`, well test-covered (+ answer-guide tests). No data flow, PII,
  or access surface.
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
security-neutral-to-positive, and no new secret, PII-in-logs, or access-control
regression was introduced. No code change was warranted this run** — the one small
candidate (a `vitest` patch bump for the dev-only `@vitest/mocker` advisory) is
blocked by the known npm `edgesOut` resolver bug and is not worth manual lockfile
surgery for a dev-only finding.

Baselines (measured against HEAD `e3a283b`; deltas vs 2026-09-09):
lint **52** problems (43 errors, **9** warnings; +1 warning, pre-existing).
Typecheck **pass at baseline** (app tsc **62**, node **0**, flat). Build
**2280.54 KiB** / 62 precache entries (+0.18 KiB, browserslist-data drift,
immaterial). Tests **461** passing / **52** files (up from 431/48 — the
source merges since run #26's base carried added coverage). `npm audit` **5**
(4 moderate, 1 high) — all known-deferred majors, **no new advisories** this
window.

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **52 problems (43 errors, 9 warnings).** +1 warning vs
  2026-09-09; all pre-existing (`@typescript-eslint/no-explicit-any` in
  tests/edge functions). Informational in CI; this run changed no source.
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
  - Risk: a crafted resume PDF could execute script in the parsing context;
    materially mitigated by pdf.js worker isolation. The freeze also disables PDF
    upload behind PREPIO-140 in the locked frontend, reducing live exposure.
  - Recommended fix: bump behind a resume-upload regression check (PDF **and**
    DOCX). Dependabot surfaces the PR; needs a human to validate the major.
  - Owner / next step: Deferred — dependency major, Dependabot-tracked.

### Low / clean-up

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
- **This PR's own review correction (post-Codex):** rewrote the Summary to state the
  true `132816b..e3a283b` range and per-commit review outcome (was mis-scoped to a
  "single source-touching merge"), and added the missing 2026-09-12 row to
  [`docs/audits/README.md`](./README.md). Documentation-only; no product source
  touched.

## Deferred items

Already tracked or explicitly noted-not-filed (no new Linear issue this run — every
open finding is already tracked or Dependabot-surfaced):

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

## Questions for product owner

- None blocking. Both High findings have owners and active Linear tracking
  (PREPIO-143 has an open fix PR; PREPIO-145 has a documented owner-attended
  remediation plan).

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
3. **`pdfjs-dist` 6 / `react-router` v7 / `vitest` ≥ 4.1.11 Dependabot PRs.** If
   open, validate the resume-upload and routing/redirect surfaces so the majors can
   land instead of accumulating.
4. **Next source-touching merge.** Re-run the full baseline against it rather than
   re-verifying carried findings — the posture that has kept each window's drift
   small.
