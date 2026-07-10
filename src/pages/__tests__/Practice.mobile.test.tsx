import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Practice from "../Practice";

const UrlSpy = () => {
  const location = useLocation();
  return <div data-testid="url-spy" data-search={location.search} />;
};
import { BREATHING_DISMISSED_KEY } from "@/components/practice/BreathingBreak";

const capturedSwipeConfigs: Array<Record<string, unknown>> = [];
const mockGetSearchResults = vi.fn();
const mockGetQuestionFlags = vi.fn();
const mockGetLowRatedQuestionIds = vi.fn();
const mockCreatePracticeSession = vi.fn();
const mockSavePracticeAnswer = vi.fn();
const mockCompletePracticeSession = vi.fn();
const mockSavePracticeSessionNotes = vi.fn();
const mockGetEntitlement = vi.fn();
const mockUseIsMobile = vi.fn();
const mockRemoveQuestionFlag = vi.fn();
const mockSetQuestionFlag = vi.fn();

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

vi.mock("react-swipeable", () => ({
  useSwipeable: (config: Record<string, unknown>) => {
    capturedSwipeConfigs.push(config);
    return {};
  },
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
    savePracticeSessionNotes: (...args: unknown[]) => mockSavePracticeSessionNotes(...args),
    removeQuestionFlag: (...args: unknown[]) => mockRemoveQuestionFlag(...args),
    setQuestionFlag: (...args: unknown[]) => mockSetQuestionFlag(...args),
  },
}));

vi.mock("@/services/entitlements", () => ({
  getEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
}));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

const startPracticeSession = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
  fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
};

