import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrepAskPanel } from "../PrepAskPanel";
import type { ResearchPreview } from "@/types/researchPreview";

const preview: ResearchPreview = {
  previewId: "preview-1",
  status: "completed",
  company: "Acme",
  role: "Staff Engineer",
  confidence: "high",
  sourceSummary: "Synthesized from public sources.",
  stages: [
    { name: "System Design", whyLikely: "Core to the role", confidence: "high" },
  ],
  assessmentSignals: [
    { name: "judgment under ambiguity", importance: "high", rationale: "Senior bar" },
  ],
  questions: [
    {
      stage: "System Design",
      difficulty: "hard",
      question: "Design a rate limiter.",
      rationale: "Common at this level",
    },
  ],
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

describe("PrepAskPanel (preset quick guidance)", () => {
  it("renders the honest reframe, not the old free-text chat", () => {
    render(<PrepAskPanel preview={preview} />);

    expect(screen.getByRole("heading", { name: "Quick guidance" })).toBeInTheDocument();
    expect(screen.queryByText("Ask about this prep")).not.toBeInTheDocument();
    // No free-text affordance.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ask$/i })).not.toBeInTheDocument();
  });

  it("shows the first preset's grounded answer by default", () => {
    render(<PrepAskPanel preview={preview} />);
    expect(screen.getByText(/Practice "Design a rate limiter\." first/)).toBeInTheDocument();
  });

  it("swaps the answer to the selected preset", () => {
    render(<PrepAskPanel preview={preview} />);

    fireEvent.click(screen.getByRole("button", { name: "How to position my background" }));

    expect(screen.getByText(/Position your background around judgment under ambiguity/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "How to position my background" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
