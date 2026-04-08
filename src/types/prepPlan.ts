// PrepPlan V2 — Assessment-first interview preparation model
// See plan.md for full product specification

export type IndustryFocus = "tech" | "consulting" | "finance" | "unknown";
export type Level = "junior" | "mid" | "senior_ic" | "people_manager" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type Priority = "high" | "medium" | "low";
export type AnswerGuidanceStatus = "pending" | "generated";

export type EvidenceSourceType =
  | "official_company"
  | "official_job"
  | "user_note"
  | "cv"
  | "public_report"
  | "market_heuristic";

// ── Core product object ──────────────────────────────────────

export type PrepPlan = {
  summary: {
    company: string;
    roleName: string | null;
    industryFocus: IndustryFocus;
    level: Level;
    overallConfidence: Confidence;
    weakSignalCase: boolean;
  };
  assessmentSignals: AssessmentSignal[];
  stageRoadmap: StagePlan[];
  prepPriorities: PrepPriority[];
  candidatePositioning: CandidatePositioning;
  practiceSequence: PracticeStep[];
  questionPlan: QuestionPlan;
  internalEvidenceLog: EvidenceItem[];
};

// ── Supporting contracts ─────────────────────────────────────

export type AssessmentSignal = {
  name: string;
  importance: Priority;
  rationale: string;
};

export type StagePlan = {
  stageName: string;
  orderIndex: number;
  confidence: Confidence;
  whatItTests: string[];
  whyLikely: string;
  prepPriority: Priority;
  questionThemes: string[];
  prepActions: string[];
  lowConfidenceGuidance: string | null;
};

export type PrepPriority = {
  label: string;
  priority: Priority;
  whyItMatters: string;
  recommendedActions: string[];
};

export type CandidatePositioning = {
  strengthsToLeanOn: string[];
  weakSpotsToAddress: string[];
  storyCoverageGaps: string[];
  mismatchRisks: string[];
};

export type PracticeStep = {
  orderIndex: number;
  title: string;
  objective: string;
  linkedStageNames: string[];
  linkedPriorityLabels: string[];
};

export type QuestionPlan = {
  coreMustPractice: QuestionItem[];
  likelyFollowUps: QuestionItem[];
  extraDepth: QuestionItem[];
};

export type QuestionItem = {
  question: string;
  stageName: string | null;
  linkedPriority: string;
  reason: string;
  answerGuidanceStatus: AnswerGuidanceStatus;
};

export type EvidenceItem = {
  id: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  excerpt: string;
  url: string | null;
  relevance: Priority;
  trustWeight: Priority;
  contradictionGroup: string | null;
};

// ── Database row shape (matches prep_plans table JSONB columns) ──

export type PrepPlanRow = {
  id: string;
  search_id: string;
  summary: PrepPlan["summary"];
  assessment_signals: AssessmentSignal[];
  stage_roadmap: StagePlan[];
  prep_priorities: PrepPriority[];
  candidate_positioning: CandidatePositioning;
  practice_sequence: PracticeStep[];
  question_plan: QuestionPlan;
  internal_evidence_log: EvidenceItem[];
  created_at: string;
};

// ── Practice progress tracking ───────────────────────────────

export type PracticeProgress = {
  questionsPracticed: number;
  averageSelfRating: number | null;
  coverageByPriority: {
    high: { total: number; practiced: number };
    medium: { total: number; practiced: number };
    low: { total: number; practiced: number };
  };
  readinessLabel: "just started" | "building momentum" | "good coverage" | "well prepared";
};
