import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Practice from "../Practice";

// PREPIO-176: on a fresh research run `interview-research` writes empty
// `evaluation_criteria` / `follow_up_questions` / `suggested_answer_approach`
// and never writes `good_answer_signals`, so the question-insights object is
// pure chrome. This proves, at the real Practice wiring, that the coach panel
// (and its "Answer guide" affordance) only appears when there is guidance to
// show — an empty question must not render a dead control.

const mockGetSearchResults = vi.fn();
const mockGetQuestionFlags = vi.fn();
const mockGetLowRatedQuestionIds = vi.fn();
const mockCreatePracticeSession = vi.fn();
const mockSavePracticeAnswer = vi.fn();
const mockCompletePracticeSession = vi.fn();
const mockGetEntitlement = vi.fn();
const mockUseIsMobile = vi.fn();

const PRACTICE_SETUP_STORAGE_KEY = "practiceSetupDefaults";
const COACH_HEADING = "What strong answers show";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("react-swipeable", () => ({
  useSwipeable: () => ({}),
}));

vi.mock("@/services/searchService", () => ({
  hasQuestionFlag: (
    flags: Record<string, Record<string, unknown> | undefined>,
    questionId: string,
    flagType: string,
  ) => Boolean(flags[questionId]?.[flagType]),
  searchService: {
    getSearchResults: (...args: unknown[]) => mockGetSearchResults(...args),
    getQuestionFlags: (...args: unknown[]) => mockGetQuestionFlags(...args),
    getLowRatedQuestionIds: (...args: unknown[]) => mockGetLowRatedQuestionIds(...args),
    createPracticeSession: (...args: unknown[]) => mockCreatePracticeSession(...args),
    savePracticeAnswer: (...args: unknown[]) => mockSavePracticeAnswer(...args),
    completePracticeSession: (...args: unknown[]) => mockCompletePracticeSession(...args),
    removeQuestionFlag: vi.fn(),
    setQuestionFlag: vi.fn(),
  },
}));

vi.mock("@/services/entitlements", () => ({
  getEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
}));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

const FRESH_QUESTION = "Describe a system you designed end to end.";
const GUIDED_QUESTION = "How do you evaluate ML models in production?";

const mockSearchResults = (question: Record<string, unknown>) => {
  mockGetSearchResults.mockResolvedValue({
    success: true,
    search: { id: "search-1", company: "OpenAI", role: "Research Engineer", status: "completed" },
    stages: [
      {
        id: "stage-1",
        name: "Technical Interview",
        duration: "45 minutes",
        interviewer: "Hiring manager",
        content: "Systems depth.",
        guidance: "Prioritize impact.",
        order_index: 0,
        search_id: "search-1",
        created_at: "2026-03-31T00:00:00.000Z",
        questions: [question],
      },
    ],
  });
};

const renderPractice = () =>
  render(
    <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
      <Routes>
        <Route path="/practice" element={<Practice />} />
      </Routes>
    </MemoryRouter>,
  );

const startCustomSession = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: /customize — stages, difficulty, filters/i }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Start custom session" }));
};

describe("Practice answer-guide surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(PRACTICE_SETUP_STORAGE_KEY);
    sessionStorage.clear();
    mockUseIsMobile.mockReturnValue(false);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    mockGetQuestionFlags.mockResolvedValue({ success: true, flags: {} });
    mockGetLowRatedQuestionIds.mockResolvedValue({ success: true, ids: [] });
    mockGetEntitlement.mockResolvedValue({
      tier: "free",
      cadence: null,
      currentPeriodEnd: null,
      status: "none",
    });
    mockCreatePracticeSession.mockResolvedValue({
      success: true,
      session: { id: "session-1", user_id: "user-1", search_id: "search-1", started_at: "2026-03-31T00:00:00.000Z" },
    });
  });

  it("renders no coach panel for a fresh question in the current pipeline shape", async () => {
    // The real fresh-run shape: interview-research writes `rationale: q.reason`
    // (normally populated) but leaves every guidance field empty and never
    // writes good_answer_signals. The rationale must not keep the surface alive.
    mockSearchResults({
      id: "q-1",
      question: FRESH_QUESTION,
      created_at: "2026-03-31T00:00:00.000Z",
      difficulty: "Medium",
      rationale: "They want to see how you scope ambiguous, end-to-end systems.",
      suggested_answer_approach: "",
      evaluation_criteria: [],
      follow_up_questions: [],
      company_context: "",
    });

    renderPractice();
    await startCustomSession();

    expect(await screen.findByText(FRESH_QUESTION)).toBeInTheDocument();
    expect(screen.queryByText(COACH_HEADING)).not.toBeInTheDocument();
    expect(screen.queryByText("Interviewer focus")).not.toBeInTheDocument();
  });

  it("renders the coach panel when the question carries answer guidance", async () => {
    mockSearchResults({
      id: "q-1",
      question: GUIDED_QUESTION,
      created_at: "2026-03-31T00:00:00.000Z",
      difficulty: "Medium",
      good_answer_signals: ["Ties evaluation metrics to the production goal"],
    });

    renderPractice();
    await startCustomSession();

    expect(await screen.findByText(GUIDED_QUESTION)).toBeInTheDocument();
    expect(screen.getByText(COACH_HEADING)).toBeInTheDocument();
    expect(
      screen.getByText("Ties evaluation metrics to the production goal"),
    ).toBeInTheDocument();
  });
});
