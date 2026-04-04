# Testing

Single reference for how we test Prepio: what already exists, how to run it, and what still needs to be covered.

## Quick Start
- `npm test` – run all frontend tests (Vitest + React Testing Library).
- `make test` – run everything (Deno + Node).
- `make test-unit` – fast unit sweep (Deno edge-function suite).
- Edge Functions stay in Deno under `tests/unit/test_edge_functions`.
- Frontend tests run via Vitest (`npm test` or `vitest run`) with jsdom environment and `@testing-library/react`.

## Suite Layout

### Frontend (Vitest + React Testing Library)
```
src/
├── components/
│   ├── __tests__/
│   │   ├── Navigation.test.tsx                 ✅ (8 tests)
│   │   └── ProgressDialog.test.tsx             ✅ (9 tests)
│   ├── practice/__tests__/
│   │   └── QuestionInsightsPanel.test.tsx      ✅ (2 tests)
│   └── ui/__tests__/
│       └── CommandDialog.test.tsx              ✅ (1 test)
├── hooks/__tests__/
│   ├── browserState.test.tsx                   ✅ (3 tests)
│   └── useSearchProgress.test.ts              ✅ (8 tests)
├── lib/__tests__/
│   └── resumeUpload.test.ts                   ✅ (4 tests)
├── pages/__tests__/
│   ├── Auth.test.tsx                          ✅ (4 tests)
│   ├── Dashboard.mobile.test.tsx              ✅ (3 tests)
│   ├── History.test.tsx                       ✅ (4 tests)
│   ├── Home.mobile.test.tsx                   ✅ (6 tests)
│   ├── Practice.mobile.test.tsx               ✅ (4 tests)
│   └── Profile.test.tsx                       ✅ (13 tests)
└── services/
    ├── searchService.test.ts                  ✅ (2 tests)
    └── sessionSampler.test.ts                 ✅ (12 tests)
```

### Backend (Deno)
```
tests/
├── unit/
│   └── test_edge_functions/
│       ├── test_01_search_creation.ts          ✅ (5 tests)
│       ├── test_02_interview_research.ts       ✅ (5 tests)
│       ├── test_03_company_research.ts         ✅ (4 tests)
│       ├── test_04_job_analysis.ts             ✅ (4 tests)
│       ├── test_05_cv_analysis.ts              ✅ (4 tests)
│       └── test_06_question_generator.ts       ✅ (4 tests)
└── integration/
    └── test_workflows/
        └── test_07_complete_workflow.ts        ✅ (2 tests)
```

**Current coverage:** 111 automated tests total — 83 frontend (Vitest) + 26 Deno edge-function unit tests + 2 workflow integrations. All passing.

## Key Scenarios
- **Test 07.1 – Complete workflow integration**: Located in `tests/integration/test_workflows/test_07_complete_workflow.ts`. Creates a real search, triggers `interview-research`, waits for the async pipeline to complete, then asserts CV/job comparison rows, ≥10 interview questions, stage generation, and cleans up the seeded `searches` record. Run with `deno test --allow-all tests/integration/test_workflows/test_07_complete_workflow.ts`.
- **Test 07.2 – Post-workflow database consistency**: Reuses the same file to trigger another end-to-end run (Meta → PwC scenario) and verifies every downstream table (`interview_questions`, `interview_stages`, `cv_job_comparisons`) references the new `search_id`, catching orphaned data regressions.
- **Next up – Dedicated CV/Job comparison edge unit**: Still planned to hammer the `cv-job-comparison` function in isolation (gap analysis structure, skill match %, fallback paths, and database writes) without waiting on the full workflow.

## Mobile Practice Redesign

