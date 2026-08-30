# Research Pipeline

How interview research works today, why output quality is below bar, and the target
"grounded evidence" architecture (v3). This is the source of truth for research-pipeline
design decisions; the work is tracked in Linear under the **[Epic] Research pipeline v3 —
grounded evidence architecture** (PREPIO-76) in Quality & Maintenance.

Status: design approved for incremental rollout. Last reviewed 2026-08-29 against `main`
@ `a9640b1`.

## The pipeline as shipped (v2)

`interview-research` orchestrates three concurrent gatherers, then one synthesis call:

```
Browser ──► interview-research (202 acknowledgement; background orchestrator)
              │
              ├─ PHASE 1 (concurrent, per-call stall guards 45–120s)
              │    ├─ company-research   → company insights + interview reports
              │    ├─ job-analysis       → requirements from role links (Tavily extract)
              │    └─ cv-analysis        → structured CV data
              │
              ├─ PHASE 2  one OpenAI call → full PrepPlan JSON
              │            (summary, signals, stage roadmap, priorities,
              │             positioning, practice sequence, ≥40 questions,
              │             internal evidence log)
              │
              └─ PHASE 3  persist → prep_plans, interview_stages,
                           interview_questions, searches.status
```

`company-research` runs a single **retrieval-grounded path**: a role-family-aware Tavily
query plan (up to 6 queries) over the allowed community domains. The URL-dedup/caching and
deep-extraction phases exist in code but are inert on `main` — see the next section.

## Why quality is below bar

Two classes of problems. The first class — **retrieval depth** — is known and tracked.
PREPIO-40 (shipped) moved orchestration into background work and removed the browser and
company-research 15-second wall-clock races. PREPIO-80 (shipped) replaced the static
SWE-biased templates with `company-research/query-planner.ts`, so a run now issues up to 6
role-family-aware queries instead of 2, and `includeRawContent` is back on. What is still
throttled, measured on `main`:

- `maxResults: 3` and `searchDepth: 'basic'` per query
  ([`company-research/index.ts:225`](../supabase/functions/company-research/index.ts)) — both
  still tuned for the synchronous budget PREPIO-40 removed. The `maxQueries: 6` comment just
  above them still cites a 15s wall clock that no longer applies.
- The deep-extraction phase is hard-skipped (`EXTRACTION_SKIPPED`,
  [`company-research/index.ts:300`](../supabase/functions/company-research/index.ts)), so
  `extracted_content` is always empty and the `DEEP-EXTRACT-*` prompt block never populates.
- The `ops.scraped_urls` cache is **read but never written**. `company-research` calls
  `searchTavily`, which forwards `company: ''` into `searchTavilyWithDeduplication`
  ([`_shared/tavily-client.ts:294`](../supabase/functions/_shared/tavily-client.ts)); that
  function's `if (supabase && company)` guard is therefore false, the dedup service is never
  constructed, and the store block that would write `ops.scraped_urls` never runs. Phase 0's
  `findReusableUrls` lookup consequently always misses. Tracked in PREPIO-51.

The analyzer is still asked for "EXACT questions candidates were asked" while being fed a
handful of search snippets.

The second class — **evidence integrity** — surfaced in the 2026-06-12 review and is the
core of v3:

