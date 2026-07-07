type Confidence = "high" | "medium" | "low";

export const MIN_REAL_CANDIDATE_REPORTS = 3;

export interface EvidenceSufficiencyStats {
  candidateReportCount: number;
}

export interface EvidenceSufficiencySummary {
  overallConfidence?: Confidence;
  weakSignalCase?: boolean;
}

export interface EvidenceSufficiencyPlan {
  summary?: EvidenceSufficiencySummary;
}

export function hasSufficientCandidateReportEvidence(
  stats: EvidenceSufficiencyStats,
  minReports = MIN_REAL_CANDIDATE_REPORTS,
) {
  return stats.candidateReportCount >= minReports;
}

export function applyEvidenceSufficiencyGate<T extends EvidenceSufficiencyPlan>(
  plan: T,
  stats: EvidenceSufficiencyStats,
  minReports = MIN_REAL_CANDIDATE_REPORTS,
): T {
  if (hasSufficientCandidateReportEvidence(stats, minReports)) {
    return plan;
  }

  return {
    ...plan,
    summary: {
      ...plan.summary,
      overallConfidence: "low",
      weakSignalCase: true,
    },
  };
}
