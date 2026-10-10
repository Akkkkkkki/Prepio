# Recurring hygiene review — 2026-10-10

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio. First run
since 2026-09-12 (#27). Measured against HEAD `bccb67c` (deltas vs the `e3a283b`
base of run #27).

**This was a substantial functional window — nine changes landed since run #27's HEAD
`e3a283b`, and they are the freeze lock-down plus the two long-deferred dependency
majors. All are security-neutral-to-positive; several *close* findings this review
series has carried for months.** The full range is `e3a283b..bccb67c` (ten commits;
excluding only the run #27 note commit `f9b0454`/#346 leaves nine). **Correction after
Codex review of this PR:** an earlier draft stated the base as `f9b0454..bccb67c`, which
silently dropped three in-range commits that land *before* the note commit — #337
(discussed in full below as the PREPIO-143 fix), and two assessed here so the window has
no unaudited gap:

- **#345 (`test: cover short-name evidence origin classification`)** — **test-only**
  (+22 lines in
  [`evidence-ledger.test.ts`](../../supabase/functions/interview-research/evidence-ledger.test.ts)),
  regression coverage asserting a short employer name is **not** over-promoted to
  official/high-trust via hostname guessing. Security-positive, and directly guards the
  short-name branch of the `official_company` trust map (the carried Medium below); no
  production source.
- **#348 (`ci: make Playwright landing smoke a blocking gate`, PREPIO-135)** — **CI/DX**:
  wires the existing deterministic Playwright landing smoke into `ci.yml` as a blocking
  gate, removes committed `.playwright-cli` scratch artifacts, and syncs `CLAUDE.md` /
  `docs/TESTING.md`. Release-readiness hardening; no product source, no data/PII/auth
  surface.

The six source/dependency merges that land after the note commit:

- **[PREPIO-172] `react-router-dom` 6 → 7 (#353)** — clears the two carried
  `react-router` advisories (open-redirect GHSA-wrjc-x8rr-h8h6 and the SSR-hydration
  GHSA-337j-9hxr-rhxg that never applied to this CSR-only SPA). `npm audit` no longer
  lists react-router. **Closes the run #27 Low.**
- **`pdfjs-dist` 5 → 6 (#350)** — the fix for the high-severity GHSA-hq66-cqwq-w95j
  (arbitrary JS execution via a malicious PDF). pdf.js 6 removed the `eval()`/`Function`
  codepath the advisory exploited, so the old `isEvalSupported: false` defence-in-depth
  was removed as no longer needed ([`resumeUpload.ts:115–128`](../../src/lib/resumeUpload.ts)).
  `npm audit` no longer lists `pdfjs-dist`. **Closes the run #27 `pdfjs-dist` Medium at
  the dependency level**, and the freeze (below) independently removes the surface.
- **[PREPIO-27/124/170/173/30] Freeze lock-down (#354, #360, #357, #351)** — locks
  Prepio to the invite-only frozen core. Reviewed in full and **net security-positive**:
  - Shared auth now **rejects anonymous Supabase Auth users** in addition to
    missing/invalid sessions ([`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts),
    `data.user.is_anonymous` check), matching the FREEZE_RELEASE boundary.
  - A single `FROZEN_PRODUCT` flag map ([`src/lib/frozenProduct.ts`](../../src/lib/frozenProduct.ts))
    gates off `billing`, `answerFeedback`, `voice`, `profile`, and **`resumeUpload`** —
    all `false`, deliberately **not** overridable from the browser or an env flag. The
    resume-upload UI (both the PDF and the DOCX/`mammoth` path) is therefore not rendered
    and `extractResumeText` is unreachable from the product (see the dependency section —
    this is why none of the `mammoth`/`argparse`/`sprintf-js` advisories have a live path).
  - `searchService.createResearchPreview` now **fail-closes** for guests (returns a
    "live guest research is unavailable, view the local sample" error instead of invoking
    the `research-preview` function), and the voice/profile/answer-feedback service entry
    points throw/short-circuit behind the frozen flags. Removes live paid-provider surface
    for anonymous visitors.
  - Routing boundary is now test-covered ([`src/__tests__/App.routing.test.tsx`](../../src/__tests__/App.routing.test.tsx),
    #357) and the Edge Function typecheck ratchet was restored after the ownership guard
    (#351).

Two findings this series carried are **now closed by merged code**, and one carried
High is **fixed in-repo** (deploy still pending its reconciliation issue):

- **[PREPIO-143] `interview-research` `searchId` BOLA — fixed in repo (#337).** The
  new [`authorizeSearch`](../../supabase/functions/interview-research/authorization.ts)
  helper verifies the caller owns the persisted `searches` row (JWT user must match both
  the body `userId` **and** `searches.user_id`, 404 on miss; service callers stay trusted)
  **before** any service-role write, with regression tests
  ([`authorization.test.ts`](../../supabase/functions/interview-research/authorization.test.ts)).
  The cross-tenant write risk is closed in source. **Production deploy is still gated by
  PREPIO-124** — a repo merge alone does not repair the live function (the FREEZE_RELEASE
  live baseline @ 2026-09-21 shows the deployed versions still predate this fix).
- **[PREPIO-179 follow-up] The `SEARCH_COMPLETE` console-log PII leak — closed.** Run #27
  confirmed `company-research/index.ts` logged the full `result` (whose
  `search_results[].query` embeds note-derived interviewer/team names) through the
  un-redacting generic `logger.log`. The log call now passes
  [`buildSearchCompleteLogPayload(result)`](../../supabase/functions/company-research/result-aggregation.ts)
  (`index.ts:321`), which emits **counts only** (`searchPayloads`, `searchResults`,
  `extractedContent`, `totalUrlsExtracted`) — no query, answer, title, or page text. The
  helper is test-covered ([`result-aggregation.test.ts:151`](../../supabase/functions/company-research/result-aggregation.test.ts),
  "logs counts without queries, answers, titles, or page text"). The raw-query console
  leak the run #27 Medium confirmed is gone.

**Headline: the window closed four of the six items this series was carrying
(react-router, pdfjs, the SEARCH_COMPLETE PII leak, and — in repo — the PREPIO-143
BOLA), introduced no new secret/PII/access regression, and tightened the auth and
guest surfaces.** Two substantive items remain open (one High, one Medium), both
unchanged service-source/owner-attended work out of scope for a docs-only hygiene run,
and `npm audit` rose 5 → 18 — but **every one of the new advisories is in dev/build/test
tooling or a surface-locked prod dependency; none reaches the production runtime in an
exploitable path** (detail below). **No product-source change is warranted this run** —
the FREEZE guardrail is explicit that routine dependency PRs are out of scope, the
substantive opens are service-source changes, and none of the new advisories is
prod-exploitable. The note + the `docs/audits/README.md` index row are the deliverable.

Baselines (vs run #27 @ `e3a283b`): lint **49** problems (**40 errors, 9 warnings**;
−3 errors as the freeze removed source), typecheck **pass at baseline** (app tsc **61**,
node **0**; −1 app error from the freeze trim), build **1242.90 KiB precache / 41 entries**
(down from 2280.54 KiB / 62 — the freeze removed a large amount of routed surface),
tests **483 passing / 58 files** (up from 461/52), `npm audit` **18** (10 moderate, 8 high;
up from 5 — newly-disclosed toolchain CVEs, analysed below).

## Commands run

- `npm install`: **pass** (via SessionStart hook; 748 packages).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** −3 errors vs run #27 (the
  freeze deleted source). **Correction after Codex review of this PR:** an earlier draft
  called every error a legacy Deno-test `@typescript-eslint/no-explicit-any` — that is
  wrong, and it concealed a real React lint backlog. The accurate breakdown of the 40
  errors is: **20 `react-hooks/set-state-in-effect`, 7 `react-hooks/immutability`,
  6 `react-hooks/purity`** (33 `react-hooks` errors, in **application** code —
  `src/pages/Practice.tsx`, `src/pages/profile/ExperienceList.tsx`,
  `src/pages/profile/ProjectList.tsx`, etc.), **4 `@typescript-eslint/no-explicit-any`**
  (the legacy Deno test files), **2 `@typescript-eslint/no-empty-object-type`**, and
  **1 `@typescript-eslint/no-require-imports`**. The 9 warnings are all
  `react-refresh/only-export-components` (incl. the #338 `hasQuestionInsightsContent` one
  carried as a Low below). Lint is **informational in CI, not a gate**, so none of this
  blocks — but the 33 `react-hooks` errors are a genuine standing backlog (the
  React-Compiler rule set from `eslint-plugin-react-hooks`), not test-only `any` debt, and
  are recorded as a Low below for a maintainer. Not remediated here (app-source changes,
  out of scope for a docs-only hygiene run).
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh`/`deno.land`, so
  Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). **Correction
  after Codex review of this PR:** an earlier draft claimed each in-range edge-function
  merge passed the `verify` gate at its own merge time — the repo history contradicts
  that for #337, whose ownership guard introduced a Deno `TS2589` that the follow-up #351
  (`restore Edge Function typecheck ratchet after ownership guard`) changed
  `authorization.ts` specifically to clear. So the accurate statement is: the **final**
  checked-in `supabase/functions` source is validated by #351's later green `verify` run
  (and the subsequent #354/#360 runs), not by #337 passing the function check at its own
  merge. No new `supabase/functions` source is pushed this run.
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1242.90 KiB**).
- `npm test`: **pass** (**58 files, 483 tests**), incl. the legacy-schema,
  answer-feedback-schema, and design-token checks.
- `npm audit`: **18** (10 moderate, 8 high). Analysed in the dependency section — all in
  dev/build/test tooling or a surface-locked prod dep.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII may still be recoverable from Git history (PREPIO-145).**
  *(Carried from run #27; **status could not be confirmed this run** — see evidence.)*
  - Evidence: PR #342 redacted ten audit screenshots in the working tree (the current
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` is the 23,025-byte placeholder,
    confirmed this run), but the pre-redaction blobs remained in history as of run #27. **This
    session's clone is shallow** (`.git/shallow` present, 50 commits deep), so the
    pre-redaction SHA run #27 cited (`5585fd4`) now reports `invalid object name` — this is
    **consistent with either** a completed history purge **or** simply the shallow boundary,
    and is **not** evidence either way. The redaction commit `da47d9e` is present; the parent
    chain containing the original blobs is below the shallow horizon. *(PII not reproduced here
    per the review's redaction rule.)*
  - Risk: if the history rewrite has not been performed, real personal data remains publicly
    fetchable by commit SHA on this public repo — a freeze-exit release blocker per the issue.
  - Recommended fix: owner confirms whether the `git filter-repo`/BFG purge + coordinated
    force-push has been completed; if not, perform it owner-attended (preserve a backup ref off
    the public remote) plus the PR/comment exposure review the issue calls for. Verify the
    identified blobs are gone from **all** refs afterward (a full, non-shallow clone is needed
    to check). Do **not** run a history rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent). Owner-attended; out of scope for an unattended
    docs-only hygiene run (force-push history rewrite of a shared public repo). Next review
    should re-verify against a full clone.

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from run #27; re-verified
  still open, now documented in-code but unmitigated. Pre-existing for ASCII names;
  #340 had widened it for accented names.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    still computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust via `trustWeightFor`) when **any**
    `companyTokens(company)` entry is a substring of it (`.includes(token)`). So for company
    "Acme", a role link `https://acme.attacker.example/job` normalizes to
    `acmeattackerexample`, which `.includes("acme")` → **`official_company`/high**. The new
    comment at `evidence-ledger.ts:180–186` documents why the *stricter* registrable-label
    exact-match path was **deferred** (hand-rolled suffix lists mis-read unlisted multipart
    suffixes without full PSL parsing), but it does **not** remove the loose `.includes()`
    over-trust — that substring match is still the live classification. (`ashbyhq.com` was
    added to the ATS `JOB_POSTING_HOSTS` list in this window — a correct addition, unrelated
    to this finding.)
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted as
    high-trust "official company" evidence in the grounded-evidence ledger, biasing generated
    prep. Gating: the row must enter via the caller's own `roleLinks` (self-inflicted) or a
    Tavily result the attacker gets ranked for the company query. Content-integrity, not
    cross-tenant read. **Now less compounded** than at run #27: the PREPIO-143 `searchId` BOLA
    is fixed in repo (#337), so the "high-trust attacker text lands in a victim's plan" path
    narrows once that deploys (PREPIO-124).
  - Recommended fix: match the company against the host's **registrable label** (exact,
    PSL-aware) rather than `.includes()` on the whole host, mirroring the ATS exact/suffix
    approach `isJobPosting` now uses; add adversarial tests rejecting
    `company-token.attacker.example` subdomains; fold in the deferred PSL-aware
    short-name/employer-domain matching at the same time. Verify legitimate employer domains
    (incl. short names and multi-label suffixes) still classify correctly.
  - Owner / next step: a substantive service-role edge-function change, out of scope for a
    docs-only hygiene run and not validatable in this proxy-limited environment. File as `Bug`
    + `area:research-pipeline` (Quality & Maintenance), cross-linked to PREPIO-144/143 and this
    audit, **once the Linear free-issue cap clears** (the intake blocker recorded since
    2026-07-29 and in run #27).

### Low / clean-up

- [ ] **`npm audit` rose 5 → 18 — but all new advisories are in dev/build/test tooling
  or a surface-locked prod dependency; none reaches the production runtime.** *(New count
  this window; traced and classified this run.)*
  - Evidence (traced via `npm ls`):
    - **`undici` (high, 10 advisories) ← `jsdom@29.1.1` (dev-dep).** jsdom is vitest's DOM
      test environment; `undici` is never in the production bundle and makes no network
      requests in prod. DoS/TLS advisories on an HTTP client that isn't shipped. `fixAvailable: true`.
    - **`braces`/`micromatch`/`chokidar`/`fast-glob`/`brace-expansion`/`postcss-selector-parser`/
      `postcss-nested`/`source-map-js`/`fast-uri` (high+moderate) ← `tailwindcss@3.4.19` (dev-dep).**
      Build-time CSS tooling ReDoS/DoS; not in shipped JS. The top-level `tailwindcss` fix is
      `fixAvailable: false` (would need a tailwind major); `tailwindcss-animate` (prod-dep) is
      flagged only transitively via tailwindcss and ships no vulnerable runtime code.
    - **`mammoth` → `argparse` → `sprintf-js` (moderate) ← `mammoth` (prod-dep).** mammoth is
      the DOCX resume parser, but it is **dynamically** imported (`import("mammoth")` inside
      `getMammoth`, [`resumeUpload.ts:60`](../../src/lib/resumeUpload.ts)) only on the upload
      path, which `FROZEN_PRODUCT.resumeUpload = false` disables — so it is **never invoked at
      runtime in the frozen product**. The advisory is a `sprintf-js` DoS reached through
      `argparse`'s **CLI** arg-parsing, not the `extractRawText` library API mammoth uses here.
      npm's offered "fix" is a **downgrade to `mammoth@0.3.29`** (SemVer-major, and older), so
      `npm audit fix --force` here regresses the dep rather than advancing it.
    - **`@vitest/mocker`/`vitest` (moderate) ← `vitest` (dev-dep).** The carried path-traversal
      advisory (GHSA-82fw-gwwq-j7x9); dev/test only, no production exposure. Now `fixAvailable: true`.
  - Risk: **low real-world exposure.** No advisory is on a production runtime path in the frozen
    product. The count jump is newly-disclosed CVEs against the toolchain, not a new product risk.
  - Recommended fix: **no change this run** — the FREEZE guardrail is explicit that routine
    dependency PRs are out of scope, and `npm audit fix` is entangled (the fixable leaves sit
    under `tailwindcss`/`jsdom` whose top-level fixes are majors, and run #27 documented the npm
    `edgesOut` resolver crash on `--package-lock-only` triggered by the `overrides` field). Let
    Dependabot carry the SemVer-compatible bumps (`undici`, `fast-glob`, `source-map-js`,
    `fast-uri`, `postcss-nested`, `@vitest/mocker`/`vitest`) with its full-tree resolution; defer
    the `tailwindcss` and `mammoth`-related ones (major / downgrade-only) to a maintainer with
    build + resume-parse validation (and only when the resumeUpload surface is unfrozen, for the
    mammoth path).

- [ ] **`react-refresh/only-export-components` lint warning from #338.** *(Carried from
  run #27; still present — lint reports 9 of these warnings.)*
  - Evidence: `export const hasQuestionInsightsContent` (a non-component export) in
    [`QuestionInsightsPanel.tsx:53`](../../src/components/practice/QuestionInsightsPanel.tsx)
    mixes a component and a plain-function export in one file, which Vite fast-refresh warns on.
  - Risk: **cosmetic / DX only** — a fast-refresh hint, not correctness/security/bundle. Lint is
    not a CI gate.
  - Recommended fix: move `hasQuestionInsightsContent` into a small `questionInsights.ts` helper
    module. Out of scope for a docs-only PR (it would widen the note PR into merged product
    source); recorded for a follow-up cleanup.

- [ ] **A 33-error `react-hooks` lint backlog in application code.** *(Surfaced by Codex on
  this PR; an earlier draft of this note had mislabeled all errors as test-only `no-explicit-any`
  — code-verified and corrected this run.)*
  - Evidence: of the 40 `npm run lint` errors, **33 are `react-hooks` rules** — 20
    `react-hooks/set-state-in-effect`, 7 `react-hooks/immutability`, 6 `react-hooks/purity`
    — in application source, incl. [`src/pages/Practice.tsx`](../../src/pages/Practice.tsx),
    [`src/pages/profile/ExperienceList.tsx`](../../src/pages/profile/ExperienceList.tsx), and
    [`src/pages/profile/ProjectList.tsx`](../../src/pages/profile/ProjectList.tsx). These are
    the React-Compiler rule set from `eslint-plugin-react-hooks` (state set directly in an
    effect, mutation of values treated as immutable, impure render reads). The remaining
    7 errors are 4 `@typescript-eslint/no-explicit-any` (Deno test files), 2
    `no-empty-object-type`, 1 `no-require-imports`.
  - Risk: **informational / DX** — lint is not a CI gate, so none of this blocks, and nothing
    here is a security or data finding. But `set-state-in-effect` / `purity` violations can be a
    smell for avoidable re-render loops or render-phase side effects, so the backlog is worth a
    maintainer's eye rather than being written off as test-only `any` debt.
  - Recommended fix: a maintainer triages the `react-hooks` errors per file (many
    `set-state-in-effect` cases are a derive-during-render or `useMemo` refactor). App-source
    changes across several pages — out of scope for a docs-only hygiene run; recorded here and
    worth a Linear `Chore` + `area:practice`/`area:profile` once the free-issue cap clears.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged from runs #26/#27 — not filed.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint, typecheck,
    typecheck:functions, build, and test — not `npm audit`. Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A CI-policy call
    for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **None (no product source touched).** The window's merges closed four carried items
  (react-router, pdfjs, the SEARCH_COMPLETE PII leak, and — in repo — the PREPIO-143 BOLA)
  and introduced no fix candidate for this docs-only run. The `npm audit` jump is entirely
  dev/build/test tooling or a surface-locked prod dep with no production-exploitable path, and
  the FREEZE guardrail explicitly excludes routine dependency PRs; the two substantive opens
  (PREPIO-145 history purge, the `official_company` over-trust) are owner-attended /
  service-source work. The note + the `docs/audits/README.md` index row are the deliverable.

## Deferred items

Tracked, Dependabot-surfaced, or owner-attended:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot blobs +
  PII/credential exposure review (High/Urgent). Working-tree slice done (#342); history status
  **unverifiable from this shallow clone** — needs owner confirmation / a full-clone re-check.
- **PREPIO-124** — deploy the merged PREPIO-143 ownership fix (and the other merged
  ownership/privacy fixes) to production; the FREEZE live baseline shows deployed function
  versions still predate them. A repo merge does not repair the live functions.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium, carried) —
  PSL-aware registrable-label matching + adversarial tests; file in Linear once the free-issue
  cap clears (cross-link PREPIO-144/143 and this audit).
- **`npm audit` toolchain advisories** (Low, dev/build/test tooling) — Dependabot carries the
  SemVer-compatible bumps; `tailwindcss` (major) and `mammoth` (downgrade-only) deferred to a
  maintainer with build/resume-parse validation.
- **`#338` `react-refresh/only-export-components` lint warning** (Low, cosmetic/DX) — move
  `hasQuestionInsightsContent` to a helper module; noted for follow-up, not filed.
- **33-error `react-hooks` lint backlog in app code** (Low, informational — Codex-surfaced
  this run) — `set-state-in-effect`/`immutability`/`purity` across `Practice.tsx` and
  `profile/*`; maintainer triage, file as `Chore` + `area:practice`/`area:profile` once the
  Linear cap clears.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.

## Questions for product owner

- **Has the PREPIO-145 Git-history purge been completed?** It could not be verified from this
  shallow clone (the run #27 pre-redaction SHA is below the shallow horizon). If not done, it
  remains the highest-residual-risk open item (real CV PII publicly fetchable on a public repo)
  and needs the owner-attended rewrite before any freeze-exit tag.
- **Linear free-issue cap** (recorded since 2026-07-29 and in run #27) still blocks filing the
  one carried Medium (`official_company` over-trust) as a tracked issue — recorded in full here
  instead. Clearing the cap would let hygiene findings live in Linear rather than only the audit
  trail. Not otherwise blocking.

## Next review focus

1. **PREPIO-124 production deploy** — confirm the merged PREPIO-143 ownership check (and the
   freeze auth/privacy fixes) actually reach the live functions; the live baseline shows
   deployed versions predating them, so the BOLA is closed in repo but **not yet in
   production**. Re-audit `company-research`, `job-analysis`, and `cv-analysis` for the same
   object-ownership pattern while confirming.
2. **PREPIO-145 Git-history purge** — re-verify against a **full (non-shallow) clone** whether
   the pre-redaction CV-PII blobs are gone from all refs; it is the top residual risk and a
   freeze-exit blocker.
3. **Evidence-ledger `official_company` over-trust** — land the PSL-aware registrable-label fix
   with adversarial `company-token.attacker.example` tests, fold in the deferred `official_job`
   short-name/employer-domain follow-up, and re-audit the whole `classifyRetrievedSource` trust
   map. File it in Linear once the cap clears.
4. **Next source-touching merge** — re-run the full baseline against it rather than
   re-verifying carried findings, and read the *merged* code (not commit messages) when
   assessing any security-relevant change (run #27's #340 lesson).
