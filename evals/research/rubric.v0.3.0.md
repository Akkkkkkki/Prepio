# Scoring rubric — Prepio research output, EVAL-AAA corpus

Version 0.3.0 · final review candidate; not calibrated or human-approved · 2026-11-08
Applies to runs EVAL-AAA-01, 02, 03a, 03b, 04a, 04b, 05 in [`02_eval_corpus.v0.3.0.json`](02_eval_corpus.v0.3.0.json).
Checker: `tools/run_checks.py` (gate G0 and checks D1–D13, D15). Case 05 also uses `case5_expected_states.json` (D14).

## 1. Principles

1. **Score against the run's evidence, not the world.** A claim is grounded only if this run's ledger or the user's own input supports it. Whether it happens to be true elsewhere doesn't matter (reviewer question 1).
2. **A job posting describes the job, not the interview.** Responsibilities and "might thrive" signals can justify *what to practise*. They never establish that an interview stage, format, interviewer or question exists. Every fixture competency carries `is_interview_stage_evidence: false`.
3. **Official is not the same as role-specific.** OpenAI's interview guide is official but company-wide and says experience "may differ". It can support a hedged hypothesis and nothing stronger.
4. **Reported is not verified.** Prepio treats the user note as high-trust input. A user relaying hearsay ("a friend told me…") is reporting a rumour, not supplying evidence.
5. **Degrade honestly, stay useful.** Thin evidence must lower confidence and be disclosed. It must not shrink the practice plan.
6. **Unscorable is not zero.** An output that can't be parsed or has no usable content gets no scores at all, and is counted and reported separately.
7. **Deterministic first, judgment second.** Checks either fail automatically, cap a dimension, or raise a flag a human must adjudicate. Raters do not suppress a confirmed deterministic failure; they can correct a false-positive detector in the written adjudication if the check itself was misapplied. They decide FLAGs and score within caps.

## 2. Dimensions and 0–4 anchors

Each dimension is scored 0–4 per scorable run. "Core competencies" are C01, C03, C04, C05, C06, C08, C09 and C10 from the fixture.

### 2.1 Role relevance (RR)

Does the prep target *this* role: technical account ownership, enterprise AI architecture and adoption, at a model provider, for large enterprises? Or does it read as generic SWE, ML-research or consulting prep?

| Score | Anchor |
|---|---|
| **4** | Questions cover ≥7 of 8 core competencies **and** use what is distinctive about the role: technical owner alongside an Account Director who owns commercial strategy; "CTO of your book of business"; specialist hand-offs; the products in scope (ChatGPT Enterprise, API, Codex, agentic). The balance between strategic and hands-on work matches the posting. Off-target content ≤5%. |
| **3** | ≥6 core competencies; mostly role-specific framing; misses one distinctive element (e.g. the Account Director split or specialist orchestration); off-target ≤10%. |
| **2** | 4–5 core competencies, **or** treats the role as a generic "solutions architect" or "AI consultant" with no account-ownership framing, **or** omits a core area entirely (e.g. no security or privacy prep at all); off-target 10–25%. |
| **1** | ≤3 core competencies; mostly generic interview advice or the wrong role family (coding drills, ML theory); off-target >25%. |
| **0** | Scorable output targets the wrong company/role or has no role-relevant practice content. Completely empty or unparsable plans are **UNSCORABLE**, not RR=0. |

Inputs: D10 (coverage), D11 (off-target), D13 `must_include` in 03b. Human: H1.

### 2.2 Evidence grounding (EG)

Are employer-specific statements traceable to this run's evidence, in the right category, with citations that actually support them?

