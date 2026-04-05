# Research Pipeline Quality Improvements

**Last updated:** April 5, 2026

## What Shipped

### 1. Enhanced Synthesis Prompt with Rich Context
**File:** `supabase/functions/interview-research/index.ts`

The synthesis prompt now includes comprehensive context: real interview questions from candidate reports (priority #1), detailed company research, full job requirements, and complete candidate profile data. The AI receives 5-10x more context than before.

### 2. Question-First Approach
Real interview questions extracted from candidate reports are the first section in the synthesis prompt, used as foundations for generating tailored variations.

### 3. Enhanced System Prompt
Added explicit requirements: "QUESTION-FIRST APPROACH", "DEEP TAILORING" (100% of questions must reference specific details), specificity examples, and "NO GENERIC QUESTIONS" enforcement.

### 4. Environment-Based Model Configuration
**File:** `supabase/functions/_shared/config.ts`

`getModelFromEnv()` checks the `OPENAI_MODEL` environment variable, with fallback to `gpt-4o`. Set via `supabase secrets set OPENAI_MODEL=<model>`. Includes `isGPT5Model()` helper for compatibility.

### 5. Removed Temperature Parameters
Removed hardcoded `temperature: 0.7` from all functions for GPT-5 compatibility.

### 6. Quality-Over-Quantity Question Generation
Changed target from 120-150 questions to 30-50 questions (5-8 per category). Every question must reference specific company, job, or CV details.

### 7. Persistent Resume-to-Search Handshake
- **Profile** stores the canonical CV once
- **Home** auto-pulls the latest stored CV when the search form loads
- Database trigger (`copy_latest_resume_on_search_insert`) snapshots the user's latest resume onto every new search row
- Edge Functions load resume in order: search-scoped snapshot → user-level fallback → request body

---

## Configuration

```bash
# Set model (defaults to gpt-4o if unset)
supabase secrets set OPENAI_MODEL=gpt-5-nano
```

---

## Future Pipeline Ideas

These are not actively being worked on. They were explored in earlier planning but remain speculative.

- **Taxonomy columns** on `interview_questions`: vertical, competency, sub-skill, seniority band
- **Signal provenance**: linking scraped sources → questions with confidence scores
- **Question stacks**: grouping anchor question + probe ladder + stress variants + scoring rubric
- **Feedback assimilation**: capturing which questions felt realistic, logging interview outcomes
- **Vertical-specific presets**: pre-baked competency lattices for Tech PM, IB, Consulting
- **Schema normalization**: replacing `search_artifacts` JSON blobs with relational tables, normalizing progress tracking

See `docs/UX_STATUS.md` (Architecture improvements section) for context on these items.
