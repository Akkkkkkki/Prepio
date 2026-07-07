import { describe, expect, it } from "vitest";
import {
  MIN_REAL_CANDIDATE_REPORTS,
  applyEvidenceSufficiencyGate,
  hasSufficientCandidateReportEvidence,
} from "./evidence-sufficiency.ts";

describe("hasSufficientCandidateReportEvidence", () => {
  it("requires the configured minimum number of real candidate reports", () => {
    expect(hasSufficientCandidateReportEvidence({ candidateReportCount: MIN_REAL_CANDIDATE_REPORTS - 1 })).toBe(false);
    expect(hasSufficientCandidateReportEvidence({ candidateReportCount: MIN_REAL_CANDIDATE_REPORTS })).toBe(true);
  });
});

describe("applyEvidenceSufficiencyGate", () => {
  it("forces low confidence and weak-signal mode when report evidence is thin", () => {
    const plan = {
      summary: {
        company: "Acme",
        overallConfidence: "high" as const,
        weakSignalCase: false,
      },
    };

    const gated = applyEvidenceSufficiencyGate(plan, {
      candidateReportCount: MIN_REAL_CANDIDATE_REPORTS - 1,
    });

    expect(gated.summary.overallConfidence).toBe("low");
    expect(gated.summary.weakSignalCase).toBe(true);
  });

  it("preserves model confidence when enough real candidate reports were gathered", () => {
    const plan = {
      summary: {
        company: "Acme",
        overallConfidence: "medium" as const,
        weakSignalCase: false,
      },
    };

    const gated = applyEvidenceSufficiencyGate(plan, {
      candidateReportCount: MIN_REAL_CANDIDATE_REPORTS,
    });

    expect(gated.summary.overallConfidence).toBe("medium");
    expect(gated.summary.weakSignalCase).toBe(false);
  });
});
