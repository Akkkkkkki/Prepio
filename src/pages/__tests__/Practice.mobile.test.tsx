import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Practice from "../Practice";

const mockGetSearchResults = vi.fn();
const mockGetQuestionFlags = vi.fn();
const mockCreatePracticeSession = vi.fn();
const mockSavePracticeAnswer = vi.fn();
const mockCompletePracticeSession = vi.fn();
const mockSavePracticeSessionNotes = vi.fn();
const mockUseIsMobile = vi.fn();

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn(() => {
    this.callback([], this as unknown as ResizeObserver);
  });

  unobserve = vi.fn();

  disconnect = vi.fn();

  static triggerAll() {
    for (const instance of MockResizeObserver.instances) {
      instance.callback([], instance as unknown as ResizeObserver);
    }
  }

  static reset() {
    MockResizeObserver.instances = [];
  }
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

vi.mock("@/services/searchService", () => ({
  searchService: {
    getSearchResults: (...args: unknown[]) => mockGetSearchResults(...args),
    getQuestionFlags: (...args: unknown[]) => mockGetQuestionFlags(...args),
    createPracticeSession: (...args: unknown[]) => mockCreatePracticeSession(...args),
    savePracticeAnswer: (...args: unknown[]) => mockSavePracticeAnswer(...args),
    completePracticeSession: (...args: unknown[]) => mockCompletePracticeSession(...args),
    savePracticeSessionNotes: (...args: unknown[]) => mockSavePracticeSessionNotes(...args),
    removeQuestionFlag: vi.fn(),
    setQuestionFlag: vi.fn(),
  },
}));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

describe("Practice mobile layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockResizeObserver.reset();
    mockUseIsMobile.mockReturnValue(true);
    mockGetQuestionFlags.mockResolvedValue({ success: true, flags: {} });
    mockCreatePracticeSession.mockResolvedValue({
      success: true,
      session: {
        id: "session-1",
        user_id: "user-1",
        search_id: "search-1",
        started_at: "2026-03-31T00:00:00.000Z",
      },
    });
    mockSavePracticeAnswer.mockResolvedValue({
      success: true,
      answer: {
        id: "answer-1",
      },
    });
    mockCompletePracticeSession.mockResolvedValue({
      success: true,
      session: {
        id: "session-1",
        user_id: "user-1",
        search_id: "search-1",
        started_at: "2026-03-31T00:00:00.000Z",
        completed_at: "2026-03-31T00:05:00.000Z",
        session_notes: null,
      },
    });
    mockSavePracticeSessionNotes.mockResolvedValue({
      success: true,
      session: {
        id: "session-1",
        user_id: "user-1",
        search_id: "search-1",
        started_at: "2026-03-31T00:00:00.000Z",
        completed_at: "2026-03-31T00:05:00.000Z",
        session_notes: "Needs tighter metrics",
      },
    });
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: {
        id: "search-1",
        company: "OpenAI",
        role: "Research Engineer",
        status: "completed",
      },
      stages: [
        {
          id: "stage-1",
          name: "Technical Interview",
          duration: "45 minutes",
          interviewer: "Hiring manager",
          content: "Systems depth and product judgment.",
          guidance: "Prioritize impact, tradeoffs, and metrics.",
          order_index: 0,
          search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            {
              id: "question-1",
              question: "How did you leverage LLM technology in the AI product evaluation at Hg Capital?",
              created_at: "2026-03-31T00:00:00.000Z",
              difficulty: "Hard",
              rationale: "Strong answers show end-to-end product thinking.",
              good_answer_signals: ["Tie model choice to measurable business outcomes."],
              weak_answer_signals: ["Talking only about tools and not user impact."],
              follow_up_questions: ["How did you validate the output quality?"],
              sample_answer_outline: "Context, decision, evaluation loop, results.",
              evaluation_criteria: ["Clear decision process"],
            },
          ],
        },
      ],
    });
  });

  it("opens coach notes as a modal and preserves notes while measured footer spacing updates", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Practice setup")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));

    expect(
      await screen.findByText("How did you leverage LLM technology in the AI product evaluation at Hg Capital?")
    ).toBeInTheDocument();

    const shell = container.querySelector("[data-mobile-practice-shell]") as HTMLElement;
    const footer = container.querySelector("[data-mobile-practice-footer]") as HTMLElement;

    Object.defineProperty(footer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        right: 390,
        bottom: 260,
        left: 0,
        width: 390,
        height: 260,
        toJSON: () => ({}),
      }),
    });

    await act(async () => {
      MockResizeObserver.triggerAll();
    });

    await waitFor(() => {
      expect(shell.style.paddingBottom).toBe("260px");
    });

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    Object.defineProperty(footer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        right: 390,
        bottom: 420,
        left: 0,
        width: 390,
        height: 420,
        toJSON: () => ({}),
      }),
    });

    await act(async () => {
      MockResizeObserver.triggerAll();
    });

    await waitFor(() => {
      expect(shell.style.paddingBottom).toBe("420px");
    });

    const notesField = await screen.findByPlaceholderText("Jot the beats you want to hit...");
    fireEvent.change(notesField, { target: { value: "STAR bullets and metrics" } });

    fireEvent.click(screen.getByRole("button", { name: "Coach notes" }));

    expect(await screen.findByText("Strong answers, weak spots, and follow-ups")).toBeInTheDocument();
    expect(screen.getByText("Tie model choice to measurable business outcomes.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByText("Strong answers, weak spots, and follow-ups")).not.toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("STAR bullets and metrics")).toBeInTheDocument();
  });

  it("keeps the user in practice when completion fails on the last answer", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCompletePracticeSession.mockResolvedValueOnce({
      success: false,
      error: new Error("write failed"),
    });

    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.click(await screen.findByRole("button", { name: "Notes" }));

    fireEvent.change(
      await screen.findByPlaceholderText("Jot the beats you want to hit..."),
      { target: { value: "Use a tighter STAR answer." } }
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & Finish" }));

    expect(await screen.findByText("We couldn't mark this session complete. Try again.")).toBeInTheDocument();
    expect(screen.getByText("How did you leverage LLM technology in the AI product evaluation at Hg Capital?")).toBeInTheDocument();
    expect(screen.queryByText("Practice complete")).not.toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it("saves reflections without re-running session completion", async () => {
    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    fireEvent.click(await screen.findByRole("button", { name: "Notes" }));

    fireEvent.change(
      await screen.findByPlaceholderText("Jot the beats you want to hit..."),
      { target: { value: "Lead with impact, then evaluation loop." } }
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & Finish" }));

    expect(await screen.findByText("Practice complete")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("Add a short reflection for your next round..."),
      { target: { value: "Needs tighter metrics" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));

    await waitFor(() => {
      expect(mockSavePracticeSessionNotes).toHaveBeenCalledWith("session-1", "Needs tighter metrics");
    });

    expect(mockCompletePracticeSession).toHaveBeenCalledTimes(1);
  });
});