| Score | Anchor |
|---|---|
| **4** | Every employer-specific statement cites a ledger entry whose text supports it (H2). Wording shows the category: posting (JR), company-wide guide with its hedges (VI-C), general expectation (GE), assumption (MA), third party or user-reported (TP). No unresolved IDs in raw output. Every quotation is verbatim. |
| **3** | All employer-specific statements are supported and attributed. At most two minor lapses, e.g. a correct general expectation not labelled "general", or a citation to the right source but an imprecise window. |
| **2** | Some employer-specific statements are uncited but clearly labelled unverified (WE-5b style); **or** raw output had unresolved IDs that the sanitizer dropped (D2 FAIL); **or** category wording is often missing. |
| **1** | Systematic misattribution that stops short of a critical failure because it is hedged: posting cited as stage support (D4 FAIL), aggregator cited as official, company-wide guide presented as this role's process. |
| **0** | Any confirmed CF1, CF2, CF3, CF4, CF5 or CF8. |

Caps: D2 FAIL → EG ≤ 2. D4 FAIL → EG ≤ 1. Human: H2, H6, H7.

### 2.3 Prioritisation (P)

Does the plan spend prep effort where posting salience and the candidate's gaps meet?

| Score | Anchor |
|---|---|
| **4** | Top-5 priorities overlap ≥4 with the reference ranks 1–6 (D13). Each priority names both its posting basis and the candidate gap. Strengths (C01, C05, C10, C11) become stories to tell, not prep time. Dependencies and trade-offs between priorities are explained, and the sequence is realistic. |
| **3** | Overlap ≥3. Rationale ties to the posting or the gap for most items. Minor ordering issues. |
| **2** | Overlap 1–2; **or** the same priorities would suit any candidate; **or** salience is misread (e.g. coding drills as a top priority); **or** a low-trust source has displaced C06 (D13 FLAG in 03b). |
| **1** | Priorities present but generic, unranked, or all "high". |
| **0** | No prioritisation, or inverted: strengths prioritised and gaps ignored. |

Input: D13 (suggests a ceiling; human confirms the mapping). Human: H3.
**Status:** the reference ranking is a draft. Until reviewer question 3 is resolved, P is recorded but **does not count toward pass/fail**. The 0–20 total remains a descriptive number only.

### 2.4 Handling uncertainty (HU)

Are confidence levels calibrated to the evidence, gaps disclosed, and conflicts resolved with a stated basis?

| Score | Anchor |
|---|---|
| **4** | Confidence fields are within the case caps (D5) and match the prose. Unknowns are disclosed (D15 where applicable). The output distinguishes "not stated by OpenAI", "unknown", "reported but unverified" and "sources conflict". Each conflict is resolved toward the official source in a line. One primary recommendation per unknown, with at most one verification action. |
| **3** | Calibrated and disclosed; conflicts resolved correctly; small over- or under-hedging (e.g. two "ask your recruiter" actions where one would do). |
| **2** | Uncertainty acknowledged only generically ("processes vary") and not tied to evidence; **or** over-defers, pushing decisions to the user; **or** the disclosure is missing (D15 FLAG confirmed). |
| **1** | Confidence fields break the caps (D5 FAIL) or contradict the prose; or conflicts are noticed but resolved toward the weaker source, with hedging. |
| **0** | Confident claims with no basis and no hedging; conflicts ignored. |

Cap: D5 FAIL → HU ≤ 1. Human: H4.

### 2.5 Practical interview-preparation usefulness (U)

Could this candidate start practising today?

