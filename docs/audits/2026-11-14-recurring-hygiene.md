# Recurring hygiene review — 2026-11-14

## Summary

Twenty-ninth recurring codebase hygiene & security review for Prepio, three days
after run #28 (2026-11-11). **No new source has merged in that window** — `main`
is still at `a330939` (the same HEAD run #28 measured), so every build/test/lint
baseline is identical to #28 and there is no new merge to review. This run's value
is therefore: (1) a **definitive verification of the one open High (PREPIO-145)**
that run #28 had to leave "unverifiable," (2) carrying the two open findings
forward, and (3) a **process observation** — a growing backlog of unmerged
audit/fix PRs — flagged for the owner.

**New, concrete result this run — PREPIO-145 is confirmed still exposed.** Run #28
could not verify the Git-history CV-PII purge because its shallow clone did not
contain the pre-redaction blob referenced in run #27 (`5585fd4`). This session is
*also* a shallow clone (50 commits), but the oversized blob is reachable under a
**different commit that *is* inside the window**: the original **146,389-byte**
`docs/audits/assets/2026-07-09/11-d-new-interview.png` resolves at commit
**`79c2097`** ([PREPIO-139] #297), which is an ancestor of `origin/main` with its
SHA intact (it matches a real merged PR number). A `git filter-repo`/BFG rewrite
would have changed that SHA and dropped the blob; since `79c2097` is unchanged and
still carries the full-size image, **the history has not been rewritten** and the
PII remains publicly fetchable by commit SHA. This upgrades run #28's "carried /
unverifiable" to **confirmed open**. *(PII not reproduced here per the review's
redaction rule.)*

**Carried findings, re-confirmed this run (all consistent with run #28):**

- **PREPIO-143 `searchId` BOLA (was High) — fixed in repo.** `authorizeSearch`
  ([`interview-research/authorization.ts`](../../supabase/functions/interview-research/authorization.ts))
  runs a fail-closed ownership check (`searches` row must match both body `userId`
  and the JWT user; a missing and a foreign row return an identical 404) *before*
  any service-role write, and is correctly wired at
  [`interview-research/index.ts:1333`](../../supabase/functions/interview-research/index.ts),
  ahead of the background pipeline. Service callers short-circuit; anonymous JWT
  users are already rejected upstream in
  [`_shared/auth.ts:71`](../../supabase/functions/_shared/auth.ts)
  (`data.user.is_anonymous` → 401). Production deploy is still gated by PREPIO-124.
- **PREPIO-179 `SEARCH_COMPLETE` PII-in-logs (was Medium) — fixed in repo.** The
  aggregate log now passes `result` through
  [`buildSearchCompleteLogPayload`](../../supabase/functions/company-research/result-aggregation.ts)
  (counts only: `searchPayloads`/`searchResults`/`extractedContent`/
  `totalUrlsExtracted`), so no raw Tavily query string reaches the logs. Test-covered.
- **`pdfjs-dist` 5→6 and `react-router` v7 — fixed in repo.** `pdfjs-dist@6.3.289`
  and `react-router-dom@7.18.4` are installed; neither appears in `npm audit` any
  more. (The freeze also gates the resume-upload UI off entirely behind
  `FROZEN_PRODUCT.resumeUpload = false`, so the pdf.js parser is additionally
  unreachable from the UI.)

**Still open:**

1. **PREPIO-145** (High, owner-attended) — Git-history CV PII. Confirmed still
   exposed this run (see above).
2. **PREPIO-184** (Medium, In Progress) — evidence-ledger `official_company`
   over-trust. Code-verified still present at
   [`evidence-ledger.ts:176`](../../supabase/functions/interview-research/evidence-ledger.ts)
   (loose `normalizedHost.includes(token)` match). **The fix is itself an open,
   unmerged PR — #375 "[PREPIO-184] Match official_company to the host's
   registrable label"** — so it is waiting on review/merge, not on authoring.

**Secret scan clean.** Only `.env.example` is tracked (truncated placeholders:
`sb_publishable_...`, `eyJ...`; the Supabase project URL it contains is non-secret
and already ships in the client bundle). `.gitignore` covers `.env`, `.env.local`,
`.env.*.local`. No `sk-`/`tvly-`/service-role-JWT pattern in tracked non-doc files.

**`npm audit` is 25** (3 low, 17 moderate, 5 high) — one fewer than run #28's 26,
and, as #28 classified in full, **entirely dev/build-time tooling with no runtime
path**: the 5 high are `brace-expansion` (dev), `source-map-js` (build-time via
PostCSS), `undici` (test-only via `jsdom@29.1.1`), `vite` (dev-server/error-overlay
`launch-editor` advisories, not the production build), and `zod@3.25.76`
(**dev-only — reached via lint tooling; `zod` is not imported anywhere in `src/` or
`supabase/functions/`**, confirmed; `package.json` pins `zod ^3.23.8` but no app
code imports it). No advisory sits on the shipped bundle or an edge function. Per
the freeze posture, version bumps are paused in
[`.github/dependabot.yml`](../../.github/dependabot.yml) and advisory response is
left to Dependabot security updates — see the Medium/process finding below for the
one caveat worth the owner's eye.

Baselines (HEAD `a330939`; identical to run #28):
lint **49** (40 errors, 9 warnings). Typecheck **pass at baseline** (app tsc **61**,
node **0**). Build **1243.41 KiB** / **41** precache entries. Tests **494** passing /
**58** files. `npm audit` **25** (3 low, 17 moderate, 5 high) — all dev/build tooling.

## Commands run

- `npm install`: **pass** (via SessionStart hook; `up to date, audited 748 packages`).
- `npm run lint`: **pass to run** — 49 problems (40 errors, 9 warnings), all
  pre-existing classes (`@typescript-eslint/no-explicit-any` in tests/edge functions;
  the fast-refresh `react-refresh/only-export-components` warnings). Lint is
  informational in CI, not a gate. Unchanged vs run #28.
- `npm run typecheck`
  ([`scripts/check-typecheck-baseline.sh`](../../scripts/check-typecheck-baseline.sh)):
  **pass at baseline.** App **61**, node **0**.
- `npm run typecheck:functions`
  ([`scripts/check-deno-baseline.sh`](../../scripts/check-deno-baseline.sh)):
  **not runnable in this environment** — the agent proxy blocks `esm.sh` / `deno.land`,
  so Deno cannot resolve the edge functions' remote imports; the script reports
  `SKIPPED — this is not a pass`. This run pushes no `supabase/functions` source.
- `npm run build`: **pass** (Vite + PWA, **41** precache entries, **1243.41 KiB**).
- `npm test`: **pass** (**58 files, 494 tests**), incl. the schema/design-token checks.
- `npm audit`: **25** (3 low, 17 moderate, 5 high) — all dev/build tooling.

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII in Git history (PREPIO-145) — carried; confirmed STILL
  exposed this run.**
  - Evidence: the pre-redaction screenshot blob
    `docs/audits/assets/2026-07-09/11-d-new-interview.png` (**146,389 bytes**)
    resolves at commit **`79c2097`** ([PREPIO-139] #297), an ancestor of
    `origin/main` within this shallow clone's 50-commit window. #342's redaction
    (commit `da47d9e`) only replaced the **working-tree** copy with a 23,025-byte
    placeholder; the original blob persists in history. Because `79c2097`'s SHA is
    unchanged (it matches its real merged PR), **no history rewrite has occurred** —
    a `filter-repo`/BFG purge would have rewritten that SHA and removed the blob.
    This is the verification run #28 could not make (its shallow window lacked the
    blob under the `5585fd4` SHA run #27 cited; the same blob is present here under
    `79c2097`). *(PII not reproduced per the review's redaction rule.)*
  - Risk: real personal data (full name, phone, email, LinkedIn, location, CV
    filename across the ten #342 paths) remains publicly fetchable by commit SHA on a
    public repo — a freeze-exit release blocker per the issue.
  - Recommended fix: unchanged — owner-attended `git filter-repo`/BFG purge of the
    identified blobs + coordinated force-push, preserving an off-remote backup ref,
    plus the PR/comment exposure review the issue calls for. **Do not run a history
    rewrite unattended** (destructive, force-pushes a shared public repo).
  - Owner / next step: **PREPIO-145** (High/Urgent, owner-attended). Already tracked
    with a full remediation plan; no new issue filed.

### Medium

- [ ] **Evidence-ledger `official_company` over-trusts any host containing a company
  token — attacker-subdomain trust escalation (PREPIO-184).** *(Carried; code-verified
  still open. The fix is authored and open as PR #375, awaiting merge.)*
  - Evidence:
    [`evidence-ledger.ts:175–178`](../../supabase/functions/interview-research/evidence-ledger.ts)
    computes `normalizedHost = host.replace(/[^a-z0-9]/g, "")` and returns
    `official_company` (→ high trust via `trustWeightFor`) when **any**
    `companyTokens(company)` entry is a substring of it (`.includes(token)`). For
    company "Acme", a caller-supplied `roleLink` or search-surfaced
    `https://acme.attacker.example/job` normalizes to `acmeattackerexample`, which
    `.includes("acme")` → `official_company`/high. No registrable-domain /
    public-suffix / exact-label check (the code comment at lines 180–186 explicitly
    defers PSL-aware matching as follow-up; short names like `X`/`BP`/`3M` fall
    through to `market_heuristic` for the same reason).
  - Risk: attacker-controlled content whose hostname embeds the company name is
    weighted as high-trust "official company" evidence in the grounded-evidence
    ledger, biasing generated prep. Gating: the row must enter via the caller's own
    `roleLinks` (self-inflicted) or a Tavily result the attacker ranks for the company
    query. Content-integrity, not cross-tenant read. (The run #27 compounding factor
    with the `searchId` BOLA is **removed** now that PREPIO-143 is fixed — an attacker
    can no longer drive writes into a *victim's* search.)
  - Recommended fix: match the company against the host's **registrable label**
    (exact, PSL-aware), mirroring the ATS exact/suffix approach `isJobPosting` already
    uses; add adversarial tests rejecting `company-token.attacker.example` subdomains;
    verify legitimate employer domains (incl. short names and multi-label suffixes)
    still classify correctly. **This is exactly what open PR #375 implements** — the
    actionable next step is reviewing/merging it, then re-auditing the whole
    `classifyRetrievedSource` trust map against adversarial fixtures.
  - Owner / next step: **PREPIO-184** (In Progress; fix PR #375 open). A service-role
    edge-function change requiring the Deno `typecheck:functions` gate that can't run
    in this proxy-limited environment — out of scope for a docs-only hygiene run.

### Low / clean-up

- [ ] **Unmerged audit/fix-PR backlog is growing.** *(Process observation, new this
  run. Not a code risk; flagged so findings and their fixes do not stall unseen.)*
  - Evidence: `main`'s audit trail ends at the 2026-09-12 note, but the four
    subsequent recurring-hygiene runs and several UX-review runs exist only as **open,
    unmerged PRs** (e.g. hygiene #374/#379/#381/#383/#384/#388/#390/#394/#397; UX
    #380/#386/#391/#398), alongside the **PREPIO-184 fix PR #375** and a dependency
    security-patch PR #389. The most recent hygiene findings (run #28, #397) and the
    one authored security fix in flight (#375) are therefore not on `main`.
  - Risk: low and indirect — the notes are a dated trail and the fixes are reviewable,
    but while #375 sits unmerged the PREPIO-184 over-trust stays live in the shipped
    code path, and each hygiene run re-derives the same carried findings because the
    prior note isn't on the branch it's measured from.
  - Recommended fix: owner to triage the open audit-note PRs (merge or close) and,
    separately, review/merge the PREPIO-184 fix (#375) so the Medium actually closes.
    No change this run — merging others' PRs is outside an unattended hygiene run's
    scope.

- [ ] **`npm audit` is still not a CI gate.** *(Observation, unchanged from prior runs.)*
  - Evidence: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) gates lint,
    typecheck, typecheck:functions, build, and test — not `npm audit`. Advisory
    response relies on Dependabot.
  - Recommended fix: optional non-blocking `npm audit --audit-level=high` step. A
    CI-policy call for maintainers, not a hygiene-run change.

- [ ] **Confirm Dependabot *security* updates are actually opening PRs.** *(New caveat
  this run; verify, don't assume.)*
  - Evidence: [`.github/dependabot.yml`](../../.github/dependabot.yml) sets
    `open-pull-requests-limit: 0` for both npm and github-actions, with a comment
    asserting "security updates remain enabled." Per GitHub's model, version-update
    PRs and Dependabot **security** updates are separate, and the limit applies to
    version updates — but security updates only fire if the repo-level "Dependabot
    security updates" setting is on. The two-month advisory accrual (now 25) with the
    only security bumps arriving via **hand-authored** PRs (#350 pdfjs, #353
    react-router) and a codex lockfile PR (#389) — not Dependabot — is weak evidence
    that automatic security PRs may not be firing.
  - Risk: low (current advisories are all dev-tooling with no runtime path), but if a
    future advisory lands on a runtime dependency, a silently-disabled Dependabot
    security channel would leave it unsurfaced.
  - Recommended fix: owner to confirm "Dependabot security updates" is enabled in the
    repo's Security settings (Settings → Code security). If it is on and still silent,
    the `limit: 0` may be suppressing it, and a small non-zero limit scoped to security
    updates would restore the channel. Cannot be verified from the repo contents alone.

## Small fixes made in this run

- **None to product source.** No new merge landed since run #28, both open findings
  (PREPIO-145 history rewrite, PREPIO-184 service-role classification) are
  owner-tracked work out of scope for an unattended docs run and not validatable in
  this proxy-limited, shallow-clone environment, and the 25 `npm audit` findings are
  dev-tooling with no runtime path (deferred to Dependabot per the freeze posture).
  The deliverable is this note + the `docs/audits/README.md` index row.

## Deferred items

Tracked or Dependabot-surfaced:

- **PREPIO-145** — owner-attended Git-history purge of the production-CV screenshot
  blobs + exposure review (High). **Confirmed still exposed this run** (blob at
  `79c2097`); no rewrite has landed.
- **PREPIO-184** — evidence-ledger `official_company` attacker-subdomain over-trust
  (Medium, In Progress). The registrable-label fix is authored as **open PR #375**;
  the next step is review/merge, then re-auditing `classifyRetrievedSource`.
- **`npm audit` dev-tooling advisories (25)** — Dependabot security updates; version
  bumps paused for the freeze. No runtime exposure.
- **Unmerged audit-note / fix-PR backlog** — owner triage (merge or close).
- **`npm audit` as a non-blocking CI step** (Low, process) — maintainer call.
- **Dependabot security-update channel** — owner to confirm it is enabled and firing
  (repo Security settings), given `open-pull-requests-limit: 0`.

## Questions for product owner

- **Is the "Dependabot security updates" setting enabled at the repo level, and is it
  opening PRs?** The freeze config pauses version updates (`limit: 0`) and relies on
  the separate security channel, but the recent security bumps arrived by hand, not
  from Dependabot. Not blocking (all current advisories are dev-tooling), but worth a
  one-time confirmation so a future runtime advisory doesn't go unsurfaced.
- **PREPIO-184 fix PR #375** is open and unmerged — is it waiting on review, or on the
  PREPIO-124 freeze-deploy ordering? The Medium stays live in the shipped path until
  it merges.

## Next review focus

1. **PREPIO-145 against a full clone.** Still the single open High. If a session with
   `git fetch --unshallow` (or remote access) becomes available, confirm the full set
   of ten #342 blobs and watch for the owner-attended purge landing. This run confirmed
   it is still exposed within the shallow window.
2. **PREPIO-184 landing (PR #375).** When it merges, re-audit the whole
   `classifyRetrievedSource` trust map (incl. the deferred short-name/employer-domain
   case) with adversarial `company-token.attacker.example` fixtures, and confirm the
   `npm audit` surface is unaffected.
3. **PREPIO-143 reaching production (PREPIO-124).** The BOLA fix is correct and merged
   in the repo, but a repo merge alone does not repair production — the freeze backend
   deploy must ship it. Re-audit `company-research`, `job-analysis`, and
   `answer-feedback` for the same object-ownership pattern while confirming.
4. **Next source-touching merge.** Re-run the full baseline against it rather than
   re-verifying carried findings, and read the *merged* code (not commit messages) when
   assessing any security fix.
