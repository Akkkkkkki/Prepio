# Research Capability Backlog

Source: product review of the research pipeline (2026-05-28). These are ready to
import into the **Prepio** Linear team (`PREPIO-` prefix). Each entry maps to the
team's label convention: one **Type** (`Bug`/`Feature`/`Improvement`/`Chore`/`Docs`)
and at least one **Area** (`area:research-pipeline`, `area:infra`, etc.). Replace the
`PREPIO-NN` placeholders with real IDs on import, and name branches accordingly
(e.g. `claude/prepio-NN-async-research-jobs`) so the GitHub integration auto-links PRs.

## Theme

The synthesis layer (`interview-research`) produces a strong, assessment-first PrepPlan,
but the retrieval layer that feeds it (`company-research`) has been throttled to near-zero
real evidence to avoid a 15s function timeout. The result reads specific but is largely the
LLM's prior knowledge, not fresh community evidence about *this* company's *current* loop.
The goal of this backlog is to **make real community data the primary input to synthesis**,
surface that evidence to users, and do it without blowing the latency/cost budget.

Evidence for the throttling, all in `supabase/functions/company-research/index.ts`:

- `getAllSearchQueries(...).slice(0, 2)` — 2 of ~12 configured queries used (`:197`)
- `maxResults: 3` per query (`:213`)
- `includeRawContent: false` despite config calling it "essential" (`:216`)
- deep extraction phase skipped entirely, `extractedContent = []` (`:271`–`:274`)
- research caching skipped (`:726`)
- hybrid path excludes glassdoor/reddit/blind/leetcode from Tavily on the assumption
  native scrapers already covered them (`:583`)

---

## Tier 1 — Small wins (low risk, ship first)

### PREPIO-NN — Fix `validResults` variable shadowing in `searchCompanyInfo` fallback
- **Type:** Bug · **Area:** `area:research-pipeline`
- **Problem:** In `company-research/index.ts`, `searchCompanyInfo` declares `let validResults = []`
  at function scope (`:172`), then re-declares `const validResults = freshSearchResults.filter(...)`
  inside the `else` block (`:236`). The returned object reads the **outer** (always-empty) array
  (`:283`), so when the fallback path runs it hands the analyzer zero search content.
- **Acceptance criteria:**
  - The fresh search results actually flow into the returned `search_results`.
  - Add a unit/integration test asserting non-empty `search_results` when Tavily returns hits.
- **Notes:** Latent today because the hybrid path is the default, but it's the safety net — it
  should work when hybrid fails.

### PREPIO-NN — Surface the evidence log in the Dashboard ("Why this question / Sources")
- **Type:** Feature · **Area:** `area:research-pipeline`
- **Problem:** `prep_plans.internal_evidence_log` already stores per-claim source attribution with
  `sourceType`, `sourceLabel`, `excerpt`, `url`, `relevance`, and `trustWeight` — and the UI never
  shows it. For a research-first product, hiding the evidence is the single biggest trust miss.
- **Acceptance criteria:**
  - Stages and/or questions in `Dashboard.tsx` expose a lightweight "Sources / why this" affordance.
  - Links open the underlying source; user notes / job description are labelled as first-party.
  - No pipeline changes required — read-only consumption of existing data.
- **Highest UX leverage item in this backlog; no retrieval work needed.**

### PREPIO-NN — Show `weakSignalCase` and `lowConfidenceGuidance` instead of a bare badge
- **Type:** Improvement · **Area:** `area:research-pipeline`
- **Problem:** Confidence is rendered as a binary high/medium/low badge. When a stage is low
  confidence the plan already contains `lowConfidenceGuidance`, and the summary carries
  `weakSignalCase` — neither reaches the screen.
- **Acceptance criteria:**
  - When confidence is low, the guidance text is shown inline (per `DESIGN_PRINCIPLES.md`: honest,
    specific copy, no vague AI claims).
  - When `weakSignalCase` is true, the summary header states the plan leans on role norms.

---

## Tier 2 — Restore the evidence base (the core work)

### PREPIO-NN — Move research to an async job, decoupled from the 15s function timeout (refactor)
- **Type:** Improvement · **Area:** `area:research-pipeline`, `area:infra`
- **Problem:** Every quality cut above exists to fit inside a synchronous 15s `Promise.race`
  timeout. The fix isn't fewer queries — it's removing the wall-clock race. Retrieval should run
  as a background job that streams progress, so we can afford real search + extraction.
- **Approach (for discussion):**
  - Make `interview-research` enqueue/trigger work and return immediately; drive state through
    `searches.status` / `progress_step` / `progress_pct` (the UI already polls these).
  - Run company/job/CV gathering as background tasks (e.g. `EdgeRuntime.waitUntil` /
    background function / scheduled worker) with per-phase progress writes.
  - Define terminal states and a stall-recovery path (RUNBOOK already documents the >2min stuck case).
