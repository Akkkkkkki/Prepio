import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Interviews from "../Interviews";

const mockGetInterviewSummaries = vi.fn();

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    getInterviewSummaries: (...args: unknown[]) => mockGetInterviewSummaries(...args),
  },
}));

const renderInterviews = () =>
  render(
    <MemoryRouter initialEntries={["/interviews"]}>
      <Routes>
        <Route path="/interviews" element={<Interviews />} />
        <Route path="/new-interview" element={<div>New interview target</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Interviews home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives first-time users one clear path to prep a new interview", async () => {
    mockGetInterviewSummaries.mockResolvedValue({ success: true, interviews: [] });

    renderInterviews();

    expect(await screen.findByRole("heading", { name: "Your interviews" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prep a new interview" })).toHaveAttribute(
      "href",
      "/new-interview",
    );
    expect(screen.queryByText(/history menu/i)).not.toBeInTheDocument();
  });

  it("renders interview identity, progress, needs-work count, and direct actions", async () => {
    mockGetInterviewSummaries.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: "search-1",
          company: "Stripe",
          role: "Senior Product Manager",
          status: "completed",
          createdAt: "2026-06-20T10:00:00.000Z",
          totalQuestions: 14,
          practicedQuestions: 6,
          progressPercent: 43,
          needsWorkCount: 3,
          state: "in_progress",
        },
      ],
    });

    renderInterviews();

    expect(await screen.findByText("Stripe · Senior Product Manager")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("6 of 14 practiced · 43%")).toBeInTheDocument();
    expect(screen.getByText("3 questions still need work")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue practice" })).toHaveAttribute(
      "href",
      "/practice?searchId=search-1",
    );
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute(
      "href",
      "/dashboard?searchId=search-1",
    );
  });

  it("shows a recoverable error instead of an empty interview list", async () => {
    mockGetInterviewSummaries.mockResolvedValue({ success: false });

    renderInterviews();

    await waitFor(() => {
      expect(screen.getByText("We couldn't load your interviews.")).toBeInTheDocument();
    });
  });
});
