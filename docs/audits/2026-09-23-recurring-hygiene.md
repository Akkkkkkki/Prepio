# Recurring hygiene review — 2026-09-23

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio.

**Headline: a strongly positive window — three of the prior review's top open
findings are now resolved in the repo, `npm audit` dropped 5 → 2, and the eight
merges since run #27's baseline (`e3a283b`) introduced no new secret, PII-in-logs,
or access-control regression.** The three resolutions map to run #27's next-review
focus **#1** (PREPIO-143, the `searchId` BOLA — resolved repo-side by #337) and
focus **#4** (the `pdfjs-dist` high and both `react-router` advisories — resolved
by #350 and #353). *(Correction after Codex review of this PR: an earlier draft
said "the top two next-review focuses" — that was wrong. Focus #2 was the
PREPIO-145 Git-history purge, which remains an **open High** below; only one of
run #27's top two focuses, #1, is resolved.)*

Range reviewed: `e3a283b..HEAD` (`9d9b711`), eight commits. Run #27 (2026-09-12)
measured against `e3a283b` (#335). Under the definition used here — `src/` or
`supabase/functions/`, excluding tests — **four** merges are source-touching:
#337, #351, #350, #354. *(Correction after Codex review of this PR: an earlier
draft listed five, including #353 — but #353 (`908b8f4`) changes only
`package.json`/`package-lock.json`, so it is a dependency bump, not source-touching
by this definition.)* The rest of the range: #353 (dependency bump, react-router
v7 — reviewed as the advisory-clearing merge below), #345 (tests only), #346
(run #27's own note), and #348 (CI-config).

- **`security: enforce interview research search ownership` (#337, `17e5b08`)** —
  **the PREPIO-143 BOLA fix landed.** This closes run #27's top carried High in the
  repo. A new
  [`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  adds `authorizeSearch(supabase, authContext, userId, searchId)`, called at
  [`index.ts:1333`](../../supabase/functions/interview-research/index.ts) **before**
  the background work promise is constructed. The gate: service callers pass; a JWT
  caller must match the body `userId` (403 on mismatch) **and** own the persisted
  `searches` row (`select id … where id = searchId and user_id = authContext.userId`,
  `maybeSingle()`), returning an intentionally identical **404** for both an absent
  row and a row owned by another tenant (no existence oracle), and **500** on a query
  error. Because all pipeline clients write with the RLS-bypassing service role, the
  check running before any write is exactly the right boundary. Dedicated coverage in
  [`authorization.test.ts`](../../supabase/functions/interview-research/authorization.test.ts)
  (sibling test file). **Repo-side High closed; production still owed** — a merge does
  not repair production (deploy tracked under PREPIO-124).
- **`fix: restore Edge Function typecheck ratchet after ownership guard` (#351,
  `571c6e5`)** — **an authorization-source change, not scripts/config** (correction
  after Codex review of this PR). Despite the "typecheck ratchet" title, the diff
  touches only
  [`authorization.ts`](../../supabase/functions/interview-research/authorization.ts)
  (+11/−3): it widens `authorizeSearch`'s `supabase` parameter from the typed
  `SearchOwnershipClient` to `unknown` with an internal `as SearchOwnershipClient`
  cast, and switches the seam's `maybeSingle()` return from `Promise` to `PromiseLike`,
  to stop Deno's structural comparison of the deep generated `SupabaseClient` generic
  from hitting TS2589 (restoring the Edge Function typecheck ratchet). No script,
  config, or ratchet-baseline file changed. **Runtime behavior is intended to remain
  neutral** — the same ownership query runs after crossing the boundary — but this is a
  security-sensitive file (the PREPIO-143 ownership guard), so it is reviewed as such:
  the `unknown` boundary trades a compile-time contract at the call site for an
  **unchecked** runtime assertion. *(Correction after Codex review of this PR: an
  earlier draft said the helper "validates the narrow query surface it uses" — it does
  not. `supabase as SearchOwnershipClient` is erased at runtime; there is no runtime
  type guard, so a caller passing anything without `.from()/.select()` would throw an
  uncaught error rather than produce a controlled 403/404/500.)* The assertion is
  justified only by the single known call site
  ([`index.ts:1333`](../../supabase/functions/interview-research/index.ts)), which
  passes the real Supabase client — not by any runtime validation. A defensive
  follow-up would add a small runtime guard (e.g. assert `typeof client.from ===
  "function"` and fail closed) so a future mis-wiring degrades to a controlled error;
  noted, not blocking.
- **`security: upgrade pdfjs-dist 5 to 6` (#350, `c4932a9`)** — **closes the carried
  `pdfjs-dist` high advisory (GHSA-hq66-cqwq-w95j).** `package.json` now pins
  `pdfjs-dist: ~6.3.289` (was 5.x); `npm audit` no longer reports the pdf.js arbitrary-JS
  advisory. This is the production-path resume parser
  ([`resumeUpload.ts`](../../src/lib/resumeUpload.ts)), so it was the highest-severity
  standing dependency item. **Correction after Codex review of this PR: #350 *removed*
  the `isEvalSupported: false` flag from the `getDocument` call (and dropped the
  matching test assertion), it did not keep it** — an earlier draft of this bullet
  wrongly said the 2026-08-08 defense-in-depth "remains". The removal is intentional
  and documented in-code
  ([`resumeUpload.ts:120`](../../src/lib/resumeUpload.ts)): pdf.js 6 removed the eval
  path that flag guarded, so the option is obsolete on v6. The parser still extracts
  text only (never renders/scripts), and the advisory itself is closed by the major
  bump, so PDF hardening is not weakened — but the current defense is "no eval path in
  the engine", not "eval disabled by flag", and future audits should baseline it that
  way.
- **`[PREPIO-172] Upgrade react-router-dom 6 → 7 to clear advisories` (#353,
  `908b8f4`)** — **closes both carried `react-router` advisories** (open-redirect
  GHSA-wrjc-x8rr-h8h6 and the SSR-hydration GHSA-337j-9hxr-rhxg that never applied to
  this CSR-only SPA). `package.json` now pins `react-router-dom: ^7.18.4` (was 6.x);
  neither advisory appears in `npm audit`.
- **`fix: lock Prepio to the invite-only frozen core` (#354, `9d9b711`)** — the
  largest merge in the window and **security-positive: it reduces surface, not adds
  it.** It removes the billing/answer-feedback/voice/profile/resume-upload UI paths
  from the shipped app (aligned to [docs/FREEZE_RELEASE.md](../FREEZE_RELEASE.md) and
  the "Current Product Truth" in CLAUDE.md), adds a small compile-time
  [`frozenProduct.ts`](../../src/lib/frozenProduct.ts) flag const (five `false`s,
  deliberately not browser/env-overridable) and a guarded
  [`deploy-frozen-functions.mjs`](../../scripts/deploy-frozen-functions.mjs) wrapper
  (manifest allowlist, `PREPIO_DEPLOY_COMMIT`-must-match-HEAD gate, refuses a dirty
  checkout — good deploy hygiene, no secrets). Net effect on the bundle: **build fell
  2280.54 KiB → 1242.25 KiB** and precache entries 62 → 41. **Correction after two
  Codex rounds on this PR: #354 *does* touch authentication (an earlier draft's "auth
  model unchanged" was wrong), but a second draft then over-corrected by calling
  account creation "disabled" — the accurate picture distinguishes the repo-side
  changes from a still-required production gate:**
  - **Repo-side, effective on merge:**
    [`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts) adds
    `data.user.is_anonymous` to its fail-closed rejection, so an anonymous Auth user is
    refused **at every edge function that uses this shared guard** (matching the "core
    provider functions reject anonymous Auth users" line in CLAUDE.md). This is a real,
    security-positive enforcement change.
  - **Local intent only, NOT a production control:**
    [`supabase/config.toml`](../../supabase/config.toml) now sets
    `[auth] enable_signup = false` / `enable_anonymous_sign_ins = false` /
    `[auth.email] enable_signup = false`, but per
    [docs/FREEZE_RELEASE.md](../FREEZE_RELEASE.md) §2 committing `config.toml` documents
    local intent and **does not apply hosted Supabase Auth settings**. So merging #354
    does **not** disable production signup — the shared guard also cannot block a direct
    signup, only anonymous callers at guarded functions. **Turning off "Allow new users
    to sign up" and "Allow anonymous sign-ins" in production Supabase Auth (and
    verifying a direct non-invited signup fails) remains an open owner deployment gate
    under PREPIO-27 / PREPIO-124 / PREPIO-170** — future audits must treat the
    invite-only production control as still open, not closed by this merge.

  Net: security-positive (anonymous-rejection guard + surface reduction) with the
  production invite-only toggle still owed. The frontend auth files (`useAuth.ts`,
  `Auth.tsx`, `searchService.ts`, `billing.ts`) shed UI; the enforcement change is in
  `_shared/auth.ts`, and `config.toml` is local-only. Tests were updated in lockstep
  and pass.

**No code change was warranted this run.** The one standing dependency candidate (the
`@vitest/mocker` dev-only advisory) remains blocked by the npm `edgesOut` resolver bug
— re-confirmed this run: `npm install vitest@^4.1.11` and `npm update vitest
--package-lock-only` both abort with `Cannot read properties of null (reading
'edgesOut')` (the documented bug triggered by the `overrides: { esbuild: ^0.28.1 }`
field). The only method that resolves cleanly (`npm install vitest@4.1.11
@vitest/mocker@4.1.11 …` with the whole `@vitest/*` family pinned) pollutes
`package.json` with seven spurious direct-dependency entries, and manual lockfile
integrity-hash surgery across eight packages is exactly the fragile change prior runs
rejected for a dev-only advisory. Deferred to Dependabot (whose full-tree resolution
is not subject to the local `--package-lock-only`/overrides crash). The two open
Mediums (the evidence-ledger `official_company` over-trust and the `SEARCH_COMPLETE`
PII-in-logs leak) are service-source edge-function changes, out of scope for a
docs-only hygiene run and not validatable here (the agent proxy blocks `esm.sh`, so
Deno cannot typecheck the edge functions).

Baselines (measured against HEAD `9d9b711`; deltas vs 2026-09-12):
lint **50** problems (**41** errors, **9** warnings; −2 errors from #354's code
removal). Typecheck **pass at baseline** (app **61**, node **0**; app baseline
62 → 61, re-ratcheted after #354/#351). Build **1242.25 KiB** / 41 precache entries
(**−1038 KiB**, the freeze-lock surface reduction). Tests **467** passing / **55**
files (up from 461/52). `npm audit` **2** (both moderate — the `@vitest/mocker`
dev-only chain; **down from 5**, the pdfjs high and both react-router moderates
cleared by #350/#353).

## Commands run

- `npm install`: **pass** (via SessionStart hook).
- `npm run lint`: **50 problems (41 errors, 9 warnings).** −2 errors vs 2026-09-12
  (#354 removed source). **Correction after Codex review of this PR: an earlier draft
  said the 41 errors were all `@typescript-eslint/no-explicit-any` in tests/edge
  functions — that was wrong and hid a substantial app-side React-hooks backlog.** The
  actual error breakdown is **21 `react-hooks/set-state-in-effect` + 7
  `react-hooks/immutability` + 6 `react-hooks/purity`** (34 app-side React-hooks
  errors), then **4 `@typescript-eslint/no-explicit-any`**, **2
  `@typescript-eslint/no-empty-object-type`**, and **1
  `@typescript-eslint/no-require-imports`** = 41; the 9 warnings are all
  `react-refresh/only-export-components` (incl. the #338 one carried as a Low). Lint is
  informational in CI (not a gate), so none of these block, and this run pushes no
  source — but the React-hooks backlog is the real lint story and future reviews should
  baseline against it, not the `no-explicit-any` mischaracterization. *(The 34
  react-hooks errors come from the newer `eslint-plugin-react-hooks` rule set flagging
  set-state-in-effect / purity / immutability patterns across app components; worth a
  dedicated cleanup pass, out of scope for a docs-only run.)*
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the script
  reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). This
  run pushes no `supabase/functions` source; the range's edge-function merges (#337,
  #351) each passed the real CI `verify` gate at merge time (#351 explicitly restored
  the deno ratchet to baseline).
- `npm run build`: **pass** (Vite + PWA, 41 precache entries, **1242.25 KiB**).
- `npm test`: **pass** (**55 files, 467 tests**), incl. the schema/design-token checks.
- `npm audit`: **2** (both moderate — `@vitest/mocker` / `vitest`, dev-only). Down
  from 5; no new advisory this window.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; the owner-attended history-purge
  slice. Re-verified still exposed this run.)*
  - Evidence: PR #342 replaced ten screenshots with placeholders in the working tree,
    but the pre-redaction blobs remain in history. Re-confirmed against the object
    store this run for `docs/audits/assets/2026-07-09/11-d-new-interview.png`, which
    has two historical **blob** versions (correction after Codex review of this PR —
    an earlier draft labelled these with the *commit* SHAs `da47d9e`/`f4f9c4b`, not the
    blob object IDs a purge actually targets; the exact blobs are):
    - the redacted **23,025-byte** blob `1cb6917a804f77169ce0aed3d562cdbc25af13f9`
      (introduced by commit `da47d9e`; the current working-tree version), and
    - the original PII **146,389-byte** blob
      `3a6f18c65cc448482d16ff58a2f257b2850a26f2`, reachable via
      `git rev-parse f4f9c4b:docs/audits/assets/2026-07-09/11-d-new-interview.png` and
      confirmed still resolvable this run with `git cat-file -s`.

    The exact blob IDs above are the unambiguous identifiers a `filter-repo`/BFG purge
    operates on, regardless of which commit references them. *(An earlier draft added an
    aside that the prior note's `5585fd4` short-SHA "no longer resolves"; that was an
    artefact of this session's clone and Codex confirmed the commit still resolves in a
    full clone, so the aside is dropped — the resolution status of any one referencing
    commit is not load-bearing once the blob IDs are pinned.)* The nine other paths
    listed in #342 (full name, phone, email, LinkedIn, location, CV filename) are the
    same shape. **This is a public repository**, so those blobs are retrievable by
    anyone with a commit SHA or the blob ID. *(PII not reproduced here per the review's
    redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten; a
    freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified
    blobs + coordinated force-push, preserving a backup ref off the public remote,
    plus the PR/comment exposure review the issue calls for. Do **not** run a history
    rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, assigned to owner). Already
    tracked with a full remediation plan; no new issue filed. Out of scope for an
    unattended hygiene run (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12;
  re-verified still open in the code this run. Base over-trust is pre-existing;
  #340 widened it for accented brand names. Outside PREPIO-144's `official_job`
  scope.)*
  - Evidence: still present at
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    — `normalizedHost = host.replace(/[^a-z0-9]/g, "")` then returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    substring of it (`.includes(token)`). So `acme.attacker.example` →
    `acmeattackerexample` → `.includes("acme")` → **`official_company`/high**. The
    inline comment (line ~182) still defers PSL-aware registrable-label matching as
    follow-up. For accented brand names the NFKD folding #340 added to `companyWords`
    produces a usable token (`"L'Oréal"` → `oreal`) that previously fell through, so
    `oreal.attacker.example` is now over-trusted where it was not before #340.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Gated by the row entering the ledger via the
    caller's own `roleLinks` (self-inflicted) or a Tavily result the attacker gets
    ranked for the company query. Content-integrity, not cross-tenant read. Note the
    compounding factor from run #27 (a combination with the open `searchId` BOLA) is
    **now reduced** — #337 closed PREPIO-143 in the repo, so once deployed the
    cross-tenant-write amplifier is gone.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the ATS
    exact/suffix approach `isJobPosting` now uses; add adversarial tests rejecting
    `company-token.attacker.example`. Verify legitimate employer domains (incl. short
    names and multi-label suffixes) still classify correctly.
  - Owner / next step: **Linear could not be reached this run** (the Linear MCP server
    is not authorized in this non-interactive session; prior runs additionally hit the
    workspace free-issue cap). Recorded here in full; file as `Bug` +
    `area:research-pipeline` (Quality & Maintenance), cross-linked to PREPIO-144,
    PREPIO-143, this audit, and PR #346, when intake is available. A substantive
    service-role edge-function change, out of scope for a docs-only hygiene run and not
    validatable in this proxy-limited environment.

- [ ] **PII-in-logs is only partially closed — the `SEARCH_COMPLETE` console log still
  leaks raw note-derived query strings (PREPIO-179 follow-up).** *(Carried from
  2026-09-12; re-verified still open in the code this run.)*
  - Evidence: still present in
    [`company-research/index.ts`](../../supabase/functions/company-research/index.ts)
    — line 248 builds a `SearchPayload` with `query: result.query` (the raw Tavily
    query, which for `user-note-*`/contextual queries embeds note-derived
    interviewer/team names), and line 317 calls
    `logger.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)`. The generic
    `SearchLogger.log`
    ([`_shared/logger.ts`](../../supabase/functions/_shared/logger.ts)) does **not**
    strip `query` (only `logTavilySearch`, redacted in #344, does) and `console.log`s
    the whole payload, so the names still reach edge-function logs on every run. The
    second path — the `searchTavily` insert into `ops.tavily_searches`
    ([`_shared/tavily-client.ts`](../../supabase/functions/_shared/tavily-client.ts))
    — remains inert against the checked-in schema (its `user_id`/`response_payload`
    columns are absent from the migrations), so durable DB persistence is still not
    established without production schema drift (itself a code/migration-mismatch
    reliability gap). `logger.test.ts` covers only `logTavilySearch`.
  - Risk: the PII-in-logs class PREPIO-141 → PREPIO-179 set out to close is still live
    via the aggregate console log (confirmed). Same interviewer/team-name exposure into
    edge-function logs.
  - Recommended fix: (a) redact `query` from each `search_results[]` entry before the
    `SEARCH_COMPLETE` log (or log counts/sources only); (b) reconcile `searchTavily`'s
    insert with the `ops.tavily_searches` schema and store the query `source`/hash
    rather than the raw string when doing so; (c) add tests asserting no free-text query
    reaches the logger or a DB writer; audit other generic `logger.log`/DB writers
    carrying `query`.
  - Owner / next step: **reopen PREPIO-179** (its #344 fix is partial) or file a
    follow-up — Linear unreachable this run (see above); recorded here in full. A
    service-role edge-function change, out of scope for a docs-only hygiene run and not
    validatable in this proxy-limited environment.

### Low / clean-up

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9) — path traversal /
  arbitrary file read via redirect mock.** *(Carried; the clean in-range fix remains
  blocked by the npm resolver bug, re-confirmed this run.)*
  - Evidence: `@vitest/mocker 2.1.0 - 4.1.10` moderate; installed `vitest@4.1.9`
    (`@vitest/mocker@4.1.9`). The fix `vitest ≥ 4.1.11` is within the existing
    `^4.1.8` manifest range (latest is `5.0.1`, a major, out of scope).
  - Attempted this run: `npm install vitest@^4.1.11` and `npm update vitest
    --package-lock-only` both abort with `Cannot read properties of null (reading
    'edgesOut')` — the documented npm resolver bug triggered by the `overrides`
    (`esbuild: ^0.28.1`). The only resolving method (`npm install vitest@4.1.11
    @vitest/mocker@4.1.11 @vitest/expect@4.1.11 …` pinning the whole family) added
    seven `@vitest/*` packages as spurious direct `dependencies` to `package.json` —
    manifest pollution — so it was reverted; the working tree is clean. Manual lockfile
    integrity-hash surgery across eight packages is fragile and not warranted for a
    **dev/test-only** advisory with no production-bundle exposure.
  - Recommended fix: let Dependabot's `vitest` bump carry it (its full-tree resolution
    is not subject to the local `--package-lock-only` crash), or a maintainer runs it
    outside this proxy sandbox.

- [ ] **App-side `react-hooks` lint backlog — 34 errors.** *(Newly surfaced this run,
  via Codex review of this PR; not a regression from this window's merges, but the real
  lint story that prior notes' `no-explicit-any` framing obscured.)*
  - Evidence: `npm run lint` errors break down as **21 `react-hooks/set-state-in-effect`
    + 7 `react-hooks/immutability` + 6 `react-hooks/purity`** across app components,
    from the newer `eslint-plugin-react-hooks` rule set. These are the bulk of the 41
    errors; only 4 are `no-explicit-any`.
  - Risk: **DX / latent-correctness** — set-state-in-effect and purity violations can
    signal render loops or effects doing work that belongs elsewhere, but lint is
    informational in CI (not a gate) so none block, and no runtime regression is
    attributed to this window.
  - Recommended fix: a dedicated React-hooks lint-cleanup pass (its own PR, per rule
    class), triaging genuine effect/purity fixes vs. justified disables. Out of scope
    for a docs-only hygiene run; file as `Chore` + `area:*` per component when Linear
    intake is available.

- [ ] **`react-refresh/only-export-components` lint warning from #338.** *(Carried;
  unchanged.)*
  - Evidence: `npm run lint` still reports 9 of these warnings, incl. the
    `export const hasQuestionInsightsContent` non-component export at
    [`QuestionInsightsPanel.tsx:53`](../../src/components/practice/QuestionInsightsPanel.tsx).
  - Risk: **cosmetic / DX only** — a fast-refresh hint, not correctness, security, or
    bundle. Lint is informational in CI (not a gate).
  - Recommended fix: move `hasQuestionInsightsContent` into a small
    `questionInsights.ts` helper module and import it back. Out of scope for a
    docs-only run; noted for a maintainer/follow-up cleanup.

- [ ] **`npm audit` is not a CI gate.** *(Observation, not filed — unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, and test — not `npm audit`. Advisory
    response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **None.** The window introduced nothing needing an in-run fix: the source-touching
  merges are security-neutral-to-positive (three of them closed prior findings), the
  one dependency candidate (`@vitest/mocker`) is blocked by the npm `edgesOut`
  resolver bug and is a dev-only advisory not worth manual lockfile surgery, and the
  two open Mediums plus PREPIO-145 are out of scope for a docs-only, proxy-limited,
  unattended run. The review note + the `docs/audits/README.md` index row are the
  deliverable.

## Deferred items

Tracked, Dependabot-surfaced, or recorded here:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + PII/credential exposure review (High/Urgent, Todo). Working-tree slice done
  (#342); history remains exposed on the public repo (re-verified this run).
- **PREPIO-124** — deploy the PREPIO-143 ownership fix (#337) to production. The repo
  fix has landed; a merge alone does not repair production. This is now the residual
  half of the BOLA item.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium,
  carried) — `classifyRetrievedSource` matches company tokens with a loose
  `.includes()` on the whole host; needs a PSL-aware registrable-label match with
  adversarial tests. Recorded in full above; file when Linear intake is available.
- **PREPIO-179 follow-up** (Medium, carried) — the `SEARCH_COMPLETE` console log still
  leaks raw query strings; reconcile the `searchTavily` → `ops.tavily_searches`
  insert with the checked-in schema and redact `query_text` when doing so. Recorded in
  full above.
- **`@vitest/mocker` ≥ vitest 4.1.11** (Low, dev-only) — blocked locally by the npm
  `edgesOut` bug; let Dependabot carry it.
- **`#338` `react-refresh/only-export-components` lint warning** (Low, cosmetic/DX) —
  move `hasQuestionInsightsContent` to a helper module; follow-up cleanup, not filed.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.

## Questions for product owner

- **Linear intake is unavailable in this session** — the Linear MCP server is not
  authorized in this non-interactive run (and prior runs recorded the workspace
  free-issue cap). The two open Mediums cannot be filed to Linear; both are recorded
  in full in this note instead. Authorizing the Linear connector (and/or clearing the
  free-issue cap) would let hygiene findings be tracked in Linear rather than only in
  the audit trail. Not otherwise blocking: the one open High (PREPIO-145) has an owner
  and a documented remediation plan.

## Next review focus

1. **PREPIO-124 — deploy the PREPIO-143 ownership fix to production.** The repo fix
   (#337) is verified sound and test-covered; the remaining risk is entirely that
   production has not been reconciled. Confirm the deploy lands, then re-audit
   `company-research`, `job-analysis`, and `answer-feedback` for the same
   object-ownership check the `interview-research` fix established.
2. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV PII
   is still publicly fetchable from history (original 146,389-byte blob
   `3a6f18c65cc448482d16ff58a2f257b2850a26f2` confirmed present this run). Track the
   owner-attended filter-repo/BFG + force-push and verify the identified blobs are
   gone from all refs afterward.
3. **The two carried research-pipeline Mediums** (file once Linear intake returns).
   (a) Evidence-ledger `official_company` over-trust — land the registrable-label
   (PSL-aware) fix with adversarial `company-token.attacker.example` tests, fold in
   the deferred `official_job` short-name/employer-domain follow-up, and re-audit the
   whole `classifyRetrievedSource` trust map. (b) PREPIO-179 follow-up — redact
   `query` from the `SEARCH_COMPLETE` aggregate log and reconcile the
   `searchTavily` → `ops.tavily_searches` insert with the checked-in schema.
4. **Next source-touching merge.** Re-run the full baseline against it. With the
   freeze lock (#354) now shipped, watch specifically for any change that re-enables a
   frozen surface (billing/answer-feedback/voice/profile/resume-upload) without a
   reviewed release — `frozenProduct.ts` is the compile-time boundary to hold.
