# Recurring hygiene review — 2026-08-29

## Summary

Twenty-sixth recurring codebase hygiene & security review for Prepio.

**First functional window since run #22.** Runs #23–#25 were all docs-only.
Since the last hygiene review (#25, base HEAD `d0377e8`, 2026-08-26) merged,
`main` advanced to `a9640b1` with exactly **one product-code commit**:
[#311](https://github.com/akkkkkkki/prepio/pull/311) — *"Surface an honest
note when practice transcription fails."* The other two commits in the range
are docs (the #25 hygiene note and the 2026-08-27 UX routine note). Per the
prior run's Next-review-focus item 2 ("re-run the full baseline against the
first source-touching merge rather than re-verifying carried findings"), I
re-ran the full baseline and reviewed #311 closely.

**#311 reviewed and cleared — no fix owed this run.** The change adds a
non-blocking `toast` when `transcribePracticeAudio` returns `{success:false}`
in the fire-and-forget transcription path
([`Practice.tsx:1483`](../../src/pages/Practice.tsx)). It is small (20 lines,
one new constant), carries a clear rationale comment, ships with a dedicated
test ([`Practice.mobile.test.tsx:734`](../../src/pages/__tests__/Practice.mobile.test.tsx)),
and its copy — `"Your answer was still saved."` — is the **verbatim** string
from [`DESIGN_PRINCIPLES.md:74`](../../docs/DESIGN_PRINCIPLES.md), which I
confirmed matches character-for-character. No security, PII, or data-flow
concern: the toast is a generic status with no user content interpolated, and
an empty-but-successful transcript still stays silent (a wordless recording is
correctly not treated as an error). Notably, this change **closes the
"voice transcription fails silently" P2** that the last several UX-review
routines carried against this exact code path — a hygiene-relevant reliability
improvement, cleanly done.

**No new security surface, no owed fix.** Whole-tree secret scan clean; no new
hardcoded keys, tokens, or JWTs. `npm audit` is **unchanged** at 3 findings
(2 react-router moderate + 1 pdfjs-dist high) — same package count and same
two react-router advisories as run #25; no new advisory attached this window.
No Dependabot major-bump PR is open yet for either the react-router v7 or the
pdfjs-dist 6 upgrade (checked open PRs — the three open are all bot-authored
draft auto-PRs, none dependency bumps), so Next-review-focus item 3 has nothing
to validate this window.

Baselines (measured against HEAD `a9640b1`):
lint **51** problems (43 errors, 8 warnings) — flat vs #25. Typecheck
**pass at baseline** (app tsc **62**, node **0**) — flat. Build **2278.89 KiB**
/ 62 precache entries (+0.10 KiB vs #25's 2278.79 — the #311 toast string).
Tests **427** passing (**+1** vs #25's 426 — the new #311 transcription-failure
test). `npm audit` **3** findings — flat.

## Commands run

- `npm install`: **pass** (via SessionStart hook). 3 vulnerabilities
  (2 moderate, 1 high) — unchanged package count from 2026-08-26.
- `npm run lint`: **51 problems (43 errors, 8 warnings).** Flat vs the
  2026-08-26 baseline. The one source change this window (#311) added no new
  lint diagnostics — the trailing error is the long-standing
  `test_05_cv_analysis.ts:323` `no-explicit-any`, unchanged.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: **62** errors. Node: **0** errors. Flat.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks
  `esm.sh` / `deno.land`, so Deno cannot resolve the edge functions' remote
  imports; the script reports `SKIPPED — this is not a pass` (exit 0 locally,
  `exit 1` under `$CI`). #311 touches no edge function, so this gap does not
  bear on this window's change; the real CI `verify` job covers it regardless.
- `npm run build`: **pass** (Vite + PWA, 62 precache entries,
  **2278.89 KiB**). +0.10 KiB vs 2026-08-26 (the added toast copy).
- `npm test`: **pass** (49 test files, **427 tests**). +1 vs 2026-08-26 — the
  new `"tells the user when transcription fails after saving the recording"`
  test in `Practice.mobile.test.tsx`.
- `npm audit`: **3** (2 react-router moderate + 1 pdfjs-dist high). Unchanged.
  `npm audit fix` non-force remains a no-op for the runtime advisories:
  react-router's patch is the v7 major (outside the `^6.26.2` manifest
  constraint) and pdfjs-dist needs the breaking 5 → 6 major.

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
    the service-role client (resume snapshot
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
    lockfile-only fix. No Dependabot PR open for it yet as of this run.

### Low / clean-up

- [ ] **`react-router` open-redirect + SSR-hydration advisories — neither
  applies to this CSR-only app; fix folds into the deferred v7 major.**
  *(Carried; re-verified. Advisory set unchanged from #25.)*
  - Evidence: `npm audit` attaches two advisories to `react-router
    6.0.0 - 7.17.0` — GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in
    `<Link>`/`useNavigate`) and GHSA-337j-9hxr-rhxg (`deserializeErrors()`
    constructor injection during **SSR hydration**). Prepio ships a client-only
    `BrowserRouter` SPA with no server rendering
    ([`src/App.tsx:84`](../../src/App.tsx); no `hydrateRoot`/`renderToString`/
    `StaticRouter` anywhere in `src/`), so the SSR-hydration path does not
    apply, and the open-redirect path requires attacker-controlled navigation
    targets the app does not construct from untrusted input.
  - Recommended fix: none advisory-specific — both resolve with the deferred
    react-router v7 major. Noted so a future run does not read the two-advisory
    count as a new exploitable exposure.
  - Owner / next step: Deferred — Dependabot-surfaced major. No PR open yet.

- [ ] **`check-deno-baseline.sh` is a total-count ratchet with an
  import-resolution soundness gap.** *(Carried from 2026-08-22; re-verified.
  Noted for the ratchet's maintainers, not filed.)*
  - Evidence: the wrapper fails only on `count > BASELINE` (19), a
    network-classified skip under `$CI`, or a nonzero `deno` exit with
    `count == 0`. A non-connection import error whose text misses the
    network-skip regex, leaving 1–19 countable diagnostics, would exit 0.
  - Risk: low — the real CI `verify` job runs a genuine blocking `deno check`,
    so this is a soundness gap in the *proof of completeness*, not an active
    false-green.
  - Recommended fix: reject any unclassified nonzero `deno` exit (not just
    `count == 0`), and treat a below-baseline count as inspect-not-pass.
  - Owner / next step: deferred; a CI-gate hardening change for the ratchet's
    maintainers, higher-risk than the hygiene mandate absorbs without approval.

## Small fixes made in this run

None. The one source-touching merge this window (#311) was reviewed and found
clean, so no corrective change was needed. The remaining open findings are each
either out-of-scope for a hygiene run and un-validatable in this
proxy-restricted environment (PREPIO-143 BOLA, an edge-function change needing
a real Supabase instance) or Dependabot-surfaced dependency majors with no
lockfile-only fix. Unlike run #25, no dangling Low finding was outstanding to
fix.

## Deferred items

Discrete, actionable items already tracked or explicitly noted-not-filed:

- **PREPIO-143** — `interview-research` `searchId` BOLA fix PR (High). The
  highest-value follow-up. Tracked in Linear.
- **`pdfjs-dist` 5 → 6 major** (Medium) and **`react-router` v7 major**
  (Low, covering both react-router advisories). Both are Dependabot-surfaced
  major bumps needing human validation; no lockfile-only fix, no PR open yet.
  Not separately filed — Dependabot is the tracker.
- **`check-deno-baseline.sh` import-resolution soundness hardening** (Low) —
  noted for the ratchet's maintainers, not filed (a CI-gate change beyond the
  hygiene mandate's approval scope).
- **PREPIO-141** — observability decision on whether any raw model content
  should be logged at all (the #25 `parseJsonResponse` bound was a limit, not
  a policy answer).

No **new** Linear issue is owed from this run: no new finding was surfaced —
the one source change was clean, and every carried open is already tracked
(PREPIO-143, PREPIO-141) or Dependabot-surfaced.

## Questions for product owner

- None blocking. All open findings have an owner or a clear next action.

## Next review focus

1. **PREPIO-143 (`searchId` BOLA) fix PR** — still the highest-value open
   item. When scheduled, verify the ownership check lands with a
   cross-tenant-rejection test and the normal create → invoke flow still
   passes, then re-audit `company-research`, `job-analysis`, and
   `answer-feedback` for the same missing object-ownership check.
2. **react-router v7 / pdfjs-dist 6 majors.** No Dependabot PR is open for
   either yet. If one appears before the next run, spend a review validating
   the resume-upload (PDF + DOCX) and routing/redirect regression surfaces so
   the majors can land instead of accumulating advisories.
3. **The next source-touching merge.** #311 was a clean, well-tested
   reliability fix; keep re-running the full baseline against each functional
   merge rather than re-verifying carried findings, so a regression is caught
   in the window it lands.
