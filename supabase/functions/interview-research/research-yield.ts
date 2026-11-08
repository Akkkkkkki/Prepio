import type { ResearchRoleFamily } from "../company-research/query-planner.ts";

export interface ResearchOutcomeMetrics {
  top5QuestionCount: number;
  top5HitCount: number;
  recallMissCount: number;
}

interface ResearchYieldEventInput {
  searchId: string;
  company: string;
  level: string;
  roleFamily: ResearchRoleFamily;
  questionsExtracted: number;
  sourcesReturned: number;
  tavilyCalls: number;
  tavilyCredits: number;
  outcome?: ResearchOutcomeMetrics | null;
}

export function buildResearchYieldEvent({
  searchId,
  company,
  level,
  roleFamily,
  questionsExtracted,
  sourcesReturned,
  tavilyCalls,
  tavilyCredits,
  outcome = null,
}: ResearchYieldEventInput) {
  const hasTop5Outcome = outcome !== null && outcome.top5QuestionCount > 0;

  return {
    event: "research_yield",
    search_id: searchId,
    company,
    level,
    role_family: roleFamily,
    questions_extracted: questionsExtracted,
    sources_returned: sourcesReturned,
    tavily_calls: tavilyCalls,
    tavily_credits: tavilyCredits,
    top_5_question_count: hasTop5Outcome ? outcome.top5QuestionCount : null,
    top_5_hit_count: hasTop5Outcome ? outcome.top5HitCount : null,
    top_5_hit_rate: hasTop5Outcome
      ? outcome.top5HitCount / outcome.top5QuestionCount
      : null,
    recall_miss_count: outcome?.recallMissCount ?? null,
  };
}
