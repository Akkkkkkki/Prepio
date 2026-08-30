# Linear ↔ repo alignment review — 2026-08-29

One-off reconciliation between the **Prepio** Linear team and `main` @ `a9640b1`,
prompted by the observation that the two had drifted apart and that the repo's own
docs disagreed with each other. Not a hygiene or UX run — no findings pass, no
screenshots. The deliverable is: every doc claim checked against code, every open
Linear issue checked against code, and both sides corrected.

## Method

Every claim below was verified by reading the code on `main` or by running the
command named. Where a doc and the code disagreed, the code won. Where Linear and
the code disagreed, the code won. Nothing here is inferred from a previous audit
without re-checking it.

Baselines measured this run:

| Check | Result |
|---|---|
| `npm test` | **427 passing / 49 files** (+ legacy-schema, answer-feedback-schema) |
| `npm run typecheck` | pass — app **62**, node **0** |
| `npm run build` | pass — 62 precache entries, 2278 KiB |
| `npm run lint` | **51 problems** (43 errors, 8 warnings) |
| `npm audit` | **3** — 1 high (`pdfjs-dist`), 2 moderate (`react-router`) |
| `npm run typecheck:functions` | not runnable here (proxy blocks `deno.land` / `esm.sh`); reports SKIPPED, not pass |

## The shape of the drift

Three distinct kinds, worth separating because they have different causes:

1. **Docs behind code.** `docs/RESEARCH_PIPELINE.md` described four shipped issues
   (PREPIO-40, 79, 80, 82) as open work, and `docs/TESTING.md` quoted a type-error
   baseline more than six times the real one. Cause: docs updated at design time,
   not at merge time.
2. **Linear behind code.** Two epics and three issues were sitting in states their
   own children or the code had already moved past.
3. **Docs contradicting each other.** `docs/ARCHITECTURE.md` listed
   `create-checkout-session` and `create-portal-session` as shipped Edge Functions
   and then, forty lines later, said Checkout and Portal "are not implemented yet".

A fourth thing is not drift at all but is easy to mistake for it: **`main` is not
production.** Seven edge functions and eight migrations have never been deployed
(PREPIO-124), so a doc saying "shipped" and a user saying "it's broken" can both be
right. Every top-level doc now says so explicitly.

## Findings

### 1. `ops.scraped_urls` is read but never written — the retrieval cache is dead

The most consequential code finding of the review, and it changes what PREPIO-51
actually is.

`company-research` Phase 0 constructs `UrlDeduplicationService`, calls
`findReusableUrls()`, and will skip the fresh search entirely at ≥5 cached items —
the read path is fully wired. But the write path is unreachable:

1. `company-research` calls `searchTavily(...)`.
2. `searchTavily` ([`_shared/tavily-client.ts:294`](../../supabase/functions/_shared/tavily-client.ts))
   forwards `company` as the **empty string** into `searchTavilyWithDeduplication`.
3. That function guards on `if (supabase && company)` (`:58`), which is therefore
   false, so `urlDeduplication` stays `null`.
4. The store block is gated on `if (urlDeduplication && ...)` (`:118`), so
   `storeScrapedUrl` / `storeScrapedContent` never run.

Net effect: every run pays full Tavily price, the cache lookup always misses, and
the table stays empty forever. `ops.tavily_searches` **is** written — its guard is
only `supabase && searchId && userId` — which is why cost telemetry looks healthy
while the cache does not exist. Filed as a root-cause comment on **PREPIO-51**,
including a warning not to "fix" it by dropping the guard (the cache key is
`(url_hash, company_name)`; an empty company would poison the table).

### 2. `supabase/schema.sql` is missing five tables — for two different reasons

The checked-in `db:pull` snapshot has no `billing_customers`,
`billing_subscriptions`, `billing_events`, `research_previews`, or
`research_preview_rate_limits`, though all five have had migrations since May.

My first reading — "production never received those migrations" — was **wrong for
three of them**, as Codex pointed out on the PR carrying this note. The live
`list_migrations` check recorded in
[`2026-07-30-ux-review-routine.md`](./2026-07-30-ux-review-routine.md) splits them:

