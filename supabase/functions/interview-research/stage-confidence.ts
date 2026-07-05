import { normalizeStageName } from "./prep-plan-validation.ts";

type Confidence = "high" | "medium" | "low";
type Priority = "high" | "medium" | "low";

interface StagePlanLike {
  stageName?: string;
  confidence?: Confidence;
  whatItTests?: string[];
  whyLikely?: string;
  questionThemes?: string[];
  lowConfidenceGuidance?: string | null;
}

interface EvidenceItemLike {
  id?: string;
  sourceType?: string;
  sourceLabel?: string;
  excerpt?: string;
  url?: string | null;
  relevance?: Priority;
  trustWeight?: Priority;
  contradictionGroup?: string | null;
}

interface PrepPlanLike {
  summary?: {
    overallConfidence?: Confidence;
    weakSignalCase?: boolean;
  };
  stageRoadmap?: StagePlanLike[];
  internalEvidenceLog?: EvidenceItemLike[];
}

interface StageEvidenceScore {
  confidence: Confidence;
  corroboratingSources: number;
  contradictingSources: number;
  weightedCorroboration: number;
}

const NON_CORROBORATING_SOURCE_TYPES = new Set(["cv", "market_heuristic"]);
const OFFICIAL_SOURCE_TYPES = new Set(["official_company", "official_job"]);

const LOOP_SHAPES = [
  {
    id: "recruiter_screen",
    patterns: [
      /\brecruiter\b/i,
      /\btalent\s+(?:screen|call|conversation)\b/i,
      /\bhr\s+(?:screen|call|round)\b/i,
      /\bphone\s+screen\b/i,
      /\binitial\s+(?:screen|call)\b/i,
    ],
  },
  {
    id: "hiring_manager",
    patterns: [
      /\bhiring\s+manager\b/i,
      /\bmanager\s+(?:screen|call|round|interview)\b/i,
      /\bteam\s+lead\b/i,
    ],
  },
  {
    id: "take_home",
    exclusiveGroup: "technical_assessment_format",
    patterns: [
      /\btake[-\s]?home\b/i,
      /\bhomework\b/i,
      /\bassignment\b/i,
      /\bcase\s+study\b/i,
      /\bwork\s+sample\b/i,
    ],
  },
  {
    id: "live_coding",
    exclusiveGroup: "technical_assessment_format",
    patterns: [
      /\blive\s+cod(?:e|ing)\b/i,
      /\bcoding\s+(?:round|interview|screen|challenge)\b/i,
      /\bpair(?:ing|ed)?\s+(?:programming|coding)\b/i,
      /\bwhiteboard(?:ing)?\b/i,
      /\balgorithm(?:s|ic)?\b/i,
    ],
  },
  {
    id: "system_design",
    patterns: [
      /\bsystem\s+design\b/i,
      /\barchitecture\s+(?:round|interview|design)\b/i,
      /\bdesign\s+(?:a|an)\b/i,
      /\bscal(?:e|ability|able)\b/i,
    ],
  },
  {
    id: "behavioral",
    patterns: [
      /\bbehavioral\b/i,
      /\bbehavioural\b/i,
      /\bvalues?\b/i,
      /\bculture\s+(?:fit|add)\b/i,
      /\bleadership\b/i,
      /\bcollaboration\b/i,
      /\btell me about a time\b/i,
    ],
  },
  {
    id: "onsite",
    patterns: [
      /\bonsite\b/i,
      /\bon-site\b/i,
      /\bpanel\b/i,
      /\bloop\b/i,
      /\bfinal\s+(?:round|interview|loop)\b/i,
    ],
  },
  {
    id: "presentation",
    patterns: [
      /\bpresentation\b/i,
      /\bpresent\s+(?:a|the|your)\b/i,
      /\bportfolio\s+review\b/i,
      /\bcritique\b/i,
    ],
  },
] as const;

