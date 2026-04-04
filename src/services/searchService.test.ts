import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import {
  dedupePracticeAnswersByQuestion,
  dedupePracticeAnswersBySessionQuestion,
  searchService,
} from "./searchService";

const createSelectChain = <T,>(result: { data: T; error: unknown }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };

  return chain;
};

const createInsertChain = <T,>(
  result: { data: T; error: unknown },
  onInsert?: (payload: unknown) => void,
) => {
  const chain = {
    select: vi.fn(() => chain),
    single: vi.fn(async () => result),
  };

  return {
    insert: vi.fn((payload: unknown) => {
      onInsert?.(payload);
      return chain;
    }),
  };
};

const createUpdateChain = <T,>(result: { data?: T; error: unknown }) => {
  const chain = {
    data: result.data,
    error: result.error,
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => result),
  };

  return {
    update: vi.fn(() => chain),
  };
};

describe("practice history answer dedupe helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

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

  it("does not carry uploaded file metadata into a pasted resume version", async () => {
    const insertedRows: Array<Record<string, unknown>> = [];

    mockSupabase.from
      .mockReturnValueOnce(
        createSelectChain({
          data: [
            {
              id: "resume-old",
              file_name: "resume.pdf",
              file_path: "user-1/resume.pdf",
              file_size_bytes: 123,
              mime_type: "application/pdf",
              parsed_data: { personalInfo: { location: "London" } },
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createInsertChain(
          {
            data: { id: "resume-new" },
            error: null,
          },
          (payload) => insertedRows.push(payload as Record<string, unknown>),
        ),
      )
      .mockReturnValueOnce(
        createUpdateChain({
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createUpdateChain({
          data: { id: "resume-new", file_name: null, file_path: null, is_active: true },
          error: null,
        }),
      );

    const result = await searchService.saveResume({
      content: "Pasted resume text",
      source: "manual",
    });

    expect(result.success).toBe(true);
    expect(insertedRows[0]).toMatchObject({
      content: "Pasted resume text",
      file_name: null,
      file_path: null,
      source: "manual",
      is_active: false,
    });
  });

  it("keeps the current active resume untouched when replacement insert fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockSupabase.from
      .mockReturnValueOnce(
        createSelectChain({
          data: [
            {
              id: "resume-old",
              file_name: "resume.pdf",
              file_path: "user-1/resume.pdf",
              file_size_bytes: 123,
              mime_type: "application/pdf",
              parsed_data: null,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createInsertChain({
          data: null,
          error: new Error("insert failed"),
        }),
      );

    const result = await searchService.saveResume({
      content: "Replacement content",
      file: {
        name: "resume-new.pdf",
        path: "user-1/resume-new.pdf",
        size: 456,
        mimeType: "application/pdf",
      },
      source: "upload",
    });

    expect(result.success).toBe(false);
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });
});
