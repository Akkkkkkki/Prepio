# Future agent-platform evaluation

Status: deferred decision record. Last reviewed 2026-08-22.

This document records AI-agent and harness ideas that look relevant to Prepio but should **not** be adopted simply because the platform capability now exists. They depend on product needs, runtime constraints, and OpenAI platform evolution. Re-evaluate them against the then-current APIs, pricing, deployment model, security model, and Prepio eval results before implementation.

The near-term work that is already actionable is tracked in Linear under the Research pipeline v3 epic, including Responses API / Structured Outputs modernization, a representative eval suite, staged synthesis, bounded adaptive retrieval, workload-level model routing, and shared guest-preview primitives.

## Architectural baseline to preserve

Prepio is a vertical interview-prep product, not a general chat surface. Its durable product state remains application-owned:

- Supabase Auth / RLS and explicit tenant authorization;
- Postgres as the source of truth for searches, plans, stages, questions, profile data, practice, and feedback;
- code-owned evidence ledger, source trust, citation validation, and confidence computation;
- entitlement, billing, rate limits, research budgets, and persistence invariants;
- application-native UI for Plan, Practice, Profile, Sources, and Review;
- durable progress exposed through persisted search/job state rather than a browser session alone.

Any future agent runtime should sit behind these boundaries. It should not become the authority for identity, billing, evidence truth, or user-owned persistent state.

## 1. Codex App Server / Codex Harness

### Why it may become useful

Codex App Server provides a long-lived agent runtime with thread lifecycle, streaming events, tool execution, interruption/resumption, approvals, MCP integration, context management, and sandbox controls. Those capabilities overlap with infrastructure Prepio currently implements manually around long research jobs.

The strongest potential use case is **premium / deep research**, where a fixed sequence becomes limiting and the system benefits from repeated reasoning over evidence gaps:

1. inspect current evidence;
2. identify the highest-value unresolved gap;
3. call search/extraction tools;
4. reassess sufficiency or contradiction;
5. continue within a deterministic budget;
6. submit evidence and a structured result back to Prepio.

This is materially different from using Codex merely as a stronger LLM wrapper.

### Why not now

The current Codex SDK/App Server deployment model assumes a long-lived executable/process and is a poor fit for Prepio's Supabase Deno Edge Function runtime. Introducing it now would add a separate worker/container tier, process lifecycle, queueing, reconnect semantics, version pinning, worker authentication, observability, and sandbox configuration.

Responses API / Structured Outputs and a bounded adaptive retrieval loop capture most of the immediate value without that infrastructure expansion.

### Re-evaluate when

Re-open this decision if one or more become true:

- users need research jobs that regularly exceed the comfortable lifecycle of the existing Edge Function architecture;
- research quality is constrained by fixed orchestration after PREPIO-150 rather than by retrieval/data quality;
- Prepio introduces a paid Deep Research mode where substantially higher latency/cost is acceptable;
- agent threads need to pause for user input or approval and resume hours/days later;
- OpenAI provides a managed/remote App Server or another deployment mode that removes the local-process/container requirement;
- the Codex runtime exposes materially better context compaction, retained reasoning, tool orchestration, or reliability than the simpler Responses/Agents path on the Prepio eval suite.

### Required spike before adoption

Do not rewrite the main pipeline first. Build an isolated A/B worker for a bounded set of PREPIO-148 cases and compare against the normal research engine on:

- citation/evidence precision;
- supported-stage accuracy;
- exact interview-question yield;
- contradiction resolution;
- question specificity;
- failure/recovery rate;
- p50/p95 end-to-end latency;
- OpenAI + search cost per completed run;
- operational complexity and deploy/recovery burden.

Adopt only if the quality gain is meaningful enough to justify a second backend runtime.

## 2. OpenAI Agents SDK

The Agents SDK may become the middle ground between direct Responses API orchestration and Codex App Server. It is potentially appropriate when Prepio needs richer tool loops, sessions, guardrails, tracing, handoffs, or human-in-the-loop behavior without a full Codex process/runtime.

Do not introduce it just to replace straightforward typed function calls. A framework is useful only when it removes more orchestration code than it adds.

Re-evaluate after PREPIO-147, PREPIO-149, and PREPIO-150 have landed. At that point compare the remaining handwritten orchestration against the then-current Agents SDK features and runtime support for Deno/serverless deployment.

Questions for that review:

- Does it run cleanly in the deployed backend environment without a new worker tier?
- Can Prepio keep Postgres as durable state instead of adopting framework-owned session state?
- Can tool permissions be bound to the authenticated user/search before the model sees a tool?
- Does tracing integrate with Prepio telemetry without leaking CV/profile/answer PII?
- Does it support deterministic budgets, cancellation, retries, and partial failure clearly enough for paid research?
- Does it improve PREPIO-148 quality or only developer ergonomics?

## 3. Programmatic Tool Calling / model-directed code execution

Newer reasoning models may increasingly be able to call tools through bounded programmatic logic rather than one model turn per tool invocation. This could help retrieval aggregation, filtering, ranking, deduplication, evidence-gap analysis, and validation.

This should remain an optimization candidate, not a source-of-truth layer.

Good candidates:

- rank retrieved URLs for deep extraction;
- filter obviously duplicate/low-signal results;
- choose which bounded retrieval primitive to call next;
- aggregate tool results before returning them to the reasoning model;
- run non-authoritative consistency checks.

