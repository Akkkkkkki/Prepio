export type Confidence = "high" | "medium" | "low";
export type Priority = "high" | "medium" | "low";
export type AnswerGuidanceStatus = "pending" | "generated";

export interface AssessmentSignal {
  name: string;
  importance: Priority;
  rationale: string;
}

export interface PrepPriority {
  label: string;
  priority: Priority;
  whyItMatters: string;
  recommendedActions: string[];
}

export interface CandidatePositioning {
  strengthsToLeanOn?: string[];
  weakSpotsToAddress?: string[];
  storyCoverageGaps?: string[];
  mismatchRisks?: string[];
}

export interface QuestionPlanItem {
  question: string;
  stageName: string | null;
  linkedPriority: string;
  reason: string;
  answerGuidanceStatus: AnswerGuidanceStatus;
}

export interface QuestionPlan {
  coreMustPractice: QuestionPlanItem[];
  likelyFollowUps: QuestionPlanItem[];
  extraDepth: QuestionPlanItem[];
}

export interface PrepPlanSummary {
  company: string;
  roleName: string | null;
  overallConfidence: Confidence;
  weakSignalCase: boolean;
  overallFitScore?: number | null;
}

export interface StagePlan {
  stageName: string;
  orderIndex: number;
  confidence: Confidence;
  whatItTests: string[];
  whyLikely: string;
  prepPriority: Priority;
  questionThemes: string[];
  prepActions: string[];
  lowConfidenceGuidance: string | null;
}

export interface PrepPlanRow {
  id: string;
  search_id: string;
  user_id: string;
  summary: PrepPlanSummary;
  assessment_signals: AssessmentSignal[];
  stage_roadmap: StagePlan[];
  prep_priorities: PrepPriority[];
  candidate_positioning: CandidatePositioning | null;
  question_plan: QuestionPlan;
  created_at: string;
}
