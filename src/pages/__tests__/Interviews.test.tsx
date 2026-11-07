import { render, screen, waitFor, within } from "@testing-library/react";
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

  // Synthetic opportunities only; no applicant or account data.
  const summary = (id: string, createdAt: unknown) => ({
    id,
    company: "OpenAI",
    role: "Applied AI Architect / Solutions Architect",
    createdAt,
    status: "completed",
    state: "plan_ready",
    totalQuestions: 8,
    practicedQuestions: 0,
    progressPercent: 0,
    needsWorkCount: 0,
  });

  it("distinguishes duplicate company/role cards by their own UTC start date", async () => {
    mockGetInterviewSummaries.mockResolvedValue({
      success: true,
      interviews: [
        summary("synthetic-first", "2026-06-20T10:00:00Z"),
        summary("synthetic-second", "2026-06-22T10:00:00Z"),
      ],
    });

    renderInterviews();

    const titles = await screen.findAllByText("OpenAI · Applied AI Architect / Solutions Architect");
    expect(titles).toHaveLength(2);
    for (const [index, date] of ["2026-06-20", "2026-06-22"].entries()) {
      const card = within(titles[index].closest(".flex.h-full") as HTMLElement);
      expect(card.getByText(`Started ${date} (UTC)`)).toBeInTheDocument();
      expect(card.getByRole("link", { name: "Start practice" })).toHaveAttribute(
        "href", `/practice?searchId=synthetic-${index === 0 ? "first" : "second"}`,
      );
      expect(card.getByText("Plan ready")).toBeInTheDocument();
      expect(card.getByText("0 of 8 answered · 0%")).toBeInTheDocument();
    }
  });

  it.each([
    null, undefined, "", "not-a-date", "2026-99-99T00:00:00Z",
    "2026-02-30T00:00:00Z", "2026-06-21T00:30:00", 0, {},
  ])(
    "shows an honest fallback for invalid createdAt %s",
    async (createdAt) => {
      mockGetInterviewSummaries.mockResolvedValue({
        success: true,
        interviews: [summary("synthetic-invalid", createdAt)],
      });

      renderInterviews();

      expect(await screen.findByText("Start date unavailable")).toBeInTheDocument();
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Start practice" })).toHaveAttribute(
        "href", "/practice?searchId=synthetic-invalid",
      );
    },
  );

  it.each([
    ["2026-06-21T00:30:00+09:00", "2026-06-20"],
    ["2026-06-20T23:30:00-07:00", "2026-06-21"],
    ["2026-01-01T00:30:00+14:00", "2025-12-31"],
  ])("uses the UTC calendar date for %s", async (createdAt, expectedDate) => {
    mockGetInterviewSummaries.mockResolvedValue({
      success: true,
      interviews: [summary("synthetic-boundary", createdAt)],
    });

    renderInterviews();

    expect(await screen.findByText(`Started ${expectedDate} (UTC)`)).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "Prep a new interview" })).toHaveAttribute(
      "href",
      "/new-interview",
    );
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("6 of 14 answered · 43%")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What the answered count means" }),
    ).toBeTruthy();
    expect(screen.getByText("3 questions still need work")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice these/ })).toHaveAttribute(
      "href",
      "/practice?searchId=search-1&focus=needs_work",
    );
    expect(screen.getByRole("link", { name: "Continue practice" })).toHaveAttribute(
      "href",
      "/practice?searchId=search-1",
    );
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute(
      "href",
      "/dashboard?searchId=search-1",
    );
  });

  it("omits the needs-work CTA when there is no needs-work backlog", async () => {
    mockGetInterviewSummaries.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: "search-2",
          company: "Linear",
          role: "Staff Engineer",
          status: "completed",
          createdAt: "2026-06-22T10:00:00.000Z",
          totalQuestions: 10,
          practicedQuestions: 10,
          progressPercent: 100,
          needsWorkCount: 0,
          state: "in_progress",
        },
      ],
    });

    renderInterviews();

    expect(await screen.findByText("10 of 10 answered · 100%")).toBeInTheDocument();
    expect(screen.queryByText(/still need/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Practice these/ })).not.toBeInTheDocument();
  });

  it("routes plan-ready, processing, and failed interviews to the correct next action", async () => {
    mockGetInterviewSummaries.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: "ready-search",
          company: "Linear",
          role: "Staff Engineer",
          status: "completed",
          createdAt: "2026-06-21T10:00:00.000Z",
          totalQuestions: 8,
          practicedQuestions: 0,
          progressPercent: 0,
          needsWorkCount: 1,
          state: "plan_ready",
        },
        {
          id: "processing-search",
          company: "Anthropic",
          role: "Product Engineer",
          status: "processing",
          createdAt: "2026-06-22T10:00:00.000Z",
          totalQuestions: 0,
          practicedQuestions: 0,
          progressPercent: 0,
          needsWorkCount: 0,
          state: "processing",
        },
        {
          id: "failed-search",
          company: "OpenAI",
          role: "Engineering Manager",
          status: "failed",
          createdAt: "2026-06-23T10:00:00.000Z",
          totalQuestions: 0,
          practicedQuestions: 0,
          progressPercent: 0,
          needsWorkCount: 0,
          state: "failed",
        },
      ],
    });

    renderInterviews();

    expect(await screen.findByText("Linear · Staff Engineer")).toBeInTheDocument();
    expect(screen.getByText("Plan ready")).toBeInTheDocument();
    expect(screen.getByText("1 question still needs work")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start practice" })).toHaveAttribute(
      "href",
      "/practice?searchId=ready-search",
    );
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute(
      "href",
      "/dashboard?searchId=ready-search",
    );

    expect(screen.getByText("Research in progress")).toBeInTheDocument();
    expect(screen.getByText("Your tailored plan is still being prepared.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View progress" })).toHaveAttribute(
      "href",
      "/dashboard?searchId=processing-search",
    );

    expect(screen.getByText("Research needs attention")).toBeInTheDocument();
    expect(screen.getByText("Open the research run to review the error and try again.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review research" })).toHaveAttribute(
      "href",
      "/dashboard?searchId=failed-search",
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
