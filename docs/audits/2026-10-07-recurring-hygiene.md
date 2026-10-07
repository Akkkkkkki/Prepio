# Recurring hygiene review — 2026-10-07

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio, measured
against HEAD `bccb67c` (deltas vs the 2026-09-12 run #27 note at `f9b0454`).
This is the first review window since the **invite-only freeze landed in
source**: six merges since the last audit note, five of them source-touching
(`src/` or `supabase/functions/`, excluding tests):

- **`security: upgrade pdfjs-dist 5 to 6` (#350)** — **resolves** the carried
  `pdfjs-dist` high advisory (GHSA-hq66-cqwq-w95j). `pdfjs-dist` is now
  `6.3.289` and no longer appears in `npm audit`. The resume PDF-text parser
  (`src/lib/resumeUpload.ts`) still runs client-side; the worker-isolation +
  `isEvalSupported: false` hardening is intact.
- **`[PREPIO-172] Upgrade react-router-dom 6 → 7` (#353)** — **resolves** both
  carried `react-router` advisories (open-redirect GHSA-wrjc-x8rr-h8h6 and the
  SSR-hydration GHSA-337j-9hxr-rhxg). `react-router-dom` is now `7.18.4` and no
  longer appears in `npm audit`.
- **`fix: lock Prepio to the invite-only frozen core` (#354)** and
  **`fix: close freeze gaps found by the final audit and UX reviews` (#360)** —
  the freeze implementation across `Home.tsx`, `Auth.tsx`, `useAuth.ts`,
  `Practice.tsx`, `Navigation.tsx`, `searchService.ts`, `frozenProduct.ts`.
  **Security-positive, reviewed in full this run:**
  - Public `signUp` was removed from `useAuth` (`src/hooks/useAuth.ts`); the
    only account-creation path left is an invited email's invite/recovery link.
  - Invite/recovery link handling is the one notable new auth surface, and it is
    written defensively: `useAuth` reads the link token **at module load**
    (before supabase-js clears the hash) and only enables the set-password view
    when the *current session's* `access_token` equals the link's own token —
    so an expired/reused/bare link shows an honest error rather than letting
    whoever is already signed in set a password on another account. An
    `?flow=recovery` marker keeps signup-verification links off the
    set-new-password view. Covered by new `useAuth.test.ts` (+100 lines) and
    `Auth.test.tsx` (+65 lines).
  - The guest landing surface (`src/components/GuestSample.tsx`) is a fully
    **local, deterministic** fixed example — a hand-written `SAMPLE` array, no
    `fetch`, no Supabase client, no clock, no user input — matching the freeze's
    "guests see a deterministic local sample" promise. No data-exposure surface
    on the public route.
- **Edge-function auth hardening (part of the freeze):**
  `supabase/functions/_shared/auth.ts` now rejects authenticated callers whose
  user is `is_anonymous` (fail-closed `error || !data.user || is_anonymous`),
  matching the freeze rule that "core provider functions reject anonymous Auth
  users." `interview-research/authorization.ts` carries the **PREPIO-143 BOLA
  ownership check** that landed via #337/#351: `authorizeSearch` now verifies
  the persisted `searches` row is owned by the JWT user before any
  service-role write. (The public boundary was loosened to `unknown` + an
  internal cast to dodge a Deno TS2589 deep-generic blow-up; the runtime query
  is unchanged and still the `.eq("id").eq("user_id").maybeSingle()` ownership
  check.)

**Two of run #27's open findings are now closed by merged code, verified this
run:**

1. **The `SEARCH_COMPLETE` PII-in-logs leak (run #27 Medium) is closed.**
   `company-research/index.ts:321` now logs
   `buildSearchCompleteLogPayload(result)` — counts only
   (`searchPayloads`/`searchResults`/`extractedContent`/`totalUrlsExtracted`),
   no raw Tavily `query` and no provider page text. The new helper carries a
   PREPIO-179 comment explaining the intent and is covered by
   `result-aggregation.test.ts` (+23 lines). This completes the PREPIO-179
   redaction the run #27 note recorded as partial.
2. **The `pdfjs-dist` and `react-router` advisories (run #27 Medium/Low) are
   closed** by #350 and #353 (above).

**Net security posture: positive this window.** The freeze shrank the
attack surface (no public signup, anonymous-rejecting edge functions, static
local guest sample, ownership-checked `interview-research` writes) and two
dependency advisories plus the PII-in-logs leak are now resolved in source.
The build dropped from 2280.54 KiB to **1242.90 KiB** (–1037 KiB, 62 → 41
precache entries) as the freeze removed paid/billing/voice/import UI. **No code
change is warranted this run** — the one substantive carried finding
(evidence-ledger `official_company` over-trust) is a service-source edge
function change out of scope for a docs-only hygiene run and not validatable in
this proxy-limited environment, and `npm audit`'s jump to 18 is almost entirely
dev/build-toolchain noise that the freeze's "no routine dependency PRs" rule
keeps deferred to Dependabot (see Findings).

Baselines (measured against HEAD `bccb67c`; deltas vs 2026-09-12):
lint **49** problems (**40** errors, **9** warnings; down from 52 — the
react-router 7 migration and freeze code removals cleared three errors; the
9 warnings are unchanged, incl. the #338 `react-refresh` one). Typecheck
**pass at baseline** (app **61**, down from 62 as freeze removals dropped one
error from the ratchet; node **0**). Build **pass**, **1242.90 KiB** / 41
precache entries. Tests **483** passing / **58** files (up from 461/52 — the
freeze merges carried added coverage). `npm audit` **18** (10 moderate, 8
high) — up from 5, but see the Low section: all but the `mammoth` chain are
dev/build-time, and the jump is newly-disclosed CVEs against in-tree tooling
plus `undici` via `jsdom`, not new runtime exposure.

## Commands run

- `npm install`: **pass** (via SessionStart hook; `up to date`, 748 packages).
- `npm run lint`: **49 problems (40 errors, 9 warnings).** Down from 52 vs
  2026-09-12 (three errors cleared by the react-router 7 migration + freeze code
  removals). Errors are the pre-existing `@typescript-eslint/no-explicit-any` in
  tests/edge functions; the 9 warnings are the prior fast-refresh set incl. the
  #338 `QuestionInsightsPanel` `react-refresh/only-export-components` one. Lint
  is informational in CI; this run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (down from 62; freeze removals dropped one),
  node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the
  script reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under
  `$CI`). This run pushes no new `supabase/functions` source; the range's
  edge-function merges (#351 and the freeze auth changes) each passed the real
  CI `verify` gate at merge time (#351 is itself the "restore the Edge Function
  typecheck ratchet" merge).
- `npm run build`: **pass** (Vite + PWA, 41 precache entries, **1242.90 KiB** —
  down ~1037 KiB from the freeze's UI removals). The >550 KiB single-chunk
  warning is pre-existing/informational.
- `npm test`: **pass** (**58 files, 483 tests**), incl. the legacy-schema,
  answer-feedback-schema, and design-token checks.
- `npm audit`: **18** (10 moderate, 8 high) — up from 5; categorized in the Low
  section (dev/build toolchain + the `mammoth` transitive chain). `npm audit
  --omit=dev` reports 12, confirming ~6 are purely dev-tree.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; owner-attended history-purge
  slice. Re-verified still exposed this run.)*
  - Evidence: PR #342 replaced the audit screenshots with placeholders in the
    working tree, but the pre-redaction blobs remain in history. Confirmed this
    run against the object store (shallow clone, 50 commits):
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` resolves to the
    original **146,389-byte** blob at `cb2937d`
    (`git cat-file -s cb2937d:<path>`) while `HEAD:<path>` is the redacted
    **23,025-byte** placeholder. The other paths listed in #342 (full name,
    phone, email, LinkedIn, location, CV filename) are the same shape. **This is
    a public repository**, so those blobs are retrievable by anyone with the
    commit SHA. *(PII not reproduced here per the review's redaction rule. Note
    the original pre-redaction commit SHA differs from the `5585fd4` the run #27
    note cited — that object is not present in this shallow clone; `cb2937d`,
    where the asset was introduced, is the resolvable pre-redaction version
    here. Same exposure, verified independently.)*
  - Risk: real personal data exposed on a public remote until history is
    rewritten; a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the
    identified blobs + coordinated force-push, preserving a backup ref off the
    public remote, plus the PR/comment exposure review the issue calls for. Do
    **not** run a history rewrite unattended.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, owner). Already tracked with
    a full remediation plan; no new issue filed. Out of scope for an unattended
    hygiene run (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a
  company token — attacker-subdomain trust escalation.** *(Carried from run #27;
  re-verified still open in the merged code this run. Outside the PREPIO-144
  `official_job` scope that #340 fixed.)*
  - Evidence:
    [`evidence-ledger.ts:175–177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    still computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when **any** `companyTokens(company)` entry
    is a substring of it (`.includes(token)`). For company "Acme", a role link
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`,
    which `.includes("acme")` → `official_company`/high. The in-code comment
    (lines 181–185) explicitly defers the registrable-label / Public-Suffix-List
    fix as follow-up. The NFKD folding #340 added to `companyWords` also still
    yields a usable token for diacritic brand names (`"L'Oréal"` → `oreal`), so
    `oreal.attacker.example` is over-trusted where it was not before #340.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Gating: the row must enter via the caller's
    own `roleLinks` or a Tavily result the attacker gets ranked for the company
    query. Content-integrity, not cross-tenant read. The run #27 note's "compounds
    with the open `searchId` BOLA (PREPIO-143)" caveat is now **reduced** — the
    BOLA ownership check landed (#337/#351), so high-trust attacker text can no
    longer be driven into another tenant's plan via a foreign `searchId`.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting`
    uses; add adversarial tests rejecting `company-token.attacker.example`
    subdomains; verify legitimate employer domains (short names, multi-label
    suffixes) still classify correctly.
  - Owner / next step: file as `Bug` + `area:research-pipeline` (Quality &
    Maintenance), cross-linked to PREPIO-144, PREPIO-143, this audit, and the
    run #27 note (#346), **when the Linear free-issue cap clears** (the same
    intake blocker prior audits recorded). A substantive service-role
    edge-function change, out of scope for a docs-only hygiene run and not
    validatable in this proxy-limited environment.

- [ ] **`mammoth` DOCX parser ships two transitive DoS advisories with no
  forward fix (`argparse` → `sprintf-js`).** *(New this window; `mammoth` is the
  only runtime-path advisory in the 18.)*
  - Evidence: `npm audit` reports `sprintf-js *` (moderate, unbounded-precision
    DoS GHSA-hp3w-g68c-fv3c) and `argparse 1.0.0–1.0.10` (moderate), both via
    `mammoth@1.12.0 → argparse@1.x → sprintf-js`. `mammoth` is a **production
    dependency** — the DOCX branch of the resume-text extractor
    (`src/lib/resumeUpload.ts`). The only fix `npm audit` offers is `mammoth@0.3.29`,
    a **downgrade** (major, backwards) — not a real forward fix; `1.12.0` is the
    current release and newer `mammoth` has not dropped the `argparse@1` chain.
  - Risk: low-real. `sprintf-js`/`argparse` are used by `mammoth` for CLI arg
    parsing / message formatting, not reached by the browser DOCX-to-text path
    in any attacker-controllable way; the advisory is a DoS against a precision
    specifier, not code execution. No production-exploit path established.
  - Recommended fix: do **not** take the downgrade. Leave to Dependabot to carry
    a `mammoth` release that drops the `argparse@1` chain, or revisit if the
    PREPIO-27 resume-upload surface-lock lands (which would remove the DOCX path
    from the guest surface entirely). The freeze's "no routine dependency PRs"
    rule applies.
  - Owner / next step: Deferred — Dependabot-tracked; no actionable forward bump.

### Low / clean-up

- [ ] **`npm audit` jumped 5 → 18, but the net is newly-disclosed CVEs against
  dev/build tooling, not new runtime exposure.** *(Observation + categorization,
  not a fix candidate this run.)*
  - Evidence: the 18 break down as —
    - **Dev/build toolchain (16 of 18), no production-bundle exposure:**
      `undici` (high, 10 CVEs) via `jsdom@29.1.1` (the Vitest DOM test env);
      `brace-expansion`, `braces`, `chokidar`, `fast-glob`, `micromatch`,
      `fast-uri`, `source-map-js`, `postcss-nested`, `postcss-selector-parser`,
      `tailwindcss`, `tailwindcss-animate`, `@tailwindcss/typography` (Tailwind /
      PostCSS / Vite build chain); and `vitest` / `@vitest/mocker` (the carried
      dev-only path-traversal advisory, GHSA-82fw-gwwq-j7x9). None of these ship
      in the browser bundle in an attacker-reachable way — they run at build or
      test time.
    - **Runtime path (2 of 18):** the `mammoth` → `argparse`/`sprintf-js` chain
      (its own Medium above).
  - Risk: dev-time only for the 16; low-real for the `mammoth` chain. `npm audit
    --omit=dev` reports 12 (several of the Tailwind/PostCSS deps are in the
    production dependency tree by package manifest even though they only run at
    build time).
  - Recommended fix: a plain `npm audit fix` (no `--force`) would clear the
    SemVer-compatible subset (`undici`, `brace-expansion`, `fast-glob`,
    `fast-uri`, `postcss-nested`, `source-map-js`, `vitest`/`@vitest/mocker`)
    without touching `package.json`. **Deliberately not done this run** — the
    freeze's "no routine dependency PRs" rule (CLAUDE.md *Current Product Truth*)
    keeps dependency churn deferred to Dependabot, and prior runs established the
    same posture. The `--package-lock-only` variant is additionally blocked by
    the known npm `edgesOut` resolver bug (the `overrides: esbuild ^0.28.1`
    field). Let Dependabot's full-tree resolution carry the compatible subset.
  - Owner / next step: Deferred to Dependabot. No runtime risk requires action.

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9).** *(Carried;
  dev-only, now folded into the audit-categorization item above.)*
  - Evidence: `@vitest/mocker 2.1.0 – 4.1.10`; installed `vitest@4.1.9`. The fix
    is within the existing `^4.1.8` manifest range (a pure lockfile patch), but
    the local `--package-lock-only` crash and the freeze posture leave it to
    Dependabot. Dev/test-only — no production-bundle exposure.

- [ ] **`#338` `react-refresh/only-export-components` lint warning persists.**
  *(Carried; cosmetic/DX.)*
  - Evidence: `npm run lint` still reports the warning at
    [`QuestionInsightsPanel.tsx:53`](../../src/components/practice/QuestionInsightsPanel.tsx)
    (the exported `hasQuestionInsightsContent` helper mixed with the component
    export). 9 fast-refresh warnings total, unchanged from run #27.
  - Recommended fix: move `hasQuestionInsightsContent` into a small
    `questionInsights.ts` helper module. A ~2–3-file move touching merged product
    source; out of scope for a docs-only hygiene PR. Noted for a follow-up
    cleanup.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates
    lint, typecheck, typecheck:functions, build, and test — not `npm audit`.
    Advisory response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers; also note it would be noisy right now given
    the 16 dev-toolchain advisories.

## Small fixes made in this run

- **None.** This is a docs-only run: the review note + the `docs/audits/README.md`
  index row are the deliverable. Two run #27 findings are closed by already-merged
  code (the `SEARCH_COMPLETE` PII leak via #350/#353/the freeze's
  `buildSearchCompleteLogPayload`, and the pdfjs/react-router advisories), and
  the remaining substantive finding (evidence-ledger `official_company`
  over-trust) is a service-source edge-function change out of scope here. The
  dependency-advisory jump is dev/build-toolchain noise the freeze's
  "no routine dependency PRs" rule keeps deferred to Dependabot.

## Deferred items

- **PREPIO-145** — owner-attended Git-history purge of the production-CV
  screenshot blobs + PII/credential exposure review (High/Urgent, Todo).
  Working-tree slice done (#342); history remains exposed on the public repo.
  Re-verified live this run (`cb2937d`).
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium,
  carried) — land the registrable-label (PSL-aware) fix with adversarial
  `company-token.attacker.example` tests; fold in the deferred `official_job`
  short-name/employer-domain follow-up; re-audit the whole
  `classifyRetrievedSource` trust map. **File the Linear issue once the
  free-issue cap clears** (recorded in full above; to be filed against Quality &
  Maintenance, cross-linked to PREPIO-144/143 and this audit).
- **`mammoth` → `argparse`/`sprintf-js` DoS chain** (Medium) — no forward fix;
  do not take the `mammoth@0.3.29` downgrade. Dependabot / PREPIO-27 surface-lock.
- **The dev/build-toolchain advisory cluster (`undici` via jsdom, Tailwind /
  PostCSS / Vite / Vitest chain)** (Low) — the SemVer-compatible subset would
  clear with a plain `npm audit fix`; deferred to Dependabot per the freeze's
  "no routine dependency PRs" rule.
- **`#338` `react-refresh` lint warning** (Low, cosmetic/DX) — move
  `hasQuestionInsightsContent` to a helper module; follow-up cleanup, not filed.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **PDF/DOCX resume-upload surface-lock (PREPIO-27/PREPIO-140)** — landing it
  removes both the `pdfjs-dist` parser surface (even though its advisory is now
  cleared, the parser is still reachable by guests) and the `mammoth` DOCX path
  in one move. Already tracked.

## Questions for product owner

- **Linear is still at its free-issue cap**, so the one carried Medium that
  needs tracking (evidence-ledger `official_company` over-trust) could not be
  filed and is recorded in full in this note instead. The same intake blocker
  was noted on 2026-07-29 and 2026-09-12. Upgrading or clearing the cap would let
  hygiene findings be tracked in Linear rather than only in the audit trail. Not
  otherwise blocking: the one open High (PREPIO-145) has an owner and active
  tracking.

## Next review focus

1. **Confirm the freeze is deployed, not just merged.** The frozen core is now
   in `main`, but production remains unreconciled per CLAUDE.md until
   PREPIO-168/145, PREPIO-124/170, PREPIO-173, and PREPIO-30 have verified
   evidence. Watch for the deploy of the five approved functions + migrations
   (the `supabase migration repair` reconciliation under PREPIO-124/170 must run
   first) and verify the anonymous-rejection + ownership-check edge-function
   changes are live, not just in source.
2. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real
   CV PII is still publicly fetchable from history (`cb2937d`). Track the
   owner-attended filter-repo/BFG + force-push and verify the identified blobs
   are gone from all refs afterward.
3. **Evidence-ledger `official_company` over-trust** — file once the Linear cap
   clears; land the PSL-aware registrable-label fix with adversarial tests and
   re-audit `classifyRetrievedSource`. Also re-audit `company-research`,
   `job-analysis`, and `answer-feedback` for the same object-ownership check now
   that `interview-research` has one.
4. **Next source-touching merge.** Re-run the full baseline against it rather
   than re-verifying carried findings, and read the *merged* code (not commit
   messages) when assessing a security fix.
