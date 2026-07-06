import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Practice from "../Practice";
import { BREATHING_DISMISSED_KEY } from "@/components/practice/BreathingBreak";

const mockGetSearchResults = vi.fn();
const mockGetQuestionFlags = vi.fn();
const mockGetLowRatedQuestionIds = vi.fn();
const mockCreatePracticeSession = vi.fn();
const mockSavePracticeAnswer = vi.fn();
const mockCompletePracticeSession = vi.fn();
const mockGetEntitlement = vi.fn();
const mockUseIsMobile = vi.fn();

const PRACTICE_SETUP_STORAGE_KEY = "practiceSetupDefaults";

const FOLLOW_UP_TEXT = "How did you validate the output quality?";
const QUESTION_ONE = "Describe your system design approach.";
const QUESTION_TWO = "How do you evaluate ML models in production?";

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

const buildQuestion = (id: string, question: string, followUps?: string[]) => ({
  id,
  question,
  created_at: "2026-03-31T00:00:00.000Z",
  difficulty: "Medium",
  ...(followUps ? { follow_up_questions: followUps } : {}),
});

const mockSearchResults = (questions: ReturnType<typeof buildQuestion>[]) => {
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
        questions,
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

const startCustomSession = async ({ interviewerMode }: { interviewerMode: boolean }) => {
  fireEvent.click(
    await screen.findByRole("button", { name: /customize — stages, difficulty, filters/i }),
  );
  if (interviewerMode) {
    fireEvent.click(await screen.findByRole("button", { name: /interviewer follow-ups/i }));
  }
  fireEvent.click(await screen.findByRole("button", { name: "Start custom session" }));
  fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
};

const answerCurrentQuestion = async (saveLabel: RegExp) => {
  fireEvent.change(
    await screen.findByPlaceholderText("Capture bullet points or timing cues…"),
    { target: { value: "Tied model choice to revenue." } },
  );
  fireEvent.click(screen.getByRole("button", { name: saveLabel }));
  await waitFor(() => expect(mockSavePracticeAnswer).toHaveBeenCalled());
};

describe("Practice interviewer follow-ups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(BREATHING_DISMISSED_KEY);
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
    mockSavePracticeAnswer.mockResolvedValue({ success: true, answer: { id: "answer-1" } });
    mockCompletePracticeSession.mockResolvedValue({
      success: true,
      session: { id: "session-1", user_id: "user-1", search_id: "search-1", started_at: "2026-03-31T00:00:00.000Z", completed_at: "2026-03-31T00:05:00.000Z", session_notes: null },
    });
  });

  it("presents the question's follow-up after saving and only advances on continue", async () => {
    mockSearchResults([
      buildQuestion("q-1", QUESTION_ONE, [FOLLOW_UP_TEXT]),
      buildQuestion("q-2", QUESTION_TWO),
    ]);

    renderPractice();
    await startCustomSession({ interviewerMode: true });

    expect(await screen.findByText(QUESTION_ONE)).toBeInTheDocument();
    await answerCurrentQuestion(/save & continue/i);

    expect(await screen.findByText("Follow-up from the interviewer")).toBeInTheDocument();
    expect(screen.getByText(FOLLOW_UP_TEXT)).toBeInTheDocument();
    // The advance is held while the follow-up is on screen.
    expect(screen.queryByText(QUESTION_TWO)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue practicing" }));

    expect(await screen.findByText(QUESTION_TWO)).toBeInTheDocument();
    expect(screen.queryByText("Follow-up from the interviewer")).not.toBeInTheDocument();
  });

  it("advances straight to the next question when interviewer follow-ups are off", async () => {
    mockSearchResults([
      buildQuestion("q-1", QUESTION_ONE, [FOLLOW_UP_TEXT]),
      buildQuestion("q-2", QUESTION_TWO),
    ]);

    renderPractice();
    await startCustomSession({ interviewerMode: false });

    expect(await screen.findByText(QUESTION_ONE)).toBeInTheDocument();
    await answerCurrentQuestion(/save & continue/i);

    expect(await screen.findByText(QUESTION_TWO)).toBeInTheDocument();
    expect(screen.queryByText("Follow-up from the interviewer")).not.toBeInTheDocument();
  });

  it("holds session completion on the last question until the follow-up is dismissed", async () => {
    mockSearchResults([buildQuestion("q-1", QUESTION_ONE, [FOLLOW_UP_TEXT])]);

    renderPractice();
    await startCustomSession({ interviewerMode: true });

    expect(await screen.findByText(QUESTION_ONE)).toBeInTheDocument();
    await answerCurrentQuestion(/save & finish/i);

    expect(await screen.findByText("Follow-up from the interviewer")).toBeInTheDocument();
    expect(mockCompletePracticeSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));

    await waitFor(() => expect(mockCompletePracticeSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Reflection checkpoint")).toBeInTheDocument();
  });
});
