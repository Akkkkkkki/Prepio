import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  QuestionInsightsPanel,
  hasQuestionInsightsContent,
} from "../QuestionInsightsPanel";

const sampleData = {
  summary: "This scenario probes collaboration with Tencent's senior ICs.",
  goodSignals: [
    "Names the specific ML infra team and deliverable",
    "Explains how they synced decisions with the senior engineer"
  ],
  weakSignals: ["Only restates the prompt", "Ignores alignment with Tencent culture"],
  answerApproach: "Outline the shared goal, your proposed plan, tradeoffs, and sync cadence.",
  followUps: ["How did you escalate disagreements?", "What metrics proved it worked?"],
  linkedStoryText: "Aligned ML infra, product, and support on an incident-response rollout.",
  linkedStorySource: "Senior PM @ Acme",
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
    expect(screen.queryByText("Draw on your experience")).not.toBeNull();
    expect(screen.queryByText("Senior PM @ Acme")).not.toBeNull();
    expect(screen.getByText("Suggested outline")).toBeInTheDocument();
    expect(screen.getByText("They may ask")).toBeInTheDocument();
  });

  it("renders nothing when no data provided", () => {
    const { container } = render(<QuestionInsightsPanel data={null} />);
    expect(container.firstChild).toBeNull();
  });

  // PREPIO-176: a fresh research run leaves every guidance field empty, so the
  // panel would otherwise render as a titled card of pure chrome — a dead control.
  it("renders nothing when only chrome is present and every guidance field is empty", () => {
    const { container } = render(
      <QuestionInsightsPanel
        data={{
          summary: null,
          goodSignals: [],
          weakSignals: [],
          answerApproach: "",
          followUps: [],
          depthLabel: "Mid-senior depth expected",
          seniorityExpectation: "Mid+ candidates should plan collaboratively.",
          meta: { company: "Tencent", role: "Machine Learning Engineer", difficulty: "Medium" },
        }}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("What strong answers show")).not.toBeInTheDocument();
  });

  it("still renders when the only populated section is the interviewer-focus summary", () => {
    render(<QuestionInsightsPanel data={{ summary: "Why they ask this.", meta: {} }} />);
    expect(screen.getByText("Why they ask this.")).toBeInTheDocument();
  });

  it("omits the panel header when hideHeader is set, keeping the depth badge", () => {
    render(<QuestionInsightsPanel data={sampleData} hideHeader />);

    expect(screen.queryByText("What strong answers show")).not.toBeInTheDocument();
    expect(screen.queryByText("Interviewer focus")).not.toBeInTheDocument();
    expect(screen.getByText(sampleData.depthLabel)).toBeInTheDocument();
    // Body content should still render so the panel remains useful.
    expect(screen.getByText("Great answers include")).toBeInTheDocument();
  });
});

describe("hasQuestionInsightsContent", () => {
  it("is false for null, undefined, or an all-empty-guidance shape", () => {
    expect(hasQuestionInsightsContent(null)).toBe(false);
    expect(hasQuestionInsightsContent(undefined)).toBe(false);
    expect(
      hasQuestionInsightsContent({
        summary: "   ",
        goodSignals: [],
        weakSignals: [],
        answerApproach: "",
        followUps: [],
        depthLabel: "Mid depth",
        seniorityExpectation: "Mid+",
        meta: { company: "Tencent", role: "ML", difficulty: "Medium" },
      }),
    ).toBe(false);
  });

  it("is true when any substantive guidance section is present", () => {
    expect(hasQuestionInsightsContent({ summary: "Why they ask this." })).toBe(true);
    expect(hasQuestionInsightsContent({ goodSignals: ["Names the team"] })).toBe(true);
    expect(hasQuestionInsightsContent({ weakSignals: ["Restates the prompt"] })).toBe(true);
    expect(hasQuestionInsightsContent({ answerApproach: "Outline the plan." })).toBe(true);
    expect(hasQuestionInsightsContent({ followUps: ["How did you escalate?"] })).toBe(true);
    expect(hasQuestionInsightsContent({ linkedStoryText: "An incident rollout." })).toBe(true);
    expect(hasQuestionInsightsContent({ sampleAnswerOutline: "Context • Plan • Impact" })).toBe(true);
  });
});
