# Recurring hygiene review — 2026-11-18

## Summary

Recurring codebase hygiene & security review, four days after the 2026-11-14 run.
Unlike the last two runs, **`main` has moved**: eleven merges landed between `a330939`
(the previous run's HEAD) and `ee3ea7b` (this run's HEAD), 51 files / +5,407 lines.
This run reviewed the merged code, not the commit messages:

| Merge | What it changes | Review result |
| --- | --- | --- |
| #375 [PREPIO-184] | Evidence ledger now matches the company against the host's **registrable label** instead of any substring | Subdomain attack closed (re-probed). One small bypass fixed this run; broader residual recorded below. |
| #395 PREPIO-156 | Adds `role_family` + top-5 outcome fields to the `research_yield` log | Privacy-safe. `classifyRoleFamily` returns a fixed enum (`consulting`/`finance`/`tech`/`other`); no `role` or `userNote` text reaches the log. Outcome fields are always `null` until a debrief exists, which the RUNBOOK says. |
| #393 | "Started YYYY-MM-DD (UTC)" on interview cards | Strict ISO-with-timezone parse, falls back to "Start date unavailable". Tested. No issue. |
| #396 / #401 | Offline `evals/research/` evidence-integrity harness | No network calls, no keys, no user data; fixtures use public job-posting URLs only. |
| #399 | Call-graph test | Test-only. |
| #383 / #386 / #391 / #398 / #400 | Audit notes + 24 screenshots | Sampled 7 signed-in screenshots: no names, emails, phone numbers or CV text visible. They do show the acceptance account's interview targets (company + role). |