The mobile practice redesign has shipped and is in QA. The execution plan lives in [`docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./MOBILE_PRACTICE_UX_EXECUTION_PLAN.md).

Minimum validation matrix for ongoing QA:
- iPhone SE, iPhone 14 Pro, Pixel 7, and one smaller mid-range Android viewport.
- Start practice from setup and confirm the first question shows prompt, response controls, and primary CTA without hunting.
- Scroll a long prompt and verify no accidental skip or favorite action fires.
- Start recording with fresh permissions, deny permissions, and confirm both success and failure states are explicit.
- Type notes, background the tab, return, and confirm local persistence still works.
- Open and close the coaching sheet without losing the current answer state.
- Save the final question and confirm completion state is clean.

## Backlog & Priorities
Treat **P0** as blockers, **P1** as near-term, **P2** as nice-to-have if timelines allow.

| Priority | Focus | What to prove |
| --- | --- | --- |
| P0 | Search artifacts persist | `supabase/functions/interview-research` writes artifacts + comparison data, falls back on zero-row updates. |
| P0 | Progress + stall UI | `ProgressDialog`, `useSearchProgress`, and stall detection animate correctly and recover from retries. |
| P0 | Search creation flow | Authenticated submissions create searches, invoke edge workflows, and show accurate polling. |
| P1 | Practice session pipeline | `sessionSampler`, favorites filters, session persistence, and the mobile practice redesign remain stable. |
| P2 | Tavily analytics math | Metrics/credit math in `tavilyAnalyticsService` stays accurate on empty + happy paths. |

### P0 Details
- **Search artifact persistence & CV-job comparison**
  - Files: `supabase/functions/interview-research/index.ts`, `_shared/progress-tracker.ts`, `src/services/searchService.ts`, related migrations.
  - Tests: Deno unit for `saveToDatabase` (update/insert/upsert paths, progress timestamps) plus integration assertion that `search_artifacts` + `cv_job_comparisons` stay in sync with `searchService.getSearchResults`.
- **Progress & stall detection UI**
  - Files: `src/components/ProgressDialog.tsx`, `src/hooks/useSearchProgress.ts`, `src/pages/Home.tsx`.
  - Tests: Vitest/RTL states (`pending`, `processing`, `completed`, `failed`, stalled >45s), adaptive polling intervals with fake timers, retry CTA toggles, toast usage mocked.
- **Search creation & polling flow**
  - Files: `src/pages/Home.tsx`, `src/services/searchService.ts`.
  - Tests: form submission happy/error paths, Supabase client mocks for `createSearchRecord/startProcessing/getSearchStatus`, polling timeouts (warnings at 2.5m, fail at 8m).

### P1 – Practice pipeline
- Files: `src/pages/Practice.tsx`, `src/services/sessionSampler.ts`, `src/services/searchService.ts` practice helpers.
- Tests: sampler sizing + randomness (seeded RNG), UI filters (favorites-only, stage toggles), persistence helpers with mocked Supabase + localStorage, mobile layout assertions, explicit navigation controls, recording permission states, and coaching-sheet open/close behavior.

### P2 – Tavily analytics
- Files: `src/services/tavilyAnalyticsService.ts`.
- Tests: Supabase call mocks covering totals, averages, ranking, cost conversions, and graceful empty results.

## Tooling Notes
- Keep Deno-based suites under `tests/` and run with `deno test --allow-all`.
- Frontend tests use Vitest (`npm test` / `vitest run`) with jsdom, `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom`. Setup file: `vitest.setup.ts`.
- Frontend test files go in `__tests__/` directories next to the code they test, or as `.test.ts` siblings for service files.
- Prefer lightweight Supabase client mocks; only hit the hosted project for end-to-end checks when necessary.

## Frontend Coverage Gaps

The following areas still need more frontend test coverage:

| Priority | Area | Key files | Status |
| --- | --- | --- | --- |
| ~~P0~~ | ~~ProgressDialog + stall detection~~ | `src/components/ProgressDialog.tsx`, `src/hooks/useSearchProgress.ts` | Covered |
| ~~P1~~ | ~~Profile page (upload, deletion, seniority)~~ | `src/pages/Profile.tsx` | Covered |
| ~~P1~~ | ~~Navigation (history selector, auth state)~~ | `src/components/Navigation.tsx` | Covered |
| ~~P1~~ | ~~Session sampler logic~~ | `src/services/sessionSampler.ts` | Covered |
| P1 | searchService main API methods | `src/services/searchService.ts` (only dedup helpers are tested) | Open |
| P2 | Tavily analytics | `src/services/tavilyAnalyticsService.ts` | Open |