Keep deterministic application code for:

- tenant authorization;
- source/evidence ownership;
- trust weights and citation resolution;
- final confidence computation;
- credit limits and entitlement;
- writes that mutate canonical user data.

Re-evaluate when PREPIO-150 has a stable baseline so an A/B test can determine whether programmatic tool calling reduces latency/tokens or improves evidence yield.

## 4. Retained reasoning and context compaction

Harness-level retained reasoning and context compaction are promising for long, iterative research because they may reduce repeated prompt/context reconstruction while preserving useful intermediate reasoning state.

Do not assume benchmark gains transfer to Prepio. The current pipeline is still dominated by duplicated prompt structure and one large synthesis call; PREPIO-147 and PREPIO-149 should remove those obvious inefficiencies first.

Re-evaluate if:

- adaptive research requires several model/tool iterations;
- repeated evidence ledgers make context cost material;
- long-lived research threads become a product feature;
- the platform exposes stable controls and usage telemetry for compaction.

Benchmark against the same PREPIO-148 cases with identical retrieval evidence. Compare quality, input/output tokens, latency, and failure rate.

## 5. Human-in-the-loop approvals

Most current AI operations are read/analyze/generate and do not need user approval for each step. Adding approval modals everywhere would create friction without improving safety.

Approvals become valuable when agents gain side effects such as:

- merging AI-derived changes into the canonical candidate profile;
- replacing/deleting CV versions or other durable user content;
- spending a materially higher research-credit budget;
- overwriting an existing PrepPlan rather than creating a version/draft;
- scheduling or sending external communications;
- changing interview lifecycle state on the user's behalf.

The application should define which actions require approval. The agent runtime may pause/resume execution, but it should not decide its own permission boundary.

## 6. Durable agent events vs Supabase progress

Do not replace `searches` progress / durable database state with an ephemeral agent event stream.

If a future runtime emits richer events, adapt them into an application-owned event model:

```text
Agent runtime events
        ↓
server-side adapter
        ↓
searches / research_job_events
        ↓
Supabase Realtime (polling fallback where useful)
        ↓
Prepio UI
```

This preserves refresh/reconnect/multi-device behavior and avoids coupling the frontend directly to Codex/Agents protocol details.

A future cleanup can simplify legacy progress phases and duplicate retry helpers, but the durable application-level job state is intentional architecture.

## 7. Product experiences that could justify a persistent agent

These are product hypotheses, not committed roadmap items.

### Find stronger evidence

On a low-confidence interview stage, let the user explicitly request deeper investigation. Resume a research thread, target that stage's evidence gap, and update the plan only with newly verified evidence.

### Investigate a contradiction

When sources disagree about a case round, interview format, or stage ordering, let the user trigger a focused follow-up rather than re-running the whole research job.

### Adapt remaining practice

After several saved answers and AI feedback records, recompute the remaining practice sequence using observed weaknesses while keeping generated questions, evidence, and profile history auditable.

### Deep Research paid tier

Offer a slower, higher-budget research mode for unusually important or poorly documented interviews. This is the clearest candidate for a separate persistent worker/harness because the user explicitly accepts more time and compute for better evidence.

Each concept requires separate product validation; adopting an agent runtime is not itself evidence that users need the feature.

## 8. Security gates before expanding agent autonomy

Before any agent receives broader tools, all application-level authorization must be explicit at the tool boundary. In particular, known cross-tenant/BOLA findings in research orchestration must be closed before a runtime gets additional write capabilities.

For every future tool define:

- authenticated principal;
- resource ownership check;
- allowed read/write fields;
- entitlement and spend limit;
- idempotency behavior;
- approval requirement;
- audit event;
- safe retry semantics.

Never expose the Supabase service-role key or a generic unrestricted database tool to the model.

## 9. Decision checklist for future reviews

When this document is revisited, research the then-current OpenAI platform rather than relying on the 2026-08-22 snapshot. At minimum verify:

- current Responses API capabilities and recommended migration path;
- current Agents SDK runtime/deployment support;
- current Codex SDK/App Server architecture and licensing;
- managed vs self-hosted options;
- model/tool compatibility, context limits, retained-reasoning and compaction behavior;
- Structured Outputs/tool schema constraints;
- pricing and cached-input economics;
- tracing/data-retention/privacy controls;
- sandbox/network policy and MCP security model;
- cancellation, resume, approval, and durable-thread semantics;
- production maturity / breaking-change policy.

Then run a Prepio-specific evaluation. Generic coding/agent benchmarks are useful context but are not acceptance criteria for this product.

## Near-term backlog created from the 2026-08-22 review

- PREPIO-147 — Responses API + strict Structured Outputs modernization.
- PREPIO-148 — representative AI eval suite.
- PREPIO-149 — finish staged PrepPlan synthesis with parallel question batches.
- PREPIO-150 — evidence-gap-driven bounded adaptive retrieval.
- PREPIO-151 — eval-backed model routing and prompt simplification.
- PREPIO-152 — consolidate guest preview onto shared research/AI primitives.
- PREPIO-153 — remove or formally isolate the unused standalone question generator.

These items deliberately stop short of committing Prepio to Codex App Server or another agent framework. They improve the current architecture while creating the measurement and modularity needed to make that future decision well.