import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Dashboard from "../Dashboard";

const mockGetSearchResults = vi.fn();
const mockDismissBanner = vi.fn();
const mockUseIsMobile = vi.fn();
const mockNetworkStatus = {
  isOnline: true,
  isOffline: false,
};

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    getSearchResults: (...args: unknown[]) => mockGetSearchResults(...args),
    dismissBanner: (...args: unknown[]) => mockDismissBanner(...args),
  },
}));

describe("Dashboard mobile layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.isOffline = false;
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: {
        id: "search-1",
        company: "OpenAI",
        role: "Research Engineer",
        country: "United Kingdom",
        status: "completed",
        banner_dismissed: true,
        created_at: "2026-03-31T00:00:00.000Z",
      },
      stages: [
        {
          id: "stage-1",
          name: "Initial Screening",
          duration: "30 minutes",
          interviewer: "Recruiter",
          content: "Introductions and fit check.",
          guidance: "Keep this concise and outcome-focused.",
          order_index: 0,
          search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-1", question: "Tell me about yourself.", created_at: "2026-03-31T00:00:00.000Z" },
          ],
        },
        {
          id: "stage-2",
          name: "Technical Panel",
          duration: "60 minutes",
          interviewer: "Hiring manager",
          content: "Systems thinking and technical tradeoffs.",
          guidance: "Show how you make decisions under ambiguity.",
          order_index: 1,
          search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-2", question: "How would you evaluate model quality?", created_at: "2026-03-31T00:00:00.000Z" },
            { id: "q-3", question: "Describe a time you shipped under pressure.", created_at: "2026-03-31T00:00:00.000Z" },
          ],
        },
      ],
      prepPlan: {
        id: "plan-1",
        search_id: "search-1",
        summary: {
          company: "OpenAI",
          roleName: "Research Engineer",
          industryFocus: "tech",
          level: "senior_ic",
          overallConfidence: "high",
          weakSignalCase: false,
        },
        assessment_signals: [
          {
            name: "Research depth",
            importance: "high",
            rationale: "The role needs strong modeling judgment.",
          },
        ],
        stage_roadmap: [],
        prep_priorities: [
          {
            label: "Sharpen technical tradeoffs",
            priority: "high",
            whyItMatters: "This will show up in the panel.",
            recommendedActions: ["Practice one systems answer."],
          },
        ],
        candidate_positioning: {
          strengthsToLeanOn: [],
          weakSpotsToAddress: [],
          storyCoverageGaps: [],
          mismatchRisks: [],
        },
        practice_sequence: [],
        question_plan: {
          coreMustPractice: [],
          likelyFollowUps: [],
          extraDepth: [],
        },
        internal_evidence_log: [],
        created_at: "2026-03-31T00:00:00.000Z",
      },
    });
  });

  it("renders the dedicated mobile stage cards and updates the sticky CTA summary", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Prep plan")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OpenAI" })).toBeInTheDocument();
    expect(screen.getByText("Stage roadmap")).toBeInTheDocument();
    expect(screen.getByText("3 questions across 2 stages")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Remove Initial Screening" }));

    await waitFor(() => {
      expect(screen.getByText("2 questions across 1 stage")).toBeInTheDocument();
    });
  });

  it("shows only data-backed overview metrics on desktop", async () => {
    mockUseIsMobile.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Stage roadmap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start practice.*3/ })).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Deep dive — why this plan/ }));

    expect(await screen.findByText("Key assessment signals")).toBeInTheDocument();
    expect(screen.getByText("Prep priorities")).toBeInTheDocument();
  });

  it("preserves the real failure message when offline", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockNetworkStatus.isOnline = false;
    mockNetworkStatus.isOffline = true;
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: {
        id: "search-1",
        company: "OpenAI",
        role: "Research Engineer",
        country: "United Kingdom",
        status: "failed",
        created_at: "2026-03-31T00:00:00.000Z",
      },
      stages: [],
      prepPlan: null,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Search processing failed. Please try again.")).toBeInTheDocument();
    expect(
      screen.getByText("You're offline. Reconnect before you try loading this research again."),
    ).toBeInTheDocument();
  });
});
