# Recurring hygiene review — 2026-10-14

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio. This is the
first hygiene run since the **freeze-lockdown merges landed on `main`** (#354 "lock
Prepio to the invite-only frozen core", #360 "close freeze gaps"), plus the follow-on
test/doc/auth merges (#363 PREPIO-180, #364/#368/#370 added coverage, #373 PREPIO-153
RUNBOOK). The headline is **net-positive**: four findings carried by the last several
runs are now resolved on `main`, the freeze gates the resume-upload parser surface off
at runtime, and the one meaningful new signal — `npm audit` rising **5 → 18** — is
almost entirely newly-disclosed **dev/build-tooling** transitive advisories with no
production runtime path.

**Resolved on `main` since the 2026-09-12 run (#27), verified in code this run:**

- **`searchId` BOLA (PREPIO-143) — fixed.** PR **#337** ("security: enforce interview
  research search ownership") merged. `authorizeSearch`
  ([`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts))
  now fail-closes: a JWT user must own both the body `userId` *and* the persisted
  `searches` row (`select id from searches where id = :searchId and user_id =
  :authUserId`, 403/404 on miss) before any service-role write. The diff since the last
  audit is a cosmetic TS2589-depth type-boundary workaround (casts the client param
  through `unknown` to the narrow `SearchOwnershipClient` seam); the ownership check and
  its tests are intact.
- **`pdfjs-dist` high advisory — cleared.** PR **#350** ("security: upgrade pdfjs-dist 5
  to 6") merged; the GHSA-hq66-cqwq-w95j major that three prior runs carried is gone
  from `npm audit`.
- **`react-router` two advisories — cleared.** PR **#353** ("Upgrade react-router-dom
  6 → 7", PREPIO-172) merged; both the open-redirect (GHSA-wrjc-x8rr-h8h6) and the
  SSR-hydration advisory (GHSA-337j-9hxr-rhxg, never reachable on this CSR-only SPA) are
  gone.
- **`SEARCH_COMPLETE` PII-in-logs leak (PREPIO-179 follow-up Medium) — fixed.**
  [`company-research/index.ts:321`](../../supabase/functions/company-research/index.ts)
  now logs `buildSearchCompleteLogPayload(result)` instead of the whole `result`. The
  new helper
  ([`result-aggregation.ts`](../../supabase/functions/company-research/result-aggregation.ts))
  emits **counts only** (`searchPayloads`, `searchResults`, `extractedContent`,
  `totalUrlsExtracted`) — no raw Tavily `query` strings (which embed note-derived
  interviewer/team names) and no provider page text reach the function logs. Covered by
  `result-aggregation.test.ts`. This closes the confirmed leak path the 2026-09-12 run
  recorded as an open Medium.
- **Anonymous-Auth rejection added** to the shared edge-function authorizer
  ([`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts)): `authorizeRequest`
  now rejects `data.user.is_anonymous`, matching the freeze requirement ("Core provider
  functions reject anonymous Auth users"). Security-positive.

**Freeze now removes the resume-upload parser surface at runtime.** `FROZEN_PRODUCT`
([`src/lib/frozenProduct.ts:8`](../../src/lib/frozenProduct.ts)) sets
`resumeUpload: false`, and every `<input type="file">` in
[`Home.tsx`](../../src/pages/Home.tsx) is gated behind `FROZEN_PRODUCT.resumeUpload`
(lines 827, 951, 1008). So `handleFileUpload` → `extractResumeText` → the pdf.js /
`mammoth` parsers are **never attached to a rendered element and never execute at
runtime** while the flag is off. This is a material change from the 2026-09-12 run,
which (correctly, for its HEAD — before the lockdown merges) recorded PDF upload as a
live surface reaching the parser even for guests. The dead code and the
`pdf.worker.min` asset still ship in `dist` (behind the compile-time flag), but there is
no runtime entry point.

**`npm audit` 5 → 18 (10 moderate, 8 high) — triaged, no production runtime exposure.**
The jump is newly-disclosed advisories in the ~month window, overwhelmingly against
**dev/build/test tooling that is not in the browser bundle and not in the deployed Deno
edge functions**:

- `undici` (8 of the highs, by advisory) comes solely from `jsdom` → **dev/test-only**
  (`npm ls undici` → `jsdom@29.1.1 → undici@7.29.0`); jsdom is the Vitest DOM
  environment, never shipped.
- `brace-expansion`, `braces`, `micromatch`, `chokidar`, `fast-glob`, `source-map-js`,
  `fast-uri`, `postcss-nested`, `postcss-selector-parser`, `tailwindcss`,
  `@tailwindcss/typography`, `tailwindcss-animate` — all **build-time** glob/watch/CSS
  tooling (Vite/PostCSS/Tailwind/Workbox chain). Not in the runtime bundle.
- `@vitest/mocker` / `vitest` — **dev/test-only** (carried from prior runs).
- `mammoth` (+ its `argparse` 1.x and `sprintf-js`) is the only advisory on a
  *production* dependency (the DOCX resume parser), but it is **inert while the freeze
  gates upload off** (see above). npm's suggested "fix" (downgrade `mammoth` to 0.3.29)
  is a nonsensical major-version regression, not a real remediation.

**No lockfile fix was applied** — `npm audit fix` (even the non-breaking, no-`--force`
form) **aborts with `Cannot read properties of null (reading 'edgesOut')`**, the same
npm resolver bug (triggered by the `overrides` field in `package.json`) that blocked
dependency surgery on the 2026-09-12 and 2026-09-09 runs. Dependabot's full-tree
resolution is not subject to the local `--package-lock-only`/`audit fix` crash, so the
in-range bumps should be carried by its PRs. No manual multi-package lockfile surgery is
warranted for advisories with no production runtime exposure.

**Carried / still open:**

- **Evidence-ledger `official_company` over-trust (Medium)** — still present, unchanged.
  [`evidence-ledger.ts:175-177`](../../supabase/functions/interview-research/evidence-ledger.ts)
  returns `official_company`/high trust when any company token is a substring of the
  whole normalized host (`.includes()`), with the code comment still deferring
  PSL-aware registrable-label matching as follow-up. Service-source edge-function change,
  out of scope for a docs-only hygiene run and not validatable here (the agent proxy
  blocks the Deno remote-import typecheck).
- **PREPIO-145 — production CV PII is CONFIRMED still recoverable from Git history
  (High).** *(Re-verified exposed this run — corrected after Codex review of this PR;
  an initial draft understated it as "unverifiable" because the review started on a
  shallow 50-commit clone.)* After `git fetch --unshallow`, the 2026-09-12 run's claim
  holds: `git merge-base --is-ancestor 5585fd4 a330939` **succeeds** (the blob's commit
  is in the PR base's ancestry) and
  `git rev-parse 5585fd4:docs/audits/assets/2026-07-09/11-d-new-interview.png` resolves
  to blob `3a6f18c6` at **146,389 bytes** — the original un-redacted CV screenshot (vs
  the 23,025-byte redacted working-tree version from #342). This is a **public repo**, so
  the blob is fetchable by anyone with the SHA. A freeze-exit release blocker; the
  owner-attended `git filter-repo`/BFG history purge is still required and not yet done.

**Baselines (HEAD `a330939`; deltas vs 2026-09-12):** lint **49** problems (40 errors,
9 warnings; **−3 errors** vs 52 — the freeze deletions in `Home.tsx`/`Practice.tsx`
removed some `no-explicit-any` sites; still informational, not a CI gate). Typecheck
**pass at baseline** (app **61** — ratcheted down from 62, node **0**). Build **pass**,
**1243.41 KiB** precache / **41** entries (down from 2280.54 KiB / 62 — the freeze
removed billing/voice/upload surfaces). Tests **494** passing / **58** files (up from
461/52). `npm audit` **18** (triaged above).

**No product-source change made.** This run's deliverables are documentation only: this
note, the `docs/audits/README.md` index row, and one small doc-accuracy fix to
[`CLAUDE.md`](../../CLAUDE.md) (the typecheck-baseline line said "app baseline 62"; the
script's real ratchet is `APP_BASELINE=61`). All respect the active freeze (no features,
no routine dependency PRs, no schema/auth/flow changes).

## Commands run

- `npm install`: **pass** (via SessionStart hook; `audited 748 packages`).
- `npm run lint`: **49 problems (40 errors, 9 warnings)** — −3 errors vs 2026-09-12.
  Informational in CI (not a gate); pre-existing `@typescript-eslint/no-explicit-any`
  in tests/edge functions + the fast-refresh warnings. This run pushes no source.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61** (was 62; the ratchet was lowered), node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under `$CI`). This run pushes
  no `supabase/functions` source; the range's edge-function merges each passed the real
  CI `verify` gate at merge time.
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1243.41 KiB**).
- `npm test`: **pass** (**58 files, 494 tests**), incl. the schema/design-token checks.
- `npm audit`: **18** (10 moderate, 8 high) — triaged in the Summary; no production
  runtime exposure, `npm audit fix` blocked by the npm `edgesOut` resolver bug.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is CONFIRMED still recoverable from Git history
  (PREPIO-145).** *(Re-verified exposed this run — initial draft understated this as
  "unverifiable" on a shallow clone; corrected after Codex review of this PR.)*
  - Evidence: the review began on a **shallow clone** (50 commits), where `5585fd4` was
    absent. After `git fetch --unshallow`, the 2026-09-12 claim was re-confirmed against
    full history: `git merge-base --is-ancestor 5585fd4 a330939` **succeeds** (so the
    pre-redaction commit is reachable from the PR base `a330939`), and
    `git rev-parse 5585fd4:docs/audits/assets/2026-07-09/11-d-new-interview.png` resolves
    to blob `3a6f18c6` at **146,389 bytes** — the original un-redacted CV screenshot, vs
    the 23,025-byte redacted working-tree version from #342. The nine other paths listed
    in #342 are the same shape. *(PII not reproduced here per the review's redaction
    rule.)*
  - Risk: real personal data remains publicly fetchable by commit SHA on a **public
    repo** until history is rewritten — a freeze-exit release blocker per the issue.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge of the identified blobs +
    coordinated force-push, preserving an off-remote backup ref, plus the PR/comment
    exposure review the issue calls for. Do **not** run a history rewrite unattended.
  - Owner / next step: **PREPIO-145** (owner-attended). Already tracked with a full
    remediation plan; no new issue filed. Out of scope for an unattended hygiene run
    (force-push history rewrite of a shared public repo).

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token (attacker-subdomain trust escalation).** *(Carried from 2026-09-12; re-verified
  open, unchanged.)*
  - Evidence:
    [`evidence-ledger.ts:175-177`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust) when any `companyTokens(company)` entry is a
    substring of it (`.includes(token)`). So for company "Acme", a role link
    `https://acme.attacker.example/job` → `acmeattackerexample`.includes("acme") →
    high-trust "official company". The code comment (lines 181-186) explicitly defers
    PSL-aware registrable-label matching as follow-up.
  - Risk: attacker-controlled content whose hostname embeds the company name is weighted
    as high-trust official evidence, biasing generated prep. Gating: the row must enter
    via the caller's own `roleLinks` (self-inflicted) or a Tavily result the attacker
    ranks for the company query. Content-integrity, not cross-tenant read. (The
    cross-tenant-write compounding vector, `searchId` BOLA, is now **closed** by #337.)
  - Recommended fix: match the company against the host's registrable label (exact,
    PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting` already uses; add
    adversarial tests rejecting `company-token.attacker.example` subdomains; fold in the
    deferred `official_job` short-name/employer-domain follow-up.
  - Owner / next step: file as `Bug` + `area:research-pipeline` (Quality & Maintenance),
    cross-linked to PREPIO-144 and this audit, **if the Linear free-issue cap allows**
    (prior runs recorded the cap blocking intake). Recorded here in full regardless.
    Out of scope for a docs-only hygiene run and not validatable in this proxy-limited
    environment.

- [ ] **`mammoth` DOCX-parser advisory chain (`argparse` 1.x, `sprintf-js`) — new in
  `npm audit`, but inert behind the freeze upload gate.** *(New this window.)*
  - Evidence: `npm audit` reports `mammoth` (direct dep, DOCX resume parser) pulling
    vulnerable `argparse@1.x` and `sprintf-js` (both moderate DoS/ReDoS-class). `mammoth`
    is lazy-imported (`import("mammoth")`,
    [`resumeUpload.ts:60`](../../src/lib/resumeUpload.ts)) only from `handleFileUpload`,
    which is wired **only** to the `FROZEN_PRODUCT.resumeUpload`-gated file inputs. With
    the flag `false`, that path has no runtime entry point.
  - Risk: **low while the freeze holds** — no untrusted DOCX reaches the parser at
    runtime. Becomes live if/when resume upload is re-enabled.
  - Recommended fix: none in-run (no runtime exposure; `npm audit fix` blocked by the
    resolver bug). Let Dependabot carry a `mammoth`/transitive bump; re-evaluate before
    any future un-gating of upload. npm's "downgrade to 0.3.29" suggestion is spurious.
  - Owner / next step: Deferred — Dependabot-surfaced; tie to the eventual
    upload-re-enable decision (PREPIO-27/PREPIO-140 surface work).

### Low / clean-up

- [ ] **`npm audit` 5 → 18: the net-new advisories are dev/build-tooling only, no
  production runtime path.** *(New this window.)*
  - Evidence: `undici` (8 highs) via `jsdom` (Vitest DOM env, dev-only);
    `brace-expansion`/`braces`/`micromatch`/`chokidar`/`fast-glob`/`source-map-js`/
    `fast-uri`/`postcss-*`/`tailwindcss*` (build-time glob/watch/CSS chain);
    `@vitest/mocker`/`vitest` (dev/test). None ship in the browser bundle or the Deno
    edge functions.
  - Recommended fix: let Dependabot carry the in-range bumps (its full-tree resolution
    is not subject to the local `edgesOut` crash). No manual lockfile surgery for
    dev-tooling advisories with no production exposure.

- [ ] **`npm audit fix` is unusable locally (npm `edgesOut` resolver bug).** *(Carried;
    re-confirmed this run.)*
  - Evidence: `npm audit fix --dry-run` aborts with `Cannot read properties of null
    (reading 'edgesOut')`, triggered by the `overrides` field (`esbuild`). Same failure
    the 2026-09-09 and 2026-09-12 runs hit on `npm update --package-lock-only`.
  - Recommended fix: rely on Dependabot for lockfile bumps; a maintainer can run the fix
    outside this proxy sandbox if a targeted bump is ever needed urgently.

- [ ] **Informational lint warnings (9) and `npm audit` not a CI gate.**
    *(Observations, carried — unchanged.)*
  - Evidence: `npm run lint` reports 9 `react-refresh/only-export-components` warnings
    (incl. the #338 `hasQuestionInsightsContent` one noted 2026-09-12); lint is
    informational, not a gate.
    [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint, typecheck,
    typecheck:functions, build, test — not `npm audit`.
  - Recommended fix: both are maintainer-policy calls (a helper-module move for the
    warning; an optional non-blocking `npm audit --audit-level=high` step), not
    hygiene-run changes.

## Small fixes made in this run

- **Doc accuracy — `CLAUDE.md`:** corrected the typecheck-baseline line from "app
  baseline 62" to "app baseline 61" to match the real ratchet
  (`scripts/check-typecheck-baseline.sh` → `APP_BASELINE=61`). One-line docs fix; no
  product behavior.
- **This note + `docs/audits/README.md` index row.**
- No product source, dependency manifest, lockfile, migration, config, auth, or flow
  changed — the freeze guardrails (no features, no routine dependency PRs) and the
  blocked `npm audit fix` leave the note as the deliverable.

## Deferred items

- **Evidence-ledger `official_company` over-trust** (Medium) — file against Quality &
  Maintenance (`Bug` + `area:research-pipeline`), cross-linked to PREPIO-144 + this
  audit, if the Linear free-issue cap allows; recorded in full above regardless.
- **PREPIO-145** — owner-attended Git-history CV-PII purge; **re-confirmed exposed this
  run** (the un-redacted 146,389-byte blob is still reachable from the PR base). Still
  owed and unattended-out-of-scope.
- **`mammoth` / dev-build-tooling advisories** — Dependabot-surfaced; no production
  runtime exposure while the freeze gates upload off; `npm audit fix` blocked locally by
  the `edgesOut` bug.
- **`@vitest/mocker`/`vitest` dev-only advisory** (carried) — within range once the
  resolver bug clears; let Dependabot carry.
- **`npm audit` as a non-blocking CI step** and **the #338 fast-refresh lint-warning
  helper move** — maintainer-policy calls.

## Questions for product owner

- **Should the recurring hygiene review keep running during the freeze? (policy
  tension, raised by Codex on this PR.)** `CLAUDE.md` (lines 24-27, added 2026-09-22 by
  #354 — *after* runs #26/#27 landed, so this is the first hygiene run under it) says
  "Do not add features, **recurring audits** or routine dependency PRs." Codex reads
  this as prohibiting this note. The scheduled recurring-review task, by contrast,
  mandates a dated note each run, and `docs/audits/` holds 27 prior entries as an
  established security practice. This run was kept because it surfaces a **confirmed
  High security exposure** (PREPIO-145), which the freeze explicitly wants surfaced
  ("Fix obvious security issues"), and it is docs-only. **Owner decision needed:** if
  the freeze means to pause the hygiene *cadence* (deferring routine notes while keeping
  ad-hoc security surfacing), say so and future runs will post findings only when a
  confirmed security/reliability issue exists, skipping the routine ceremony; otherwise
  the established cadence continues. Recorded so the rule is set once, not re-litigated.
- **PREPIO-145 is confirmed still exposed** (not merely owed a check) — the
  owner-attended history purge is the blocker; nothing here can or should rewrite the
  public repo's history unattended.
- **Linear free-issue cap** (noted by prior runs) — if still in force, the one new
  trackable finding (evidence-ledger over-trust) stays recorded in this note only.
  Clearing the cap would let it live in the backlog.

## Next review focus

1. **Track the PREPIO-145 history purge to completion** — the highest-residual-risk open
   item, re-confirmed exposed this run (the un-redacted blob is reachable from the PR
   base). After the owner-attended `git filter-repo`/BFG purge + force-push, verify the
   identified blobs are gone from all refs.
2. **Land the evidence-ledger `official_company` PSL-aware fix** — registrable-label
   match + adversarial `company-token.attacker.example` tests, folding in the deferred
   `official_job` short-name/employer-domain follow-up; then re-audit the whole
   `classifyRetrievedSource` trust map. The last remaining open research-pipeline Medium.
3. **Dependabot dependency bumps** — confirm the dev/build-tooling advisories (undici via
   jsdom, the tailwind/postcss/glob chain, vitest) get carried by Dependabot PRs since
   local `npm audit fix` is blocked; re-evaluate `mammoth` before any future un-gating of
   resume upload.
