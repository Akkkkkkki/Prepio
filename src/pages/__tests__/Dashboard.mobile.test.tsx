import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Dashboard from "../Dashboard";

const mockGetSearchResults = vi.fn();
const mockUseIsMobile = vi.fn();

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    getSearchResults: (...args: unknown[]) => mockGetSearchResults(...args),
  },
}));

describe("Dashboard mobile layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
    mockGetSearchResults.mockResolvedValue({
      success: true,
      search: {
        id: "search-1",
        company: "OpenAI",
        role: "Research Engineer",
        country: "United Kingdom",
        status: "completed",
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
      enhancedQuestions: [],
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

    expect(await screen.findByText("OpenAI Interview Research")).toBeInTheDocument();
    expect(screen.queryByText("Interview Process Overview")).not.toBeInTheDocument();
    expect(screen.getByText("3 questions across 2 selected stages")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Initial Screening"));

    expect(await screen.findByText("Introductions and fit check.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Initial Screening" }));

    await waitFor(() => {
      expect(screen.getByText("2 questions across 1 selected stage")).toBeInTheDocument();
    });
  });
});