| # | Failure | Where | Tracked |
|---|---------|-------|---------|
| 1 | `internalEvidenceLog` (now user-visible via the Dashboard "Sources" affordance) was written freeform by the synthesis LLM. **FIXED:** retrieval now builds the persisted ledger in code, synthesis cites `ev-*` IDs only, and unresolved IDs are dropped before persistence. | `interview-research/index.ts`, `interview-research/evidence-ledger.ts` | PREPIO-78 ✓ |
| 2 | Synthesis is one 12k-token mega-call with no schema enforcement: question minimums are prompt-only, stage links are free-text (mismatches silently orphan questions), malformed output fails the whole run with no repair. **PARTIALLY FIXED:** synthesis output is now schema-validated (minimums, stage-link resolution, per-question difficulty enums) with one bounded repair pass; runs that still fail are persisted with an honest `summary.synthesisQuality.degraded` marker instead of silently completing. The staged-generation split remains open. | `interview-research/index.ts`, `interview-research/prep-plan-validation.ts` | PREPIO-79 ◑ |
| 3 | Confidence (`stageRoadmap[].confidence`, `overallConfidence`, `weakSignalCase`) is model self-assessment; zero-evidence runs still present confident roadmaps. `contradictionGroup` exists in the schema but nothing computes it. | `interview-research/index.ts` | PREPIO-81 |
| 4 | Retrieval was SWE-biased regardless of role, and the DuckDuckGo "fallback" hit the instant-answer API and returned no forum results. **FIXED:** `buildResearchQueryPlan` classifies role-family and lets `level`, `country`, and the user note shape queries and domain packs; the DuckDuckGo path is gone, and an empty or failed search now logs `TAVILY_SEARCH_EMPTY` / `TAVILY_SEARCH_FALLBACK_UNAVAILABLE` with `fallbackEngaged: false` instead of substituting non-equivalent evidence. `_shared/duckduckgo-fallback.ts` survives only as a dead Tavily-only shim with no production caller. | `company-research/query-planner.ts`, `_shared/duckduckgo-fallback.ts` | PREPIO-80 ✓ (shim removal: PREPIO-155) |
| 5 | `job-analysis` fell back to generic stub requirements with no provenance flag; synthesis was told they came "from link analysis". **FIXED:** the payload carries `requirementsSource: "extracted" \| "stub"`, a stub run reports no sources, and a `[job-analysis] stub-fallback` log line makes the stub rate countable. | `job-analysis/index.ts` | PREPIO-82 ✓ |

The combined effect: synthesis output is mostly model priors dressed up as research, with
fabricated supporting evidence — the opposite of the research-first wedge in
`PRODUCT_STRATEGY.md`.

## Target architecture (v3: grounded evidence)

### Principles

1. **No fabricated evidence, ever.** Mock, stub, or heuristic content never enters a prompt
   as evidence and never persists as a source. Heuristic/prior knowledge is allowed but must
   be labeled as such (`sourceType: market_heuristic`).
2. **Citations resolve.** Every user-visible source row maps to a real retrieved URL in a
   programmatically built ledger. The model cites by ID; it never writes URLs.
3. **Confidence is computed.** Corroboration across independent sources sets stage
   confidence; the model proposes, code disposes.
4. **Degrade honestly.** Thin evidence ⇒ `weakSignalCase: true`, low-confidence copy, and a
   role-norms framing — not an invented high-confidence loop.
5. **Validated outputs only.** Schema-validated synthesis with a bounded repair pass;
   silently-broken plans never persist as `completed`.

### Phases

```
A. Intake & query planning      B. Retrieval (async job)
   role-family classification      tiered: official → community → role links
   level/country/user-note         budgeted Tavily search + extract
   aware query plan                cache via ops.scraped_urls
            │                              │
            └──────────────┬───────────────┘
                           ▼
C. Evidence ledger          dedupe, quality-score, date, trust-weight (rules),
   (programmatic)           corroboration/contradiction groups, stable IDs ev-1…
                           ▼
D. Staged synthesis         D1 assessment model + stage roadmap (cites IDs)
   (validated)              D2 questions per stage/tier, batched (cites IDs)
                            D3 candidate positioning vs CV
                            validator → one repair call → degrade if needed
                           ▼
E. Persistence & telemetry  prep_plans + normalized tables, verified evidence
                            log, research_yield + validation/fallback events
```

**A. Intake & query planning** (PREPIO-80 ✓, PREPIO-53 ✓). A fast-model planner turns
company/role/level/country/user note into a query plan: role-family (tech, consulting,
finance, other) selects domain packs and query shapes; named interviewers/teams in the user
note trigger targeted lookups. Plans are logged for yield evaluation.

