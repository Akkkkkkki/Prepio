import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByText(/3 questions across 2 stages/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Remove Initial Screening" }));

    await waitFor(() => {
      expect(screen.getByText(/2 questions across 1 stage/)).toBeInTheDocument();
    });
  });

  it("renders PrepSummaryHero on mobile with headline and practice CTA", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/OpenAI · prep summary/i)).toBeInTheDocument();
    expect(screen.getByText(/You're set up with 3 questions across 2 stages/)).toBeInTheDocument();
    const practiceButtons = screen.getAllByRole("button", { name: /Start practice/ });
    expect(practiceButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows preset quick guidance on the dashboard without a free-text ask box", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const guidance = await screen.findByRole("region", { name: "Quick guidance" });

    expect(within(guidance).getByRole("button", { name: "What should I practice first?" })).toBeInTheDocument();
    expect(within(guidance).getByRole("button", { name: "Which questions are most senior-level?" })).toBeInTheDocument();
    expect(within(guidance).getByRole("button", { name: "How should I position my background?" })).toBeInTheDocument();
    expect(within(guidance).queryByLabelText("Ask about this prep")).not.toBeInTheDocument();
    expect(within(guidance).queryByRole("button", { name: "Ask" })).not.toBeInTheDocument();

    fireEvent.click(within(guidance).getByRole("button", { name: "How should I position my background?" }));

    expect(within(guidance).getByText(/Position your background around Research depth for the Research Engineer role/i)).toBeInTheDocument();
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

  it("surfaces the evidence log with first-party labels and source links in the deep dive", async () => {
    mockUseIsMobile.mockReturnValue(false);
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
        assessment_signals: [],
        stage_roadmap: [],
        prep_priorities: [],
        candidate_positioning: {
          strengthsToLeanOn: [],
          weakSpotsToAddress: [],
          storyCoverageGaps: [],
          mismatchRisks: [],
        },
        practice_sequence: [],
        question_plan: { coreMustPractice: [], likelyFollowUps: [], extraDepth: [] },
        internal_evidence_log: [
          {
            id: "ev-1",
            sourceType: "official_job",
            sourceLabel: "Research Engineer job posting",
            excerpt: "Requires strong evaluation and modeling judgment.",
            url: "https://openai.com/careers/research-engineer",
            relevance: "high",
            trustWeight: "high",
            contradictionGroup: null,
          },
          {
            id: "ev-2",
            sourceType: "public_report",
            sourceLabel: "Glassdoor interview report",
            excerpt: "Panel focused on systems tradeoffs.",
            url: "https://www.glassdoor.com/openai-interview",
            relevance: "medium",
            trustWeight: "medium",
            contradictionGroup: null,
          },
          {
            id: "ev-3",
            sourceType: "market_heuristic",
            sourceLabel: "Role norm for senior ICs",
            excerpt: "Expect a systems-design round.",
            url: "javascript:alert(1)",
            relevance: "low",
            trustWeight: "low",
            contradictionGroup: null,
          },
        ],
        created_at: "2026-03-31T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Deep dive — why this plan/ }));

    expect(await screen.findByText("The evidence this plan was built from")).toBeInTheDocument();
    expect(screen.getByText("Job description")).toBeInTheDocument();
    expect(screen.getByText("Community report")).toBeInTheDocument();
    expect(screen.getAllByText("First-party").length).toBeGreaterThanOrEqual(1);

    // The javascript: URL on ev-3 is still listed as a source but must not render a link.
    expect(screen.getByText("Role norm for senior ICs")).toBeInTheDocument();
    const sourceLinks = screen.getAllByRole("link", { name: /View source/ });
    expect(sourceLinks).toHaveLength(2);
    expect(sourceLinks[0]).toHaveAttribute("href", "https://openai.com/careers/research-engineer");
    expect(sourceLinks[0]).toHaveAttribute("target", "_blank");
    expect(
      sourceLinks.some((link) => link.getAttribute("href")?.startsWith("javascript:")),
    ).toBe(false);
  });

  it("surfaces stage-level low_confidence_guidance inline on the mobile stage card", async () => {
    mockUseIsMobile.mockReturnValue(true);
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
          confidence: "low",
          low_confidence_guidance:
            "Screening format is unconfirmed; treat the question themes as directional.",
          order_index: 0,
          search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-1", question: "Tell me about yourself.", created_at: "2026-03-31T00:00:00.000Z" },
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
          overallConfidence: "low",
          weakSignalCase: false,
        },
        assessment_signals: [],
        stage_roadmap: [],
        prep_priorities: [],
        candidate_positioning: {
          strengthsToLeanOn: [],
          weakSpotsToAddress: [],
          storyCoverageGaps: [],
          mismatchRisks: [],
        },
        practice_sequence: [],
        question_plan: { coreMustPractice: [], likelyFollowUps: [], extraDepth: [] },
        internal_evidence_log: [],
        created_at: "2026-03-31T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/treat the question themes as directional/),
    ).toBeInTheDocument();
  });

  it("surfaces stage-level low_confidence_guidance inline without expanding the accordion", async () => {
    mockUseIsMobile.mockReturnValue(false);
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
          confidence: "low",
          low_confidence_guidance:
            "We could not confirm the screening format for this employer; treat the question themes as directional.",
          order_index: 0,
          search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-1", question: "Tell me about yourself.", created_at: "2026-03-31T00:00:00.000Z" },
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
          overallConfidence: "low",
          weakSignalCase: false,
        },
        assessment_signals: [],
        stage_roadmap: [],
        prep_priorities: [],
        candidate_positioning: {
          strengthsToLeanOn: [],
          weakSpotsToAddress: [],
          storyCoverageGaps: [],
          mismatchRisks: [],
        },
        practice_sequence: [],
        question_plan: { coreMustPractice: [], likelyFollowUps: [], extraDepth: [] },
        internal_evidence_log: [],
        created_at: "2026-03-31T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/treat the question themes as directional/),
    ).toBeInTheDocument();
  });

  it("frames the weak-signal notice around role norms when weakSignalCase is true", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: {
        id: "search-1",
        company: "Tiny Startup",
        role: "Staff Engineer",
        country: "United Kingdom",
        status: "completed",
        banner_dismissed: true,
        created_at: "2026-03-31T00:00:00.000Z",
      },
      stages: [
        {
          id: "stage-1",
          name: "Recruiter screen",
          order_index: 0,
          search_id: "search-1",
          created_at: "2026-03-31T00:00:00.000Z",
          questions: [
            { id: "q-1", question: "Walk me through your background.", created_at: "2026-03-31T00:00:00.000Z" },
          ],
        },
      ],
      prepPlan: {
        id: "plan-1",
        search_id: "search-1",
        summary: {
          company: "Tiny Startup",
          roleName: "Staff Engineer",
          industryFocus: "unknown",
          level: "staff_ic",
          overallConfidence: "low",
          weakSignalCase: true,
        },
        assessment_signals: [],
        stage_roadmap: [],
        prep_priorities: [],
        candidate_positioning: {
          strengthsToLeanOn: [],
          weakSpotsToAddress: [],
          storyCoverageGaps: [],
          mismatchRisks: [],
        },
        practice_sequence: [],
        question_plan: { coreMustPractice: [], likelyFollowUps: [], extraDepth: [] },
        internal_evidence_log: [],
        created_at: "2026-03-31T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard?searchId=search-1"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/leans on role norms/i)).toBeInTheDocument();
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
