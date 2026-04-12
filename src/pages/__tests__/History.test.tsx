import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import History from "../History";

const mockGetPracticeSessions = vi.fn();
const mockGetPracticeOverviewStats = vi.fn();
const mockGetQuestionFlags = vi.fn();
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
  searchService: {
    getPracticeSessions: (...args: unknown[]) => mockGetPracticeSessions(...args),
    getPracticeOverviewStats: (...args: unknown[]) => mockGetPracticeOverviewStats(...args),
    getQuestionFlags: (...args: unknown[]) => mockGetQuestionFlags(...args),
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
    expect(screen.getByRole("link", { name: "Start new research" })).toHaveAttribute("href", "/");
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
    expect(screen.getByRole("link", { name: "Start new research" })).toHaveAttribute("href", "/");
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
});