**B. Retrieval** (PREPIO-40 ✓, PREPIO-48, PREPIO-51). Already runs as a background job
decoupled from the 15s wall clock. Tiers in priority order: official employer/careers pages, community
interview reports (Glassdoor, Blind, Reddit, 1point3acres, LeetCode for tech; consulting/
finance packs for those families), then role-link extraction. Raw content on; deep
extraction for the top-N highest-signal URLs; reads and writes the `ops.scraped_urls`
cache. Credit-budgeted per run.

**C. Evidence ledger** (PREPIO-78 ✓, PREPIO-81, PREPIO-52 ✓). Built in code, not by the model:
one entry per retrieved source with ID, URL, title, platform, published date, snippet, and
a rule-assigned trust weight (official > job posting > community report > heuristic).
User note, pasted JD, and CV become first-class ledger entries. Corroboration and
contradiction groups are computed across entries per stage hypothesis.

**D. Staged synthesis** (PREPIO-79 ◑ validation shipped, PREPIO-149 for the split). Three
focused calls instead of one mega-call, each
receiving the ledger and citing only by evidence ID. Persisted confidence comes from the
phase-C corroboration scores (PREPIO-81), with the PREPIO-50 sufficiency gate as the coarse
floor. A code validator enforces question minimums, stage-link integrity, and enums; on
failure it runs one repair call with the validator errors, then persists what is valid and
marks the run degraded.

**E. Persistence & telemetry** (PREPIO-54 ✓; extend under PREPIO-156). Existing tables stay. The
`[research_yield]` event gains validation-failure, repair, and fallback-engagement counts
so quality regressions are visible in the RUNBOOK queries, not just credit spend.

### Rollout

| Step | Contents | Issues | State |
|------|----------|--------|-------|
| 0. Stop the bleeding | Flag job-analysis stubs; remove the no-op DuckDuckGo fallback | PREPIO-82, part of PREPIO-80 | **Done.** Residual: delete the dead `duckduckgo-fallback.ts` shim (PREPIO-155) |
| 1. Real retrieval | Async job; restore query breadth, raw content, extraction, caching | PREPIO-40 ✓, PREPIO-80 ✓, PREPIO-48, PREPIO-51 | **Partial.** Async job and query breadth shipped; raw content back on. `maxResults`/`searchDepth`, deep extraction, and a live `ops.scraped_urls` cache remain |
| 2. Grounding | Evidence ledger + ID-only citations; sufficiency gate | PREPIO-78 ✓, PREPIO-50 | **Partial.** Ledger shipped; the sufficiency gate is still open |
| 3. Synthesis quality | Staged synthesis with validation + repair; computed confidence | PREPIO-79 ◑, PREPIO-149, PREPIO-81, PREPIO-147 | **Partial.** Validation + bounded repair + honest `degraded` marker shipped; the staged split and computed confidence are open |
| 4. Reach | Query planner with role-family packs; freshness; interviewer/team targeting; non-English | PREPIO-80 ✓, PREPIO-52 ✓, PREPIO-53 ✓, PREPIO-55 | **Mostly done.** Non-English (PREPIO-55) is the remainder |

Step 0 is complete. Steps 2–3 depend on step 1 for there to be real evidence worth
grounding in, and step 1's remaining work is now the binding constraint on the rest.

### Measurement gate (added 2026-08-29)

Steps 1–4 above have no way to prove they improved anything. Before more quality code
lands, the eval work in PREPIO-154 (published-interview-report backtest corpus) and
PREPIO-148 (eval harness) establishes a baseline for four numbers — **top-5 hit rate**,
citation precision, stage-count accuracy, and degradation rate — and PREPIO-162 adds a
shadow-run harness so a v3 path can be scored against v2 on the same cases before traffic
moves. Record the first baseline here when it exists.

## Invariants for reviewers

When touching the research pipeline, hold changes to these:

- A prompt section labeled as evidence must trace back to a ledger entry or a user input.
- New fallbacks must be visible: flagged in the response payload and counted in telemetry.
- `searches.status = 'completed'` implies the persisted plan passed validation (or is
  explicitly marked degraded).
- Tavily spend stays within `RESEARCH_CONFIG.tavily.maxCreditsPerSearch` per run.
- `[research_yield]` keeps emitting on every completed run (RUNBOOK depends on it).
