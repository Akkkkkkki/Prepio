import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnswerFeedbackCard } from "../AnswerFeedbackCard";
import type { AnswerFeedback } from "@/shared/answer-feedback";

const feedback: AnswerFeedback = {
  id: "fb-1",
  practiceAnswerId: "answer-1",
  model: "gpt-4o-mini",
  createdAt: null,
  strengths: [{ text: "Clear STAR structure", evidence: "named the result" }],
  improvements: [{ text: "Quantify the impact" }],
  starBreakdown: { situation: "Outage", task: "Restore", action: "Rolled back", result: "10 min" },
  nextAction: { text: "Re-tell it with a hard metric." },
};

describe("AnswerFeedbackCard", () => {
  it("shows the paid gate, no action, for free users", () => {
    render(<AnswerFeedbackCard access="free" />);
    expect(screen.getByText("Detailed coaching is paid")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /get detailed coaching/i }),
    ).not.toBeInTheDocument();
  });

  it("lets paid users trigger generation", () => {
    const onGenerate = vi.fn();
    render(<AnswerFeedbackCard access="paid" onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("button", { name: /get detailed coaching/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("renders concise feedback and a regenerate control when feedback exists", () => {
    render(<AnswerFeedbackCard access="paid" feedback={feedback} onRegenerate={vi.fn()} />);

    expect(screen.getByText("Clear STAR structure")).toBeInTheDocument();
    expect(screen.getByText("Quantify the impact")).toBeInTheDocument();
    expect(screen.getByText(/Re-tell it with a hard metric/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    // Generation action should be gone once feedback is present.
    expect(
      screen.queryByRole("button", { name: /get detailed coaching/i }),
    ).not.toBeInTheDocument();
  });

  it("surfaces an honest message for a too-short answer", () => {
    render(<AnswerFeedbackCard access="paid" status="error" errorCode="answer_too_short" />);
    expect(screen.getByText(/Add a bit more to your answer/i)).toBeInTheDocument();
  });

  it("shows a generating state", () => {
    render(<AnswerFeedbackCard access="paid" status="generating" onGenerate={vi.fn()} />);
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  });
});
