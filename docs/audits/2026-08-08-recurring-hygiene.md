# Recurring hygiene review — 2026-08-08

## Summary

Twenty-first recurring codebase hygiene & security review for Prepio.

One PR merged to `main` since the 2026-08-05 review (#276), which is the
base of this run's branch (HEAD `a40c250`):

- **Runtime — practice**
  - [#281](https://github.com/akkkkkkki/prepio/pull/281)
    ([PREPIO-125](https://linear.app/qiuyue/issue/PREPIO-125)) — 2026-08-07
    "Surface a toast when a practice flag write fails." Adds a destructive
    toast on every failure path of `handleToggleFlag` in
    [`Practice.tsx`](../../src/pages/Practice.tsx) so a failed Favorite /
    Needs-work write no longer snaps the control back silently. UI-only,
    +18 lines src / +61 lines tests. Retro-audited clean below.

Two headline results this run:

1. **Two new HIGH advisories appeared; one fixed in-run, one deferred.**
   `npm audit` rose from last run's 2 to **4 at entry** (2 moderate,
   2 high): the two standing `react-router` moderates plus new `nanoid`
   (GHSA-2v37-7h3g-55p8) and `pdfjs-dist` (GHSA-hq66-cqwq-w95j) highs.
   `nanoid` reaches the tree only through `postcss` (build-time) and has
   a lockfile-only fix in range — a plain `npm audit fix` cleared it
   (4 → 3). `pdfjs-dist` is a **production dependency** (client-side
   resume parsing) whose only fix is a breaking 5 → 6 major, out of
   hygiene scope; deferred with a small defense-in-depth hardening applied
   instead (see below).
2. **Defense-in-depth for the resume-PDF parser.** `pdfjs-dist`'s advisory
   is arbitrary-JS-execution on a crafted PDF, and resume uploads are the
   app's highest-risk untrusted-input surface. The app already only
   **extracts text** (never renders, never enables scripting), so practical
   exposure is low — but this run adds `isEvalSupported: false` to the
   `getDocument` call in [`resumeUpload.ts`](../../src/lib/resumeUpload.ts),
   disabling the `eval()`/`Function` codepath a malicious PDF would need.
   Zero effect on text-extraction output; a one-line hardening with a test
   assertion locking it in place.

Baselines held: lint **54 problems** (unchanged), typecheck at baseline
(app 381 / node 0), test count **up 390 → 392** (the two new #281 flag-toast
cases), bundle **2266.47 KiB** (+0.22 KiB from #281 + the one-line pdfjs
option — within noise). Secret / client-exposure re-scan clean.

## Commands run

- `npm install`: pass. **4 vulnerabilities at entry** (2 moderate,
  2 high); **3 after the in-run `npm audit fix`** (2 react-router
  moderates + 1 pdfjs-dist high, deferred).
- `npm run lint`: **54 problems (46 errors, 8 warnings).** Unchanged from
  2026-08-05 (39 `react-hooks` violations + the standing 15-problem
  baseline). No net drift from the merged PR.
- `npm run typecheck` (backed by
  [`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App: 381 errors (baseline 381). Node: 0 errors
  (baseline 0). No regressions from the pdfjs change.
- `npm run build`: pass (Vite + PWA, 60 precache entries, **2266.47 KiB**).
  Unchanged before vs. after the fixes.
- `npm test`: pass (47 test files, **392 tests**, up from 390). Vitest +
  `check-legacy-schema.sh` + `check-answer-feedback-schema.sh` all green,
  re-run *after* the fixes. No `Practice.mobile.test.tsx` flake observed.
- `npm audit`: **4 at entry → 3 after `npm audit fix`** (non-force). The
  fix cleared the `nanoid` high; the `pdfjs-dist` high and the two
  react-router moderates remain (both need major bumps). See Small fixes
  for the lockfile delta.

## Review focus this run

### Dependency advisories — two new highs (the substantive work)

`npm audit` at entry:

| Advisory | Package | Severity | Prod runtime? | Path | Fix | Disposition |
|----------|---------|----------|---------------|------|-----|-------------|
| GHSA-2v37-7h3g-55p8 | nanoid `3.3.16` | High | No (build-time) | `postcss → nanoid` | `3.3.16 → 3.3.18`, non-force | **Fixed in-run** |
| GHSA-hq66-cqwq-w95j | pdfjs-dist `5.6.205` | High | **Yes** (resume parse) | direct dep | `5.x → 6.2.108` major only | **Deferred + hardened** |
| GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | react-router `6.30.4` | Moderate | **Yes** (routing) | direct dep | v6 → v7 major only | **Deferred** (carried) |

**nanoid (fixed).** Not on a production-runtime path — pulled only by
`postcss@8.5.23`, the CSS build toolchain. The advisory (a custom-generator
infinite loop when `size` is zero) needs an attacker-controlled `size`
argument that never reaches this transitive usage. Patched version is inside
the existing semver range, so a plain `npm audit fix` resolves it
lockfile-only — `package.json` untouched, one transitive bump in
`package-lock.json` (`nanoid 3.3.16 → 3.3.18`). Squarely inside the
"update dependencies when the risk is low and tests pass" allowance.
Verified `npm audit` 4 → 3, `npm run build` unchanged, typecheck at
baseline, `npm test` 392/392 green afterward.

**pdfjs-dist (deferred, hardened).** This is the notable finding.
`pdfjs-dist@5.6.205` is a **direct production dependency**, pinned
`~5.6.205`, used in [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) to
parse user-uploaded PDF resumes **client-side in the browser** — the
single highest-risk untrusted-input path in the app (arbitrary user files
enter the browser's JS context). The advisory
([GHSA-hq66-cqwq-w95j](https://github.com/advisories/GHSA-hq66-cqwq-w95j),
affected `>=5.6.83 <6.2.108`) is *arbitrary JavaScript execution on
opening a malicious PDF*. The only listed remediation is
`pdfjs-dist@6.2.108`, a **breaking 5 → 6 major bump** — out of the
hygiene-runner's low-risk allowance because it changes a core user journey
(resume upload / CV parsing) and needs real-browser regression testing.

Two facts keep **practical exposure low** and let this defer safely:

- **The app never renders and never enables scripting.**
  `extractPdfText` calls only `getDocument(...)` → `getPage(...)` →
  `getTextContent()` ([resumeUpload.ts:115–140](../../src/lib/resumeUpload.ts)).
  There is no `page.render()` (no canvas/font rasterisation) and
  `enableScripting` is left at its `getDocument` default of `false`, so the
  PDF's embedded JavaScript actions — the advisory's stated vector — never
  run.
- **pdf.js executes in a Web Worker**, not the main thread
  ([resumeUpload.ts:71–73](../../src/lib/resumeUpload.ts) sets
  `GlobalWorkerOptions.workerSrc`), narrowing the blast radius further.

**Hardening applied this run** (small, safe, in-scope): added
`isEvalSupported: false` to the `getDocument` options
([resumeUpload.ts:117–124](../../src/lib/resumeUpload.ts)). This disables
the `eval()`/`Function`-constructor codepath in pdf.js's font /
PostScript-function handling — the classic pdf.js arbitrary-JS vector
(the original CVE-2024-4367 was mitigated by exactly this knob). Text
extraction does not exercise that path, so output is unaffected; the
`getDocument`-args assertion in
[`resumeUpload.test.ts`](../../src/lib/__tests__/resumeUpload.test.ts) was
updated to require the option, locking it in against future edits. This is
**defense-in-depth, not full remediation** — the version bump is still the
real fix and remains deferred (tracked below).

**react-router (deferred — unchanged from 2026-08-05).** Still no patched
6.x; only remediation is a v6 → v7 major governing every route transition
plus auth/billing-return navigation — migration-sized, out of hygiene
scope. Practical exposure remains **low**: [`Auth.tsx`](../../src/pages/Auth.tsx)
`redirectPath` derives from in-memory `location.state.from` (not a URL
param); [`BillingReturn.tsx`](../../src/pages/BillingReturn.tsx)
`fallbackHref` passes through `safeReturnTo`, which rejects the `//` and
`/\` prefixes the open-redirect advisory concerns; the SSR-hydration
advisory does not apply (client-rendered SPA). Deferred, tracked on
[PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98).

### Runtime retro-audit — practice flag toast (#281, PREPIO-125)

The natural retro-audit target this window. #281 adds `notifyFlagError()`
and calls it on the three failure paths of `handleToggleFlag` (remove
failure, set failure, catch), reusing the app-wide `useToast` hook. Read in
full:

- **No new data flow.** No new network call, no new env read, no new query.
  The toast fires on an existing DB write's failure branch.
- **No PII surfaced.** The toast title/description are static strings
  ("Couldn't save that flag" / "Something went wrong saving your Favorite /
  Needs work. Please try again.") — no question text, answer, or note
  content interpolated. Rendered as plain toast props (no
  `dangerouslySetInnerHTML`).
- **No cross-user path.** Purely the requesting user's own flag write on
  their own practice question.

**Verdict: clean, no regression.** The change also correctly leaves the
button label + `aria-pressed` inactive on failure (they only latch on
success), which the two new test cases exercise.

### Secret / client-exposure re-scan

Standard cadence — clean, same posture as 2026-08-05.

- **No server-only env var referenced from `src/`.** Grep for
  `import.meta.env.{SUPABASE_SERVICE_ROLE_KEY,OPENAI_API_KEY,STRIPE_SECRET_KEY,TAVILY_API_KEY,OPENAI_MODEL}`
  in `src/` returns nothing.
- **No tracked `.env` / `.env.local`.** Only `.env.example` is tracked;
  every value is a truncated placeholder (`sk-proj-...`, `tvly-...`,
  `whsec_...`, `price_...`, etc.) except the Supabase project URL and
  publishable-key prefix, which are client-public by design. The
  `SUPABASE_SERVICE_ROLE_KEY` placeholder is only the standard public JWT
  header (`{"alg":"HS256","typ":"JWT"}`) with no payload/signature — not a
  real key. No real secret present.
- **No *direct* user content in server console logs.** Grep across
  `supabase/functions/**` for `console.(log|info|warn|error)` touching
  `question_text|answer_text|transcript_text|user_note|userNote|user_input|cv_text|resume`
  returns one hit — a static `"📄 Using stored profile resume"` string in
  `interview-research/index.ts`, no content. (Same indirect-flow caveat as
  the `QUERY_PLAN` Low carried below.)

## Findings

### Critical

- None.

### High

- [ ] **`pdfjs-dist` arbitrary-JS-execution advisory (GHSA-hq66-cqwq-w95j)
  — production resume-parser dep; needs a breaking 5 → 6 major to fully
  remediate. Defense-in-depth hardening applied this run; version bump
  deferred.**
  - Evidence: `npm audit` reports it High against `pdfjs-dist 5.6.205`
    (direct dep, `~5.6.205`), used client-side in
    [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) to parse uploaded
    PDFs. Affected range `>=5.6.83 <6.2.108`; fix is `6.2.108` (major).
  - Risk: **Low in practice, but on a real untrusted-input surface.** The
    app only calls `getTextContent()` — it never renders (no
    `page.render()`) and never enables scripting (`enableScripting` default
    `false`), so the advisory's stated JS-execution vector is not reached;
    pdf.js also runs in a Web Worker. A crafted resume PDF is nonetheless
    attacker-controlled input entering the browser.
  - Recommended fix: `pdfjs-dist` 5 → 6 (`6.2.108`) as focused,
    real-browser-tested work — resume upload/parse on Home + Profile, both
    PDF and DOCX paths, is the regression scope. Out of hygiene scope
    (breaking major on a core journey). Defense-in-depth `isEvalSupported:
    false` shipped this run reduces exposure in the interim.
  - Owner / next step: Schedule the major bump into a cycle; fold into the
    dependency-migration planner [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98)
    alongside react-router v7, or file a dedicated `Chore` /
    `area:profile` issue if the Linear intake cap is resolved. Product-owner
    scheduling call.

### Medium

- [ ] **`react-router` open-redirect + SSR advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — runtime dep, no patched
  6.x; deferred to a tracked v7 upgrade.** *(Carried, unchanged.)*
  - Evidence: `npm audit` reports both (moderate) against
    `react-router` / `react-router-dom` 6.30.4; range `6.0.0 – 7.17.0`
    with no 6.x fix. Only remediation is v6 → v7.
  - Risk: Open-redirect exposure is **low in Prepio** — both dynamic
    redirect targets have same-origin protection (`Auth.tsx` derives from
    `location.state.from`, not a URL param; `BillingReturn.tsx` passes
    `?returnTo=` through `safeReturnTo`, which rejects the `//` and `/\`
    backslash vectors). SSR-hydration advisory does not apply (SPA, no SSR).
  - Recommended fix: react-router-dom v6 → v7 as focused, browser-tested
    work (auth + billing-return navigation are the high-value regression
    scope). Out of hygiene scope.
  - Owner / next step: Tracked on
    [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98). Product-owner
    scheduling call.

### Low / clean-up

- [ ] **`QUERY_PLAN` structured log captures extracted interviewer
  person-names from the user note into first-party operational logs.**
  *(Carried from 2026-08-01/08-05; not a regression this window — #281 did
  not touch the research pipeline.)*
  - Evidence:
    [`company-research/index.ts:201`](../../supabase/functions/company-research/index.ts)
    logs `QUERY_PLAN` with `signals` + `queries`, which
    [`SearchLogger.log()`](../../supabase/functions/_shared/logger.ts)
    forwards to `console.log` (Supabase edge-function logs). Those fields
    can include interviewer names parsed from the free-text note.
  - Risk: **Low.** User's own note content plus a third-party interviewer
    name, to first-party operational logs — not cross-user, not
    client-exposed, not public; short Supabase retention.
  - Recommended fix: Redact the free-text-derived fields (log `roleFamily`,
    counts) or gate the full payload behind a debug flag. **Not applied** —
    altering `QUERY_PLAN` reduces research-pipeline debuggability the
    [RUNBOOK](../../docs/RUNBOOK.md) relies on; a product-owner
    observability call.
  - Owner / next step: Product owner to decide redact vs. accept. Worth a
    `Chore` / `area:research-pipeline` issue if the workspace issue cap is
    resolved (see Questions).
- [ ] **`Practice.mobile.test.tsx` CI flake — remains Low; not
  reproducing.** *(Carried.)*
  - Evidence: The `{ retry: 2 }` mitigation (PR #226, extended by #281's
    de-flake) is on the affected `it()` blocks. All 392 tests passed
    cleanly this run — no flake observed.
  - Recommended fix: None from this audit. Trigger for a real ticket
    remains: retries actually exhausting in CI.
- [ ] **Dependabot cadence vs. security advisories** — informational,
  recurring. *(Carried.)*
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml)
    runs `npm` monthly. Two new high advisories (`nanoid`, `pdfjs-dist`)
    surfaced upstream this window; no off-schedule Dependabot *security* PR
    was observed opening them first.
  - Recommended fix: None required — `nanoid` fixed in-tree, `pdfjs-dist`
    deferred with tracking. Next reviewer: confirm GitHub Settings → Code
    security has Dependabot **security** updates enabled so patched
    advisories auto-open PRs between the monthly version runs. The
    recurrence of new highs (postcss → brace-expansion → fast-uri/undici →
    now nanoid/pdfjs) makes this the single highest-leverage process fix.

## Small fixes made in this run

- **`npm audit fix` — resolved the `nanoid` HIGH (lockfile-only).**
  `nanoid 3.3.16 → 3.3.18` (GHSA-2v37-7h3g-55p8, build-time only via
  `postcss`). `package.json` untouched; only `package-lock.json` changed
  (three lines, one dep). Verified `npm audit` 4 → 3, build unchanged,
  typecheck at baseline, `npm test` 392/392 green after the change.
- **`isEvalSupported: false` hardening on the resume-PDF parser.** Added to
  the `getDocument` options in
  [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) with an explanatory
  comment, disabling the `eval()`/`Function` codepath a crafted PDF would
  need for arbitrary-JS execution. Defense-in-depth for the app's
  highest-risk untrusted-input surface while the `pdfjs-dist` 5 → 6 major
  bump is deferred. No effect on text-extraction output; the
  `getDocument`-args assertion in
  [`resumeUpload.test.ts`](../../src/lib/__tests__/resumeUpload.test.ts) was
  updated to require the option so it can't silently regress.

Explicitly *not* touched this run:

- **The `pdfjs-dist` 5 → 6 major bump.** Breaking, real-browser-tested work
  on a core journey (resume parsing) — outside the low-risk allowance;
  deferred with High-severity tracking.
- **The react-router v7 major upgrade.** Migration-sized, browser-tested
  work; deferred with Linear tracking (PREPIO-98).
- **The `QUERY_PLAN` operational-log PII observation.** Reduces
  research-pipeline debuggability the RUNBOOK depends on — a product-owner
  observability call (see Low finding).
- **The 381-error typecheck backlog** and the **39 react-hooks
  violations.** Coordinated cleanup passes, not hygiene-runner scope.

## Deferred items

Tracked in Linear (no free-form bullets to re-discover):

- [PREPIO-98](https://linear.app/qiuyue/issue/PREPIO-98) — Major
  dependency-migration planner. Carries the react-router 6 → 7 upgrade;
  **the `pdfjs-dist` 5 → 6 bump should join it** (or a dedicated
  `Chore` / `area:profile` issue) once the Linear intake cap is confirmed
  resolved.
- [PREPIO-110](https://linear.app/qiuyue/issue/PREPIO-110) — Stale bot-PR
  cleanup pass.
- [PREPIO-62](https://linear.app/qiuyue/issue/PREPIO-62) — esbuild override
  test guard (PR #240). Product-owner merge call.
- **Still unfiled: `QUERY_PLAN` operational-log PII redaction** and the
  **`pdfjs-dist` major-bump ticket.** Both should be `Chore` issues in
  Quality & Maintenance (`area:research-pipeline` / `area:profile`),
  cross-linked to this audit. Recorded here until the Linear workspace
  issue-intake cap is confirmed resolved.

## Questions for product owner

- **Schedule the `pdfjs-dist` 5 → 6 upgrade?** New High advisory on a
  production dependency that parses attacker-controlled resume PDFs. Only
  fix is a breaking major; a defense-in-depth `isEvalSupported: false`
  hardening shipped this run, but the version bump is the real remediation
  and needs a real-browser resume-parse regression pass. Scope into a cycle?
- **`QUERY_PLAN` log PII — redact or accept?** *(Carried.)* The
  research-pipeline discovery log writes interviewer names parsed from the
  user's note into first-party edge-function logs (Low). User's own data in
  operational logs, not a cross-user leak. Redact the free-text-derived
  fields (keep counts + `roleFamily` for debuggability), or accept with
  this note on record?
- **Enable Dependabot *security* updates?** Four windows running have
  surfaced new highs (postcss → brace-expansion → fast-uri/undici →
  nanoid/pdfjs) that the monthly Dependabot version run missed and the
  hygiene run patched or triaged by hand. Turning on security updates would
  auto-open these between version runs.
- **Is the Linear workspace free-issue cap resolved?** *(Carried.)* Still
  blocks filing the `pdfjs-dist` and `QUERY_PLAN` issues. If capped,
  findings keep landing in the audit doc as the system of record.

## Next review focus

1. **Confirm the advisory picture.** With `nanoid` cleared, `npm audit`
   should read 3 (2 react-router moderates + 1 pdfjs-dist high) until the
   two major bumps land. Watch whether `pdfjs-dist` gets scheduled — it is
   the only High on a genuine production-runtime path.
2. **Next research-pipeline or resume-parsing PR.** The natural retro-audit
   target, with attention to whether any new provider-shaped or free-text
   parsing widens the operational-log PII surface (the standing `QUERY_PLAN`
   Low) or the untrusted-file surface (the pdfjs path).
3. **`pdfjs-dist` / react-router major-bump disposition.** If the product
   owner schedules either upgrade, that becomes a focused retro-audit; if
   both are accepted as standing advisories, close the loop in the doc with
   the low-exposure notes on record.
