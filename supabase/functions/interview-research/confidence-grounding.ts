export type Confidence = "high" | "medium" | "low";

export interface ConfidenceGroundingEvidence {
  retrievedSourceCount: number;
  hasExtractedJobRequirements: boolean;
  hasUserNote: boolean;
  hasJobDescription: boolean;
  hasCv: boolean;
}

export interface ConfidenceGroundingResult {
  maxConfidence: Confidence;
  weakSignalCase: boolean;
  retrievedSourceCount: number;
  evidenceClasses: string[];
  reason: string;
}

interface PrepPlanConfidenceShape {
  summary: {
    overallConfidence: Confidence;
    weakSignalCase: boolean;
    confidenceGrounding?: ConfidenceGroundingResult;
  };
  stageRoadmap?: Array<{
    confidence: Confidence;
    lowConfidenceGuidance?: string | null;
  }>;
}

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const LOW_CONFIDENCE_GUIDANCE =
  "Evidence is thin for this stage; treat it as a role-norm hypothesis and validate it with recruiter or interviewer signals.";

function normalizedRetrievedSourceCount(evidence: ConfidenceGroundingEvidence): number {
  return Number.isFinite(evidence.retrievedSourceCount)
    ? Math.max(0, Math.floor(evidence.retrievedSourceCount))
    : 0;
}

function evidenceClassesFor(evidence: ConfidenceGroundingEvidence): string[] {
  const classes: string[] = [];
  if (normalizedRetrievedSourceCount(evidence) >= 3) classes.push("retrieved_sources");
  if (evidence.hasExtractedJobRequirements) classes.push("job_requirements");
  if (evidence.hasUserNote || evidence.hasJobDescription) classes.push("user_provided_context");
  if (evidence.hasCv) classes.push("candidate_cv");
  return classes;
}

function capConfidence(value: Confidence, maxConfidence: Confidence): Confidence {
  return CONFIDENCE_RANK[value] > CONFIDENCE_RANK[maxConfidence] ? maxConfidence : value;
}

export function computeConfidenceGrounding(
  evidence: ConfidenceGroundingEvidence,
): ConfidenceGroundingResult {
  const retrievedSourceCount = normalizedRetrievedSourceCount(evidence);
  const evidenceClasses = evidenceClassesFor(evidence);

  if (retrievedSourceCount >= 5 && evidenceClasses.length >= 2) {
    return {
      maxConfidence: "high",
      weakSignalCase: false,
      retrievedSourceCount,
      evidenceClasses,
      reason: "Multiple retrieved sources plus another evidence class support high confidence.",
    };
  }

  if (retrievedSourceCount > 0 || evidenceClasses.length >= 2) {
    return {
      maxConfidence: "medium",
      weakSignalCase: true,
      retrievedSourceCount,
      evidenceClasses,
      reason: "Evidence exists but is not corroborated enough for high confidence.",
    };
  }

  return {
    maxConfidence: "low",
    weakSignalCase: true,
    retrievedSourceCount,
    evidenceClasses,
    reason: "No retrieved sources or corroborating first-party evidence were available.",
  };
}

export function applyConfidenceGrounding<T extends PrepPlanConfidenceShape>(
  plan: T,
  evidence: ConfidenceGroundingEvidence,
): T {
  const grounding = computeConfidenceGrounding(evidence);
  const next: T = {
    ...plan,
    summary: {
      ...plan.summary,
      overallConfidence: capConfidence(plan.summary.overallConfidence, grounding.maxConfidence),
      weakSignalCase: plan.summary.weakSignalCase || grounding.weakSignalCase,
      confidenceGrounding: grounding,
    },
    stageRoadmap: (plan.stageRoadmap || []).map((stage) => {
      const confidence = capConfidence(stage.confidence, grounding.maxConfidence);
      return {
        ...stage,
        confidence,
        lowConfidenceGuidance:
          confidence === "low"
            ? (stage.lowConfidenceGuidance || LOW_CONFIDENCE_GUIDANCE)
            : (stage.lowConfidenceGuidance ?? null),
      };
    }),
  };

  return next;
}