function textForStage(stage: StagePlanLike): string {
  return [
    stage.stageName,
    stage.whyLikely,
    ...(stage.whatItTests || []),
    ...(stage.questionThemes || []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function textForEvidence(item: EvidenceItemLike): string {
  return [item.sourceLabel, item.excerpt]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function patternMatchesAffirmatively(pattern: RegExp, text: string): boolean {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return false;

  const prefix = text.slice(Math.max(0, match.index - 40), match.index);
  return !/\b(?:no|not|without|never|didn't|did not|isn't|wasn't)\W+(?:\w+\W+){0,3}$/i.test(prefix);
}

function shapeIdsFor(text: string): Set<string> {
  const ids = new Set<string>();
  LOOP_SHAPES.forEach((shape) => {
    if (shape.patterns.some((pattern) => patternMatchesAffirmatively(pattern, text))) {
      ids.add(shape.id);
    }
  });
  return ids;
}

function groupForShape(shapeId: string): string | null {
  return LOOP_SHAPES.find((shape) => shape.id === shapeId)?.exclusiveGroup ?? null;
}

function isUsableStageEvidence(item: EvidenceItemLike): boolean {
  return !NON_CORROBORATING_SOURCE_TYPES.has(item.sourceType || "");
}

function evidenceSourceKey(item: EvidenceItemLike, index: number): string {
  return item.url || item.sourceLabel || item.id || `evidence-${index}`;
}

function evidenceWeight(item: EvidenceItemLike): number {
  if (OFFICIAL_SOURCE_TYPES.has(item.sourceType || "")) return 2;
  if (item.sourceType === "user_note") return 1.5;
  return 1;
}

function hasStageNameMatch(stage: StagePlanLike, evidenceText: string): boolean {
  const stageName = normalizeStageName(stage.stageName);
  if (!stageName) return false;

  const normalizedEvidence = normalizeStageName(evidenceText);
  if (normalizedEvidence.includes(stageName)) return true;

  return stageName
    .split(/\s+/)
    .filter((word) => word.length >= 5)
    .some((word) => normalizedEvidence.includes(word));
}

function scoreStage(stage: StagePlanLike, evidence: EvidenceItemLike[]): StageEvidenceScore {
  const stageShapes = shapeIdsFor(textForStage(stage));
  const corroborating = new Map<string, number>();
  const contradicting = new Map<string, number>();

  evidence.forEach((item, index) => {
    if (!isUsableStageEvidence(item)) return;

    const evidenceText = textForEvidence(item);
    const evidenceShapes = shapeIdsFor(evidenceText);
    const sourceKey = evidenceSourceKey(item, index);
    const shapeOverlap = [...stageShapes].some((shape) => evidenceShapes.has(shape));
    const nameOverlap = hasStageNameMatch(stage, evidenceText);

    if (shapeOverlap || nameOverlap) {
      corroborating.set(sourceKey, Math.max(corroborating.get(sourceKey) || 0, evidenceWeight(item)));
      return;
    }

    const conflictingGroup = [...stageShapes]
      .map(groupForShape)
      .filter((group): group is string => Boolean(group))
      .find((group) => [...evidenceShapes].some((shape) => groupForShape(shape) === group));

    if (conflictingGroup) {
      contradicting.set(sourceKey, Math.max(contradicting.get(sourceKey) || 0, evidenceWeight(item)));
      item.contradictionGroup = conflictingGroup;
    }
  });

  const weightedCorroboration = [...corroborating.values()].reduce((sum, value) => sum + value, 0);
  const weightedContradiction = [...contradicting.values()].reduce((sum, value) => sum + value, 0);

  let confidence: Confidence = "low";
  if (weightedCorroboration >= 2) confidence = "high";
  else if (weightedCorroboration >= 1) confidence = "medium";

  if (weightedContradiction >= weightedCorroboration && weightedContradiction > 0) {
    confidence = weightedCorroboration > 0 ? "medium" : "low";
  }

  return {
    confidence,
    corroboratingSources: corroborating.size,
    contradictingSources: contradicting.size,
    weightedCorroboration,
  };
}

function combineOverallConfidence(scores: StageEvidenceScore[]): Confidence {
  if (scores.length === 0) return "low";
  if (scores.every((score) => score.confidence === "high")) return "high";
  if (scores.some((score) => score.confidence === "medium" || score.confidence === "high")) return "medium";
  return "low";
}

function lowConfidenceGuidanceFor(score: StageEvidenceScore): string {
  if (score.contradictingSources > 0) {
    return "Reports differ on this stage format, so treat it as a hypothesis and prepare the nearby alternatives.";
  }
  return "No independent source corroborates this stage yet; use it as a role-norm hypothesis until stronger evidence appears.";
}

export function deriveStageConfidenceFromEvidence<T extends PrepPlanLike>(plan: T): T {
  const stages = plan.stageRoadmap || [];
  const evidence = plan.internalEvidenceLog || [];
  const scores = stages.map((stage) => scoreStage(stage, evidence));

  stages.forEach((stage, index) => {
    const score = scores[index];
    stage.confidence = score.confidence;
    if (score.confidence === "low" && !stage.lowConfidenceGuidance) {
      stage.lowConfidenceGuidance = lowConfidenceGuidanceFor(score);
    }
  });

  if (plan.summary) {
    plan.summary.overallConfidence = combineOverallConfidence(scores);
    plan.summary.weakSignalCase = scores.every((score) => score.weightedCorroboration < 1);
  }

  return plan;
}