describe("Practice mobile layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockResizeObserver.reset();
    capturedSwipeConfigs.length = 0;
    localStorage.removeItem(BREATHING_DISMISSED_KEY);
    mockUseIsMobile.mockReturnValue(true);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
      },
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
    mockRemoveQuestionFlag.mockResolvedValue({ success: true });
    mockSetQuestionFlag.mockResolvedValue({
      success: true,
      flag: {
        id: "flag-needs-work",
        flag_type: "needs_work",
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

  it("sends the no-search fallback to the new-interview flow", async () => {
    render(
      <MemoryRouter initialEntries={["/practice"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
          <Route path="/new-interview" element={<div>New interview target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prep a new interview" }));

    expect(await screen.findByText("New interview target")).toBeInTheDocument();
  });

  it("starts with notes expanded and preserves them across coach sheet open/close", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Practice setup")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByText("Breathe in...")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(
      await screen.findByText("How did you leverage LLM technology in the AI product evaluation at Hg Capital?")
    ).toBeInTheDocument();

    const notesField = await screen.findByPlaceholderText("Jot the beats you want to hit...");
    expect(notesField).toBeInTheDocument();

    const shell = container.querySelector("[data-mobile-practice-shell]") as HTMLElement;
    const footer = container.querySelector("[data-mobile-practice-footer]") as HTMLElement;

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
      expect(shell.style.paddingBottom).toBe("436px");
    });

    fireEvent.change(notesField, { target: { value: "STAR bullets and metrics" } });

    fireEvent.click(screen.getByRole("button", { name: "Answer guide" }));

    expect(
      await screen.findByRole("heading", { name: "What strong answers show", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText("Tie model choice to measurable business outcomes.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "What strong answers show", level: 2 })
      ).not.toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("STAR bullets and metrics")).toBeInTheDocument();
  });

  it("reserves clearance beyond the footer height so the question card bottom isn't covered", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    await startPracticeSession();

    const shell = container.querySelector("[data-mobile-practice-shell]") as HTMLElement;
    const footer = container.querySelector("[data-mobile-practice-footer]") as HTMLElement;

    const measuredFooterHeight = 200;
    Object.defineProperty(footer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        right: 390,
        bottom: measuredFooterHeight,
        left: 0,
        width: 390,
        height: measuredFooterHeight,
        toJSON: () => ({}),
      }),
    });

    await act(async () => {
      MockResizeObserver.triggerAll();
    });

    await waitFor(() => {
      const reservedPx = Number.parseInt(shell.style.paddingBottom, 10);
      expect(Number.isNaN(reservedPx)).toBe(false);
      expect(reservedPx).toBeGreaterThan(measuredFooterHeight);
    });
  });

  it("keeps touch swipe navigation on mobile and shows permission-denied recording guidance", async () => {
    const getUserMediaMock = vi
      .mocked(navigator.mediaDevices.getUserMedia)
      .mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));

    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    await startPracticeSession();

    await waitFor(() => {
      expect(
        capturedSwipeConfigs.some((config) => config.trackTouch === true),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Record answer" }));

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        "Microphone access is blocked. Allow microphone access in your browser settings, then try again.",
      ),
    ).toBeInTheDocument();
  });

  it("lets users mark the current in-session question as needs work", async () => {
    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    await startPracticeSession();

    const needsWorkButton = await screen.findByRole("button", { name: "Needs work" });
    expect(needsWorkButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(needsWorkButton);

    await waitFor(() => {
      expect(mockSetQuestionFlag).toHaveBeenCalledWith("question-1", "needs_work");
    });

    expect(
      await screen.findByRole("button", { name: "Needs work flagged" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a favorite flag when users also mark the question as needs work", async () => {
    mockGetQuestionFlags.mockResolvedValue({
      success: true,
      flags: {
        "question-1": {
          favorite: { flag_type: "favorite", id: "flag-favorite" },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    await startPracticeSession();

    const favoriteButton = await screen.findByRole("button", { name: "Favorited" });
    expect(favoriteButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Needs work" }));

    await waitFor(() => {
      expect(mockSetQuestionFlag).toHaveBeenCalledWith("question-1", "needs_work");
    });

    expect(screen.getByRole("button", { name: "Favorited" })).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("button", { name: "Needs work flagged" }),
    ).toHaveAttribute("aria-pressed", "true");
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

    await startPracticeSession();

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

    await startPracticeSession();

    fireEvent.change(
      await screen.findByPlaceholderText("Jot the beats you want to hit..."),
      { target: { value: "Lead with impact, then evaluation loop." } }
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & Finish" }));

    expect(await screen.findByText("Reflection checkpoint")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(/My scoping for the sys-design question/),
      { target: { value: "Needs tighter metrics" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));

    await waitFor(() => {
      expect(mockSavePracticeSessionNotes).toHaveBeenCalledWith("session-1", "Needs tighter metrics");
    });

    expect(mockCompletePracticeSession).toHaveBeenCalledTimes(1);
  });
});

describe("Practice keyboard navigation", () => {
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.clearAllMocks();
    MockResizeObserver.reset();
    capturedSwipeConfigs.length = 0;
    localStorage.removeItem(BREATHING_DISMISSED_KEY);
    mockUseIsMobile.mockReturnValue(false);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    mockGetQuestionFlags.mockResolvedValue({ success: true, flags: {} });
    mockCreatePracticeSession.mockResolvedValue({
      success: true,
      session: { id: "session-1", user_id: "user-1", search_id: "search-1", started_at: "2026-03-31T00:00:00.000Z" },
    });
    mockSavePracticeAnswer.mockResolvedValue({ success: true, answer: { id: "answer-1" } });
    mockCompletePracticeSession.mockResolvedValue({
      success: true,
      session: { id: "session-1", user_id: "user-1", search_id: "search-1", started_at: "2026-03-31T00:00:00.000Z", completed_at: "2026-03-31T00:05:00.000Z", session_notes: null },
    });
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: { id: "search-1", company: "OpenAI", role: "Research Engineer", status: "completed" },
      stages: [
        {
          id: "stage-1", name: "Technical Interview", duration: "45 minutes", interviewer: "Hiring manager",
          content: "Systems depth.", guidance: "Prioritize impact.", order_index: 0, search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-1", question: "Describe your system design approach.", created_at: "2026-03-31T00:00:00.000Z", difficulty: "Medium" },
            { id: "q-2", question: "How do you evaluate ML models in production?", created_at: "2026-03-31T00:00:00.000Z", difficulty: "Hard" },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it("ArrowLeft navigates back after skipping forward", async () => {
    const questionTexts = [
      "Describe your system design approach.",
      "How do you evaluate ML models in production?",
    ];

    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText("Quick Start"));
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));

    let initialQuestionText = "";
    await waitFor(() => {
      const renderedQuestion = questionTexts.find((questionText) =>
        screen.queryByText(questionText),
      );
      expect(renderedQuestion).toBeDefined();
      initialQuestionText = renderedQuestion ?? "";
    });

    const nextQuestionText = questionTexts.find((questionText) => questionText !== initialQuestionText);
    expect(nextQuestionText).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(await screen.findByText(nextQuestionText!)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });

    expect(await screen.findByText(initialQuestionText)).toBeInTheDocument();
  });

  it("debounces the aria-live question announcement so rapid navigation doesn't flood screen readers", async () => {
    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText("Quick Start"));
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));

    const initialAnnouncement = await screen.findByText("Question 1 of 2");
    expect(initialAnnouncement).toHaveAttribute("aria-live", "polite");
    expect(initialAnnouncement).toHaveAttribute("aria-atomic", "true");

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    // Synchronously after navigation, the live region text still reflects the
    // previous index — the debounce hasn't elapsed yet.
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Question 2 of 2")).not.toBeInTheDocument();

    await waitFor(
      () => expect(screen.getByText("Question 2 of 2")).toBeInTheDocument(),
      { timeout: 1500 },
    );
  });
});

describe("Practice needs-work focus mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockResizeObserver.reset();
    capturedSwipeConfigs.length = 0;
    localStorage.removeItem(BREATHING_DISMISSED_KEY);
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
      session: {
        id: "session-1",
        user_id: "user-1",
        search_id: "search-1",
        started_at: "2026-03-31T00:00:00.000Z",
      },
    });
    mockSavePracticeAnswer.mockResolvedValue({ success: true, answer: { id: "answer-1" } });
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
  });

  it("keeps focus=needs_work in the URL after stage normalization fills in 'stages'", async () => {
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
          questions: [
            { id: "q-1", question: "Q1.", created_at: "2026-03-31T00:00:00.000Z", difficulty: "Medium" },
          ],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&focus=needs_work"]}>
        <Routes>
          <Route
            path="/practice"
            element={
              <>
                <Practice />
                <UrlSpy />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const spy = await screen.findByTestId("url-spy");

    await waitFor(() => {
      const search = spy.getAttribute("data-search") ?? "";
      expect(search).toContain("stages=stage-1");
      expect(search).toContain("focus=needs_work");
    });
  });

  it("treats low-rated answers as needs-work alongside explicit flags", async () => {
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
              id: "question-flagged",
              question: "Explicit needs-work question.",
              created_at: "2026-03-31T00:00:00.000Z",
              difficulty: "Hard",
            },
            {
              id: "question-low-rated",
              question: "Low self-rated question.",
              created_at: "2026-03-31T00:00:00.000Z",
              difficulty: "Hard",
            },
            {
              id: "question-clean",
              question: "Healthy question, no needs-work signal.",
              created_at: "2026-03-31T00:00:00.000Z",
              difficulty: "Hard",
            },
          ],
        },
      ],
    });
    mockGetQuestionFlags.mockResolvedValue({
      success: true,
      flags: {
        "question-flagged": {
          needs_work: { flag_type: "needs_work", id: "flag-1" },
        },
      },
    });
    mockGetLowRatedQuestionIds.mockResolvedValue({
      success: true,
      ids: ["question-low-rated"],
    });

    render(
      <MemoryRouter
        initialEntries={["/practice?searchId=search-1&stages=stage-1&focus=needs_work"]}
      >
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Quick Start"));
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));

    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();

    // Both the explicitly-flagged and the low-rated questions are reachable; the
    // healthy one is filtered out.
    expect(screen.getByText(/Explicit needs-work question\.|Low self-rated question\./)).toBeInTheDocument();
    expect(screen.queryByText("Healthy question, no needs-work signal.")).not.toBeInTheDocument();
  });
});

