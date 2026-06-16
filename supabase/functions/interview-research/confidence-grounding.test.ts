import { describe, expect, it } from "vitest";
import {
  applyConfidenceGrounding,
  computeConfidenceGrounding,
  type ConfidenceGroundingEvidence,
} from "./confidence-grounding.ts";

const NO_EVIDENCE: ConfidenceGroundingEvidence = {
  retrievedSourceCount: 0,
  hasExtractedJobRequirements: false,
  hasUserNote: false,
  hasJobDescription: false,
  hasCv: false,
};

function makePlan() {
  return {
    summary: {
      overallConfidence: "high" as const,
      weakSignalCase: false,
    },
    stageRoadmap: [
      {
        stageName: "Phone Screen",
        confidence: "high" as const,
        lowConfidenceGuidance: null,
      },
      {
        stageName: "Hiring Manager",
        confidence: "medium" as const,
        lowConfidenceGuidance: null,
      },
    ],
  };
}

describe("computeConfidenceGrounding", () => {
  it("allows high confidence only with retrieved-source corroboration and another evidence class", () => {
    const grounding = computeConfidenceGrounding({
      retrievedSourceCount: 5,
      hasExtractedJobRequirements: true,
      hasUserNote: false,
      hasJobDescription: false,
      hasCv: false,
    });

    expect(grounding.maxConfidence).toBe("high");
    expect(grounding.weakSignalCase).toBe(false);
    expect(grounding.retrievedSourceCount).toBe(5);
    expect(grounding.evidenceClasses).toEqual(["retrieved_sources", "job_requirements"]);
  });

  it("caps to medium when evidence exists but is not enough for high confidence", () => {
    const grounding = computeConfidenceGrounding({
      retrievedSourceCount: 1,
      hasExtractedJobRequirements: false,
      hasUserNote: true,
      hasJobDescription: false,
      hasCv: false,
    });

    expect(grounding.maxConfidence).toBe("medium");
    expect(grounding.weakSignalCase).toBe(true);
  });

  it("caps to low when no retrieved or first-party evidence exists", () => {
    const grounding = computeConfidenceGrounding(NO_EVIDENCE);

    expect(grounding.maxConfidence).toBe("low");
    expect(grounding.weakSignalCase).toBe(true);
    expect(grounding.retrievedSourceCount).toBe(0);
    expect(grounding.evidenceClasses).toEqual([]);
  });
});

describe("applyConfidenceGrounding", () => {
  it("downgrades overconfident zero-evidence plans and adds low-confidence guidance", () => {
    const plan = applyConfidenceGrounding(makePlan(), NO_EVIDENCE);

    expect(plan.summary.overallConfidence).toBe("low");
    expect(plan.summary.weakSignalCase).toBe(true);
    expect(plan.summary.confidenceGrounding?.maxConfidence).toBe("low");
    expect(plan.stageRoadmap?.map((stage) => stage.confidence)).toEqual(["low", "low"]);
    expect(plan.stageRoadmap?.[0].lowConfidenceGuidance).toContain("Evidence is thin");
  });

  it("does not promote model confidence when grounding is richer", () => {
    const plan = makePlan();
    plan.summary.overallConfidence = "medium";
    plan.stageRoadmap[0].confidence = "medium";

    const grounded = applyConfidenceGrounding(plan, {
      retrievedSourceCount: 8,
      hasExtractedJobRequirements: true,
      hasUserNote: false,
      hasJobDescription: false,
      hasCv: true,
    });

    expect(grounded.summary.overallConfidence).toBe("medium");
    expect(grounded.stageRoadmap?.[0].confidence).toBe("medium");
    expect(grounded.summary.weakSignalCase).toBe(false);
  });
});