- `research_previews` / `research_preview_rate_limits` come from
  `20260516232408_research_preview_cache`, which **is** genuinely pending. Their
  absence is explained by the freeze.
- The three `billing_*` tables come from `billing_v1`, which is **already applied in
  production** as version `20260515131539`. Those tables exist in the live database,
  so their absence from the snapshot is *not* explained by the freeze.

That makes the file worse than "an accurate picture of the wrong database": it is not
a faithful `db:pull` of any database that has existed. Filed as **PREPIO-173**, whose
first job is now to explain the billing gap rather than assume the deploy will close
it.

**The deployment hazard this uncovered matters more than the snapshot.** Two
already-applied migrations were re-timestamped in the repo:

| Migration | Local | Production |
|---|---|---|
| `billing_v1` | `20260514000000` | `20260515131539` |
| `security_hardening_and_resume_rpc` | `20260515150000` | `20260515171733` |

The histories therefore diverge, and a blind `npm run db:push` can stop on the
unmatched remote version or treat the local security migration as new and re-run it.
The history needs reconciling (`supabase migration repair`) **before** anything is
pushed. This caveat was recorded in the 2026-07-30 audit but had not reached
PREPIO-124 or PREPIO-170; it has now been added to both.

The pending count is unaffected: the 2026-07-30 audit found 7 pending, and
`20260808110000_profile_story_linking` has landed since, giving the 8 recorded here.

### 3. Two issues had drifted past their own scope

- **PREPIO-48** — `includeRawContent` is already `true` and query breadth is already
  6 (PREPIO-80), so a third of the issue is done. What remains is deep extraction
  (hard-skipped at `company-research/index.ts:300`) and the hardcoded
  `maxResults: 3` / `searchDepth: 'basic'`. All four call sites still carry comments
  citing a 15-second synchronous budget that **PREPIO-40 removed**.
- **PREPIO-155** — the DuckDuckGo fallback is already gone; PREPIO-80 removed it.
  What survives is a dead Tavily-only shim whose only importer is its own test, plus
  a log `reason` string naming the deleted vendor. Still worth doing, but it is a
  deletion, not a fix.

### 4. Playwright: the PREPIO-135 question, answered

CI has exactly one job with six steps, and `test:e2e` is not among them. The suite
is not red and not skipped — nothing runs it. `docs/TESTING.md` now says so.

### 5. A repeat accessibility finding with no issue behind it

The guest landing page has rendered zero `<h1>` elements across at least three UX
review runs, with the outline running h3 → h3 → h2. `/pricing`, `/profile`, and
`/history` are all correct, so it is one isolated page. It had never been filed,
which is why it kept resurfacing. Now **PREPIO-171**.

### 6. Deferred audit items that were never filed

CLAUDE.md requires a Linear issue per deferred item over the 30-minute threshold.
Two dependency-major items were repeatedly deferred with "Dependabot is the tracker"
— inconsistent with `pdfjs-dist` (PREPIO-140) and vite/esbuild (PREPIO-62), which
both got issues. The react-router upgrade is now **PREPIO-172**. The
`check-deno-baseline.sh` hardening turned out to be already filed as **PREPIO-169**
during the previous session; the duplicate this review opened (PREPIO-174) was
closed as a duplicate on discovery.

### 7. A closed advisory nobody had noticed closing

**PREPIO-62** asked for a `vite@8` upgrade to clear GHSA-67mh-4wv8-2f99. Vite is at
7.3.5 and the advisory no longer appears in `npm audit` at all — vite 7 carries a
patched esbuild. Closed. Leaving it open meant re-litigating a fixed advisory every
hygiene run.

## Linear changes

**Status corrections (5).** PREPIO-24 → Done (the named flaky test no longer exists;
suite green at 427/427, and PR #60 fixed it long ago). PREPIO-56 → Done (all three
children shipped). PREPIO-76 → In Progress (seven children shipped while the epic
sat in Backlog). PREPIO-128 → In Progress. PREPIO-62 → Done.