describe("Practice autosave label", () => {
  // Mirrors AUTOSAVE_DELAY_MS in src/pages/Practice.tsx; keep a small overshoot.
  const AUTOSAVE_DELAY_OVERSHOOT_MS = 5500;
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.clearAllMocks();
    MockResizeObserver.reset();
    capturedSwipeConfigs.length = 0;
    localStorage.removeItem(BREATHING_DISMISSED_KEY);
    sessionStorage.clear();
    mockUseIsMobile.mockReturnValue(false);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    mockGetQuestionFlags.mockResolvedValue({ success: true, flags: {} });
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
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: { id: "search-1", company: "OpenAI", role: "Research Engineer", status: "completed" },
      stages: [
        {
          id: "stage-1", name: "Technical Interview", duration: "45 minutes", interviewer: "Hiring manager",
          content: "Systems depth.", guidance: "Prioritize impact.", order_index: 0, search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-1", question: "Describe your system design approach.", created_at: "2026-03-31T00:00:00.000Z", difficulty: "Medium" },
            { id: "q-2", question: "How do you evaluate ML models in production?", created_at: "2026-03-31T00:00:00.000Z", difficulty: "Hard" },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
    vi.useRealTimers();
  });

  const startSession = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /quick start/i }));
    expect(await screen.findByText("Breathe in...")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
    expect(await screen.findByText("Describe your system design approach.")).toBeInTheDocument();
    return screen.findByPlaceholderText("Capture bullet points or timing cues…");
  };

  it("shows a draft-kept label (no green) after the debounce on the typed answer", async () => {
    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await startSession();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(textarea, { target: { value: "Lead with impact." } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_OVERSHOOT_MS);
    });

    const label = await screen.findByText("Draft kept in this tab");
    expect(label).toBeInTheDocument();
    expect(label.className).toContain("text-muted-foreground");
    expect(label.className).not.toContain("text-green-600");
    expect(screen.queryByText("Saved locally")).not.toBeInTheDocument();
  });

  it("shows an Answer-saved label (green) after Save & Continue, never 'Saved locally'", async () => {
    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await startSession();

    fireEvent.change(textarea, { target: { value: "Tied model choice to revenue." } });
    fireEvent.click(screen.getByRole("button", { name: /save & continue/i }));

    await waitFor(() => expect(mockSavePracticeAnswer).toHaveBeenCalled());

    const label = await screen.findByText("Answer saved");
    expect(label).toBeInTheDocument();
    expect(label.className).toContain("text-green-600");
    expect(screen.queryByText("Saved locally")).not.toBeInTheDocument();
  });

  it("resets the autosave label off the draft state when skipping to the next question", async () => {
    render(
      <MemoryRouter initialEntries={["/practice?searchId=search-1&stages=stage-1"]}>
        <Routes>
          <Route path="/practice" element={<Practice />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await startSession();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(textarea, { target: { value: "Partial draft." } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_OVERSHOOT_MS);
    });

    expect(await screen.findByText("Draft kept in this tab")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /skip/i }));

    await waitFor(() =>
      expect(screen.getByText("How do you evaluate ML models in production?")).toBeInTheDocument()
    );
    expect(screen.queryByText("Draft kept in this tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved locally")).not.toBeInTheDocument();
  });
});
