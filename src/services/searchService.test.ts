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
    then: (onFulfilled: (value: { data: T; error: unknown }) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
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

const createUpdateChain = <T,>(
  result: { data?: T; error: unknown },
  onUpdate?: (payload: unknown) => void,
) => {
  const chain = {
    data: result.data,
    error: result.error,
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => result),
  };

  return {
    update: vi.fn((payload: unknown) => {
      onUpdate?.(payload);
      return chain;
    }),
  };
};

const createDeleteChain = (
  result: { error: unknown },
  onDelete?: () => void,
) => {
  const chain = {
    eq: vi.fn(async () => result),
    in: vi.fn(async () => result),
  };

  return {
    delete: vi.fn(() => {
      onDelete?.();
      return chain;
    }),
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
    expect(insertedRows[0].parsed_data).toMatchObject({
      professional: {
        currentRole: "Pasted resume text",
        summary: "Pasted resume text",
      },
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

  it("waits for the research function to acknowledge startup", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { status: "accepted" },
      error: null,
    });

    const result = await searchService.startProcessing("search-1", {
      company: "OpenAI",
      role: "Research Engineer",
      country: "United Kingdom",
      roleLinks: "https://example.com/job-1\nhttps://example.com/job-2",
      cv: "Resume text",
      targetSeniority: "senior",
    });

    expect(result).toEqual({ success: true });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("interview-research", {
      body: {
        company: "OpenAI",
        role: "Research Engineer",
        country: "United Kingdom",
        roleLinks: ["https://example.com/job-1", "https://example.com/job-2"],
        cv: "Resume text",
        level: "senior_ic",
        userNote: undefined,
        jobDescription: undefined,
        targetSeniority: "senior",
        userId: "user-1",
        searchId: "search-1",
      },
    });
  });

  it("marks the search as failed when the research function cannot be started", async () => {
    const updates: Array<Record<string, unknown>> = [];

    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("relay down"),
    });
    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain(
        { error: null },
        (payload) => updates.push(payload as Record<string, unknown>),
      ),
    );

    const result = await searchService.startProcessing("search-2", {
      company: "Stripe",
    });

    expect(result.success).toBe(false);
    expect(updates[0]).toMatchObject({
      status: "failed",
      error_message: "relay down",
    });
  });

  it("skips artifact lookups while research is still pending", async () => {
    mockSupabase.from
      .mockReturnValueOnce(
        createSelectChain({
          data: {
            id: "search-3",
            status: "pending",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createSelectChain({
          data: [],
          error: null,
        }),
      );

    const result = await searchService.getSearchResults("search-3");

    expect(result.success).toBe(true);
    expect(
      mockSupabase.from.mock.calls.map(([table]: [string]) => table),
    ).not.toContain("search_artifacts");
  });

  it("sends new V2 fields (level, userNote, jobDescription) to the research function", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { status: "accepted" },
      error: null,
    });

    await searchService.startProcessing("search-v2", {
      company: "Anthropic",
      role: "ML Engineer",
      country: "US",
      level: "senior_ic",
      userNote: "Focus on safety research",
      jobDescription: "Design alignment techniques",
      roleLinks: "https://anthropic.com/jobs/1",
      cv: "PhD in ML",
    });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("interview-research", {
      body: expect.objectContaining({
        level: "senior_ic",
        userNote: "Focus on safety research",
        jobDescription: "Design alignment techniques",
        searchId: "search-v2",
      }),
    });
  });

  it("resolves level from legacy targetSeniority when level is not set", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { status: "accepted" },
      error: null,
    });

    await searchService.startProcessing("search-legacy", {
      company: "Stripe",
      targetSeniority: "senior",
    });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("interview-research", {
      body: expect.objectContaining({
        level: "senior_ic",
        targetSeniority: "senior",
      }),
    });
  });

  it("creates a search record with V2 fields", async () => {
    const insertedRows: Array<Record<string, unknown>> = [];

    mockSupabase.from.mockReturnValueOnce(
      createInsertChain(
        { data: { id: "search-new" }, error: null },
        (payload) => insertedRows.push(payload as Record<string, unknown>),
      ),
    );

    const result = await searchService.createSearchRecord({
      company: "Google",
      role: "SRE",
      country: "UK",
      level: "people_manager",
      userNote: "Transitioning from IC",
      jobDescription: "Lead SRE team of 8",
    });

    expect(result.success).toBe(true);
    expect(insertedRows[0]).toMatchObject({
      company: "Google",
      role: "SRE",
      level: "people_manager",
      user_note: "Transitioning from IC",
      job_description: "Lead SRE team of 8",
    });
  });

  it("getPrepPlan fetches from prep_plans table", async () => {
    const fakePlan = {
      id: "plan-1",
      search_id: "search-1",
      summary: { headline: "Test plan" },
    };

    mockSupabase.from.mockReturnValueOnce(
      createSelectChain({ data: fakePlan, error: null }),
    );

    const result = await searchService.getPrepPlan("search-1");

    expect(result.success).toBe(true);
    expect(result.prepPlan).toEqual(fakePlan);
    expect(mockSupabase.from).toHaveBeenCalledWith("prep_plans");
  });

  it("getPrepPlan returns success with null when no plan exists", async () => {
    mockSupabase.from.mockReturnValueOnce(
      createSelectChain({ data: null, error: null }),
    );

    const result = await searchService.getPrepPlan("search-no-plan");

    expect(result.success).toBe(true);
    expect(result.prepPlan).toBeNull();
  });

  it("dismissBanner updates searches table", async () => {
    const updates: Array<Record<string, unknown>> = [];

    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain(
        { error: null },
        (payload) => updates.push(payload as Record<string, unknown>),
      ),
    );

    const result = await searchService.dismissBanner("search-1");

    expect(result.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("searches");
    expect(updates[0]).toEqual({ banner_dismissed: true });
  });

  it("deleteResume removes import drafts after deleting resume versions", async () => {
    const deletedTables: string[] = [];

    mockSupabase.storage.from.mockReturnValue({
      remove: vi.fn(async () => ({ error: null })),
    });
    mockSupabase.from
      .mockReturnValueOnce(
        createSelectChain({
          data: [{ id: "resume-1", file_path: "user-1/resume.pdf" }],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createDeleteChain({ error: null }, () => deletedTables.push("resumes")),
      )
      .mockReturnValueOnce(
        createDeleteChain({ error: null }, () => deletedTables.push("profile_imports")),
      )
      .mockReturnValueOnce(
        createUpdateChain({ error: null }),
      );

    const result = await searchService.deleteResume();

    expect(result.success).toBe(true);
    expect(deletedTables).toEqual(["resumes", "profile_imports"]);
  });

  it("deleteResume stops before deleting rows when file cleanup fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockSupabase.storage.from.mockReturnValue({
      remove: vi.fn(async () => ({ error: new Error("storage down") })),
    });
    mockSupabase.from.mockReturnValueOnce(
      createSelectChain({
        data: [{ id: "resume-1", file_path: "user-1/resume.pdf" }],
        error: null,
      }),
    );

    const result = await searchService.deleteResume();

    expect(result.success).toBe(false);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it("saveSelfRating updates practice_answers table", async () => {
    const updates: Array<Record<string, unknown>> = [];

    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain(
        { error: null },
        (payload) => updates.push(payload as Record<string, unknown>),
      ),
    );

    const result = await searchService.saveSelfRating("answer-1", 4);

    expect(result.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("practice_answers");
    expect(updates[0]).toEqual({ self_rating: 4 });
  });
});
