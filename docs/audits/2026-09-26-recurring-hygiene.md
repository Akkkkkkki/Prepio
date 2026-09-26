# Recurring hygiene review — 2026-09-26

## Summary

Twenty-eighth recurring codebase hygiene & security review for Prepio.

**Headline: a remediation-heavy window with one new regression.** Three findings
prior runs carried as open are now resolved at the repository level (below), but
#354 — while a large net security-positive surface reduction — also introduced a
new Medium auth-flow regression in its `flow=recovery` handling, with two facets: a
resend-verification post-confirmation misroute, and a bare-query set-new-password
form that renders without a session (surfaced by Codex on this audit PR and recorded
below). The three resolved items:

- **[PREPIO-143] `searchId` cross-tenant write (BOLA) — fixed (#337).** The
  carried High from 2026-08-12 landed. A new fail-closed ownership gate
  ([`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts))
  runs **synchronously before** the background research promise is constructed
  ([`interview-research/index.ts:1330–1344`](../../supabase/functions/interview-research/index.ts)),
  so it precedes every service-role (RLS-bypassing) write. Service callers are
  exempt (`authContext.kind === "service"`); a JWT user must match both the body
  `userId` (403 on mismatch) and own the persisted `searches` row
  (`select id … eq id … eq user_id … maybeSingle()`), with a missing row and a
  foreign-owned row returning an **identical 404** (no existence oracle) and a
  query error failing closed at 500. Covered by
  [`authorization.test.ts`](../../supabase/functions/interview-research/authorization.test.ts)
  (91 lines: owner allow, foreign-ID reject, service bypass, DB-error 500).
  **#351** followed up to restore the Edge Function typecheck ratchet the new
  file perturbed. Repo-level closure only — production remediation still tracks
  under PREPIO-124 (a repo merge does not repair production).
- **`pdfjs-dist` high advisory (GHSA-hq66-cqwq-w95j) — fixed (#350).**
  `package.json` now pins `~6.3.289` and `pdfjs-dist@6.3.289` is installed,
  clearing the carried Medium (arbitrary JS execution on opening a crafted PDF).
  #350 also **removed** the prior `isEvalSupported: false` defence-in-depth from
  [`resumeUpload.ts`](../../src/lib/resumeUpload.ts) (and its test assertion):
  pdf.js 6 eliminated the `eval()`/`Function` codepath GHSA-hq66-cqwq-w95j
  exploited — the advisory's fix — so that option is no longer needed (see the
  in-code comment at `resumeUpload.ts:118–122`). The remaining surface is small
  and unchanged: the parser runs in an isolated worker
  (`GlobalWorkerOptions.workerSrc`), extracts text only, and never renders.
- **`react-router` two advisories (open-redirect + SSR-hydration) — fixed (#353,
  PREPIO-172).** `react-router-dom@7.18.4` is installed (manifest `^7.18.4`),
  clearing both carried Low advisories.

Of the window's remaining source merges, **#354** (lock to the invite-only frozen
core) is a net **−1,017-line scope reduction** that removes billing UI,
file-upload, and voice controls — an attack-surface *reduction* and the cause of
the ~45% bundle drop below — **but it is not fully clean:** it also repointed the
shared auth email-redirect callback to `/auth?flow=recovery` and added a
`passwordSetupRequired` initializer that sets the set-new-password flow **from the
bare URL query, without a session check**. That produces two defects (new Medium
finding below): (a) the still-live *resend-verification* path misroutes its
post-confirmation landing to the set-new-password screen (verification still
succeeds server-side — the confirmed user is just shown the wrong screen), and
(b) any `/auth?flow=recovery` visit with no session (expired link or direct visit)
renders a dead-end set-new-password form. **#345** adds evidence-origin
short-name classification
test coverage (tests only, cursor-authored); **#348** makes the Playwright landing
smoke a blocking CI gate (CI/DX hardening).

**Two carried research-pipeline Mediums remain open and code-verified this run**
(both are service-role edge-function changes, not validatable in this
proxy-limited environment where `typecheck:functions`/Deno cannot resolve remote
imports, and consistently deferred by prior runs): the evidence-ledger
`official_company` loose-`.includes()` attacker-subdomain over-trust, and the
`SEARCH_COMPLETE` console log still leaking raw note-derived query strings. The
`@vitest/mocker` dev-only moderate also persists (dev/test-only, no production
bundle exposure). Codex review of this audit PR additionally surfaced a **new
Medium** — a `#354` `flow=recovery` auth-flow regression with two facets (a
resend-verification post-confirmation misroute and a session-less set-new-password
form; recorded below). **No product-source fix was made in this run:** the two
research-pipeline
Mediums are out of scope for a docs-only hygiene run and unvalidatable here, and the
auth regression is a product-source change touching the auth flow (owner-approval
territory per CLAUDE.md, and the Supabase email round-trip is not validatable in
this environment) — it is recorded for a dedicated, reviewed fix rather than
bundled into this docs PR. The note + the `docs/audits/README.md` index row are
this run's deliverable.

**Scope note (freeze):** [`CLAUDE.md:24–27`](../../CLAUDE.md) says not to *add*
features, recurring audits, or routine dependency PRs during the freeze. This run
adds none of those: it is the continuation of the pre-existing, owner-configured
scheduled hygiene review (prior notes on 2026-09-09 and 2026-09-12 ran and merged
after the 2026-09-02 freeze decision), and it makes **no product-source, feature,
or dependency change** — only the dated documentation note and its index row. Its
findings this run (the #354 auth regression, the PREPIO-145 purge scope) are
freeze-blocker safety information, not scope expansion. If an owner wants the
recurring review itself paused during the freeze, that is a one-line call to make —
flagged under *Questions for product owner* — but the audit trail is not itself
freeze scope.

Baselines (measured against HEAD `9d9b711`; deltas vs 2026-09-12):
lint **50** problems (**41** errors / 9 warnings; **−2 errors** vs 52 total,
composition below). The 41 errors are **34 application-side React Hooks
diagnostics** (21 `react-hooks/set-state-in-effect`, 7 `react-hooks/immutability`,
6 `react-hooks/purity`) plus **4 `@typescript-eslint/no-explicit-any`**, 2
`no-empty-object-type`, and 1 `no-require-imports`; the 9 warnings are
`react-refresh/only-export-components`. Almost all pre-existing (the
`eslint.config.js` react-hooks ruleset was unchanged this window; lint is
informational, not a CI gate) — **one exception: #354 newly introduced a
`react-hooks/set-state-in-effect` error at `Auth.tsx:59`** (its new effect calls
`setAuthView("set-new-password")` synchronously in the body; pre-#354 the only
`setAuthView` was inside the `onAuthStateChange` callback, which the rule does not
flag) and removed three other errors, so 43 → 41 is one add + three drops, not a
flat pre-existing set. Typecheck **pass at baseline** (app **61**, node
**0**; −1 app error, same cause). Build **1,242.25 KiB** / **41** precache
entries — **down ~45%** from 2,280.54 KiB / 62 (the #354 freeze removed
billing/upload/voice code paths). Tests **467** passing / **55** files (up from
461 / 52 — the range's merges carried added coverage). `npm audit` **2**
moderate (down from 5) — only the dev-only `@vitest/mocker`/`vitest` advisory
remains; the `pdfjs-dist` high and both `react-router` advisories are cleared.

## Commands run

- `npm install`: **pass** (via SessionStart hook; 2 moderate advisories reported).
- `npm run lint`: **50 problems (41 errors, 9 warnings).** Informational in CI
  (not a gate). −2 errors vs 2026-09-12. Breakdown: 34 React Hooks diagnostics
  (21 `set-state-in-effect`, 7 `immutability`, 6 `purity`), 4
  `@typescript-eslint/no-explicit-any`, 2 `no-empty-object-type`, 1
  `no-require-imports`; 9 `react-refresh/only-export-components` warnings. Almost
  all pre-existing (ruleset unchanged this window), except **one new
  `set-state-in-effect` from #354 at `Auth.tsx:59`** offset by three removals (43 →
  41). This run pushes no source. See the Low finding below.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` /
  `deno.land`, so Deno cannot resolve the edge functions' remote imports; the
  script reports `SKIPPED — this is not a pass` (exit 0 locally, `exit 1` under
  `$CI`). This run pushes no `supabase/functions` source. The final merged tree is
  green on the real CI `verify` gate, but not because each edge-function merge was
  individually clean: **#337 landed the ownership-guard security behavior but
  *perturbed* the Deno ratchet** — its `authorization.ts` used a typed
  `SearchOwnershipClient` boundary and a native `Promise` return that triggered the
  Deno **TS2589** deep-instantiation regression — and **#351 repaired it**, changing
  the boundary to `unknown`/`PromiseLike` (see the `authorization.ts:22–33` comment)
  and validating the final tree. So the accurate record is #337 (behavior, ratchet
  perturbed) → #351 (ratchet restored, gate green), not "both passed at merge."
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1,242.25 KiB**).
- `npm test`: **pass** (**55 files, 467 tests**), incl. the schema/design-token
  checks.
- `npm audit`: **2** moderate — both the `@vitest/mocker`/`vitest` dev-only
  advisory; no production-path advisory.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII is still recoverable from Git history despite the
  working-tree redaction (PREPIO-145).** *(Carried; the owner-attended history-purge
  slice. Re-verified still exposed this run.)*
  - Evidence: PR #342 replaced ten screenshots with placeholders in the working
    tree, but the pre-redaction blobs remain in history.
    [`docs/security/freeze-pii-paths.txt`](../../docs/security/freeze-pii-paths.txt)
    (added by #354) lists those ten current-tree replacements, **but it is a
    *starting inventory*, not the complete set** —
    [`docs/FREEZE_RELEASE.md:52–56`](../../docs/FREEZE_RELEASE.md) is explicit that
    the purge must **also** cover deleted/renamed images, the two images removed in
    **PR #298**, and profile/new-interview captures reviewed across **every** dated
    audit folder. Confirmed still resolvable this run:
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` has both the redacted
    blob at `da47d9e` and the original **146,389-byte** blob at `5585fd4`
    retrievable via `git rev-parse 5585fd4:<path>`. **This is a public
    repository**, so those blobs are fetchable by anyone with the commit SHA.
    *(PII not reproduced here per the review's redaction rule.)*
  - Risk: real personal data exposed on a public remote until history is rewritten;
    a freeze-exit release blocker per the issue. **A purge scoped to only the ten
    listed paths would leave known CV PII in history** (deleted/renamed blobs and
    the PR #298 removals), so the broader inventory in `FREEZE_RELEASE.md` governs.
  - Recommended fix: owner-attended `git filter-repo`/BFG purge covering the **full**
    `FREEZE_RELEASE.md` inventory — the ten `freeze-pii-paths.txt` entries **plus**
    deleted/renamed images, the two PR #298 removals, and the profile/new-interview
    captures from every dated folder — then a coordinated force-push, preserving a
    backup ref off the public remote, plus the PR/comment exposure review the issue
    calls for. Do **not** run a history rewrite unattended, and do **not** treat
    `freeze-pii-paths.txt` as the complete target list.
  - Owner / next step: **PREPIO-145** (Urgent, Todo, assigned to owner). Tracked
    with a full remediation plan; `freeze-pii-paths.txt` is a checked-in starting
    inventory, not the complete finding. Out of scope for an unattended hygiene run
    (force-push history rewrite of a shared public repo).

### Medium

- [ ] **#354's `flow=recovery` handling has two defects: a resend-verification
  post-confirmation misroute, and a bare-query set-new-password form that renders
  without a session.** *(New this run; surfaced by Codex on this audit PR across three
  rounds and code-verified against the #354 diff. Facet (a) was initially over-scoped
  as a High "cannot verify" break; corrected to a UI misroute after Codex's
  GoTrue-behavior note. Facet (b) added after a further Codex round.)*
  - Common root cause: #354 changed the shared `getAuthRedirectUrl()` from
    `${origin}/auth` to **`${origin}/auth?flow=recovery`**
    ([`src/hooks/useAuth.ts:5–6`](../../src/hooks/useAuth.ts)) and added a
    `passwordSetupRequired` initializer that returns `true` **purely from the URL
    query** (`flow === "recovery"` or `"invite"`, `useAuth.ts:13–17`) with **no
    session/authenticated-callback check**;
    [`Auth.tsx:58–60`](../../src/pages/Auth.tsx) then forces the `set-new-password`
    view whenever `passwordSetupRequired` is set, even when `user`/session is null.
    Before #354 there was no query-driven `passwordSetupRequired` — recovery was
    handled only via the `PASSWORD_RECOVERY` auth event (which fires with a valid
    recovery session) — so both facets are #354 regressions.
  - Facet (a) — **resend-verification post-confirmation misroute:** `resetPassword`
    uses the shared callback correctly (recovery *is* the intent), **but
    `resendVerification` (`type: "signup"`, `useAuth.ts:73–86`) uses the same
    callback** and is still live (two `openView("resend-verification")` buttons in
    `Auth.tsx` ~290/~338 → `Auth.tsx:146`). **Verification itself is not broken:**
    Supabase's `auth/v1/verify?type=signup` validates the token server-side *before*
    following `emailRedirectTo`, so the account is confirmed regardless of the
    redirect target; the defect is that a just-confirmed user (valid session) lands on
    `flow=recovery` and is shown the **set-new-password** screen instead of an
    ordinary landing.
  - Facet (b) — **bare-query recovery view with no session:** because
    `passwordSetupRequired` trusts the query alone, an **expired/invalid recovery
    callback** (token consumed/expired, no session established) **or a direct visit to
    `/auth?flow=recovery`** renders the set-new-password form anyway; its
    `updateUser` submission (`updatePassword`, `useAuth.ts:88–95`) requires a session
    and cannot succeed, so the user hits a dead-end form with no link-error handling.
    **Splitting the resend callback does not fix this facet** — it needs intent to be
    validated against an authenticated callback state.
  - Risk: confusing/incorrect auth UX on shipping, still-wired controls — a confirmed
    user mis-prompted to reset a password (a), and a dead-end set-new-password form on
    an expired/invalid or hand-typed recovery URL (b). Neither is a verification
    failure, lockout, or data exposure (the `updateUser` call simply fails without a
    session), and (a) is gated to the resend path (public signup disabled in the
    freeze) — hence Medium, not High. Content/flow correctness.
  - Recommended fix: (a) split the callback — keep `flow=recovery` only for
    `resetPassword`, and give `resendVerification` a plain `${origin}/auth` (or a
    `flow=verify` the initializer does **not** treat as recovery); (b) gate
    `passwordSetupRequired` on an **authenticated recovery/invite session** (e.g. the
    `PASSWORD_RECOVERY` event or a present session), not the bare URL query, and
    render a link-error state when a recovery/invite callback arrives without a valid
    session. Add tests: the resend redirect does not set `passwordSetupRequired`, and
    `/auth?flow=recovery` with no session shows an error rather than a dead-end form.
    Verify the invite (`flow=invite`) and reset (`flow=recovery`) happy paths still
    behave.
  - Owner / next step: **a dedicated, reviewed product-source PR** — this touches the
    auth flow (owner-approval territory per CLAUDE.md's "Auth + profile changes need
    both screen copy and route behavior checked"), and the Supabase email round-trip
    is not validatable in this proxy-limited environment. **Not** fixed in this
    docs-only hygiene run to avoid bundling an unvalidated auth change into an audit
    PR. File in Linear (`Bug` + `area:auth`) when intake is available; recorded here
    in full meanwhile.

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation.** *(Carried from 2026-09-12;
  re-verified open in the merged code this run. Outside PREPIO-144's `official_job`
  scope.)*
  - Evidence:
    [`evidence-ledger.ts:172–178`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust via `trustWeightFor`) when **any**
    `companyTokens(company)` entry is a substring of it (`.includes(token)`). So for
    company "Acme", a caller-supplied or search-surfaced role link
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`, which
    `.includes("acme")` → **`official_company`/high**. There is no
    registrable-domain / public-suffix / exact-label check — the code comment
    (lines 180–186) explicitly defers PSL-aware short-name/employer-domain matching
    as follow-up. #345 added short-name *test coverage* around this classifier but
    did not change the `.includes()` behavior.
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Content-integrity, not cross-tenant read.
    Gating: the row must enter the ledger via the caller's own `roleLinks`
    (self-inflicted) or a Tavily result ranked for the company query. The
    now-closed `searchId` BOLA (PREPIO-143, #337) reduces the compounding cross-tenant
    concern the prior run flagged.
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware) rather than `.includes()` on the whole host, mirroring the
    ATS exact/suffix approach `isJobPosting` now uses; add adversarial tests that
    reject `company-token.attacker.example` subdomains, and verify legitimate
    employer domains (incl. short names and multi-label suffixes) still classify.
  - Owner / next step: **Linear intake is unavailable this session (the connector is
    unauthenticated here, and prior runs record the workspace at its free-issue
    cap).** Recorded in full here; file as `Bug` + `area:research-pipeline` (Quality
    & Maintenance), cross-linked to PREPIO-144, this audit, and the audit PR, when
    intake is available. A substantive service-role edge-function change, out of
    scope for a docs-only hygiene run and not Deno-validatable in this proxy-limited
    environment.

- [ ] **PII-in-logs: the `SEARCH_COMPLETE` console log still leaks raw
  note-derived query strings (PREPIO-179 follow-up).** *(Carried from 2026-09-12;
  re-verified open this run.)*
  - Evidence: in
    [`company-research/index.ts`](../../supabase/functions/company-research/index.ts),
    the per-search `SearchPayload` is built with `query: result.query` (line 248 —
    the raw Tavily query, which for `user-note-*`/contextual queries embeds
    note-derived interviewer/team names), those roll into `result.search_results`,
    and line 317 calls `logger?.log('SEARCH_COMPLETE', 'COMPANY_INFO', result)`.
    The generic `SearchLogger.log`
    ([`_shared/logger.ts:37–58`](../../supabase/functions/_shared/logger.ts))
    routes the whole payload into `logEntry.metadata` (the operation name matches
    none of the INPUT/OUTPUT/RESULT branches) and `console.log`s it — it does
    **not** strip `query` (only `logTavilySearch` does, which #344 hardened). This
    path executes on every run. `logger.test.ts` covers only `logTavilySearch`,
    not this path. (The prior run also noted a second `ops.tavily_searches` DB-writer
    path attempting the same insert but inert against the checked-in schema; that
    code/migration mismatch is unchanged and still worth reconciling.)
  - Risk: the PII-in-logs class PREPIO-141 → PREPIO-179 set out to close is still
    live via the aggregate console log; interviewer/team-name exposure into
    edge-function logs.
  - Recommended fix: redact `query` from each `search_results[]` entry before the
    `SEARCH_COMPLETE` log (or log counts/sources only); add a test asserting no
    free-text query reaches the logger on this path; and separately reconcile the
    `searchTavily` → `ops.tavily_searches` insert with its schema
    (`user_id`/`response_payload` mismatch), redacting `query_text` when doing so.
  - Owner / next step: **reopen PREPIO-179 or file a follow-up** — blocked on Linear
    intake this session (see above); recorded in full here. A service-role
    edge-function change, out of scope for a docs-only hygiene run and not
    Deno-validatable in this environment.

### Low / clean-up

- [ ] **`@vitest/mocker` moderate advisory (GHSA-82fw-gwwq-j7x9) — path traversal /
  arbitrary file read via redirect mock.** *(Carried; dev/test-only.)*
  - Evidence: `npm audit` reports `@vitest/mocker 2.1.0 - 4.1.10` moderate, via
    `vitest@4.1.9`. The fix is `vitest ≥ 4.1.11`, within the existing `^4.1.8`
    manifest range — a pure lockfile patch bump. Prior runs recorded that
    `npm update vitest --package-lock-only` aborts locally with the documented npm
    `edgesOut` resolver bug triggered by the `overrides` field; not re-attempted
    this run (dev-only advisory, no production-bundle exposure).
  - Recommended fix: let Dependabot's `vitest` bump carry it (full-tree resolution
    is not subject to the local `--package-lock-only` crash), or a maintainer runs
    it outside this proxy sandbox.

- [ ] **Lint is informational, not a CI gate; 41 errors / 9 warnings persist —
  and 34 of the 41 are React Hooks diagnostics, not `any` usage.**
  *(Observation; characterization corrected this run after Codex review — prior
  audits had described the backlog as `no-explicit-any`, which the current
  breakdown does not support.)*
  - Evidence: the 41 errors are **34 application-side React Hooks diagnostics**
    (21 `react-hooks/set-state-in-effect`, 7 `react-hooks/immutability`, 6
    `react-hooks/purity`), 4 `@typescript-eslint/no-explicit-any`, 2
    `@typescript-eslint/no-empty-object-type`, and 1
    `@typescript-eslint/no-require-imports`; the 9 warnings are
    `react-refresh/only-export-components` fast-refresh hints. The ruleset was
    unchanged this window, so most are pre-existing — **but the 43 → 41 move is not
    flat: #354 newly introduced one `react-hooks/set-state-in-effect` error at
    [`Auth.tsx:59`](../../src/pages/Auth.tsx)** (its added effect calls
    `setAuthView("set-new-password")` synchronously in the body; pre-#354 the only
    `setAuthView` sat inside the `onAuthStateChange` callback, which the rule does
    not flag), offset by three unrelated removals. So one of the 21
    `set-state-in-effect` errors is a #354 regression, tied to the same auth-flow
    change as the Medium finding above. **Not all are cosmetic:** the react-hooks
    `set-state-in-effect`, `purity`, and
    `immutability` rules can flag genuine render-time correctness smells
    (state-in-effect loops, impure render, mutation of props/state) — they are
    surfaced but not triaged here, and warrant a dedicated maintainer pass rather
    than being dismissed. None block CI (lint is informational).
  - Recommended fix: a maintainer triage of the 34 React Hooks findings (they may
    be false positives against this code's patterns or may be real render-time
    bugs) plus the low-risk `any`/empty-type/require-import cleanups; out of scope
    for a docs-only hygiene run.

- [ ] **`npm audit` is not a CI gate.** *(Observation, unchanged from prior runs.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates
    lint, typecheck, typecheck:functions, build, test, and (now, via #348) the
    Playwright landing smoke — not `npm audit`. Advisory response relies on
    Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

## Small fixes made in this run

- **None (no product-source change).** Three prior findings were resolved by merges
  this window (PREPIO-143 BOLA #337, `pdfjs-dist` #350, `react-router` #353). The
  items still open are all out of scope for a docs-only hygiene run: the two carried
  research-pipeline Mediums are service-role edge-function changes not
  Deno-validatable in this proxy-limited environment; the new **#354
  resend-verification Medium** is an auth-flow product change (owner-approval per
  CLAUDE.md; email round-trip unvalidatable here) that belongs in a dedicated
  reviewed PR, not bundled into this audit note; the standing `vitest` patch is a
  dev-only advisory blocked by the npm `edgesOut` bug. The dated note and the
  `docs/audits/README.md` index row are this run's deliverable.

## Deferred items

Tracked, Dependabot-surfaced, or recorded here (Linear intake unavailable this
session):

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs (`freeze-pii-paths.txt` is a *starting inventory*, not the complete set —
  `FREEZE_RELEASE.md:52–56` also requires deleted/renamed images, the two PR #298
  removals, and profile/new-interview captures from every dated folder) + PII/credential
  exposure review (High/Urgent, Todo). Working-tree slice done (#342); history
  remains exposed on the public repo.
- **PREPIO-124 deployment of the PREPIO-143 fix** — #337 closed the BOLA at the repo
  level; production remains unrepaired until deployed via the freeze runbook.
- **#354 `flow=recovery` auth-flow regression, two facets** (Medium, new this run) —
  (a) split the shared `getAuthRedirectUrl` so `resendVerification` no longer lands
  confirmed users on `flow=recovery`, and (b) gate `passwordSetupRequired` on an
  authenticated recovery/invite session (not the bare URL query) with a link-error
  state, so a session-less `/auth?flow=recovery` visit doesn't render a dead-end
  form. Dedicated reviewed product PR; file in Linear (`Bug` + `area:auth`) when
  intake is available.
- **Evidence-ledger `official_company` attacker-subdomain over-trust** (Medium,
  carried) — land the registrable-label (PSL-aware) fix with adversarial
  `company-token.attacker.example` tests; file in Linear (Quality & Maintenance,
  `Bug` + `area:research-pipeline`) when intake is available.
- **PREPIO-179 follow-up — the `SEARCH_COMPLETE` console log still leaks raw query
  strings** (Medium, carried) — redact `query` before the aggregate log, add a test,
  and reconcile the `ops.tavily_searches` insert schema mismatch. Reopen PREPIO-179
  or file a follow-up when intake is available.
- **`@vitest/mocker` `vitest ≥ 4.1.11`** (Low, dev-only) — let Dependabot carry it.
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.

## Questions for product owner

- **Should the recurring hygiene review itself pause during the freeze?**
  `CLAUDE.md:24–27` says not to *add* recurring audits during the freeze. This run
  reads that as "don't spin up new audit/dependency cadences," not "stop the existing
  owner-scheduled review" (prior notes ran and merged post-freeze, and this run is
  documentation-only with freeze-relevant findings). If the owner intends the
  scheduled review to halt until the freeze ends, say so and it will stand down;
  otherwise it continues as a docs-only safety trail.
- **The #354 `flow=recovery` regression (new Medium, two facets) needs an owner
  decision on a dedicated auth-flow fix.** The recommended fix has two parts: (a)
  split the shared redirect callback so `resendVerification` uses a non-recovery
  `/auth` URL, **and** (b) gate `passwordSetupRequired` on an authenticated
  recovery/invite session (not the bare URL query) with a link-error state, so a
  session-less `/auth?flow=recovery` visit no longer renders a dead-end form — the
  callback split alone does not fix facet (b). It touches the auth flow and its
  Supabase round-trip is not validatable in this environment, so it was not fixed in
  this docs-only run. Confirm **both** parts and assign it.
- **Linear intake is unavailable to this session** (the connector is unauthenticated
  here; prior runs also record the workspace at its free-issue cap), so the new Medium
  and the two carried research-pipeline Mediums cannot be filed as issues — all are
  recorded in full in this note instead. Authorizing the Linear connector (or
  clearing the issue cap) would let hygiene findings be tracked in Linear rather than
  only in the audit trail. Not otherwise blocking: the carried High (PREPIO-145) has
  an owner and a documented plan.

## Next review focus

1. **PREPIO-124 deployment of the PREPIO-143 fix.** #337 closed the `searchId` BOLA in
   the repo; verify it reaches production via the freeze runbook (a merge alone does
   not repair production). Then re-audit `company-research`, `job-analysis`, and
   `answer-feedback` for the same missing object-ownership check.
2. **#354 `flow=recovery` auth regression (two facets)** — in a dedicated reviewed
   PR: (a) split the callback so `resendVerification` uses a non-recovery redirect,
   and (b) gate `passwordSetupRequired` on an authenticated recovery/invite session
   (not the bare URL query) with a link-error state. Tests: the resend path does not
   set `passwordSetupRequired`, and a session-less `/auth?flow=recovery` shows an
   error rather than a dead-end form. Verify the invite/reset happy paths still
   behave.
3. **PREPIO-145 Git-history purge** — the highest-residual-risk open item: real CV
   PII is still publicly fetchable from history. Track the owner-attended
   filter-repo/BFG + force-push against the **full `FREEZE_RELEASE.md` inventory**
   (not just the ten `freeze-pii-paths.txt` entries — include deleted/renamed
   images, the two PR #298 removals, and every dated folder's profile/new-interview
   captures) and verify the blobs are gone from all refs afterward.
4. **The two carried research-pipeline Mediums** — (a) evidence-ledger
   `official_company` over-trust: land the registrable-label (PSL-aware) fix + the
   deferred short-name/employer-domain follow-up with adversarial subdomain tests;
   (b) PREPIO-179 follow-up: redact `query` from the `SEARCH_COMPLETE` aggregate log
   and reconcile the `ops.tavily_searches` insert schema mismatch, with tests on each
   path. Both need a maintainer able to run the Deno `typecheck:functions` gate.
5. **Next source-touching merge.** Re-run the full baseline against it and read the
   *merged* code, not commit messages, when assessing a security fix.
