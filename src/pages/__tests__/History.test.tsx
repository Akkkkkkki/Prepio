import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import History from "../History";

const mockGetPracticeSessions = vi.fn();
const mockGetPracticeOverviewStats = vi.fn();
const mockGetQuestionFlags = vi.fn();
const mockGetSessionDetail = vi.fn();
const mockGetAnswerFeedbackForAnswers = vi.fn();
const mockNetworkStatus = {
  isOnline: true,
  isOffline: false,
};

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

vi.mock("@/services/searchService", () => ({
  getQuestionFlagTypes: (
    flags: Record<string, Record<string, unknown> | undefined>,
    questionId: string,
  ) => Object.keys(flags[questionId] ?? {}),
  hasQuestionFlag: (
    flags: Record<string, Record<string, unknown> | undefined>,
    questionId: string,
    flagType: string,
  ) => Boolean(flags[questionId]?.[flagType]),
  searchService: {
    getPracticeSessions: (...args: unknown[]) => mockGetPracticeSessions(...args),
    getPracticeOverviewStats: (...args: unknown[]) => mockGetPracticeOverviewStats(...args),
    getQuestionFlags: (...args: unknown[]) => mockGetQuestionFlags(...args),
    getSessionDetail: (...args: unknown[]) => mockGetSessionDetail(...args),
    getAnswerFeedbackForAnswers: (...args: unknown[]) => mockGetAnswerFeedbackForAnswers(...args),
  },
}));

describe("History page states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.isOffline = false;

    mockGetPracticeOverviewStats.mockResolvedValue({
      success: true,
      stats: {
        totalSessions: 0,
        totalQuestionsAnswered: 0,
        totalTimeSeconds: 0,
        needsWorkCount: 0,
      },
    });
    mockGetQuestionFlags.mockResolvedValue({
      success: true,
      flags: {},
    });
    mockGetSessionDetail.mockResolvedValue({
      success: false,
    });
    mockGetAnswerFeedbackForAnswers.mockResolvedValue({
      success: true,
      feedback: {},
    });
  });

  it("shows deterministic dashboard and research CTAs when there is no history", async () => {
    mockGetPracticeSessions.mockResolvedValue({
      success: true,
      sessions: [],
    });

    render(
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={<History />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ready to start practicing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Prep a new interview" })).toHaveAttribute(
      "href",
      "/new-interview",
    );
  });

  it("keeps error CTAs deterministic when loading fails", async () => {
    mockGetPracticeSessions.mockResolvedValue({
      success: false,
    });

    render(
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={<History />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Practice history unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Prep a new interview" })).toHaveAttribute(
      "href",
      "/new-interview",
    );
  });

  it("uses the selected research for filtered empty-state CTAs", async () => {
    mockGetPracticeSessions.mockResolvedValue({
      success: true,
      sessions: [
        {
          id: "session-1",
          search_id: "search-other",
          started_at: "2026-03-31T00:00:00.000Z",
          completed_at: "2026-03-31T00:05:00.000Z",
          session_notes: null,
          searches: {
            company: "OpenAI",
            role: "Research Engineer",
            country: "United Kingdom",
          },
          practice_answers: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/history?searchId=search-target"]}>
        <Routes>
          <Route path="/history" element={<History />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("No sessions for this research yet")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Start practice for this research" })).toHaveAttribute(
      "href",
      "/practice?searchId=search-target",
    );
    expect(screen.getByRole("button", { name: "Show all sessions" })).toBeInTheDocument();
  });

  it("keeps loaded history visible after the browser goes offline", async () => {
    mockGetPracticeSessions.mockResolvedValue({
      success: true,
      sessions: [
        {
          id: "session-1",
          search_id: "search-1",
          started_at: "2026-03-31T00:00:00.000Z",
          completed_at: "2026-03-31T00:05:00.000Z",
          session_notes: "Focus on tighter examples.",
          searches: {
            company: "OpenAI",
            role: "Research Engineer",
            country: "United Kingdom",
          },
          practice_answers: [
            {
              id: "answer-1",
              question_id: "question-1",
              answer_text: "Talked through model evaluations.",
              audio_path: null,
              answer_notes: null,
              answer_time_seconds: 120,
              created_at: "2026-03-31T00:01:00.000Z",
              interview_questions: {
                id: "question-1",
                question: "How do you evaluate model quality?",
                category: "technical",
                difficulty: "medium",
                interview_stages: {
                  name: "Technical Panel",
                },
              },
            },
          ],
        },
      ],
    });

    const view = render(
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={<History />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI")).toBeInTheDocument();

    mockNetworkStatus.isOnline = false;
    mockNetworkStatus.isOffline = true;
    view.rerender(
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={<History />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.queryByText("Practice history unavailable")).not.toBeInTheDocument();
    expect(mockGetPracticeSessions).toHaveBeenCalledTimes(1);
  });

  it("renders coexisting question flags in history summaries and answer details", async () => {
    const flags = {
      "question-1": {
        favorite: { id: "flag-favorite", flag_type: "favorite" },
        needs_work: { id: "flag-needs-work", flag_type: "needs_work" },
      },
    };

    mockGetPracticeOverviewStats.mockResolvedValue({
      success: false,
    });
    mockGetQuestionFlags.mockResolvedValue({
      success: true,
      flags,
    });
    mockGetPracticeSessions.mockResolvedValue({
      success: true,
      sessions: [
        {
          id: "session-1",
          search_id: "search-1",
          started_at: "2026-03-31T00:00:00.000Z",
          completed_at: "2026-03-31T00:05:00.000Z",
          session_notes: "Revisit the tradeoff framing.",
          searches: {
            company: "Stripe",
            role: "Backend Engineer",
            country: "United Kingdom",
          },
          practice_answers: [
            {
              id: "answer-1",
              question_id: "question-1",
              answer_time_seconds: 95,
              created_at: "2026-03-31T00:01:00.000Z",
            },
          ],
        },
      ],
    });
    mockGetSessionDetail.mockResolvedValue({
      success: true,
      session: {
        id: "session-1",
        search_id: "search-1",
        started_at: "2026-03-31T00:00:00.000Z",
        completed_at: "2026-03-31T00:05:00.000Z",
        session_notes: "Revisit the tradeoff framing.",
        searches: {
          company: "Stripe",
          role: "Backend Engineer",
          country: "United Kingdom",
        },
      },
      answers: [
        {
          id: "answer-1",
          question_id: "question-1",
          text_answer: "I would describe the migration risks and rollback plan.",
          answer_time_seconds: 95,
          created_at: "2026-03-31T00:01:00.000Z",
          interview_questions: {
            question: "How would you migrate a critical payments service?",
            category: "technical",
            difficulty: "hard",
            interview_stages: {
              name: "Systems Design",
            },
          },
        },
      ],
      flags,
    });

    render(
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={<History />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText("1 favorite")).toBeInTheDocument();
    expect(screen.getByText("1 needs work")).toBeInTheDocument();

    const needsWorkStat = screen.getByText("Questions still marked for review").parentElement;
    expect(needsWorkStat).not.toBeNull();
    expect(within(needsWorkStat as HTMLElement).getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Stripe/ }));

    expect(await screen.findByText("How would you migrate a critical payments service?")).toBeInTheDocument();
    expect(screen.getByText("Favorite")).toBeInTheDocument();
    expect(screen.getByText("Needs work")).toBeInTheDocument();
    expect(mockGetSessionDetail).toHaveBeenCalledWith("session-1");
    await waitFor(() => {
      expect(mockGetAnswerFeedbackForAnswers).toHaveBeenCalledWith(["answer-1"]);
    });
  });
});