The deliverables of this run are this note, the index row, and one small security fix
with a regression test (see [Small fixes](#small-fixes-made-in-this-run)).

## Commands run

- `npm install`: **pass** (748 packages; via SessionStart hook and again in the baseline run).
- `npm run lint`: **runs, 49 problems** (40 errors, 9 warnings). All pre-existing classes
  (`no-explicit-any` in tests / edge functions, fast-refresh warnings). Unchanged. Lint is
  informational in CI.
- `npm run typecheck`: **pass at baseline** — app **61**, node **0**.
- `npm run typecheck:functions`: **pass at baseline — 19** errors. **First run in this
  environment where the Deno gate actually executed** (earlier runs reported `SKIPPED`
  because the proxy blocked `esm.sh` / `deno.land`). Re-run after this run's edge-function
  change: still 19.
- `npm run build`: **pass** (41 precache entries, 1243.85 KiB).
- `npm test`: **pass — 63 files, 714 tests** before the fix; **715** after (one new test).
  Up from 494 / 58 at the last run because of the new eval and ledger tests.
- `npm audit`: **38** (1 low, 12 moderate, 25 high, 0 critical) — up from 25 through new
  advisories, not new packages.
- `npm audit --omit=dev`: **14** (1 moderate, 13 high). See the dependency finding below.
- `npm outdated`: run; version bumps stay paused for the freeze.
- Temporary adversarial probe of `buildEvidenceLedger` (a throwaway vitest file, deleted
  after use — not committed).

## Findings

### Critical

- None.

### High

- [ ] **Production CV PII still in Git history (PREPIO-145) — carried, not re-verified.**
  - Evidence: no history rewrite has merged since the 2026-11-14 run, which confirmed the
    pre-redaction blob still resolves at commit `79c2097`. `79c2097` is still an ancestor
    of `origin/main` with an unchanged SHA.
  - Risk: real personal data remains fetchable by commit SHA on a public repository.
  - Recommended fix: unchanged — owner-attended `git filter-repo` purge, coordinated
    force-push and exposure review per `docs/FREEZE_RELEASE.md` §1. **Not something an
    unattended run should do.**
  - Owner / next step: **PREPIO-145** (Urgent, Todo), owner Qiuyue.

### Medium

- [ ] **Evidence ledger still gives `official_company` (high trust) to hosts the employer
  does not own — residual of PREPIO-184.** *(New this run.)*
  - Evidence: #375 fixed the reported attack: `acme.attacker.example` now classifies as
    `market_heuristic` (re-probed). The new rule compares the company name with the
    host's registrable label only. It does not check the TLD or whether the employer
    owns the domain. A throwaway probe against `buildEvidenceLedger` at `ee3ea7b`
    returned `official_company` / `high` for:
    - `acme.xyz` for company "Acme". Anyone can register the name under another TLD.
    - `capital.com` for "Capital One" and `american.edu` for "American Express". One
      significant word of a multi-word name is enough (`tokens.includes(label)` in
      `classifyRetrievedSource`).
    - `attacker.gen.in` for "Gen Digital". `gen.in` is an open second-level suffix that is
      missing from `MULTIPART_PUBLIC_SUFFIXES`, so `gen` is read as the registrable label.
    - `sites.google.com/view/<anyone>` for "Google". The same applies to any employer whose
      own domain hosts user content.
    - `attacker.monster.` for "Monster" (trailing-dot FQDN). **Fixed this run.**
  - Risk: content integrity, not cross-tenant access. A row needs to come from Tavily
    results for the company query or from the caller's own `roleLinks`. When it does,
    unrelated or attacker content is labelled "official company" and weighted as high
    trust in the plan prompt. The attacker's cost is registering one cheap domain, which
    is about the same as the subdomain attack #375 closed.
  - Recommended fix (owner decision; more than 30 minutes): anchor `official_company` to a
    known employer domain (for example a verified role-link host or a curated map) and
    downgrade everything else. Alternatively, require the full-name compacts, drop
    single-token matches, and use a real Public Suffix List. Add adversarial tests for
    each case above.
  - Owner / next step: **needs a Linear issue — filing failed this run** (Linear returned
    "exceeded the free issue limit for this workspace"). The issue text is ready under
    [Deferred items](#deferred-items) for the owner to paste. Related: PREPIO-184 (Done),
    PREPIO-76.

### Low / clean-up

- [ ] **`zod` is a production dependency that nothing imports, and it carries a high
  advisory.**
  - Evidence: `package.json` lists `"zod": "^3.23.8"` (installed 3.25.76) under
    `dependencies`. `grep` finds no `zod` import in `src/`, `supabase/functions/`, or
    anywhere else outside lockfiles and an old review. `npm ls zod` shows the only other
    consumer is `eslint-plugin-react-hooks` (dev). GHSA-mrhx-c7xc-m3w5 (memory
    exhaustion) is therefore reported in `npm audit --omit=dev`, but no app code path
    reaches it. **This corrects the 2026-10-24 note**, which said zod is used for
    client-side form validation; the 2026-11-14 note had it right.
  - Recommended fix: remove the direct `zod` entry (the dev-only copy stays for the
    eslint plugin). Not done here: the freeze discourages dependency PRs, and this has no
    runtime exposure. Fold it into the next owner-approved dependency change.

- [ ] **Advisory count grew from 25 to 38, all build, dev or test tooling.**
  - Evidence: the 13 extra advisories are new GHSAs on packages already installed.
    `picomatch` ReDoS (no fix available) reaches `tailwindcss`, `chokidar`, `micromatch`
    and `tinyglobby`. Others: `source-map-js`, `brace-expansion`, `undici` (via jsdom),
    `@vitest/mocker`, and `vite` / `launch-editor` (dev server, Windows editor launch).
    The production-tree audit (14) is made up of build-time tooling that is listed under
    `dependencies` (tailwind / postcss), plus the unused `zod`. None of it ships in the
    built bundle.
  - Recommended fix: none during the freeze. After release, consider moving build-only
    packages (tailwind, postcss plugins) to `devDependencies` so `--omit=dev` audits show
    real runtime risk.

- [ ] **Open PR backlog: 17 open PRs, 10 of them audit notes that later notes supersede.**
  - Evidence: open hygiene-note PRs #374, #379, #381, #384, #388, #390, #394, #397 and
    UX-note PRs #376, #380 — their successors (#383, #400, #386, #391, #398) merged
    instead. Also open: fix / test PRs #378 (PREPIO-132), #385 (PREPIO-101), #389
    (lockfile security refresh), and cursor test PRs #377, #382 (draft), #387, #392.
    #375 has now merged, so last run's main concern is resolved.
  - Recommended fix: owner closes the superseded audit-note PRs. The evidence they hold
    is carried forward in the merged notes. Separately, decide on #389 and the test PRs.

- [ ] **Process: a feature merged during the freeze.** #395 (PREPIO-156 telemetry)
  is a small, privacy-safe change, but `CLAUDE.md` / `FREEZE_RELEASE.md` say "do not add
  features". Recorded only so the freeze scope stays an explicit decision.

- [ ] **Carried: `npm audit` is not a CI step; Dependabot's security-update channel is
  unconfirmed.** Still true: `.github/dependabot.yml` sets `open-pull-requests-limit: 0`,
  and no Dependabot security PR appears among the 17 open PRs, even with 25 high
  advisories. This is consistent with the security channel being off, or with all
  advisories being dev-only or having no fix. Owner to check *Settings → Code security*.

## Small fixes made in this run

- **Evidence ledger: strip a trailing-dot FQDN before reading the registrable label.**
  Without this, `new URL("https://attacker.monster./").hostname` keeps the trailing dot.
  The empty last label makes `registrableLabel` return the TLD, so any `*.monster`
  registrant was trusted as the employer "Monster". The same applies to any company name
  that is also a generic TLD. The fix is one normalization in `hostFor`
  ([`evidence-ledger.ts`](../../supabase/functions/interview-research/evidence-ledger.ts)).
  It also normalizes `platform` and the community / ATS host checks, which previously
  missed trailing-dot forms of `glassdoor.com.` and similar hosts — those could only lose
  trust, never gain it.
  - Test: "ignores a fully-qualified trailing dot when reading the registrable label" in
    `evidence-ledger.test.ts` covers the spoof case (`attacker.monster.` →
    `market_heuristic`) and a genuine FQDN (`careers.acme.com.` → `official_company`).
    Verified to **fail without the fix and pass with it**.
  - Gates after the change: `typecheck:functions` 19 (baseline), `typecheck` 61 / 0,
    `build` pass, `test` 715 pass.
  - Deployment: this is merged-code-only. Like every other edge-function fix, it reaches
    production only through the PREPIO-124 freeze deploy.

## Deferred items

- **PREPIO-145** — history purge (High, owner-attended). Unchanged.
- **NEW — not yet filed (Linear free-issue limit reached).** Proposed issue for the
  owner to file in *Quality & Maintenance* (`Chore`, `area:research-pipeline`, Medium,
  related to PREPIO-184 / PREPIO-76):
  > **Evidence ledger still grants official_company to lookalike registrable labels
  > (PREPIO-184 residual).** The registrable-label match never checks the TLD or
  > ownership, so `acme.xyz` (any-TLD lookalike), `capital.com` → "Capital One" (one
  > token of a multi-word name), `attacker.gen.in` (unlisted open second-level suffix),
  > and `sites.google.com/view/*` → "Google" (an employer hosting user content) all
  > classify as high-trust `official_company`. Fix direction: anchor to a known employer
  > domain or require full-name matches plus a real PSL; add adversarial tests. Needs the
  > Deno gate and a PREPIO-124 deploy decision. Source: this note.
- **Remove the unused direct `zod` dependency** — under 30 minutes; fold into the next
  approved dependency change.
- **Close superseded audit-note PRs** — owner triage.
- **`npm audit` as a non-blocking CI step; Dependabot security-channel check** — carried.

## Questions for product owner

- **The Linear workspace has hit its free-issue limit.** Hygiene findings can't be filed
  automatically while this lasts (it also blocked an earlier run in this series). Should
  the routine keep putting ready-to-file text in the note, or is there a different intake
  path?
- **Are the acceptance-account interview targets in the new audit screenshots (Stripe
  Data PM, OpenAI Solutions Architect, Anthropic PM) synthetic?** `FREEZE_RELEASE.md`
  requires synthetic acceptance data. The screenshots show no direct identifiers, but a
  real person's job-search targets are still personal data.

## Next review focus

1. **Verify the residual `official_company` issue is filed and triaged.** When a fix
   lands, re-run the five-host adversarial probe from this note against the merged code.
2. **PREPIO-145 / PREPIO-124 progress.** Watch for the history purge and the freeze
   deploy that ships PREPIO-143, PREPIO-184 and this run's fix. Merged code is not
   deployed code.
3. **Next source-touching merge**: rerun the full baseline. The Deno gate is now
   runnable here, so record a real `typecheck:functions` result rather than `SKIPPED`.
