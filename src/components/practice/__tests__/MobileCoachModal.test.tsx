import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileCoachModal } from "../MobileCoachModal";
import type { QuestionInsightsData } from "../QuestionInsightsPanel";

const insights: QuestionInsightsData = {
  summary: "Probes how candidate aligns with senior ICs.",
  goodSignals: ["Names the specific team and deliverable"],
  weakSignals: ["Only restates the prompt"],
  answerApproach: "Outline shared goal and sync cadence.",
  followUps: ["How did you escalate disagreements?"],
  depthLabel: "Mid-senior depth expected",
  seniorityExpectation: "Mid+ candidates should plan collaboratively.",
  sampleAnswerOutline: "Context • Plan • Execution • Impact",
  meta: { company: "Tencent", role: "Machine Learning Engineer", difficulty: "Medium" },
};

describe("MobileCoachModal", () => {
  it("renders the sheet title once and does not duplicate it inside the inner panel", () => {
    render(
      <MobileCoachModal
        open
        onOpenChange={() => undefined}
        question="Walk me through a cross-team collaboration."
        insights={insights}
      />,
    );

    expect(screen.getAllByText("What strong answers show")).toHaveLength(1);
    // The redundant "Interviewer focus" kicker inside the embedded panel
    // must stay suppressed so the sheet's "Answer guide" kicker is unambiguous.
    expect(screen.queryByText("Interviewer focus")).not.toBeInTheDocument();
    expect(screen.getByText("Answer guide")).toBeInTheDocument();
    expect(screen.getByText(/For this question:/)).toBeInTheDocument();
  });
});
