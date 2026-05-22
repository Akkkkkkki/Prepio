export type ResearchPreviewConfidence = "high" | "medium" | "low";

export interface ResearchPreviewStage {
  name: string;
  whyLikely: string;
  confidence: ResearchPreviewConfidence;
}

export interface ResearchPreviewSignal {
  name: string;
  importance: "high" | "medium" | "low";
  rationale: string;
}

export interface ResearchPreviewQuestion {
  stage: string;
  difficulty: string;
  question: string;
  rationale: string;
}

export interface ResearchPreview {
  previewId: string;
  status: "completed" | "cached";
  company: string;
  role?: string | null;
  confidence: ResearchPreviewConfidence;
  sourceSummary: string;
  stages: ResearchPreviewStage[];
  assessmentSignals: ResearchPreviewSignal[];
  questions: ResearchPreviewQuestion[];
  expiresAt: string;
}

