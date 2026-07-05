import { describe, expect, it } from "vitest";
import { deriveStageConfidenceFromEvidence } from "./stage-confidence.ts";

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      overallConfidence: "high" as const,
      weakSignalCase: false,
    },
    stageRoadmap: [
      {
        stageName: "Technical Screen",
        confidence: "high" as const,
        whatItTests: ["live coding"],
        whyLikely: "Candidates report a live coding screen.",
        questionThemes: ["algorithms"],
        lowConfidenceGuidance: null,
      },
      {
        stageName: "Behavioral Round",
        confidence: "high" as const,
        whatItTests: ["behavioral", "collaboration"],
        whyLikely: "Values and culture interview.",
        questionThemes: ["leadership"],
        lowConfidenceGuidance: null,
      },
    ],
    internalEvidenceLog: [],
    ...overrides,
  };
}

describe("deriveStageConfidenceFromEvidence", () => {
  it("overwrites model confidence with deterministic evidence scores", () => {
    const plan = makePlan({
      stageRoadmap: [
        {
          stageName: "Live Coding Screen",
          confidence: "high",
          whatItTests: ["live coding"],
          whyLikely: "Coding screen.",
          questionThemes: [],
          lowConfidenceGuidance: null,
        },
      ],
      internalEvidenceLog: [
        {
          id: "ev-1",
          sourceType: "public_report",
          sourceLabel: "Glassdoor report",
          excerpt: "The first round was a live coding interview.",
          url: "https://example.com/report-1",
          trustWeight: "medium",
          contradictionGroup: null,
        },
      ],
    });

    deriveStageConfidenceFromEvidence(plan);

    expect(plan.stageRoadmap[0].confidence).toBe("medium");
    expect(plan.summary.overallConfidence).toBe("medium");
    expect(plan.summary.weakSignalCase).toBe(false);
  });

  it("weights an official source high enough for high confidence", () => {
    const plan = makePlan({
      stageRoadmap: [
        {
          stageName: "Portfolio Presentation",
          confidence: "low",
          whatItTests: ["presentation"],
          whyLikely: "Candidate presents prior work.",
          questionThemes: [],
          lowConfidenceGuidance: null,
        },
      ],
      internalEvidenceLog: [
        {
          id: "ev-1",
          sourceType: "official_company",
          sourceLabel: "Company interview guide",
          excerpt: "Candidates complete a portfolio presentation with the hiring panel.",
          url: "https://example.com/careers/interview-guide",
          trustWeight: "high",
          contradictionGroup: null,
        },
      ],
    });

    deriveStageConfidenceFromEvidence(plan);

    expect(plan.stageRoadmap[0].confidence).toBe("high");
    expect(plan.summary.overallConfidence).toBe("high");
    expect(plan.summary.weakSignalCase).toBe(false);
  });

  it("forces low confidence and weak-signal when only heuristics are present", () => {
    const plan = makePlan({
      internalEvidenceLog: [
        {
          id: "ev-1",
          sourceType: "market_heuristic",
          sourceLabel: "Role norm",
          excerpt: "Senior technical roles often include system design.",
          url: null,
          trustWeight: "low",
          contradictionGroup: null,
        },
      ],
    });

    deriveStageConfidenceFromEvidence(plan);

    expect(plan.stageRoadmap.map((stage) => stage.confidence)).toEqual(["low", "low"]);
    expect(plan.summary.overallConfidence).toBe("low");
    expect(plan.summary.weakSignalCase).toBe(true);
    expect(plan.stageRoadmap[0].lowConfidenceGuidance).toContain("No independent source corroborates");
  });

  it("records contradictions when evidence describes a conflicting assessment format", () => {
    const plan = makePlan({
      stageRoadmap: [
        {
          stageName: "Technical Screen",
          confidence: "high",
          whatItTests: ["live coding"],
          whyLikely: "Live coding round.",
          questionThemes: [],
          lowConfidenceGuidance: null,
        },
      ],
      internalEvidenceLog: [
        {
          id: "ev-1",
          sourceType: "public_report",
          sourceLabel: "Blind thread",
          excerpt: "My technical screen was live coding with an interviewer.",
          url: "https://example.com/live",
          trustWeight: "medium",
          contradictionGroup: null,
        },
        {
          id: "ev-2",
          sourceType: "public_report",
          sourceLabel: "Reddit report",
          excerpt: "There was no live coding; they sent a take-home assignment.",
          url: "https://example.com/take-home",
          trustWeight: "medium",
          contradictionGroup: null,
        },
      ],
    });

    deriveStageConfidenceFromEvidence(plan);

    expect(plan.stageRoadmap[0].confidence).toBe("medium");
    expect(plan.internalEvidenceLog[1].contradictionGroup).toBe("technical_assessment_format");
    expect(plan.stageRoadmap[0].lowConfidenceGuidance).toBeNull();
  });

  it("deduplicates corroboration by source URL", () => {
    const plan = makePlan({
      stageRoadmap: [
        {
          stageName: "Behavioral Round",
          confidence: "high",
          whatItTests: ["behavioral"],
          whyLikely: "Behavioral questions.",
          questionThemes: [],
          lowConfidenceGuidance: null,
        },
      ],
      internalEvidenceLog: [
        {
          id: "ev-1",
          sourceType: "public_report",
          sourceLabel: "Glassdoor report",
          excerpt: "Behavioral interview focused on collaboration.",
          url: "https://example.com/same-report",
          trustWeight: "medium",
          contradictionGroup: null,
        },
        {
          id: "ev-2",
          sourceType: "public_report",
          sourceLabel: "Same Glassdoor report",
          excerpt: "More behavioral interview details from the same source.",
          url: "https://example.com/same-report",
          trustWeight: "medium",
          contradictionGroup: null,
        },
      ],
    });

    deriveStageConfidenceFromEvidence(plan);

    expect(plan.stageRoadmap[0].confidence).toBe("medium");
  });
});
