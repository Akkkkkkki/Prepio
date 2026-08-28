# Recurring hygiene review — 2026-08-26

## Summary

Twenty-fifth recurring codebase hygiene & security review for Prepio.

**Second consecutive docs-only window.** Since the last hygiene review
(#24, HEAD `d0377e8`, 2026-08-22) merged, `main` has **not advanced at all** —
`git rev-parse HEAD origin/main` both resolve to `d0377e8`, and the only
commits since the prior review's base are that review's own note plus the
2026-08-23 UX routine note (#307). No functional source, no config, no
migration, no edge function, and no dependency manifest changed since run #24.
**Headline: no new code surface merged, so no new security, reliability, or
data-flow risk was introduced by the product this window.**

**One small fix was made this run** — I bounded the raw-model-response log in
[`parseJsonResponse`](../../supabase/functions/_shared/openai-client.ts) to a
500-char preview, closing the PII-in-logs Low finding that the last two runs
carried as "still owed a fix." This was the one standing item that was both
in-scope for a hygiene run and safely fixable in this environment (a
single-file, isolated logging change to a Deno shared module; the JS test
suite does not import it, and it does not touch any product flow). Everything
else is either an owner-scheduling item (PREPIO-143 BOLA fix PR) or a
dependency major-bump that Dependabot already surfaces.

**One genuinely new signal this window:** `npm audit` now reports a **second**
`react-router` advisory — GHSA-337j-9hxr-rhxg (*Arbitrary Constructor
Injection via `deserializeErrors()` in React Router **SSR** Hydration*) —
alongside the pre-existing open-redirect one. Prepio is a **client-only SPA**
(`BrowserRouter` in [`src/App.tsx:84`](../../src/App.tsx); no
`hydrateRoot`/`renderToString`/`StaticRouter` anywhere in `src/`), so the
SSR-hydration exploit path for this new advisory **does not apply** to the
shipped app. The vulnerable-version count is unchanged (react-router-dom is
still one package); only the advisory count against it rose. Fix still
requires the react-router v7 major, unchanged from prior runs.

Baselines (measured against HEAD `d0377e8`; all flat vs 2026-08-22):
lint **51** problems (43 errors, 8 warnings). Typecheck **pass at baseline**
(app tsc **62**, node **0**). Build **2278.79 KiB** / 62 precache entries
(byte-flat). Tests **426** passing (49 files). `npm audit` **3** findings
(2 react-router moderate + 1 pdfjs-dist high) — same package count, one new
advisory attached.

## Commands run

- `npm install`: **pass** (via SessionStart hook). 3 vulnerabilities
  (2 moderate, 1 high) — unchanged package count from 2026-08-22.
- `npm run lint`: **51 problems (43 errors, 8 warnings).** Flat vs the
  2026-08-22 baseline. No source changed this window, so no lint delta was
  possible; the one in-run fix is a Deno edge-function file outside the
  ESLint config's TS-project scope.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: **62** errors. Node: **0** errors. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks
  `esm.sh` / `deno.land`, so Deno cannot resolve the edge functions' remote
  imports; the script reports `SKIPPED — this is not a pass` (exit 0 locally,
  but `exit 1` under `$CI`, lines 57–60 / 139–143). The one file I changed
  this run is plain TS with no new imports; it is covered by the real CI
  `verify` job on the PR this note ships in.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries,
  **2278.79 KiB**). Byte-flat vs 2026-08-22.
- `npm test`: **pass** (49 test files, **426 tests**). Re-run after the
  edge-function edit — still 426/426 green (the suite does not import the
  changed Deno module, confirming the change is isolated).
- `npm audit`: **3** (2 react-router moderate + 1 pdfjs-dist high). `npm audit
  fix` non-force is a no-op for the runtime advisories: react-router's patch
  is `>7.17.0` (v7 major, outside the `^6.26.2` manifest constraint — the
  "fix available via npm audit fix" line is npm being optimistic; the
  `--dry-run` applies nothing), and pdfjs-dist needs the breaking 5 → 6 major.

## Findings

### Critical

- None.

### High

- [ ] **`interview-research` never verifies `searchId` ownership —
  cross-tenant write (BOLA) via the service-role client.** *(Carried from
  2026-08-12; re-verified still open this run. Pre-existing, not a
  regression. Tracked as PREPIO-143.)*
  - Evidence: the only identity check is body `userId` == JWT user
    ([interview-research/index.ts:1096](../../supabase/functions/interview-research/index.ts)).
    `searchId` (line 1085) is taken straight from the request and is **never**
    checked against the caller, yet every downstream write keys off it with
    the service-role client (e.g. resume snapshot
    [:1136](../../supabase/functions/interview-research/index.ts), stage
    upserts [:936/:947](../../supabase/functions/interview-research/index.ts),
    status update [:1067](../../supabase/functions/interview-research/index.ts)).
  - Risk: a signed-in user who supplies their own `userId` but another
    tenant's `searchId` can drive writes against a search row they do not own.
    Service-role writes bypass RLS, so the DB will not stop it.
  - Recommended fix: before any write, `select user_id from searches where
    id = searchId` and reject when it is absent or `!= userId`. Land it with a
    cross-tenant-rejection test and confirm the normal create → invoke flow
    still passes. Then re-audit `company-research`, `job-analysis`, and
    `answer-feedback` for the same missing object-ownership check.
  - Owner / next step: **PREPIO-143** (a substantive edge-function change,
    out of scope for a hygiene run and not validatable in this proxy-limited
    environment). Deferred to a dedicated fix PR.

### Medium

- [ ] **`pdfjs-dist` high-severity advisory (GHSA-hq66-cqwq-w95j) — arbitrary
  JS execution on opening a malicious PDF.** *(Carried; re-verified.)*
  - Evidence: `npm audit` reports `pdfjs-dist >=5.6.83 <6.2.108` high; the app
    parses user-uploaded resumes client-side via the `pdf-*` chunk.
  - Risk: a crafted resume PDF could execute script in the parsing context.
    Materially mitigated by pdf.js worker isolation, but still the highest-CVSS
    open advisory.
  - Recommended fix: bump `pdfjs-dist` to `>=6.2.108` (a 5 → 6 major) behind a
    resume-upload regression check (PDF **and** DOCX parse paths). Dependabot
    will open the PR; it needs a human to validate the major.
  - Owner / next step: Deferred — dependency major, Dependabot-surfaced. Not a
    lockfile-only fix.

### Low / clean-up

- [x] **`parseJsonResponse` logged the entire raw model response on a parse
  failure — PII-in-logs.** *(Carried from 2026-08-22; **fixed this run**.)*
  - Evidence (before):
    [`openai-client.ts:93`](../../supabase/functions/_shared/openai-client.ts)
    was `console.error("Raw response:", content)`, dumping the full model
    output. For the `cv-analysis`, `answer-feedback`, and `profile-import`
    callers that output echoes user CV text, interview answers, and imported
    profile data.
  - Fix: bounded the log to a 500-char preview with a truncation marker,
    matching the existing `RESEARCH_CONFIG.logging.logContentSamples`
    "first 500 chars" convention. Parse errors are structural, so the preview
    plus the error position keeps debuggability while cutting the volume of
    PII that reaches `console`.
  - Note: this reduces, not eliminates, PII in the preview. The broader
    "should any raw model content be logged at all" question stays with the
    PREPIO-141 observability decision.

- [ ] **`check-deno-baseline.sh` is a total-count ratchet with an
  import-resolution soundness gap.** *(Carried from 2026-08-22; re-verified.
  Noted for the ratchet's maintainers, not filed — see below.)*
  - Evidence: the wrapper fails only on `count > BASELINE` (19), a
    network-classified skip under `$CI`, or a nonzero `deno` exit with
    `count == 0`. A non-connection import error whose text misses the
    network-skip regex, leaving 1–19 countable diagnostics, would exit 0.
  - Risk: low — the real CI `verify` job does run a genuine `deno check` as a
    blocking step (not the PREPIO-119 silent no-op), so this is a soundness
    gap in the *proof of completeness*, not an active false-green.
  - Recommended fix: reject any unclassified nonzero `deno` exit (not just
    `count == 0`), and treat a below-baseline count as inspect-not-pass.
  - Owner / next step: deferred; a CI-gate hardening change for the ratchet's
    maintainers, higher-risk than the hygiene mandate absorbs without approval.

- [ ] **Second `react-router` advisory (GHSA-337j-9hxr-rhxg) — SSR-hydration
  constructor injection; does not apply to this CSR-only app.** *(New signal
  this window.)*
  - Evidence: `npm audit` now attaches this advisory to `react-router
    6.0.0 - 7.17.0` in addition to the open-redirect one. The exploit is via
    `deserializeErrors()` during **SSR hydration**; Prepio ships a
    client-only `BrowserRouter` SPA with no server rendering
    ([`src/App.tsx:84`](../../src/App.tsx)).
  - Recommended fix: none specific to this advisory — folds into the existing
    react-router v7 upgrade already deferred for the open-redirect advisory.
    Noted so a future run does not treat the risen advisory count as a new
    exploitable exposure.

## Small fixes made in this run

- **Bounded the `parseJsonResponse` raw-response log to a 500-char preview**
  ([`openai-client.ts`](../../supabase/functions/_shared/openai-client.ts)) —
  reduces user-PII volume reaching `console` on a model-JSON parse failure,
  aligned to the codebase's existing content-sampling convention. Isolated to
  one Deno shared module; `npm test` re-run green at 426/426. Shipped in the
  same PR as this note.

## Deferred items

Discrete, actionable items already tracked or explicitly noted-not-filed:

- **PREPIO-143** — `interview-research` `searchId` BOLA fix PR (High). The
  highest-value follow-up. Tracked in Linear.
- **`pdfjs-dist` 5 → 6 major** (Medium) and **`react-router` v7 major**
  (Low, now covering two advisories). Both are Dependabot-surfaced major
  bumps needing human validation; no lockfile-only fix. Not separately filed —
  Dependabot is the tracker.
- **`check-deno-baseline.sh` import-resolution soundness hardening** (Low) —
  noted for the ratchet's maintainers, not filed (a CI-gate change beyond the
  hygiene mandate's approval scope).
- **PREPIO-141** — observability decision on whether any raw model content
  should be logged at all. The `parseJsonResponse` fix this run is a bound,
  not a policy answer; the policy question stays with PREPIO-141.

No **new** Linear issue is owed from this run: the one item that lacked a fix
(`parseJsonResponse`) was fixed rather than filed, and the remaining opens are
each already tracked (PREPIO-143, PREPIO-141) or Dependabot-surfaced.

## Questions for product owner

- None blocking. All open findings have an owner or a clear next action.

## Next review focus

1. **PREPIO-143 (`searchId` BOLA) fix PR** — still the highest-value open
   item. When scheduled, verify the ownership check lands with a
   cross-tenant-rejection test and the normal create → invoke flow still
   passes, then re-audit `company-research`, `job-analysis`, and
   `answer-feedback` for the same missing object-ownership check.
2. **First functional window since #22.** Runs #23–#25 have all been
   docs-only. The next merge that touches source is the one to review closely
   — re-run the full baseline against it rather than re-verifying carried
   findings.
3. **react-router v7 / pdfjs-dist 6 majors.** If Dependabot has opened the
   security PRs, spend a review validating the resume-upload (PDF+DOCX) and
   routing/redirect regression surfaces so the majors can actually land
   instead of accumulating.
