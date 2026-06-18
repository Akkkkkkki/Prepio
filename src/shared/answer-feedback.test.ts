import { describe, expect, it } from "vitest";

import { hasRenderableFeedback, normalizeStructuredFeedback } from "./answer-feedback";

describe("normalizeStructuredFeedback", () => {
  it("coerces string-only lists into feedback items", () => {
    const result = normalizeStructuredFeedback({
      strengths: ["Clear structure", "  Strong metric  "],
      improvements: [],
    });

    expect(result.strengths).toEqual([
      { text: "Clear structure" },
      { text: "Strong metric" },
    ]);
    expect(result.improvements).toEqual([]);
  });

  it("keeps evidence when present and drops empties", () => {
    const result = normalizeStructuredFeedback({
      strengths: [
        { text: "Owned the outcome", evidence: "cut latency 40%" },
        { text: "" },
        { notText: "ignored" },
      ],
    });

    expect(result.strengths).toEqual([
      { text: "Owned the outcome", evidence: "cut latency 40%" },
    ]);
  });

  it("caps each list at three items for a scannable read", () => {
    const result = normalizeStructuredFeedback({
      improvements: ["a", "b", "c", "d", "e"],
    });

    expect(result.improvements).toHaveLength(3);
  });

  it("reads snake_case columns from a persisted DB row", () => {
    const result = normalizeStructuredFeedback({
      star_breakdown: { situation: "S", task: "T", action: "A", result: "R" },
      next_action: { text: "Re-run with a metric", practicePrompt: "Try again" },
    });

    expect(result.starBreakdown).toEqual({
      situation: "S",
      task: "T",
      action: "A",
      result: "R",
    });
    expect(result.nextAction).toEqual({
      text: "Re-run with a metric",
      practicePrompt: "Try again",
    });
  });

  it("tolerates missing and malformed fields", () => {
    const result = normalizeStructuredFeedback({});
    expect(result).toEqual({
      strengths: [],
      improvements: [],
      starBreakdown: { situation: "", task: "", action: "", result: "" },
      nextAction: { text: "" },
    });
  });
});

describe("hasRenderableFeedback", () => {
  it("is false for fully empty feedback", () => {
    expect(hasRenderableFeedback(normalizeStructuredFeedback({}))).toBe(false);
  });

  it("is true when any section has content", () => {
    expect(
      hasRenderableFeedback(normalizeStructuredFeedback({ nextAction: { text: "Do this" } })),
    ).toBe(true);
    expect(
      hasRenderableFeedback(normalizeStructuredFeedback({ strengths: ["x"] })),
    ).toBe(true);
  });
});
