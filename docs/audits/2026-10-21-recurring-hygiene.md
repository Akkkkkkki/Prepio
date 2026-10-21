# Recurring hygiene review — 2026-10-21

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio.

**First window since the invite-only freeze landed, and it is a large, security-positive
one.** The review range is `f9b0454..origin/main` — the **11 merges after the
2026-09-12 note (#346)** — with the three merges that landed between the prior note's
base (`e3a283b`, #335) and the note itself (#337, #345, #348) confirmed in their
**merged** state this run rather than re-reviewed as the open PRs the last note saw them
as. The headline is that **two of the last run's top deferred items are now closed in
code and three deferred advisories are cleared**:

- **[PREPIO-143] `searchId` BOLA fix merged (#337, `17e5b08`) and verified intact.**
  The carried **High** from every run since 2026-08-12 is now closed in code.
  [`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  adds `authorizeSearch`, wired at
  [`interview-research/index.ts:1333`](../../supabase/functions/interview-research/index.ts)
  right after `authorizeRequest` (line 1313) and **before** any service-role write.
  It is fail-closed: service callers pass; a JWT user must match the body `userId`
  (**403** on mismatch) **and** own the persisted `searches` row
  (`.eq("id", searchId).eq("user_id", authContext.userId).maybeSingle()`), returning
  a deliberately indistinguishable **404** for an absent row or one owned by another
  tenant, and **500** on a lookup error. This is exactly the fix the last run
  recommended. #351 (`571c6e5`) later changed the helper's parameter type to `unknown`
  with an internal cast to the narrow `SearchOwnershipClient` seam — a documented
  TS2589 (Deno type-depth) workaround that does **not** weaken the runtime check.
  *Production is still unreconciled until the PREPIO-124 deploy; a repo merge alone does
  not repair production.*
- **The `SEARCH_COMPLETE` PII-in-logs leak (last run's open Medium) is closed (#360).**
  [`company-research/index.ts:321`](../../supabase/functions/company-research/index.ts)
  now logs `buildSearchCompleteLogPayload(result)` instead of the whole `result`. The
  new helper in
  [`result-aggregation.ts`](../../supabase/functions/company-research/result-aggregation.ts)
  emits **counts only** (`searchPayloads`, `searchResults`, `extractedContent`,
  `totalUrlsExtracted`) and carries no `query`, URL, or provider page text. This closes
  the confirmed leak path the 2026-09-12 note surfaced (raw note-derived interviewer/team
  names reaching the function logs through the un-redacting generic `logger.log`).
- **pdfjs-dist 5 → 6 (#350) and react-router-dom 6 → 7 (#353) both merged**, clearing
  the pdfjs high (GHSA-hq66-cqwq-w95j) and both react-router advisories — the two
  production-reachable deps the last several runs deferred to Dependabot. The current
  `npm audit` no longer lists either (see Commands).

**The freeze lock itself (#354, #360) is thorough and consistently gated.** It:

- Rejects **anonymous** Auth users at the shared boundary —
  [`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts) now fails closed on
  `data.user.is_anonymous`, satisfying the CLAUDE.md "Core provider functions reject
  anonymous Auth users" rule — and disables signup/anonymous sign-ins at the project
  level ([`supabase/config.toml`](../../supabase/config.toml):
  `enable_signup = false`, `enable_anonymous_sign_ins = false`).
- Centralises the client-side feature boundary in
  [`frozenProduct.ts`](../../src/lib/frozenProduct.ts) (`billing`/`answerFeedback`/
  `voice`/`profile`/`resumeUpload` all `false`, deliberately not env-overridable) and
  gates every excluded surface behind it:
  [`searchService.ts`](../../src/services/searchService.ts) (voice upload/transcribe,
  CV analysis, resume upload, profile import, answer feedback, and a no-op
  `createResearchPreview`), [`billing.ts`](../../src/services/billing.ts) (checkout +
  portal throw `billing_unavailable`), and the Home/Profile resume-upload inputs.
- Removes public signup from [`useAuth.ts`](../../src/hooks/useAuth.ts) and adds an
  honest expired/reused invite-and-reset-link path: it reads the link's own
  `access_token` at module load and only shows the set-password form when the current
  session's token matches it — otherwise it surfaces `EXPIRED_AUTH_LINK_MESSAGE` rather
  than a password form for whoever happens to be signed in. Good auth-UX hardening.
- Guards deployment with [`scripts/deploy-frozen-functions.mjs`](../../scripts/deploy-frozen-functions.mjs)
  (dry-run by default; validates every function name against
  [`freeze-functions.json`](../../supabase/freeze-functions.json); requires
  `PREPIO_DEPLOY_COMMIT` to equal the git HEAD SHA and refuses a dirty checkout before
  `--execute`).

**Reachability check for the one defence-in-depth reduction this window
introduced:** #350 **removed** the `isEvalSupported: false` option from the pdf.js
`getDocument` call in [`resumeUpload.ts`](../../src/lib/resumeUpload.ts), on the stated
grounds that pdf.js 6 removed the eval codepath the advisory exploited. I traced whether
the parser is reachable at all under the freeze: the Home.tsx resume inputs are gated
behind `FROZEN_PRODUCT.resumeUpload` (false), so they never render; and **Profile is not
routed** — [`App.tsx`](../../src/App.tsx) lazy-loads only Home/Interviews/Dashboard/
Practice/History/Auth/NotFound, with no `/profile` route, so `Profile.tsx`'s ungated file
input is unreachable (a stray `navigate("/profile")` in Home is itself inside a
`FROZEN_PRODUCT.profile` block and also never renders). **So there is no live
attacker-controlled path to the pdf.js parser in the frozen product** and the removal has
no current attack surface. It remains a **latent** defence-in-depth reduction recorded as
a Low below: re-add `isEvalSupported: false` (or independently confirm the pdf.js-6
eval-codepath claim) **before** resume upload is ever un-frozen.

**No product-source change was warranted this run.** All reviewed merges are
security-neutral-to-positive, the carried Highs are either closed-in-code (PREPIO-143)
or owner-attended (PREPIO-145), and the remaining findings are either dev/build-only
dependency advisories (blocked locally by the npm `edgesOut` resolver bug and deferred to
Dependabot per the freeze's "no routine dependency PRs" rule) or service-source changes
out of scope for a docs-only hygiene run. The note + its index row are the deliverable.

Baselines (measured against HEAD `a330939`; deltas vs 2026-09-12):
lint **49** problems (**40** errors, 9 warnings) — down 3 from 52 (the freeze removed
code, including the file that carried the #338 warning's siblings); **no regression**.
Typecheck **pass at baseline** (app tsc **61**, down 1 from 62; node **0**). Build
**1243.41 KiB** / 41 precache entries — **down ~46%** from 2280.54 KiB / 62 entries, the
freeze shrinking Home/Practice/Auth and dropping excluded surfaces. Tests **494**
passing / **58** files (up from 461/52; the freeze and its coverage commits added tests).
`npm audit` **19** (10 moderate, 9 high) — up from 5, but see the Medium below: the rise
is **new dev/build/test-only advisories (undici via jsdom, vite/launch-editor), none
production-reachable**, while the two production-reachable ones (pdfjs, react-router) were
cleared.

## Commands run

- `npm install`: **pass** (via SessionStart hook; 748 packages).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** Down 3 vs 2026-09-12
  (was 52). Errors are the unchanged pre-existing `@typescript-eslint/no-explicit-any`
  in tests/edge functions; warnings are the pre-existing `react-refresh` fast-refresh
  hints. Lint is informational in CI; this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (down 1 from 62, the freeze removing a typed surface),
  node **0**. Flat/under baseline.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). This run pushes
  no `supabase/functions` source; the window's edge-function merges (#337, #350, #360)
  each passed the real CI `verify` gate at merge time (#351 restored the deno ratchet to
  baseline after #337).
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1243.41 KiB**).
- `npm test`: **pass** (**58** files, **494** tests), incl. the legacy-schema,
  answer-feedback-schema, and design-token checks.
- `npm audit`: **19** (10 moderate, 9 high) — all dev/build/test-only (see Medium).
- `npm audit fix --package-lock-only --dry-run`: **crashes** with
  `Cannot read properties of null (reading 'edgesOut')` — the documented npm resolver
  bug triggered by the `overrides: { esbuild: "^0.28.1" }` field. Working tree left
  clean; no change committed. Even the non-breaking fixes cannot be applied locally;
  they are a Dependabot job.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the working-tree
  redaction (PREPIO-145).** *(Carried; owner-attended. Not re-fetched this run per the
  review's redaction rule, but no history rewrite has landed, so it remains exposed.)*
  - Evidence: PR #342 (2026-09-12 window) replaced ten screenshots with placeholders in
    the working tree, but the pre-redaction blobs remain in history (the last run
    resolved the original 146,389-byte blob of
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` at `5585fd4`). **This is a
    public repository**, so the blobs are retrievable by anyone with the commit SHA.
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue (and per
    [docs/FREEZE_RELEASE.md](../FREEZE_RELEASE.md)'s unreconciled-production note).
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified blobs
    + coordinated force-push, preserving a backup ref off the public remote, plus the
    PR/comment exposure review the issue calls for. **Do not run a history rewrite
    unattended.**
  - Owner / next step: **PREPIO-145** (Urgent, Todo, owner-assigned). Already tracked
    with a full remediation plan; out of scope for an unattended hygiene run
    (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12; re-verified
  unchanged in code this run. Not fixed by #340; outside PREPIO-144's `official_job`
  scope.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    still computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    substring of it (`normalizedHost.includes(token)`). So for company "Acme",
    `https://acme.attacker.example/job` → `acmeattackerexample`.includes("acme") →
    **`official_company`/high**. The code comment (line ~182) still explicitly defers
    PSL-aware registrable-label matching as follow-up. The #340 NFKD-folding widening for
    accented brand names (`"L'Oréal"` → `oreal` → `oreal.attacker.example` over-trusted)
    also still applies.
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted
    as high-trust "official company" evidence in the grounded-evidence ledger, biasing
    generated prep. Content-integrity, not cross-tenant read. The combined severity with
    the BOLA is **reduced now that PREPIO-143 is fixed in code** (the fix caps whose plan
    an attacker could influence), but it is not deploy-verified yet (PREPIO-124).
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting` already
    uses; add adversarial tests rejecting `company-token.attacker.example`. Verify
    legitimate employer domains (short names, multi-label suffixes) still classify.
  - Owner / next step: file as `Bug` + `area:research-pipeline` (Quality & Maintenance),
    cross-linked to PREPIO-144/PREPIO-143 and the 2026-09-12 note, **once the Linear
    free-issue cap clears** (the same intake blocker prior runs recorded). Recorded in
    full here meanwhile. A service-role edge-function change, out of scope for a docs-only
    hygiene run and not validatable in this proxy-limited environment.

- [ ] **`npm audit` rose 5 → 19, but every advisory is dev/build/test-only — none reach
  the production browser bundle.** *(New count this run; triaged by dependency path.)*
  - Evidence: `npm ls` + `npm audit --json` confirm **none** of the 19 are in
    `package.json` `dependencies` (production); they are all `devDependencies` or
    transitive beneath them:
    - **undici** (high, 8 CVEs) — transitive via `jsdom@29.1.1 → undici@7.29.0`; jsdom is
      vitest's test DOM environment. Not shipped.
    - **vite** 7.0.0–7.3.6 (high, launch-editor CVEs) — the build tool / dev server;
      the advisories are Windows-dev-server-only and never in a built artifact.
    - **vitest / @vitest/mocker** (moderate) — test runner (carried).
    - **tailwindcss / @tailwindcss/typography / tailwindcss-animate** (direct, build-time
      CSS tooling) and **mammoth** (DOCX resume parsing, now behind the frozen
      `resumeUpload` gate) — carried.
    - The two production-reachable advisories from prior runs (**pdfjs-dist** high,
      **react-router** moderate ×2) are **gone**, cleared by #350 and #353.
  - Risk: **no production runtime exposure.** The vite/undici advisories affect local dev
    and CI build/test only. The count increase is new-disclosure churn against in-tree
    tooling, not a new product risk.
  - Recommended fix: let Dependabot carry the non-breaking fixes (undici, vite patch,
    vitest, brace-expansion, fast-glob, fast-uri, postcss-nested, source-map-js) — its
    full-tree resolution is not subject to the local `--package-lock-only` `edgesOut`
    crash confirmed this run. The `tailwindcss`/`mammoth` fixes are SemVer-major (one a
    downgrade) and need human validation. No lockfile surgery warranted in a docs-only
    run under the freeze's "no routine dependency PRs" rule.
  - Owner / next step: Deferred — Dependabot-tracked. Optionally add a non-blocking
    `npm audit --audit-level=high` CI step (maintainer call; unchanged from prior runs).

### Low / clean-up

- [ ] **`isEvalSupported: false` defence-in-depth was removed from the pdf.js call
  (#350).** *(New this window; latent only — the parser is unreachable under the freeze,
  see Summary reachability check.)*
  - Evidence: [`resumeUpload.ts:115`](../../src/lib/resumeUpload.ts) `extractPdfText`
    previously passed `isEvalSupported: false` to `getDocument`; #350 removed it with a
    comment that pdf.js 6 removed the eval codepath GHSA-hq66-cqwq-w95j exploited. The
    resume-upload surface is fully frozen (`FROZEN_PRODUCT.resumeUpload = false` gates the
    Home inputs; Profile is not routed), so **no live path reaches the parser**.
  - Risk: **none while frozen.** Latent: if resume upload is un-frozen without re-adding
    the option (or verifying the pdf.js-6 claim), a crafted PDF could reach the eval
    codepath if the claim is imprecise. pdf.js still only extracts text here (no
    `page.render`, scripting off), which keeps the remaining surface small regardless.
  - Recommended fix: treat "re-add `isEvalSupported: false` or confirm the pdf.js-6
    eval-removal claim with an upstream citation" as a **precondition of un-freezing
    resume upload** (PREPIO-27/PREPIO-140). No action needed while frozen.

- [ ] **`react-refresh/only-export-components` lint warnings (9).** *(Carried;
  cosmetic/DX.)*
  - Evidence: the fast-refresh hints from mixing component and non-component exports in a
    file (incl. the #338 `hasQuestionInsightsContent` helper). Lint is informational in
    CI (not a gate).
  - Recommended fix: move non-component exports into sibling helper modules. Out of scope
    for a docs-only PR; noted for a follow-up cleanup.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, test, and now the Playwright landing smoke
    (#348) — not `npm audit`. Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers.

## Small fixes made in this run

- **None.** All reviewed merges are security-neutral-to-positive; the carried Highs are
  closed-in-code (PREPIO-143) or owner-attended (PREPIO-145); the remaining findings are
  dev/build-only dependency advisories (blocked locally by the `edgesOut` resolver bug,
  deferred to Dependabot per the freeze's "no routine dependency PRs" rule) or
  service-source/history-rewrite work out of scope for a docs-only hygiene run. The note
  and its `docs/audits/README.md` index row are the deliverable.

## Deferred items

Tracked, Dependabot-surfaced, or awaiting the Linear cap:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot blobs
  + PII/credential exposure review (High/Urgent, Todo). History remains exposed on the
  public repo.
- **PREPIO-124** — deploy the PREPIO-143 ownership fix (and the window's other edge
  changes) to production; the repo merge alone does not repair production.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium, carried)
  — land the PSL-aware registrable-label fix with adversarial
  `company-token.attacker.example` tests, folding in the deferred `official_job`
  short-name/employer-domain follow-up and re-auditing the whole `classifyRetrievedSource`
  trust map. **File once the Linear free-issue cap clears** (cross-link PREPIO-144/143).
- **Dev/build/test-only `npm audit` advisories** (undici via jsdom, vite/launch-editor,
  vitest, tailwind, mammoth) — Dependabot-tracked; no production-bundle exposure. The
  SemVer-major ones (tailwind, mammoth) need human validation.
- **pdf.js `isEvalSupported` re-add / claim-verification** — a precondition of un-freezing
  resume upload (PREPIO-27/PREPIO-140), not a live risk.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **`react-refresh/only-export-components` warnings** (Low, DX) — helper-module move;
  follow-up cleanup, not filed.

## Questions for product owner

- **The Linear free-issue cap** (recorded since 2026-07-29) still blocks filing the one
  new-but-carried Medium as its own issue (evidence-ledger `official_company` over-trust);
  it is recorded in full here. Clearing the cap would let hygiene findings be tracked in
  Linear rather than only in the audit trail. Not otherwise blocking: the High has an
  owner (PREPIO-145), and the top prior High (PREPIO-143) is now fixed in code pending the
  PREPIO-124 deploy.

## Next review focus

1. **Confirm the PREPIO-143 fix is deployed (PREPIO-124), not just merged.** The code is
   correct and fail-closed, but production stays unreconciled until the deploy has
   verified evidence — the note's standing "repo merge ≠ deployed" rule. Then re-audit
   `company-research`, `job-analysis`, and `answer-feedback` for the same object-ownership
   check applied to their own caller-supplied IDs.
2. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV PII is
   still publicly fetchable from history. Track the owner-attended filter-repo/BFG +
   force-push and verify the identified blobs are gone from all refs afterward.
3. **Evidence-ledger `official_company` over-trust** — land the registrable-label
   (PSL-aware) fix with adversarial subdomain tests; file in Linear once the cap clears.
4. **Next source-touching merge after the freeze.** Re-run the full baseline against it;
   read the *merged* code, not commit messages (the standing lesson). Watch especially for
   any un-freeze of an excluded surface (resume upload → re-add `isEvalSupported: false`;
   billing/voice/profile/answer-feedback → re-verify the server-side anonymous rejection
   and ownership checks before the client gate is lifted).