**New issues (4 kept).** PREPIO-170 (apply `question_flags_per_type` to production),
PREPIO-171 (landing `<h1>`), PREPIO-172 (react-router v7), PREPIO-173
(`schema.sql`). PREPIO-174 closed as a duplicate of PREPIO-169.

**Project hygiene.** PREPIO-128 and its seven children (129–135) had **no project**,
contrary to the CLAUDE.md convention. All eight moved to Quality & Maintenance.

**Scope and root-cause comments (7).** PREPIO-48, 51, 55, 110, 124, 135, 155.

**Left deliberately alone.** PREPIO-55 stays In Review: CLAUDE.md says not to move
an issue by hand while a PR exists, and draft PR #247 is the reason for the status.
The fix belongs on the PR, and it is tracked in PREPIO-110 with the other two stale
bot PRs. PREPIO-99, 101, and 107 were re-verified against the code and their
In Progress states are correct — nav is still Home / Dashboard / Practice / Practice
History, there is no Plan/Practice/Review workspace header, and no Review tab exists.

## Repo changes

- `docs/RESEARCH_PIPELINE.md` — corrected the "why quality is below bar" section
  against measured code, marked rows 4 and 5 FIXED, added per-step state to the
  rollout table, and added a measurement gate pointing at PREPIO-154/148/162.
- `docs/ROADMAP.md` — moved shipped work out of "known gaps", added the
  profile-activation, interview-home, and practice work that had shipped without
  being recorded, corrected PREPIO-41/45/47 references, and reordered "Next" so
  PREPIO-124 and the eval work come first.
- `docs/ARCHITECTURE.md` — added `Interviews.tsx` and the two Stripe functions,
  removed the self-contradiction about Checkout/Portal, added a deployment-state
  table and the `schema.sql` warning, noted the dead `ops.scraped_urls` write path.
- `docs/TESTING.md` — 381 → 62 type-error baseline, 54 → 51 lint problems, added
  `typecheck:functions` and the 19-error Deno ratchet, named Playwright and its
  absence from CI, marked the PREPIO-133 triage section historical.
- `CLAUDE.md` and `README.md` — the missing typecheck commands, and an explicit
  "shipped means merged to `main`, not live" caveat at the top of each.

## Deferred items

Per the CLAUDE.md recurring-hygiene rule, every deferred item below is tracked in
Linear by identifier rather than re-described here:

- **PREPIO-168** (Urgent) — rotate the test-account credential exposed in git
  history. Re-verified this run: the code fallback is gone from HEAD (the legacy
  Deno tests read `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` with no literal
  default), but history rotation is an owner action and is still owed.
- **PREPIO-124** (Urgent) — the production deploy. Now blocking six other issues.
- **PREPIO-170** (High) — the `42P10` schema step split out of PREPIO-124.
- **PREPIO-143** (High) — the `interview-research` `searchId` BOLA fix.
  Re-verified still open: `index.ts:1096` checks body `userId` against the JWT and
  never checks `searchId` ownership.
- **PREPIO-140** (High) — `pdfjs-dist` 5 → 6.
- **PREPIO-171** (Medium), **PREPIO-173** (Medium), **PREPIO-172** (Low),
  **PREPIO-169** (Low).

## What would stop this recurring

The drift found here was cheap to fix and expensive to find — six hours of reading
code to confirm claims that were wrong for months. Two things would have caught most
of it earlier:

1. **A doc-touch expectation on pipeline PRs.** Every stale claim in
   `RESEARCH_PIPELINE.md` was stale because the PR that made it untrue did not touch
   the doc. The rollout table now has a State column, which is the cheapest possible
   place to notice.
2. **Baselines that cite their source.** `docs/TESTING.md` quoted 381 as a prose
   number while `scripts/check-typecheck-baseline.sh` said 62. A doc that names the
   script and the command, as it now does, cannot silently disagree with it.

The deeper point is the one PREPIO-154/148 exist for: most claims in this repo about
research quality are still unfalsifiable. Alignment reviews can keep prose honest
about *code*; only an eval harness can keep it honest about *output*.
