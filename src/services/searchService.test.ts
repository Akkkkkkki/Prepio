import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

import {
  dedupePracticeAnswersByQuestion,
  dedupePracticeAnswersBySessionQuestion,
} from "./searchService";

describe("practice history answer dedupe helpers", () => {
  it("keeps only the latest answer per question", () => {
    const answers = dedupePracticeAnswersByQuestion([
      {
        id: "answer-1",
        question_id: "question-1",
        created_at: "2026-03-31T10:00:00.000Z",
      },
      {
        id: "answer-2",
        question_id: "question-1",
        created_at: "2026-03-31T10:05:00.000Z",
      },
      {
        id: "answer-3",
        question_id: "question-2",
        created_at: "2026-03-31T10:02:00.000Z",
      },
    ]);

    expect(answers).toEqual([
      {
        id: "answer-3",
        question_id: "question-2",
        created_at: "2026-03-31T10:02:00.000Z",
      },
      {
        id: "answer-2",
        question_id: "question-1",
        created_at: "2026-03-31T10:05:00.000Z",
      },
    ]);
  });

  it("keeps only the latest answer per session and question", () => {
    const answers = dedupePracticeAnswersBySessionQuestion([
      {
        session_id: "session-1",
        question_id: "question-1",
        created_at: "2026-03-31T10:00:00.000Z",
        answer_time_seconds: 40,
      },
      {
        session_id: "session-1",
        question_id: "question-1",
        created_at: "2026-03-31T10:10:00.000Z",
        answer_time_seconds: 65,
      },
      {
        session_id: "session-2",
        question_id: "question-1",
        created_at: "2026-03-31T10:03:00.000Z",
        answer_time_seconds: 55,
      },
    ]);

    expect(answers).toEqual([
      {
        session_id: "session-2",
        question_id: "question-1",
        created_at: "2026-03-31T10:03:00.000Z",
        answer_time_seconds: 55,
      },
      {
        session_id: "session-1",
        question_id: "question-1",
        created_at: "2026-03-31T10:10:00.000Z",
        answer_time_seconds: 65,
      },
    ]);
  });
});
