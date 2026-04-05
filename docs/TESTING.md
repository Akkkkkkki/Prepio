# Testing

How to run tests, what's covered, and what still needs work.

## Quick Start

```bash
npm test              # Frontend tests (Vitest + React Testing Library)
make test             # All tests (Deno + Node)
make test-unit        # Deno edge function unit tests only
```

## Test Suite

### Frontend (Vitest + React Testing Library)

83 tests across components, hooks, pages, and services.

```
src/
├── components/__tests__/
│   ├── Navigation.test.tsx              (8 tests)
│   └── ProgressDialog.test.tsx          (9 tests)
├── components/practice/__tests__/
│   └── QuestionInsightsPanel.test.tsx   (2 tests)
├── components/ui/__tests__/
│   └── CommandDialog.test.tsx           (1 test)
├── hooks/__tests__/
│   ├── browserState.test.tsx            (3 tests)
│   └── useSearchProgress.test.ts        (8 tests)
├── lib/__tests__/
│   └── resumeUpload.test.ts            (4 tests)
├── pages/__tests__/
│   ├── Auth.test.tsx                    (4 tests)
│   ├── Dashboard.mobile.test.tsx        (3 tests)
│   ├── History.test.tsx                 (4 tests)
│   ├── Home.mobile.test.tsx             (6 tests)
│   ├── Practice.mobile.test.tsx         (4 tests)
│   └── Profile.test.tsx                 (13 tests)
└── services/
    ├── searchService.test.ts            (2 tests)
    └── sessionSampler.test.ts           (12 tests)
```

### Backend (Deno)

26 unit tests + 2 integration tests.

```
tests/
├── unit/test_edge_functions/
│   ├── test_01_search_creation.ts       (5 tests)
│   ├── test_02_interview_research.ts    (5 tests)
│   ├── test_03_company_research.ts      (4 tests)
│   ├── test_04_job_analysis.ts          (4 tests)
│   ├── test_05_cv_analysis.ts           (4 tests)
│   └── test_06_question_generator.ts    (4 tests)
└── integration/test_workflows/
    └── test_07_complete_workflow.ts      (2 tests)
```

**Total: 111 automated tests.**

## Key Integration Scenarios

- **Complete workflow (Test 07.1)**: Creates a real search, triggers `interview-research`, waits for the pipeline, asserts downstream data (CV/job comparisons, questions, stages), then cleans up. Run with `deno test --allow-all tests/integration/test_workflows/test_07_complete_workflow.ts`.
- **Database consistency (Test 07.2)**: Runs a second end-to-end pipeline and verifies every downstream table references the correct `search_id`.

## Test Priorities

### P0 — Blockers

| Focus | Key files |
|-------|-----------|
| Search artifact persistence and CV-job comparison | `interview-research/index.ts`, `progress-tracker.ts`, `searchService.ts` |
| Progress and stall detection UI | `ProgressDialog.tsx`, `useSearchProgress.ts` |
| Search creation and polling flow | `Home.tsx`, `searchService.ts` |

### P1 — Near-term

| Focus | Key files |
|-------|-----------|
| Practice session pipeline | `Practice.tsx`, `sessionSampler.ts`, `searchService.ts` practice helpers |
| searchService main API methods | `searchService.ts` (only dedup helpers are tested) |

### P2 — Nice-to-have

| Focus | Key files |
|-------|-----------|
| Tavily analytics | `tavilyAnalyticsService.ts` |

## Mobile Practice QA

Minimum validation matrix:

**Devices:** iPhone SE, iPhone 14 Pro, Pixel 7, one smaller mid-range Android.

**Scenarios:**
- Start practice from setup; confirm prompt, controls, and CTA visible without scrolling
- Scroll a long prompt; verify no accidental skip or favorite fires
- Start recording with fresh permissions; deny permissions; confirm explicit success/failure states
- Type notes, background the tab, return; confirm local persistence
- Open and close coaching modal without losing answer state
- Save final question; confirm clean completion state

## Tooling

- **Frontend**: Vitest with jsdom, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`. Setup file: `vitest.setup.ts`.
- **Backend**: Deno test runner with `--allow-all`. Suites under `tests/`.
- **File convention**: Frontend tests go in `__tests__/` directories next to the code, or as `.test.ts` siblings for service files.
- **Mocking**: Prefer lightweight Supabase client mocks. Only hit hosted Supabase for end-to-end checks.
