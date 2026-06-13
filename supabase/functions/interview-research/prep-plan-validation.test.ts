import { describe, expect, it } from "vitest";
import {
  buildRepairInstructions,
  countQuestions,
  QUESTION_MINIMUMS,
  validatePrepPlan,
} from "./prep-plan-validation.ts";

function makeQuestion(
  overrides: Partial<{
    question: string;
    stageName: string | null;
    linkedPriority: string;
    difficulty: string;
  }> = {},
) {
  return {
    question: "Tell me about a time you shipped under pressure.",
    stageName: "Phone Screen",
    linkedPriority: "high",
    difficulty: "Medium",
    reason: "Probes execution under constraints.",
    answerGuidanceStatus: "pending",
    ...overrides,
  };
}

function makeValidPlan() {
  return {
    summary: { company: "Acme", overallConfidence: "medium", weakSignalCase: false },
    stageRoadmap: [
      { stageName: "Phone Screen", orderIndex: 1, confidence: "high", prepPriority: "high" },
      { stageName: "Onsite", orderIndex: 2, confidence: "medium", prepPriority: "medium" },
    ],
    questionPlan: {
      coreMustPractice: Array.from({ length: QUESTION_MINIMUMS.coreMustPractice }, () =>
        makeQuestion(),
      ),
      likelyFollowUps: Array.from({ length: QUESTION_MINIMUMS.likelyFollowUps }, () =>
        makeQuestion({ stageName: null, linkedPriority: "medium", difficulty: "Easy" }),
      ),
      extraDepth: Array.from({ length: QUESTION_MINIMUMS.extraDepth }, () =>
        makeQuestion({ stageName: "Onsite", linkedPriority: "low", difficulty: "Hard" }),
      ),
    },
  };
}

describe("countQuestions", () => {
  it("sums tiers and tolerates missing arrays", () => {
    expect(countQuestions(makeValidPlan()).total).toBe(40);
    expect(countQuestions({}).total).toBe(0);
    expect(countQuestions(null).total).toBe(0);
  });
});

describe("validatePrepPlan", () => {
  it("accepts a well-formed plan that meets every minimum", () => {
    const result = validatePrepPlan(makeValidPlan());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.total).toBe(40);
  });

  it("flags tiers below the mandatory minimums", () => {
    const plan = makeValidPlan();
    plan.questionPlan.coreMustPractice = plan.questionPlan.coreMustPractice.slice(0, 3);
    const result = validatePrepPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("coreMustPractice has 3"))).toBe(true);
  });

  it("flags questions whose stageName does not match the roadmap", () => {
    const plan = makeValidPlan();
    plan.questionPlan.coreMustPractice[0] = makeQuestion({ stageName: "Ghost Round" });
    const result = validatePrepPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.unresolvedStageLinks).toContain("Ghost Round");
  });

  it("allows null stageName (not stage-specific)", () => {
    const plan = makeValidPlan();
    plan.questionPlan.coreMustPractice[0] = makeQuestion({ stageName: null });
    expect(validatePrepPlan(plan).valid).toBe(true);
  });

  it("matches stage names case-insensitively and trimming whitespace", () => {
    const plan = makeValidPlan();
    plan.questionPlan.coreMustPractice[0] = makeQuestion({ stageName: "  phone screen  " });
    expect(validatePrepPlan(plan).valid).toBe(true);
  });

  it("requires a valid difficulty enum on every question", () => {
    const plan = makeValidPlan();
    plan.questionPlan.coreMustPractice[0] = makeQuestion({ difficulty: undefined as any });
    plan.questionPlan.coreMustPractice[1] = makeQuestion({ difficulty: "Trivial" });
    const result = validatePrepPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("difficulty is missing"))).toBe(true);
    expect(result.errors.some((e) => e.includes('"Trivial"'))).toBe(true);
  });

  it("rejects an empty stage roadmap", () => {
    const plan = makeValidPlan();
    plan.stageRoadmap = [];
    const result = validatePrepPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("stageRoadmap must contain"))).toBe(true);
  });

  it("does not throw on entirely malformed input", () => {
    expect(validatePrepPlan(null).valid).toBe(false);
    expect(validatePrepPlan(undefined).valid).toBe(false);
    expect(validatePrepPlan("nope").valid).toBe(false);
  });
});

describe("buildRepairInstructions", () => {
  it("lists valid stage names and the concrete errors", () => {
    const plan = makeValidPlan();
    plan.questionPlan.extraDepth = plan.questionPlan.extraDepth.slice(0, 1);
    const validation = validatePrepPlan(plan);
    const text = buildRepairInstructions(validation, ["Phone Screen", "Onsite"]);
    expect(text).toContain("Phone Screen");
    expect(text).toContain("extraDepth has 1");
    expect(text).toContain("VALIDATION ERRORS TO FIX");
  });
});
