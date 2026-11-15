import { describe, expect, it } from "vitest";
import { buildResearchYieldEvent } from "./research-yield.ts";

const baseInput = {
  searchId: "search-123",
  company: "Acme",
  level: "senior_ic",
  roleFamily: "tech" as const,
  questionsExtracted: 42,
  sourcesReturned: 18,
  tavilyCalls: 6,
  tavilyCredits: 9,
};

describe("buildResearchYieldEvent", () => {
  it("keeps outcome fields explicitly null before a debrief is attached", () => {
    expect(buildResearchYieldEvent(baseInput)).toEqual({
      event: "research_yield",
      search_id: "search-123",
      company: "Acme",
      level: "senior_ic",
      role_family: "tech",
      questions_extracted: 42,
      sources_returned: 18,
      tavily_calls: 6,
      tavily_credits: 9,
      top_5_question_count: null,
      top_5_hit_count: null,
      top_5_hit_rate: null,
      recall_miss_count: null,
    });
  });

  it("derives the top-5 rate and carries the recall diagnostic", () => {
    expect(buildResearchYieldEvent({
      ...baseInput,
      roleFamily: "consulting",
      outcome: {
        top5QuestionCount: 5,
        top5HitCount: 3,
        recallMissCount: 2,
      },
    })).toMatchObject({
      role_family: "consulting",
      top_5_question_count: 5,
      top_5_hit_count: 3,
      top_5_hit_rate: 0.6,
      recall_miss_count: 2,
    });
  });

  it("does not divide by zero when an outcome has no top-5 questions", () => {
    expect(buildResearchYieldEvent({
      ...baseInput,
      outcome: {
        top5QuestionCount: 0,
        top5HitCount: 0,
        recallMissCount: 1,
      },
    })).toMatchObject({
      top_5_question_count: null,
      top_5_hit_count: null,
      top_5_hit_rate: null,
      recall_miss_count: 1,
    });
  });
});
