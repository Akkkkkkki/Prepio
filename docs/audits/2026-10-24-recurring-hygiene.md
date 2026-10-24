# Recurring hygiene review — 2026-10-24

## Summary

Twenty-ninth recurring codebase hygiene & security review for Prepio.

**Quiet window: `main` has not advanced since the 2026-10-21 run (#381).** `HEAD` and
`origin/main` are both `a330939` — the same commit the last run measured against — so
there are **zero new merges to review** this run (`git log a330939..origin/main` is
empty). This is a re-verification pass against an identical tree three days later, not a
new review surface. All standing findings are carried below with their current status;
the one substantive change this window is in the **open-PR state**, not in `main`:

- **The one carried Medium (`official_company` attacker-subdomain over-trust) now has a
  complete, CI-green, mergeable fix PR in flight: [#375] "[PREPIO-184] Match
  official_company to the host's registrable label".** The finding was recorded in every
  run back to 2026-09-12 as "file once the Linear cap clears"; **PREPIO-184 has now been
  filed** (so the cap has eased enough for intake) and the fix is written. #375 replaces
  the loose `normalizedHost.includes(token)` substring test at
  [`evidence-ledger.ts:175-177`](../../supabase/functions/interview-research/evidence-ledger.ts)
  with an **exact match against the host's registrable (eTLD+1) label**, adds a
  `registrableLabel(host)` helper (curated multi-part ccTLD suffixes; `null` for
  per-subdomain platforms like `github.io`), and ships **3 new adversarial tests**
  (`acme.attacker.example` → `market_heuristic`; `notacme.example` substring-only →
  `market_heuristic`; `acme.github.io` → `market_heuristic`; while `acme.com` and
  `careers.acme.co.uk` stay `official_company`). This is exactly the registrable-label
  (PSL-aware) fix the finding recommended, and it also folds in the accent-fold case
  (`loreal.com` still matches "L'Oréal"), closing the #340 NFKD-widening regression. Its
  checks are green — `verify`, Vercel Preview, and GitGuardian all pass — and
  `mergeable_state` is `clean`. **Not merged yet**, and even once merged, production stays
  unreconciled until the PREPIO-124 deploy. No action owed from this hygiene run beyond
  confirming it lands; it is not a docs-run change to make.

**No new merged source ⇒ no product-source change warranted this run.** The carried High
(PREPIO-145) is owner-attended; the carried Medium's fix is in flight as #375; the
remaining items are dev/build/test-only dependency advisories (blocked locally by the npm
`edgesOut` resolver bug and deferred to Dependabot per the freeze's "no routine dependency
PRs" rule). Secret scan re-run clean. The note + its `docs/audits/README.md` index row are
the deliverable.

Baselines (measured against HEAD `a330939`; deltas vs 2026-10-21 #381):
lint **49** problems (**40** errors, **9** warnings) — **flat**. Typecheck **pass at
baseline** (app tsc **61**, node **0**) — flat. Build **1243.41 KiB** / **41** precache
entries — **byte-flat**. Tests **494** passing / **58** files — flat. `npm audit` **14**
(**1 low, 8 moderate, 5 high**) — **down 5 from 19**; the drop is advisory-database churn
/ dedup against the same in-tree tooling (no dependency version changed, `main` didn't
move), and every remaining advisory is still dev/build/test-only on the exposure analysis
below.

## Commands run

- `npm install`: **pass** (via SessionStart hook; 748 packages audited).
- `npm run lint`: **pass to read** — 49 problems (40 errors, 9 warnings), flat vs #381.
  Errors are the unchanged pre-existing `@typescript-eslint/no-explicit-any` /
  `no-require-imports` in tests, edge functions, and `tailwind.config.ts`; warnings are
  the pre-existing `react-refresh/only-export-components` fast-refresh hints. Lint is
  informational in CI; this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). This run pushes
  no `supabase/functions` source, and `main` has not advanced, so the window's edge
  functions are byte-identical to those that passed the real CI `verify` gate at merge
  time.
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1243.41 KiB**).
- `npm test`: **pass** (**58** files, **494** tests), incl. the legacy-schema,
  answer-feedback-schema, and design-token checks.
- `npm audit`: **14** (1 low, 8 moderate, 5 high) — down from 19; all dev/build/test-only
  (see the Medium below for the per-dependency-path triage).

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the working-tree
  redaction (PREPIO-145).** *(Carried; owner-attended. Not re-fetched this run per the
  review's redaction rule; no history rewrite has landed, so it remains exposed.)*
  - Evidence: PR #342 (2026-09-12 window) replaced ten screenshots with placeholders in
    the working tree, but the pre-redaction blobs remain in history (prior runs resolved
    the original 146,389-byte blob of
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` at `5585fd4`). **This is a
    public repository**, so the blobs are retrievable by anyone with the commit SHA.
  - Risk: real personal data exposed on a public remote until history is rewritten; a
    freeze-exit release blocker per the issue and per
    [docs/FREEZE_RELEASE.md](../FREEZE_RELEASE.md)'s unreconciled-production note.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified blobs +
    coordinated force-push, preserving a backup ref off the public remote, plus the
    PR/comment exposure review the issue calls for. **Do not run a history rewrite
    unattended.**
  - Owner / next step: **PREPIO-145** (Urgent, Todo, owner-assigned). Already tracked with
    a full remediation plan; out of scope for an unattended hygiene run (force-push
    history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12; re-verified
  unchanged in `main` this run. **Now has a complete, CI-green fix PR #375 awaiting
  merge** — see Summary.)*
  - Evidence:
    [`evidence-ledger.ts:175-177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    on `main` still computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry is a
    substring of it (`normalizedHost.includes(token)`). For company "Acme",
    `https://acme.attacker.example/` → `acmeattackerexample`.includes("acme") →
    **`official_company`/high**. The in-code comment (line ~180) still defers PSL-aware
    registrable-label matching as follow-up, and the #340 NFKD-folding widening for
    accented names (`"L'Oréal"` → `oreal` → `oreal.attacker.example` over-trusted) still
    applies on `main`.
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted
    as high-trust "official company" evidence in the grounded-evidence ledger, biasing
    generated prep. Content-integrity, not cross-tenant read. The combined severity with
    the BOLA is **reduced now that PREPIO-143 is fixed in code** (the ownership check caps
    whose plan an attacker could influence), though neither is deploy-verified yet
    (PREPIO-124).
  - Recommended fix: **already written and ready** — PR [#375] (PREPIO-184) does exactly
    the recommended registrable-label (eTLD+1) exact-match with adversarial
    `company-token.attacker.example` tests and preserves legitimate employer domains.
  - Owner / next step: **PREPIO-184** — confirm #375 merges (CI is green, mergeable state
    clean), then that it reaches production via the PREPIO-124 deploy (repo merge alone
    does not repair production). No docs-run change owed.

- [ ] **`npm audit` reports 14 advisories (was 19 at #381), every one dev/build/test-only
  on the dependency-path analysis — none in the production browser bundle.** *(Re-triaged
  by `npm ls` this run; one correction to the prior run's "none in `dependencies`"
  claim — see `zod`.)*
  - Evidence: `npm ls` + `npm audit --json` by dependency path:
    - **undici** (high, multiple CVEs) — transitive **only** via `jsdom@29.1.1 →
      undici@7.29.0`; `jsdom` is a `devDependency` (vitest's test DOM). Not shipped. (No
      `@supabase/supabase-js → undici` edge in the tree.)
    - **vite** 7.0.0–7.3.6 (high, launch-editor CVEs) — the build tool / dev server; the
      advisories are Windows-dev-server-only and never in a built artifact. `fixAvailable`
      non-major.
    - **vitest / @vitest/mocker** (moderate; now two CVEs incl. a manual-mock code
      injection) — test runner only.
    - **brace-expansion, source-map-js, fast-uri, serialize-javascript, postcss-nested /
      postcss-selector-parser** — build/test transitives (`serialize-javascript` via the
      PWA/workbox build step; `postcss-selector-parser` via tailwind). None reach runtime.
    - **tailwindcss / @tailwindcss/typography / tailwindcss-animate** (direct, build-time
      CSS tooling) — carried; `fixAvailable` is SemVer-major (one a downgrade), needs
      human validation.
    - **`zod` <4.6.6 (high)** — **correction to #381, which listed "none in
      `dependencies`": `zod` IS a direct production dependency** (`dependencies.zod`,
      installed **3.25.76**, used for client-side form validation via
      `@hookform/resolvers` + `react-hook-form`). However the advisory
      ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), memory
      exhaustion validating oversized constrained collections) is a **client-side
      form-validation path**: the only attacker is the user supplying oversized input to
      their own browser (self-DoS), with no server, cross-user, or data-integrity surface.
      Real-world risk is negligible. The fix is a **SemVer-major (zod 4.x)** — a breaking
      change needing human validation of every `zod` schema in the app, not a
      hygiene-run lockfile bump.
    - The two production-reachable advisories prior runs deferred (**pdfjs-dist** high,
      **react-router** moderate ×2) remain **gone**, cleared by #350 and #353.
  - Risk: **no meaningful production-runtime exposure.** `zod` is the only prod-dep
    advisory and is a negligible-risk self-DoS on client form validation; everything else
    is dev/build/CI-only. The count movement (19 → 14) is advisory-DB churn against
    unchanged in-tree tooling, not a product-risk change.
  - Recommended fix: let Dependabot carry the non-breaking fixes (undici, vite patch,
    vitest, brace-expansion, fast-uri, source-map-js, postcss-nested, serialize-javascript)
    — its full-tree resolution is not subject to the local `--package-lock-only`
    `edgesOut` crash. The SemVer-major ones (`zod` 4.x, `tailwindcss`) need human
    validation. No lockfile surgery warranted in a docs-only run under the freeze's "no
    routine dependency PRs" rule.
  - Owner / next step: Deferred — Dependabot-tracked. The `zod` 4.x major is a candidate
    to validate alongside the other majors when the freeze lifts; negligible live risk
    meanwhile. Optionally add a non-blocking `npm audit --audit-level=high` CI step
    (maintainer call; unchanged from prior runs).

### Low / clean-up

- [ ] **`isEvalSupported: false` defence-in-depth was removed from the pdf.js call
  (#350).** *(Carried from #381; latent only — the parser is unreachable under the
  freeze.)*
  - Evidence: [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) `extractPdfText`
    previously passed `isEvalSupported: false` to `getDocument`; #350 removed it with a
    comment that pdf.js 6 removed the eval codepath GHSA-hq66-cqwq-w95j exploited. The
    resume-upload surface is fully frozen (`FROZEN_PRODUCT.resumeUpload = false` gates the
    Home inputs; `Profile` is not routed in [`App.tsx`](../../src/App.tsx)), so **no live
    path reaches the parser**.
  - Risk: **none while frozen.** Latent: if resume upload is un-frozen without re-adding
    the option (or confirming the pdf.js-6 eval-removal claim with an upstream citation),
    a crafted PDF could reach an eval codepath if the claim is imprecise. pdf.js here
    extracts text only (no `page.render`, scripting off), keeping the residual surface
    small regardless.
  - Recommended fix: treat "re-add `isEvalSupported: false` or confirm the pdf.js-6
    eval-removal claim" as a **precondition of un-freezing resume upload**
    (PREPIO-27/PREPIO-140). No action needed while frozen.

- [ ] **`react-refresh/only-export-components` lint warnings (9).** *(Carried;
  cosmetic/DX.)*
  - Evidence: the fast-refresh hints from mixing component and non-component exports in a
    file (incl. the #338 `hasQuestionInsightsContent` helper in
    [`QuestionInsightsPanel.tsx`](../../src/components/practice/QuestionInsightsPanel.tsx)).
    Lint is informational in CI (not a gate).
  - Recommended fix: move non-component exports into sibling helper modules. Out of scope
    for a docs-only PR; noted for a follow-up cleanup.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, test, and the Playwright landing smoke (#348)
    — not `npm audit`. Advisory response relies on Dependabot (security updates enabled;
    version-update PRs paused at `open-pull-requests-limit: 0` for the freeze) and the
    GitGuardian PR check for secrets.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A CI-policy
    call for maintainers.

## Small fixes made in this run

- **None.** `main` has not advanced since #381, so the window introduced nothing to fix;
  the carried High is owner-attended (PREPIO-145), the carried Medium's fix is written and
  CI-green as PR #375 (PREPIO-184), and the remaining items are dev/build-only dependency
  advisories deferred to Dependabot (blocked locally by the npm `edgesOut` resolver bug)
  under the freeze's "no routine dependency PRs" rule. The note and its
  [`docs/audits/README.md`](./README.md) index row are the deliverable. The only new
  content vs #381 is an accuracy correction (recorded in the audit `npm`-triage Medium):
  `zod` is a direct **production** dependency, not dev-only — negligible live risk, major
  fix.

## Deferred items

Tracked, in-flight, or Dependabot-surfaced:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot blobs
  + PII/credential exposure review (High/Urgent, Todo). History remains exposed on the
  public repo.
- **PREPIO-184 / PR #375** — registrable-label fix for the `official_company`
  attacker-subdomain over-trust (Medium). **Written, test-covered, CI-green, mergeable** —
  confirm it merges, then deploys via PREPIO-124.
- **PREPIO-124** — deploy the PREPIO-143 ownership fix and the window's other edge changes
  to production; the repo merge alone does not repair production. The top standing
  "repo merge ≠ deployed" item.
- **Dev/build/test-only `npm audit` advisories** (undici via jsdom, vite/launch-editor,
  vitest, brace-expansion, fast-uri, source-map-js, postcss, serialize-javascript,
  tailwind, and the negligible-risk `zod` client-validation advisory) — Dependabot-tracked;
  no production-bundle exposure. The SemVer-major ones (`zod` 4.x, `tailwindcss`) need
  human validation when the freeze lifts.
- **pdf.js `isEvalSupported` re-add / claim-verification** — a precondition of un-freezing
  resume upload (PREPIO-27/PREPIO-140), not a live risk.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **`react-refresh/only-export-components` warnings** (Low, DX) — helper-module move;
  follow-up cleanup, not filed.

## Questions for product owner

- None blocking. The previously standing Linear-cap blocker has **eased**: the one carried
  Medium is now filed (PREPIO-184) and fixed in PR #375. The remaining open items each
  have an owner or tracker (PREPIO-145 owner-attended; PREPIO-124 deploy; Dependabot for
  advisories).

## Next review focus

1. **Confirm PR #375 (PREPIO-184) merges, then deploys (PREPIO-124).** The code is the
   recommended registrable-label fix and is CI-green; verify it lands on `main` and then
   reaches production (repo merge ≠ deployed). After it merges, re-run the full baseline
   against the new HEAD and read the *merged* `classifyRetrievedSource` to confirm the
   curated multi-part-suffix / delegated-platform sets behave as the PR claims.
2. **Confirm the PREPIO-143 BOLA fix is deployed (PREPIO-124), not just merged.** Then
   re-audit `company-research`, `job-analysis`, and `answer-feedback` for the same
   object-ownership check applied to their own caller-supplied IDs.
3. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV PII is
   still publicly fetchable from history. Track the owner-attended filter-repo/BFG +
   force-push and verify the identified blobs are gone from all refs afterward.
4. **Next source-touching merge after the freeze.** Re-run the full baseline against it and
   read the *merged* code, not commit messages (the standing lesson). Watch especially for
   any un-freeze of an excluded surface (resume upload → re-add `isEvalSupported: false`;
   billing/voice/profile/answer-feedback → re-verify server-side anonymous rejection and
   ownership checks before the client gate is lifted).

[#375]: https://github.com/Akkkkkkki/Prepio/pull/375
