import type { Entitlement } from "../_shared/entitlement-rules.ts";

export interface SupabaseError {
  message?: string;
  code?: string;
}

interface QueryResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SelectBuilder<T> {
  eq: (column: string, value: unknown) => SelectBuilder<T>;
  is: (column: string, value: null) => SelectBuilder<T>;
  maybeSingle: () => Promise<QueryResult<T>>;
  single: () => Promise<QueryResult<T>>;
}

interface InsertBuilder<T> {
  select: (columns?: string) => {
    single: () => Promise<QueryResult<T>>;
  };
}

interface UpdateBuilder<T> {
  eq: (column: string, value: unknown) => Promise<QueryResult<T>>;
}

interface DeleteBuilder<T> {
  eq: (column: string, value: unknown) => Promise<QueryResult<T>>;
}

interface TableBuilder {
  select: <T>(columns: string) => SelectBuilder<T>;
  insert: <T>(row: Record<string, unknown>) => InsertBuilder<T>;
  update: <T>(row: Record<string, unknown>) => UpdateBuilder<T>;
  delete: <T>() => DeleteBuilder<T>;
}

export interface SupabaseLike {
  from: (table: string) => TableBuilder;
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<QueryResult<T>>;
}

export interface PracticeAnswerRow {
  id: string;
  session_id: string;
  question_id: string;
  text_answer: string | null;
  transcript_text: string | null;
}

export interface PracticeSessionRow {
  id: string;
  user_id: string;
  search_id: string;
}

export interface SearchRow {
  id: string;
  company: string;
  role: string | null;
  level: string | null;
  country: string | null;
  job_description: string | null;
  user_note: string | null;
}

export interface InterviewQuestionRow {
  id: string;
  search_id: string;
  question: string;
  category: string | null;
  difficulty: string | null;
  suggested_answer_approach: string | null;
  good_answer_signals: string[] | null;
  weak_answer_signals: string[] | null;
  seniority_expectation: string | null;
  sample_answer_outline: string | null;
}

export interface CandidateProfileRow {
  user_id: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  experiences: unknown;
  education: unknown;
  skills: unknown;
  projects: unknown;
  preferences: unknown;
  completion_score: number | null;
}

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

export interface FeedbackModelInput {
  userId: string;
  practiceAnswerId: string;
  practiceSessionId: string;
  question: InterviewQuestionRow;
  answer: {
    textAnswer: string | null;
    transcriptText: string | null;
    effectiveText: string;
  };
  search: SearchRow;
  candidateProfile: CandidateProfileRow | null;
}

export interface FeedbackModelResult {
  feedback: StructuredFeedback;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackModel {
  generate: (input: FeedbackModelInput) => Promise<FeedbackModelResult>;
}

export interface Deps {
  supabase: SupabaseLike;
  getEntitlement: (userId: string) => Promise<Entitlement>;
  model: FeedbackModel;
  log?: (event: string, fields?: Record<string, unknown>) => void;
}

export interface GenerateAnswerFeedbackRequest {
  userId: string;
  practiceAnswerId: unknown;
  regenerate?: boolean;
}

export type GenerateAnswerFeedbackResult =
  | {
      ok: true;
      feedbackId: string;
      supersededFeedbackId: string | null;
      feedback: StructuredFeedback;
    }
  | { ok: false; status: number; error: string };

export interface FeedbackRow {
  id: string;
  user_id: string;
  practice_answer_id: string;
  practice_session_id: string;
  question_id: string;
  strengths: FeedbackItem[];
  improvements: FeedbackItem[];
  star_breakdown: StarBreakdown;
  next_action: NextAction;
  model: string | null;
  generation_metadata: Record<string, unknown>;
  superseded_by: string | null;
}

const MIN_ANSWER_CHARS = 20;

function normalizeId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAnswer(textAnswer: string | null, transcriptText: string | null): string {
  const typedAnswer = textAnswer?.trim() ?? "";
  const transcriptAnswer = transcriptText?.trim() ?? "";
  const answer =
    typedAnswer.length >= MIN_ANSWER_CHARS || !transcriptAnswer ? typedAnswer : transcriptAnswer;

  return answer.replace(/\s+/g, " ");
}

function hasUsableAnswer(textAnswer: string | null, transcriptText: string | null): boolean {
  return normalizeAnswer(textAnswer, transcriptText).length >= MIN_ANSWER_CHARS;
}

function isUniqueViolation(error: SupabaseError | null): boolean {
  return error?.code === "23505";
}

function toDbFeedback(feedback: StructuredFeedback) {
  return {
    strengths: feedback.strengths,
    improvements: feedback.improvements,
    star_breakdown: feedback.starBreakdown,
    next_action: feedback.nextAction,
  };
}

async function readSingle<T>(
  supabase: SupabaseLike,
  table: string,
  columns: string,
  filters: Array<[string, unknown]>,
): Promise<QueryResult<T>> {
  let query = supabase.from(table).select<T>(columns);
  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }
  return query.maybeSingle();
}