- **Acceptance criteria:**
  - A research run can spend >15s on retrieval without failing.
  - Partial progress is visible to the user during the run.
  - Stalled runs are detectable and recoverable.
- **This is the prerequisite that unblocks PREPIO-NN (raw content), (caching), and (sufficiency gate).**

### PREPIO-NN — Re-enable raw content + deep extraction for top-N highest-signal URLs
- **Type:** Improvement · **Area:** `area:research-pipeline`
- **Problem:** `includeRawContent: false` and the skipped extraction phase mean the analyzer works
  from snippets, yet its prompt demands "EXACT interview questions candidates were asked." Snippets
  can't deliver that.
- **Acceptance criteria:**
  - Restore `getAllSearchQueries` breadth (or a tuned subset) instead of `.slice(0, 2)`.
  - Turn `includeRawContent` on and run Tavily extract on the top 3–5 ranked interview URLs.
  - Stay within the configured Tavily credit cap; log credits per run.
- **Depends on:** async job refactor.

### PREPIO-NN — Fix hybrid retrieval so the best community sources aren't dropped
- **Type:** Bug · **Area:** `area:research-pipeline`
- **Problem:** The hybrid path native-scrapes Glassdoor/Blind/Reddit/LeetCode, then excludes those
  same domains from Tavily (`:583`) assuming native scraping covered them. Those sites are the most
  anti-bot-protected, so they may get neither path — exactly the sources with the richest
  candidate-reported questions.
- **Acceptance criteria:**
  - Instrument native scraper hit-rate per platform; log results-per-platform per run.
  - If native yield for a platform is below a threshold, allow Tavily to cover it instead of
    blanket-excluding.
  - Verify end-to-end that Glassdoor/Blind/Reddit content reaches the analyzer.

### PREPIO-NN — Add an evidence-sufficiency gate with honest low-confidence copy
- **Type:** Improvement · **Area:** `area:research-pipeline`
- **Problem:** When retrieval returns little, the plan still presents at full confidence, masking
  that it's role-norm guesswork.
- **Acceptance criteria:**
  - If fewer than K real candidate reports are gathered, set `summary.overallConfidence: low` and
    `weakSignalCase: true`.
  - UI states plainly that data was limited for this company (pairs with the Tier 1 weak-signal item).

### PREPIO-NN — Restore URL deduplication / scraped-content caching
- **Type:** Improvement · **Area:** `area:research-pipeline`, `area:infra`
- **Problem:** Caching via `ops.scraped_urls` and the `UrlDeduplicationService` is built but disabled
  ("Skipping research caching to avoid timeouts", `:726`). With the async refactor, reuse cuts both
  latency and Tavily spend, making richer retrieval affordable.
- **Acceptance criteria:**
  - Reusable URLs/content are read from cache and fresh content is written back.
  - Reuse and credits-saved are logged per run.
- **Depends on:** async job refactor.

---

## Tier 3 — Deepen the research model

### PREPIO-NN — Capture and display evidence recency/freshness
- **Type:** Feature · **Area:** `area:research-pipeline`
- **Problem:** Interview loops change; stale posts shouldn't silently anchor the plan, and users
  can't tell how current the evidence is.
- **Acceptance criteria:**
  - Record published/observed dates and source count on the run.
  - Surface a freshness summary (e.g. "based on 8 reports, mostly 2024–2025").

### PREPIO-NN — Targeted retrieval from interviewer/team signals in the user note
- **Type:** Feature · **Area:** `area:research-pipeline`
- **Problem:** `userNote` is already treated as first-class evidence. When a user names an
  interviewer or team, targeted lookups beat generic company search.
- **Acceptance criteria:**
  - Detect named interviewer/team in the note and issue targeted queries (LinkedIn, blogs, talks).
  - Attribute any resulting evidence in the evidence log.

### PREPIO-NN — Evidence-yield observability (regression guard)
- **Type:** Chore · **Area:** `area:infra`, `area:research-pipeline`
- **Problem:** `ops.tavily_searches` tracks credits but nothing tracks **evidence yield** — so a
  regression like the current throttling is invisible. We need a quality signal, not just a cost one.
- **Acceptance criteria:**
  - Log real-questions-extracted and sources-used per run.
  - A simple query/dashboard shows yield-per-credit and the rate of zero-evidence runs over time.
  - Documented in RUNBOOK alongside the existing Tavily cost query.

---

## Later (tracked, not scheduled)

- **Non-English research/synthesis.** Config already has 1point3acres queries with Chinese keywords,
  but synthesis is English-first. Relevant to the international candidate segment.
  (Type: Feature · Area: `area:research-pipeline`.)