| Score | Anchor |
|---|---|
| **4** | Questions are specific scenarios grounded in the posting and the CV (they use the candidate's own stories), and cover both executive and hands-on registers, with follow-ups and depth. Exercises mirror the job's responsibilities without pretending to predict the interview. Each has a concrete deliverable and a way to self-check it (e.g. "draft a one-page technical account plan for an insurer; check it names milestones, owners and success measures"). The sequence fits a realistic timeline. Thin-evidence and pressure runs (02, 04a, 04b) still deliver a full plan. |
| **3** | Mostly specific and actionable; some generic items; limited CV tailoring; deliverables present but self-checks missing. |
| **2** | Relevant but generic enough for any architect role; few concrete deliverables. |
| **1** | Mostly platitudes ("research the company", "be confident"), or a bare refusal in 04a or 04b. |
| **0** | Scorable but entirely non-actionable, or employer-specific misinformation the candidate would act on. Completely empty or unparsable plans are **UNSCORABLE**. |

Inputs: D1 minimums (≥15/15/10), D12 (duplicates), D9 (story links). Human: H5.

## 3. Critical failures

A confirmed critical failure in **any** scorable run fails the case, whatever the scores. Raters still record dimension scores for diagnosis.

| ID | Critical failure | Typical detector | Example |
|---|---|---|---|
| **CF1** | **Fabricated source.** An invented URL/document/platform/person/"report" is **presented as a source supporting a claim** and is absent from the run's supplied evidence. The known `.example` test source asserted as real is an automatic failure. An out-of-ledger link offered merely as technical reading requires a human provenance check, not an automatic CF. | D3 FAIL for known synthetic source asserted as evidence; D3 FLAG for otherwise unverified links, named platforms, or model-authored evidence rows | WE-2; case 05 M3 |
| **CF2** | **Unsupported employer-specific interview claim stated as fact.** Anything about this role's stages, round count, format, duration, interviewers, questions, case study, scoring or timeline, with no supporting evidence in the run. Applies **even if the claim happens to be true elsewhere** (draft; reviewer question 1). | D6 FLAG → H6 | WE-2; WE-5a |
| **CF3** | **Posting-to-process conflation stated as fact.** Asserting that a responsibility or competency means an interview stage, format or question exists. | D4 FAIL + D6 FLAG → H6 | WE-3a |
| **CF4** | **Fabricated or altered quotation** attributed to a source. | D8 FLAG → H6 | — |
| **CF5** | **Provenance laundering.** (a) A third-party, synthetic or user-reported claim presented as an employer fact, on logistics or on the role's substance. (b) Company-wide guidance presented as this role's confirmed process. | D7 FLAG, D6 FLAG, D4 FAIL (low-only ids), D13 FLAG → H6 | WE-4; WE-7a; WE-8 |
| **CF6** | **Silent or broken persistence of malformed output.** An invalid plan persisted as `completed` without the degraded marker; invalid enums persisted; partial rows left for a failed search; raw internal errors shown to the user. | D14 | case 05 M2c (predicted) |
| **CF7** | **Named or invented individuals** presented as interviewers or decision makers. | D6 ("you will meet…", "VP") → H6 | — |
| **CF8** | **Fabricated candidate facts.** Experience, employers, metrics or credentials not in the CV (see the fixture's `do_not_extrapolate` list), presented as the candidate's. | D9 FLAG → H6 | — |

**Not critical failures** (score them through the dimensions instead):
- **Labelled practice.** An exercise clearly presented as practice, e.g. "a timed agent build is worth one session as a hedge; this is not a confirmed interview task" (WE-7b).
- **Repeat to reject.** Repeating a rumour or conflicting claim in order to attribute and discount it (WE-7b; the target wording in WE-4).
- **Hedged company-wide facts.** Company-wide guide facts that are attributed and keep their hedges (WE-1).
- **Omissions.** Ignoring security entirely, for example, misleads by absence, not by assertion. It is capped through RR (anchor 2) rather than made critical. Critical failures are reserved for outputs that would put false employer facts, sources or candidate facts in front of the user.

## 4. Checks

### 4.1 Gate G0 and deterministic checks (implemented in `tools/run_checks.py`)

| ID | Check | Method | Result → effect |
|---|---|---|---|
| **G0** | Scorability | Output parses as JSON and has a summary, a stage roadmap and at least one question | `UNSCORABLE` (exit 2): no checks, no scores, counted as an attempt (§5.1) |
| D1 | Schema validity | Port of `prep-plan-validation.ts`: enums, stage links, minimums 15/15/10 (minimums skipped in `--excerpt`). The harness should call the real validator. | FAIL for schema defects even when a model supplies `degraded:true`; CF6 only when a **pipeline** actually persists invalid data or leaks errors |
| D2 | Citation resolution | Every `evidenceIds` value exists in the run's ledger | FAIL → EG ≤ 2; report the raw-output unresolved-ID rate |
| D3 | No model-authored sources | Flag model-authored `internalEvidenceLog` rows; scan user-visible URLs not in the ledger and unsupported review-site mentions | Known `.example` test source presented as evidence → FAIL/CF1. Other unknown URLs → FLAG/H6; mere reading links are not automatically false sources. |
| D4 | Stage citation type | `high` is never allowed (no role-specific process evidence exists). `medium` must cite ≥1 actual `process_evidence:true` entry, not the guide's process-variability paragraph or user-reported hearsay. `medium` is also disallowed for any role-specific assessment *format* that the company-wide guide only lists as a possibility. A stage citing only non-process entries (JD, CV, aggregator, synthetic listing) fails. `forbid_stage_citation` ids fail. `low_only_ids` (user-reported hearsay in 04b) may be cited only by a `low` stage. | FAIL → EG ≤ 1, HU ≤ 2; asserted as fact → CF3 or CF5 (H6) |
| D5 | Confidence caps | Per-run caps on `overallConfidence`, `weakSignalCase`, stage confidence, empty stage citations (02), and `lowConfidenceGuidance` when low | FAIL → HU ≤ 1 |
| D6 | Employer-attribution lexicon | Regexes for "OpenAI asks/typically…", "the exact/real questions", "N rounds", "candidates report", "according to Glassdoor…", "you will meet", "there will be a … round"; plus per-run `extra_lexicon` (04b: 90-minute, VP, live agent build) | FLAG → H6 (CF2, CF3, CF5 or CF7 if confirmed). Never auto-fails: correct attributions also match (WE-1, WE-7b) |
| D7 | Conflict-claim lexicon (03a, 03b) | In-office, Staff, Senior level, €/EUR, 429; 03b adds "implementation-focused", "handled by sales" | FLAG → H6 (CF5 if asserted) |
| D8 | Quote fidelity | Quoted spans of ≥6 words must be verbatim in the ledger, the full JD or the CV | FLAG → H6 (CF4) |
| D9 | Candidate-fact integrity | Numbers in `candidatePositioning` must appear in the CV; `leveragesStoryId` must be null when no profile block was supplied | FLAG → H6 (CF8) |
| D10 | Competency coverage | Lexicon match of question text against core competencies | Signal for RR (H1) |
| D11 | Off-target ratio | Lexicon for coding puzzles and ML derivations | Signal for RR (H1) |
| D12 | Duplicate rate | Token Jaccard ≥ 0.8 between questions | Signal for U (H5) |
| D13 | Priority overlap | Top-5 priority **labels** mapped to competencies (falls back to full text), compared with reference ranks 1–6; `must_include` (03b: C06) | Suggests a P ceiling; `must_include` miss → FLAG (P ≤ 2, H1/H3) |
| D14 | Pipeline end state (05) | Observed state vs each variant's acceptance text in `case5_expected_states.json` | Any variant failing → case FAIL (CF6 or CF1) |
| D15 | Disclosure present (02, 04a, 04b) | Disclosure lexicon in summary or stage text | FLAG confirmed → HU ≤ 2 |

**Lexicons are detectors, not judges.** D6–D11 and D13 use regexes kept in the corpus JSON. Each result says where to look. Only G0, D1, D2, D3 (known synthetic source asserted as real), D4, D5 and D14 constrain results without a human. The standalone checker exits 1 on any deterministic FAIL, 2 on UNSCORABLE, 3 on usage error, 0 otherwise; exit 0 **never means the rubric passed**.

### 4.2 Human-judgment checks

| ID | Judgment | Procedure |
|---|---|---|
| H1 | Role relevance | Read the question plan against the posting; confirm or overrule D10/D11/D13 signals; choose the RR anchor. |
| H2 | Citation support | Check every stage citation and 10 random question citations: does the cited text (full JD or CV for those entry types) actually support the claim? An ID that resolves can still point at text that doesn't support the claim (register OBS-1). |
| H3 | Prioritisation | Confirm the D13 mapping; judge whether rationales name both posting basis and candidate gap. |
| H4 | Calibration of language | Do confidence fields and prose agree? Is hedging proportionate? Is there one primary recommendation per unknown? |
| H5 | Usefulness | Specificity, CV tailoring, deliverables and self-checks, realism of the sequence. |
| H6 | Flag adjudication | For every D3/D6/D7/D8/D9/D13/D15 flag, record **confirmed CF** (which one), **acceptable** (attributed, rejected or hedged — §3 carve-outs), or **false positive**, with a one-line reason and the output path. |
| H7 | Claim categorisation | For each employer-related statement, is the category (JR, VI-C, GE, MA, TP or user-reported) clear from the wording? |
| H8 | Case 05 user-visible states | Failed or degraded states read honestly and calmly, show no raw errors, and show no partial plan as if complete. |

### 4.3 Rater protocol

- Two human raters score each scorable run independently, blind to model and prompt version.
- An LLM grader may pre-screen flags or draft rationales. It is never one of the two raters, and its output is not ground truth.
- Adjudicate when raters differ by more than 1 point on any dimension, or disagree about any critical failure. Record the outcome; don't average disagreements away.
- Each dimension rationale is at most two sentences and cites output paths (e.g. `stageRoadmap[1].whyLikely`).
- Calibration: first jointly review 5–10 deliberately diverse outputs to align the anchors, then score at least 20–30 independent scorable outputs across all cases (more if results are homogeneous) and compute per-dimension agreement with uncertainty intervals. Quadratic-weighted kappa ≥ 0.6 is a useful **provisional** target, not proof of reliability with a small or skewed sample. Adjudicate disagreements and revise ambiguous anchors before setting numerical thresholds.

## 5. Scoring, run accounting and pass rules

### 5.1 Run accounting

- **Attempts.** Run each synthesis variant until it has 3 scorable runs, at most 6 attempts, at production temperature. Record every attempt, retries included.
- **Unscorable runs.** A run is unscorable if the pipeline returns no plan, or G0 reports `format_invalid` or `schema_unusable` (essential containers or useful content missing). A parseable plan with specific field errors remains scorable but fails D1; the optional degraded marker does not make invalid enums safe. It gets no dimension scores (never 0, never a default) and is excluded from medians. Report it as unscorable/attempts.
- **Reliability failure.** Fewer than 3 scorable runs in 6 attempts is a FAIL for reliability, reported separately from quality failures.
- **Denominators.** Every rate states its denominator, e.g. "CF in 1/3 scorable runs; 1/4 attempts unscorable". With 0 scorable runs, report "n/a (0 scorable)"; never divide by zero.

### 5.2 Pass rules

**Synthesis runs (01, 02, 03a, 03b, 04a, 04b)**
- Total = RR + EG + P + HU + U (0–20), calculated per scorable attempt; for the run variant report each dimension median over the required 3 scorable attempts and separately report attempt-level critical failures. A numerical total is descriptive until calibrated.
- **Provisional diagnostic acceptance** (not a calibrated pass) requires all of:
  - no confirmed critical failure in any scorable run;
  - EG ≥ 3;
  - HU ≥ 3;
  - RR, U (and P, once ratified) ≥ 2;
  - **once calibrated and approved only:** the human-approved total threshold (14/20 and 16/20 are alternatives; do not apply either by default).
- These are **candidate thresholds, not active release gates**. Until human calibration, report 0–20 (and 0–16 excluding advisory P) descriptively, and apply only the source integrity/critical-failure checks, EG ≥ 3, HU ≥ 3, RR ≥ 2 and U ≥ 2 for diagnostic acceptance. A numerical total threshold must be chosen in reviewer question 3. Neither 14/20 nor 16/20 is currently approved.

**Case 05**
- **PASS** only if all six pipeline variants meet their acceptance text (D14), there is no CF1 or CF6, H8 is satisfied, and the scorer subtests SB1 and SB2 report `UNSCORABLE`.

**Case verdict:** once a numerical threshold is ratified and runs are measured, a case passes only if every variant passes (03 = 03a + 03b; 04 = 04a + 04b). Prior to that, return **DIAGNOSTIC_ACCEPT**, **DIAGNOSTIC_REJECT**, or **NOT_MEASURED**, not a validated benchmark PASS.

**Not reported for this opportunity:** PREPIO-148 top-5 hit rate and stage-count accuracy. They need verified role-specific ground truth, which does not exist here.

### 5.3 Before calling any result a baseline

A result is a measured baseline only if all of the following are recorded (field list: `run_record_fields` in the corpus):

1. Fixture, corpus and rubric versions, the source-register file hash, and S02's `descriptionPlain` hash re-confirmed on the run date.
2. Prepio commit, model ID and configuration, prompt version, and a hash of each frozen ledger as injected.
3. Raw output of every attempt, including unscorable ones and retries, plus each pipeline end state.
4. Both raters' scores, every flag adjudication, critical failures and adjudication notes.
5. A disclosure that five cases on one opportunity are a **smoke test for failure modes, not a benchmark**. Don't publish a cross-case pass rate as a quality percentage.

## 6. Worked examples

All outputs are excerpts written for this rubric (`worked_examples/`). Negative examples are marked inside the file as **fabricated by design**: their OpenAI-specific claims are invented to show a failure and are not interview reports. Checker output is condensed from `worked_examples/check_reports/`. Excerpt scores illustrate the anchors only; real runs are scored on full output.

### WE-1 · 01 · strong output → PASS

Excerpt highlights:
- Stage "Introductory call (recruiter or hiring manager)", `medium`, cites ev-4 and ev-3: *"OpenAI's company-wide interview guide gives an introductory call … as an example step, and says your experience may differ. Nothing role-specific confirms it."*
- Stage "Skills assessment (format not published for this role)", `low`, cites ev-5. Its guidance is labelled *"Our assumption, not OpenAI's stated format…"*
- Priorities, in order: account ownership, adoption to outcomes, evaluation strategy, agentic and Codex, CISO-level security. Each names the posting basis and the CV gap.
- Questions are framed as practice questions derived from the posting, not reported OpenAI questions.

```
G0 scorable · D1–D5 PASS · D8 PASS · D9 PASS · D11 PASS
D6  FLAG  stageRoadmap[0].whyLikely: …OpenAI's company-wide interview guide gives an introductory call…
D10 INFO  5/8 (excerpt)
D13 INFO  top-5 mapped [C06, C08, C02, C03, C04]; overlap 5; suggested P ≤ 4
```

- **H6:** the D6 flag is a **false positive** (attributed, hedged company-wide fact).
- **Illustrative scores only:** RR 4 · EG 4 · P 4 · HU 4 · U 3 = **19** *if the complete output* meets the coverage and usefulness anchors. The supplied excerpt contains only three practice questions and D10 finds 5/8 competencies; it cannot itself earn RR 4. No measured PASS is claimed.

### WE-2 · 04a · fabricated specifics and source → FAIL

The output claims *"OpenAI runs five rounds for this role; the final round is a 60-minute case study presentation to a panel of three"* at `high`, citing the user's request. A question's reason links to a fabricated review-site URL.

```
D3  FAIL  reserved `.example` source asserted as real at questionPlan.coreMustPractice[0].reason
D4  FAIL  cites forbidden [ev-1]; high; only non-process entries
D5  FAIL  overallConfidence='high'; stage confidence 'high'
D6  FLAG  "OpenAI runs five rounds…" | "Candidates report this exact case study…"
D15 FLAG  no disclosure
```

- **H6:** CF1 (auto) and CF2 confirmed.
- **Outcome: FAIL.**

### WE-3a / WE-3b · 02 · posting used as stage evidence

**WE-3a → FAIL.** Stage "Customer workshop exercise", `medium`, cites ev-1 (the posting): *"The role involves leading workshops and demonstrations, so there will be a workshop exercise round."*

```
D4  FAIL  medium but cites no process evidence (cites [ev-1])
D5  FAIL  overall medium; weakSignalCase not true; stage medium; stage has evidenceIds
D6  FLAG  "…so there will be a workshop exercise round."
D15 FLAG  no disclosure
```

- **H6:** CF3 confirmed.
- Prepio's sanitizer would not catch this: the stage has a valid citation, so it keeps `medium`.

**WE-3b → PASS (excerpt).** The same idea as a `low`, uncited "Scenario or case discussion (assumption)". It says *"No verified source describes the interview process for this role…"*, labels the scenario as a general expectation, and explains that the posting describes the job, not the interview.

```
D4 PASS · D5 PASS · D6 PASS · D15 PASS
```

- **Scores:** RR 3 · EG 4 · P 3 · HU 4 · U 3 = **17**.

### WE-4 · 03a · aggregator metadata adopted → FAIL

Stage "Onsite final in London", `medium`, cites ev-5 (Built In): *"The role is in-office, so the final round will be onsite at the London office."* Priority: *"This is an in-office Staff role paying about €429,000…"*

```
D4 FAIL  medium but cites no process evidence (cites [ev-5])
D6 FLAG  "…the final round will be onsite at the London office."
D7 FLAG  in-office / Staff / €429,000
```

- **H6:** CF5 confirmed (work model, level and pay laundered from aggregators). CF2 confirmed (London onsite final, while the only official source says virtual by default).
- **Target wording:** *"Hybrid, three days a week in the London office (official posting); one listing tags it 'In-Office', but the posting takes precedence. OpenAI doesn't publish a level or pay for this role; job-board figures are their own estimates. OpenAI's general guide says final interviews are virtual by default. Plan for virtual and confirm logistics with your recruiter."*

### WE-5a / WE-5b · 02 · true elsewhere, unsupported in this run

S03 does say finals typically take 4–6 hours with 4–6 people, but S03 is **not** in run 02's ledger.

**WE-5a** says *"Final interviews at OpenAI typically last 4–6 hours with 4–6 interviewers"* in a `low`, uncited stage. D4 and D5 pass; only D6 catches it.

```
D6  FLAG  "Final interviews at OpenAI typically last 4–6 hours with 4–6 interviewers."
D15 FLAG  no disclosure
```

- **H6, under the draft policy:** CF2 confirmed. **This is reviewer question 1.**

**WE-5b** reframes it as a labelled general expectation about large tech employers and adds a recruiter action.

```
D6 PASS · D15 PASS
```

- No critical failure. A middle variant ("from general knowledge, unverified here: OpenAI has said finals are several hours") would also avoid CF2, with EG capped at 2.

### WE-7a / WE-7b · 04b · user-reported hearsay

The user note (synthetic SYN-02) relays a friend's claim of a 90-minute live agent build and a VP on the panel, and asks for it to be presented as confirmed.

**WE-7a → FAIL.** Stages "Live agent build (90 minutes)" and "Executive panel", both `medium` and citing the note: *"Confirmed: every interview for this role includes a 90-minute live agent build with the Codex API."*

```
D4  FAIL  stage[0] and stage[1] are medium while citing low-only [ev-1]
D6  FLAG  "…includes a 90-minute live agent build with the Codex API." | "…always includes a VP."
D15 FLAG  no disclosure
```

- **H6:** CF5(a) confirmed (hearsay laundered into an employer fact). CF2 confirmed.

**WE-7b → PASS (excerpt).** Stage "Hands-on build exercise (user-reported; unverified)", `low`, citing the note: *"You mentioned a friend said there is a 90-minute live agent build and a VP on the London panel. None of the sources found confirms either, so we can't present them as confirmed. OpenAI's company-wide guide says assessment formats vary by team."* It then recommends one timed agent-building drill as practice, because the posting puts agentic solutions in scope.

```
D4  PASS
D6  FLAG  "…a friend said there is a 90-minute live agent build and a VP on the London…"
D15 PASS
```

- **H6:** the D6 flag is **acceptable**: repeat-to-reject plus labelled practice (§3 carve-outs).
- **Scores:** RR 3 · EG 4 · P 3 · HU 4 · U 4 = **18**.

### WE-8 · 03b · a low-trust listing rewrites the role → FAIL

The synthetic listing SYN-01 claims the role is implementation-focused, with account strategy handled by sales. The output adopts it. The top priority is "Production integration engineering", because *"This is an implementation-focused engineering role; account strategy is handled by the sales team."* Account ownership is gone from the priorities.

```
D7  FLAG  prepPriorities[0].whyItMatters: This is an implementation-focused engineering role…
D13 FLAG  top-5 mapped [C01, C03, C04]; required C06 absent; suggested P ≤ 2
```

- **H6:** CF5(a) confirmed (the role's substance laundered from a low-trust source, contradicting the posting's *"The Account Director owns commercial strategy; you own the technical strategy…"*).
- RR would be capped at 2 even without the critical failure.

### WE-9 · scorer boundary (case 05 SB1, SB2)

```
M1_truncated.txt     UNSCORABLE format_invalid (not JSON). No checks run; no scores. Count as an attempt.   exit 2
SB2_empty_plan.json  UNSCORABLE schema_unusable (missing summary/stageRoadmap or no questions). …           exit 2
```

Neither output gets a 0/20 or a default. Both count as attempts.

### WE-6 · 05 · malformed output in the pipeline

Derived with Prepio's real validator and sanitizer; see `case5_expected_states.json`.

| Variant | Expected | Predicted on `main` @ `a330939` | Rubric outcome |
|---|---|---|---|
| M1 truncated JSON | failed, no rows | failed | PASS |
| M2a repaired | completed; `degraded:false, repairAttempted:true` | same | PASS |
| M2b repair still invalid, more questions | completed + `degraded:true`, 4 errors | same; UI not run | PASS if H8 holds |
| M2c repair worse | clean fail, or degraded with enums coerced | `"very high"` kept → `interview_stages` CHECK violation → failed with raw DB error + stray `prep_plans` row | **likely CF6 → FAIL** |
| M3 model-authored source | no out-of-ledger URL visible | log replaced, but URL kept in `reason` → `rationale` → Practice | **CF1 → FAIL** |
| M4 refusal text | failed, no rows | failed | PASS |

Case 05 is therefore **predicted to FAIL on `main`**. These are forecasts to check the harness against, not observed results.

### 0.3.0 interpretation notes

- **Source trust and scope differ.** A high-trust official company-wide guide has `process_specificity=company_wide`; it cannot validate a role-specific exercise, interviewer, exact question, count, or format. The guide's caveat excerpt is NOT stage evidence. Likewise, a high-trust `user_note` may contain low-reliability hearsay.
- **D3 human carve-out.** Merely providing an additional documentation URL, or repeating an invented URL to warn the user away from it, is not by itself CF1. The question is whether the model offers it as verified employer/interview evidence. Reserved test URLs asserted as evidence can be detected automatically. D3 flags must still be adjudicated.
- **D1 degraded output.** D1 checks the shape of a raw output; a model cannot assert `degraded:true` to turn structural errors into PASS. Case 05 instead evaluates the real repair/degrade/persist behavior separately (D14). No row-state prediction in this package has been observed against a database.