export async function generateAnswerFeedback(
  deps: Deps,
  req: GenerateAnswerFeedbackRequest,
): Promise<GenerateAnswerFeedbackResult> {
  const practiceAnswerId = normalizeId(req.practiceAnswerId);
  if (!practiceAnswerId) {
    return { ok: false, status: 400, error: "invalid_practice_answer_id" };
  }

  const entitlement = await deps.getEntitlement(req.userId);
  if (entitlement.tier !== "paid") {
    deps.log?.("answer_feedback_blocked_free_user", { userId: req.userId, practiceAnswerId });
    return { ok: false, status: 403, error: "paid_entitlement_required" };
  }

  const answerResult = await readSingle<PracticeAnswerRow>(
    deps.supabase,
    "practice_answers",
    "id, session_id, question_id, text_answer, transcript_text",
    [["id", practiceAnswerId]],
  );
  if (answerResult.error) {
    deps.log?.("answer_feedback_answer_read_failed", { message: answerResult.error.message });
    return { ok: false, status: 500, error: "internal_error" };
  }
  if (!answerResult.data) {
    return { ok: false, status: 404, error: "practice_answer_not_found" };
  }

  const answer = answerResult.data;
  if (!hasUsableAnswer(answer.text_answer, answer.transcript_text)) {
    return { ok: false, status: 422, error: "answer_too_short" };
  }

  const sessionResult = await readSingle<PracticeSessionRow>(
    deps.supabase,
    "practice_sessions",
    "id, user_id, search_id",
    [["id", answer.session_id]],
  );
  if (sessionResult.error) {
    deps.log?.("answer_feedback_session_read_failed", { message: sessionResult.error.message });
    return { ok: false, status: 500, error: "internal_error" };
  }
  if (!sessionResult.data || sessionResult.data.user_id !== req.userId) {
    return { ok: false, status: 404, error: "practice_answer_not_found" };
  }

  const [questionResult, searchResult, profileResult, currentFeedbackResult] = await Promise.all([
    readSingle<InterviewQuestionRow>(
      deps.supabase,
      "interview_questions",
      "id, search_id, question, category, difficulty, suggested_answer_approach, good_answer_signals, weak_answer_signals, seniority_expectation, sample_answer_outline",
      [["id", answer.question_id]],
    ),
    readSingle<SearchRow>(
      deps.supabase,
      "searches",
      "id, company, role, level, country, job_description, user_note",
      [["id", sessionResult.data.search_id]],
    ),
    readSingle<CandidateProfileRow>(
      deps.supabase,
      "candidate_profiles",
      "user_id, headline, summary, location, experiences, education, skills, projects, preferences, completion_score",
      [["user_id", req.userId]],
    ),
    deps.supabase
      .from("answer_feedback")
      .select<FeedbackRow>("id, superseded_by")
      .eq("practice_answer_id", practiceAnswerId)
      .is("superseded_by", null)
      .maybeSingle(),
  ]);

  if (questionResult.error || searchResult.error || profileResult.error || currentFeedbackResult.error) {
    deps.log?.("answer_feedback_context_read_failed", {
      question: questionResult.error?.message,
      search: searchResult.error?.message,
      profile: profileResult.error?.message,
      current: currentFeedbackResult.error?.message,
    });
    return { ok: false, status: 500, error: "internal_error" };
  }
  if (!questionResult.data || !searchResult.data || questionResult.data.search_id !== searchResult.data.id) {
    return { ok: false, status: 404, error: "practice_context_not_found" };
  }

  const currentFeedbackId = currentFeedbackResult.data?.id ?? null;
  if (currentFeedbackId && !req.regenerate) {
    return { ok: false, status: 409, error: "feedback_already_exists" };
  }

  const modelInput: FeedbackModelInput = {
    userId: req.userId,
    practiceAnswerId,
    practiceSessionId: answer.session_id,
    question: questionResult.data,
    answer: {
      textAnswer: answer.text_answer,
      transcriptText: answer.transcript_text,
      effectiveText: normalizeAnswer(answer.text_answer, answer.transcript_text),
    },
    search: searchResult.data,
    candidateProfile: profileResult.data ?? null,
  };

  let modelResult: FeedbackModelResult;
  try {
    modelResult = await deps.model.generate(modelInput);
  } catch (err) {
    deps.log?.("answer_feedback_generation_failed", {
      userId: req.userId,
      practiceAnswerId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 502, error: "feedback_generation_failed" };
  }

  const newFeedbackId = crypto.randomUUID();
  const dbFeedback = toDbFeedback(modelResult.feedback);
  const metadata = {
    ...(modelResult.metadata ?? {}),
    regenerated: Boolean(currentFeedbackId),
    input_snapshot: modelInput,
  };

  const rpcResult = await deps.supabase.rpc<FeedbackRow>("create_answer_feedback_atomic", {
    p_feedback_id: newFeedbackId,
    p_user_id: req.userId,
    p_practice_answer_id: practiceAnswerId,
    p_practice_session_id: answer.session_id,
    p_question_id: answer.question_id,
    p_strengths: dbFeedback.strengths,
    p_improvements: dbFeedback.improvements,
    p_star_breakdown: dbFeedback.star_breakdown,
    p_next_action: dbFeedback.next_action,
    p_model: modelResult.model,
    p_generation_metadata: metadata,
    p_expected_current_feedback_id: currentFeedbackId,
  });

  if (rpcResult.error || !rpcResult.data) {
    deps.log?.("answer_feedback_atomic_insert_failed", {
      code: rpcResult.error?.code,
      message: rpcResult.error?.message,
    });
    if (isUniqueViolation(rpcResult.error)) {
      return { ok: false, status: 409, error: "feedback_already_exists" };
    }
    return { ok: false, status: 500, error: "internal_error" };
  }

  deps.log?.("answer_feedback_generated", {
    userId: req.userId,
    practiceAnswerId,
    feedbackId: rpcResult.data.id,
    regenerated: Boolean(currentFeedbackId),
  });

  return {
    ok: true,
    feedbackId: newFeedbackId,
    supersededFeedbackId: currentFeedbackId,
    feedback: modelResult.feedback,
  };
}
