import { describe, expect, it, vi } from "vitest";
import type { Entitlement } from "../_shared/entitlement-rules.ts";
import {
  generateAnswerFeedback,
  type CandidateProfileRow,
  type FeedbackModelInput,
  type FeedbackModelResult,
  type FeedbackRow,
  type InterviewQuestionRow,
  type PracticeAnswerRow,
  type PracticeSessionRow,
  type SearchRow,
  type StructuredFeedback,
  type SupabaseError,
  type SupabaseLike,
} from "./handler.ts";

const USER_ID = "user-123";
const ANSWER_ID = "answer-123";
const SESSION_ID = "session-123";
const QUESTION_ID = "question-123";
const SEARCH_ID = "search-123";

const FREE: Entitlement = {
  tier: "free",
  cadence: null,
  status: "none",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const PAID: Entitlement = {
  tier: "paid",
  cadence: "monthly",
  status: "active",
  currentPeriodEnd: "2026-12-31T00:00:00.000Z",
  cancelAtPeriodEnd: false,
};

const question: InterviewQuestionRow = {
  id: QUESTION_ID,
  search_id: SEARCH_ID,
  question: "Tell me about a time you changed a technical direction after new evidence.",
  category: "behavioral",
  difficulty: "medium",
  suggested_answer_approach: "Use a STAR story with explicit tradeoffs.",
  good_answer_signals: ["names the evidence", "explains stakeholder alignment"],
  weak_answer_signals: ["vague outcome"],
  seniority_expectation: "Senior answers should show judgment under ambiguity.",
  sample_answer_outline: "Situation, evidence, decision, result.",
};

const search: SearchRow = {
  id: SEARCH_ID,
  company: "Acme",
  role: "Staff Product Engineer",
  level: "senior_ic",
  country: "US",
  job_description: "Lead platform initiatives and mentor engineers.",
  user_note: "Focus on architecture leadership.",
};

const profile: CandidateProfileRow = {
  user_id: USER_ID,
  headline: "Platform engineer",
  summary: "Builds developer platforms and leads migrations.",
  location: "Remote",
  experiences: [{ company: "OldCo", title: "Senior Engineer" }],
  education: [],
  skills: ["TypeScript", "architecture"],
  projects: [{ name: "Migration" }],
  preferences: { targetRoles: ["Staff Engineer"] },
  completion_score: 82,
};

const feedback: StructuredFeedback = {
  strengths: [{ text: "Clear context", evidence: "Named the migration constraint." }],
  improvements: [{ text: "Add a measurable result", evidence: "Outcome was qualitative." }],
  starBreakdown: {
    situation: "Good context.",
    task: "Task could be sharper.",
    action: "Actions were specific.",
    result: "Result needs metrics.",
  },
  nextAction: {
    text: "Rewrite the ending with one metric.",
    practicePrompt: "Add before/after latency, cost, or team velocity.",
  },
};

interface FakeDb {
  practice_answers: PracticeAnswerRow[];
  practice_sessions: PracticeSessionRow[];
  interview_questions: InterviewQuestionRow[];
  searches: SearchRow[];
  candidate_profiles: CandidateProfileRow[];
  answer_feedback: FeedbackRow[];
}

function buildDb(overrides: Partial<FakeDb> = {}): FakeDb {
  return {
    practice_answers: [
      {
        id: ANSWER_ID,
        session_id: SESSION_ID,
        question_id: QUESTION_ID,
        text_answer:
          "I changed the migration plan after production traces showed the batch approach would miss our reliability target.",
        transcript_text: null,
      },
    ],
    practice_sessions: [{ id: SESSION_ID, user_id: USER_ID, search_id: SEARCH_ID }],
    interview_questions: [question],
    searches: [search],
    candidate_profiles: [profile],
    answer_feedback: [],
    ...overrides,
  };
}

interface FakeSupabaseFailures {
  insertAnswerFeedback?: SupabaseError;
  markCurrentAnswerFeedback?: SupabaseError;
  // Row that a concurrent regeneration commits as current right before this
  // request's mark-current step, simulating the row that won the race.
  concurrentWinner?: FeedbackRow;
}

function buildFakeSupabase(db: FakeDb, failures: FakeSupabaseFailures = {}): SupabaseLike {
  return {
    from(table: string) {
      return {
        select<T>(_columns: string) {
          const filters: Array<{ column: string; value: unknown; op: "eq" | "is" }> = [];
          const builder = {
            eq(column: string, value: unknown) {
              filters.push({ column, value, op: "eq" });
              return builder;
            },
            is(column: string, value: null) {
              filters.push({ column, value, op: "is" });
              return builder;
            },
            async maybeSingle() {
              const rows = (db[table as keyof FakeDb] as unknown[]).filter((row) =>
                filters.every((filter) => {
                  const rowValue = (row as Record<string, unknown>)[filter.column];
                  return filter.op === "is" ? rowValue === filter.value : rowValue === filter.value;
                }),
              );
              return { data: (rows[0] as T) ?? null, error: null };
            },
            async single() {
              return builder.maybeSingle();
            },
          };
          return builder;
        },
        insert<T>(row: Record<string, unknown>) {
          return {
            select(_columns?: string) {
              return {
                async single() {
                  if (table === "answer_feedback" && failures.insertAnswerFeedback) {
                    return { data: null, error: failures.insertAnswerFeedback };
                  }
                  (db[table as keyof FakeDb] as unknown[]).push(row);
                  return { data: row as T, error: null };
                },
              };
            },
          };
        },
        update<T>(patch: Record<string, unknown>) {
          return {
            async eq(column: string, value: unknown) {
              if (
                table === "answer_feedback" &&
                patch.superseded_by === null &&
                failures.markCurrentAnswerFeedback
              ) {
                if (failures.concurrentWinner) {
                  db.answer_feedback.push(failures.concurrentWinner);
                }
                return { data: null, error: failures.markCurrentAnswerFeedback };
              }
              const rows = db[table as keyof FakeDb] as unknown[];
              const row = rows.find((candidate) => {
                return (candidate as Record<string, unknown>)[column] === value;
              }) as Record<string, unknown> | undefined;
              if (!row) {
                return { data: null, error: { message: "row not found" } };
              }
              Object.assign(row, patch);
              return { data: row as T, error: null };
            },
          };
        },
        delete<T>() {
          return {
            async eq(column: string, value: unknown) {
              const rows = db[table as keyof FakeDb] as unknown[];
              const index = rows.findIndex((candidate) => {
                return (candidate as Record<string, unknown>)[column] === value;
              });
              if (index === -1) {
                return { data: null, error: { message: "row not found" } };
              }
              const [removed] = rows.splice(index, 1);
              return { data: removed as T, error: null };
            },
          };
        },
      };
    },
  };
}

function buildModel(result: FeedbackModelResult = { feedback, model: "gpt-test" }) {
  const generate = vi.fn(async (_input: FeedbackModelInput) => result);
  return { generate };
}

describe("generateAnswerFeedback", () => {
  it("returns 403 for free users before any model call or feedback insert", async () => {
    const db = buildDb();
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => FREE,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result).toEqual({ ok: false, status: 403, error: "paid_entitlement_required" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(db.answer_feedback).toHaveLength(0);
  });

  it("passes question, answer, search, and candidate profile context to the model and persists feedback", async () => {
    const db = buildDb();
    const model = buildModel({ feedback, model: "gpt-feedback-test", metadata: { latencyMs: 321 } });

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result.ok).toBe(true);
    expect(model.generate).toHaveBeenCalledOnce();
    expect(model.generate.mock.calls[0][0]).toMatchObject({
      userId: USER_ID,
      practiceAnswerId: ANSWER_ID,
      practiceSessionId: SESSION_ID,
      question,
      search,
      candidateProfile: profile,
      answer: {
        textAnswer: db.practice_answers[0].text_answer,
        transcriptText: null,
        effectiveText: expect.stringContaining("production traces"),
      },
    });
    expect(db.answer_feedback).toHaveLength(1);
    expect(db.answer_feedback[0]).toMatchObject({
      user_id: USER_ID,
      practice_answer_id: ANSWER_ID,
      practice_session_id: SESSION_ID,
      question_id: QUESTION_ID,
      strengths: feedback.strengths,
      improvements: feedback.improvements,
      star_breakdown: feedback.starBreakdown,
      next_action: feedback.nextAction,
      model: "gpt-feedback-test",
      superseded_by: null,
    });
    expect(db.answer_feedback[0].generation_metadata).toMatchObject({
      latencyMs: 321,
      regenerated: false,
      input_snapshot: {
        search: { company: "Acme", role: "Staff Product Engineer" },
        candidateProfile: { headline: "Platform engineer" },
      },
    });
  });

  it("uses transcript text when a saved answer has no typed answer", async () => {
    const db = buildDb({
      practice_answers: [
        {
          id: ANSWER_ID,
          session_id: SESSION_ID,
          question_id: QUESTION_ID,
          text_answer: null,
          transcript_text:
            "The transcript explains how I aligned the team around a safer incremental launch plan.",
        },
      ],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result.ok).toBe(true);
    expect(model.generate.mock.calls[0][0].answer).toMatchObject({
      textAnswer: null,
      transcriptText: expect.stringContaining("incremental launch"),
      effectiveText: expect.stringContaining("incremental launch"),
    });
  });

  it("uses transcript text when a short typed answer accompanies a usable recording transcript", async () => {
    const db = buildDb({
      practice_answers: [
        {
          id: ANSWER_ID,
          session_id: SESSION_ID,
          question_id: QUESTION_ID,
          text_answer: "see recording",
          transcript_text:
            "The recording explains how I changed the rollout plan after reliability data showed the first approach would miss our target.",
        },
      ],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result.ok).toBe(true);
    expect(model.generate.mock.calls[0][0].answer).toMatchObject({
      textAnswer: "see recording",
      transcriptText: expect.stringContaining("reliability data"),
      effectiveText: expect.stringContaining("reliability data"),
    });
  });

  it("rejects empty or partial answers without model calls or partial feedback rows", async () => {
    const db = buildDb({
      practice_answers: [
        {
          id: ANSWER_ID,
          session_id: SESSION_ID,
          question_id: QUESTION_ID,
          text_answer: "too short",
          transcript_text: null,
        },
      ],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result).toEqual({ ok: false, status: 422, error: "answer_too_short" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(db.answer_feedback).toHaveLength(0);
  });

  it("hides answers owned by another user without generating feedback", async () => {
    const db = buildDb({
      practice_sessions: [{ id: SESSION_ID, user_id: "other-user", search_id: SEARCH_ID }],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result).toEqual({ ok: false, status: 404, error: "practice_answer_not_found" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(db.answer_feedback).toHaveLength(0);
  });

  it("rejects mismatched question and search context before model generation", async () => {
    const db = buildDb({
      interview_questions: [{ ...question, search_id: "different-search" }],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result).toEqual({ ok: false, status: 404, error: "practice_context_not_found" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(db.answer_feedback).toHaveLength(0);
  });

  it("regenerates feedback by preserving history and leaving one latest row", async () => {
    const db = buildDb({
      answer_feedback: [
        {
          id: "feedback-old",
          user_id: USER_ID,
          practice_answer_id: ANSWER_ID,
          practice_session_id: SESSION_ID,
          question_id: QUESTION_ID,
          strengths: [{ text: "Old strength" }],
          improvements: [],
          star_breakdown: feedback.starBreakdown,
          next_action: feedback.nextAction,
          model: "gpt-old",
          generation_metadata: {},
          superseded_by: null,
        },
      ],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID, regenerate: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.supersededFeedbackId).toBe("feedback-old");
    expect(db.answer_feedback).toHaveLength(2);
    expect(db.answer_feedback.find((row) => row.id === "feedback-old")?.superseded_by).toBe(
      result.feedbackId,
    );
    expect(db.answer_feedback.find((row) => row.id === result.feedbackId)?.superseded_by).toBeNull();
    expect(
      db.answer_feedback.filter(
        (row) => row.practice_answer_id === ANSWER_ID && row.superseded_by === null,
      ),
    ).toHaveLength(1);
  });

  it("refuses to create duplicate latest feedback without explicit regeneration", async () => {
    const db = buildDb({
      answer_feedback: [
        {
          id: "feedback-current",
          user_id: USER_ID,
          practice_answer_id: ANSWER_ID,
          practice_session_id: SESSION_ID,
          question_id: QUESTION_ID,
          strengths: [{ text: "Existing feedback" }],
          improvements: [],
          star_breakdown: feedback.starBreakdown,
          next_action: feedback.nextAction,
          model: "gpt-existing",
          generation_metadata: {},
          superseded_by: null,
        },
      ],
    });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result).toEqual({ ok: false, status: 409, error: "feedback_already_exists" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(db.answer_feedback).toHaveLength(1);
  });

  it("maps a concurrent first-generation unique violation to feedback already exists", async () => {
    const db = buildDb();
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db, {
          insertAnswerFeedback: {
            code: "23505",
            message: "duplicate key value violates unique constraint idx_answer_feedback_current",
          },
        }),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID },
    );

    expect(result).toEqual({ ok: false, status: 409, error: "feedback_already_exists" });
  });

  it("rolls back the losing row and repoints the chain on a regeneration race", async () => {
    const previousCurrent: FeedbackRow = {
      id: "feedback-current",
      user_id: USER_ID,
      practice_answer_id: ANSWER_ID,
      practice_session_id: SESSION_ID,
      question_id: QUESTION_ID,
      strengths: [{ text: "Existing feedback" }],
      improvements: [],
      star_breakdown: feedback.starBreakdown,
      next_action: feedback.nextAction,
      model: "gpt-existing",
      generation_metadata: {},
      superseded_by: null,
    };
    const concurrentWinner: FeedbackRow = {
      ...previousCurrent,
      id: "feedback-winner",
      strengths: [{ text: "Winning regeneration" }],
      model: "gpt-winner",
    };
    const db = buildDb({ answer_feedback: [previousCurrent] });
    const model = buildModel();

    const result = await generateAnswerFeedback(
      {
        supabase: buildFakeSupabase(db, {
          markCurrentAnswerFeedback: {
            code: "23505",
            message: "duplicate key value violates unique constraint idx_answer_feedback_current",
          },
          concurrentWinner,
        }),
        getEntitlement: async () => PAID,
        model,
      },
      { userId: USER_ID, practiceAnswerId: ANSWER_ID, regenerate: true },
    );

    expect(result).toEqual({ ok: false, status: 409, error: "feedback_already_exists" });

    // The row this request optimistically inserted must be removed so it does
    // not linger in history; only the previous current row and the winner stay.
    const ids = db.answer_feedback.map((row) => row.id).sort();
    expect(ids).toEqual(["feedback-current", "feedback-winner"]);

    // The previous current row must now point at the genuine winner rather than
    // dangling at the discarded row.
    const previous = db.answer_feedback.find((row) => row.id === "feedback-current");
    expect(previous?.superseded_by).toBe("feedback-winner");
  });
});
