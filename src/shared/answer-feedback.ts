// Shared answer-feedback shapes used by the client surfaces (Practice session
// summary + History) and the searchService layer. Mirrors the structured
// feedback contract returned by the `answer-feedback` edge function
// (supabase/functions/answer-feedback/handler.ts).

export interface FeedbackItem {
  text: string;
  evidence?: string;
}

export interface StarBreakdown {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface NextAction {
  text: string;
  practicePrompt?: string;
}

export interface StructuredFeedback {
  strengths: FeedbackItem[];
  improvements: FeedbackItem[];
  starBreakdown: StarBreakdown;
  nextAction: NextAction;
}

export interface AnswerFeedback extends StructuredFeedback {
  id: string;
  practiceAnswerId: string;
  model: string | null;
  createdAt: string | null;
}

/**
 * Error codes the `answer-feedback` function can return in its JSON body.
 * The UI branches on these to show honest, non-broken states.
 */
export type AnswerFeedbackErrorCode =
  | "paid_entitlement_required"
  | "feedback_already_exists"
  | "answer_too_short"
  | "feedback_generation_failed"
  | "practice_answer_not_found"
  | "practice_context_not_found"
  | "invalid_practice_answer_id"
  | "internal_error"
  | "unknown_error";

const MAX_ITEMS = 3;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFeedbackItems(value: unknown): FeedbackItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): FeedbackItem | null => {
      if (typeof entry === "string") {
        const text = entry.trim();
        return text ? { text } : null;
      }
      if (entry && typeof entry === "object") {
        const text = asString((entry as Record<string, unknown>).text);
        if (!text) return null;
        const evidence = asString((entry as Record<string, unknown>).evidence);
        return evidence ? { text, evidence } : { text };
      }
      return null;
    })
    .filter((item): item is FeedbackItem => item !== null)
    .slice(0, MAX_ITEMS);
}

function normalizeStar(value: unknown): StarBreakdown {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    situation: asString(obj.situation),
    task: asString(obj.task),
    action: asString(obj.action),
    result: asString(obj.result),
  };
}

function normalizeNextAction(value: unknown): NextAction {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const text = asString(obj.text);
  const practicePrompt = asString(obj.practicePrompt);
  return practicePrompt ? { text, practicePrompt } : { text };
}

/**
 * Defensively coerce an arbitrary structured-feedback payload (model output or
 * a persisted DB row's JSON columns) into the typed, capped shape the UI
 * renders. Tolerates strings, missing keys, and over-long lists.
 */
export function normalizeStructuredFeedback(input: {
  strengths?: unknown;
  improvements?: unknown;
  starBreakdown?: unknown;
  star_breakdown?: unknown;
  nextAction?: unknown;
  next_action?: unknown;
}): StructuredFeedback {
  return {
    strengths: normalizeFeedbackItems(input.strengths),
    improvements: normalizeFeedbackItems(input.improvements),
    starBreakdown: normalizeStar(input.starBreakdown ?? input.star_breakdown),
    nextAction: normalizeNextAction(input.nextAction ?? input.next_action),
  };
}

/** True when there is anything worth rendering for this feedback. */
export function hasRenderableFeedback(feedback: StructuredFeedback): boolean {
  const star = feedback.starBreakdown;
  return (
    feedback.strengths.length > 0 ||
    feedback.improvements.length > 0 ||
    feedback.nextAction.text.length > 0 ||
    Boolean(star.situation || star.task || star.action || star.result)
  );
}
