import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionInsightsPanel } from "../QuestionInsightsPanel";

const sampleData = {
  summary: "This scenario probes collaboration with Tencent's senior ICs.",
  goodSignals: [
    "Names the specific ML infra team and deliverable",
    "Explains how they synced decisions with the senior engineer"
  ],
  weakSignals: ["Only restates the prompt", "Ignores alignment with Tencent culture"],
  answerApproach: "Outline the shared goal, your proposed plan, tradeoffs, and sync cadence.",
  followUps: ["How did you escalate disagreements?", "What metrics proved it worked?"],
  depthLabel: "Mid-senior depth expected",
  seniorityExpectation: "Mid+ candidates should articulate collaborative planning, not just individual output.",
  sampleAnswerOutline: "Context • Communication plan • Execution mechanics • Impact",
  meta: {
    company: "Tencent",
    role: "Machine Learning Engineer",
    difficulty: "Medium"
  }
};

describe("QuestionInsightsPanel", () => {
  it("renders summary, signals, and outline details", () => {
    render(<QuestionInsightsPanel data={sampleData} />);

    expect(screen.getByText("What strong answers show")).toBeInTheDocument();
    expect(screen.getByText("Great answers include")).toBeInTheDocument();
    expect(screen.getByText("Watch out for")).toBeInTheDocument();
    expect(screen.getByText(/Mid\+ candidates/)).toBeInTheDocument();
    expect(screen.getByText("Suggested outline")).toBeInTheDocument();
    expect(screen.getByText("They may ask")).toBeInTheDocument();
  });

  it("renders nothing when no data provided", () => {
    const { container } = render(<QuestionInsightsPanel data={null} />);
    expect(container.firstChild).toBeNull();
  });
});

