# Research Pipeline

How interview research works today, why output quality is below bar, and the target
"grounded evidence" architecture (v3). This is the source of truth for research-pipeline
design decisions; the work is tracked in Linear under the **[Epic] Research pipeline v3 —
grounded evidence architecture** (PREPIO-76) in Quality & Maintenance.

Status: design approved for incremental rollout. Last reviewed 2026-06-12.

## The pipeline as shipped (v2)

`interview-research` orchestrates three concurrent gatherers, then one synthesis call:

```
Browser ──► interview-research (orchestrator)
              │
              ├─ PHASE 1 (concurrent, per-call timeouts 15–20s)
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

`company-research` runs a single **retrieval-grounded path**: Tavily search over
templated queries (across every allowed community domain), with URL dedup/caching and a
deep-extraction phase.

## Why quality is below bar

Two classes of problems. The first class — **retrieval depth** — is known and tracked
(PREPIO-40 and its tier): everything was cut to fit a synchronous 15s timeout. Queries
sliced to 2, `maxResults: 3`, `searchDepth: 'basic'`, raw content off, the deep-extraction
phase skipped, caching disabled. The analyzer is asked for "EXACT questions candidates were
asked" while being fed a handful of search snippets.

The second class — **evidence integrity** — surfaced in the 2026-06-12 review and is the
core of v3:

| # | Failure | Where | Tracked |
|---|---------|-------|---------|
| 1 | `internalEvidenceLog` (now user-visible via the Dashboard "Sources" affordance) is written freeform by the synthesis LLM — URLs and trust weights are model-invented, not derived from retrieval. | `interview-research/index.ts` | PREPIO-78 |
| 2 | Synthesis is one 12k-token mega-call with no schema enforcement: question minimums are prompt-only, stage links are free-text (mismatches silently orphan questions), malformed output fails the whole run with no repair. **PARTIALLY FIXED:** synthesis output is now schema-validated (minimums, stage-link resolution, per-question difficulty enums) with one bounded repair pass; runs that still fail are persisted with an honest `summary.synthesisQuality.degraded` marker instead of silently completing. The staged-generation split remains open. | `interview-research/index.ts`, `interview-research/prep-plan-validation.ts` | PREPIO-79 ◑ |
| 3 | Confidence (`stageRoadmap[].confidence`, `overallConfidence`, `weakSignalCase`) is model self-assessment; zero-evidence runs still present confident roadmaps. `contradictionGroup` exists in the schema but nothing computes it. | `interview-research/index.ts` | PREPIO-81 |
| 4 | Retrieval is SWE-biased regardless of role: query templates and allowed domains assume software engineering; `level` and `country` never shape a query; the DuckDuckGo "fallback" hits the instant-answer API and returns no forum results. | `_shared/config.ts`, `_shared/duckduckgo-fallback.ts` | PREPIO-80 |
| 5 | `job-analysis` falls back to generic stub requirements with no provenance flag; synthesis is told they came "from link analysis". | `job-analysis/index.ts` | PREPIO-82 |

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

**A. Intake & query planning** (PREPIO-80, PREPIO-53). A fast-model planner turns
company/role/level/country/user note into a query plan: role-family (tech, consulting,
finance, other) selects domain packs and query shapes; named interviewers/teams in the user
note trigger targeted lookups. Plans are logged for yield evaluation.

**B. Retrieval** (PREPIO-40, PREPIO-48, PREPIO-51). Runs as a background job decoupled from
the 15s wall clock. Tiers in priority order: official employer/careers pages, community
interview reports (Glassdoor, Blind, Reddit, 1point3acres, LeetCode for tech; consulting/
finance packs for those families), then role-link extraction. Raw content on; deep
extraction for the top-N highest-signal URLs; reads and writes the `ops.scraped_urls`
cache. Credit-budgeted per run.

**C. Evidence ledger** (PREPIO-78, PREPIO-81, PREPIO-52). Built in code, not by the model:
one entry per retrieved source with ID, URL, title, platform, published date, snippet, and
a rule-assigned trust weight (official > job posting > community report > heuristic).
User note, pasted JD, and CV become first-class ledger entries. Corroboration and
contradiction groups are computed across entries per stage hypothesis.

**D. Staged synthesis** (PREPIO-79). Three focused calls instead of one mega-call, each
receiving the ledger and citing only by evidence ID. Persisted confidence comes from the
phase-C corroboration scores (PREPIO-81), with the PREPIO-50 sufficiency gate as the coarse
floor. A code validator enforces question minimums, stage-link integrity, and enums; on
failure it runs one repair call with the validator errors, then persists what is valid and
marks the run degraded.

**E. Persistence & telemetry** (PREPIO-54 shipped; extend). Existing tables stay. The
`[research_yield]` event gains validation-failure, repair, and fallback-engagement counts
so quality regressions are visible in the RUNBOOK queries, not just credit spend.

### Rollout

| Step | Contents | Issues |
|------|----------|--------|
| 0. Stop the bleeding | Flag job-analysis stubs; remove the no-op DuckDuckGo fallback | PREPIO-82, part of PREPIO-80 |
| 1. Real retrieval | Async job; restore query breadth, raw content, extraction, caching | PREPIO-40, PREPIO-48, PREPIO-51 |
| 2. Grounding | Evidence ledger, ID-only citations, sufficiency gate | PREPIO-78, PREPIO-50 |
| 3. Synthesis quality | Staged synthesis with validation + repair; computed confidence | PREPIO-79, PREPIO-81 |
| 4. Reach | Query planner with role-family packs; freshness; interviewer/team targeting; non-English | PREPIO-80, PREPIO-52, PREPIO-53, PREPIO-55 |

Step 0 is shippable immediately and independently; nothing in it depends on the async
refactor. Steps 2–3 depend on step 1 for there to be real evidence worth grounding in.

## Invariants for reviewers

When touching the research pipeline, hold changes to these:

- A prompt section labeled as evidence must trace back to a ledger entry or a user input.
- New fallbacks must be visible: flagged in the response payload and counted in telemetry.
- `searches.status = 'completed'` implies the persisted plan passed validation (or is
  explicitly marked degraded).
- Tavily spend stays within `RESEARCH_CONFIG.tavily.maxCreditsPerSearch` per run.
- `[research_yield]` keeps emitting on every completed run (RUNBOOK depends on it).
