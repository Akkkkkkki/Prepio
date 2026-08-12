import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  buildInterviewSummaries,
  dedupePracticeAnswersByQuestion,
  dedupePracticeAnswersBySessionQuestion,
  searchService,
} from "./searchService";

const createSelectChain = <T,>(result: { data: T; error: unknown }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
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
  onEq?: (column: string, value: unknown) => void,
) => {
  const chain = {
    data: result.data,
    error: result.error,
    eq: vi.fn((column: string, value: unknown) => {
      onEq?.(column, value);
      return chain;
    }),
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
    vi.useRealTimers();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("builds interview-card progress from answers, flags, and low self-ratings", () => {
    const summaries = buildInterviewSummaries({
      searches: [
        {
          id: "search-1",
          company: "Stripe",
          role: "Senior Product Manager",
          status: "completed",
          created_at: "2026-06-20T10:00:00.000Z",
        },
      ],
      questions: [
        { id: "question-1", search_id: "search-1" },
        { id: "question-2", search_id: "search-1" },
        { id: "question-3", search_id: "search-1" },
      ],
      sessions: [
        { id: "session-1", search_id: "search-1" },
        { id: "session-2", search_id: "search-1" },
      ],
      answers: [
        {
          session_id: "session-1",
          question_id: "question-1",
          self_rating: 4,
          created_at: "2026-06-20T10:10:00.000Z",
        },
        {
          session_id: "session-1",
          question_id: "question-2",
          self_rating: 2,
          created_at: "2026-06-20T10:15:00.000Z",
        },
        {
          session_id: "session-2",
          question_id: "question-2",
          self_rating: 3,
          created_at: "2026-06-20T11:00:00.000Z",
        },
      ],
      flags: [
        { question_id: "question-1", flag_type: "needs_work" },
        { question_id: "question-2", flag_type: "needs_work" },
      ],
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        id: "search-1",
        totalQuestions: 3,
        practicedQuestions: 2,
        progressPercent: 67,
        needsWorkCount: 2,
        state: "in_progress",
      }),
    ]);
  });

  it("prioritizes research status over practice progress when building interview-card states", () => {
    const summaries = buildInterviewSummaries({
      searches: [
        {
          id: "completed-search",
          company: "Stripe",
          role: "Senior Product Manager",
          status: "completed",
          created_at: "2026-06-20T10:00:00.000Z",
        },
        {
          id: "processing-search",
          company: "Linear",
          role: "Staff Engineer",
          status: "processing",
          created_at: "2026-06-21T10:00:00.000Z",
        },
        {
          id: "pending-search",
          company: "Anthropic",
          role: "Product Engineer",
          status: "pending",
          created_at: "2026-06-22T10:00:00.000Z",
        },
        {
          id: "failed-search",
          company: "OpenAI",
          role: "Engineering Manager",
          status: "failed",
          created_at: "2026-06-23T10:00:00.000Z",
        },
      ],
      questions: [
        { id: "completed-question", search_id: "completed-search" },
        { id: "processing-question", search_id: "processing-search" },
        { id: "pending-question", search_id: "pending-search" },
        { id: "failed-question", search_id: "failed-search" },
      ],
      sessions: [
        { id: "processing-session", search_id: "processing-search" },
        { id: "failed-session", search_id: "failed-search" },
      ],
      answers: [
        {
          session_id: "processing-session",
          question_id: "processing-question",
          self_rating: 4,
          created_at: "2026-06-21T10:15:00.000Z",
        },
        {
          session_id: "failed-session",
          question_id: "failed-question",
          self_rating: 4,
          created_at: "2026-06-23T10:15:00.000Z",
        },
      ],
      flags: [],
    });

    expect(Object.fromEntries(summaries.map((summary) => [summary.id, summary.state]))).toEqual({
      "completed-search": "plan_ready",
      "processing-search": "processing",
      "pending-search": "processing",
      "failed-search": "failed",
    });
  });

  it("loads interview summaries from user-scoped searches, sessions, and flags", async () => {
    const searchesChain = createSelectChain({
      data: [
        {
          id: "search-1",
          company: "Stripe",
          role: "Senior Product Manager",
          status: "completed",
          created_at: "2026-06-20T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const questionsChain = createSelectChain({
      data: [{ id: "question-1", search_id: "search-1" }],
      error: null,
    });
    const sessionsChain = createSelectChain({
      data: [{ id: "session-1", search_id: "search-1" }],
      error: null,
    });
    const answersChain = createSelectChain({
      data: [
        {
          session_id: "session-1",
          question_id: "question-1",
          self_rating: 2,
          created_at: "2026-06-20T11:00:00.000Z",
        },
      ],
      error: null,
    });
    const flagsChain = createSelectChain({
      data: [],
      error: null,
    });

    mockSupabase.from
      .mockReturnValueOnce(searchesChain)
      .mockReturnValueOnce(questionsChain)
      .mockReturnValueOnce(sessionsChain)
      .mockReturnValueOnce(answersChain)
      .mockReturnValueOnce(flagsChain);

    const result = await searchService.getInterviewSummaries();

    expect(searchesChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(sessionsChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(flagsChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toEqual({
      success: true,
      interviews: [
        expect.objectContaining({
          id: "search-1",
          practicedQuestions: 1,
          progressPercent: 100,
          needsWorkCount: 1,
          state: "in_progress",
        }),
      ],
    });
  });

  it("collects question ids whose latest answer scored 2 or less", async () => {
    const sessionsChain = createSelectChain({
      data: [{ id: "session-1" }, { id: "session-2" }],
      error: null,
    });
    const answersChain = createSelectChain({
      data: [
        // question-1: latest is 4 → cleared
        {
          question_id: "question-1",
          self_rating: 1,
          created_at: "2026-06-20T10:00:00.000Z",
        },
        {
          question_id: "question-1",
          self_rating: 4,
          created_at: "2026-06-21T10:00:00.000Z",
        },
        // question-2: latest is 2 → low-rated
        {
          question_id: "question-2",
          self_rating: 2,
          created_at: "2026-06-21T09:00:00.000Z",
        },
        // question-3: never rated → skipped
        {
          question_id: "question-3",
          self_rating: null,
          created_at: "2026-06-21T09:30:00.000Z",
        },
      ],
      error: null,
    });

    mockSupabase.from
      .mockReturnValueOnce(sessionsChain)
      .mockReturnValueOnce(answersChain);

    const result = await searchService.getLowRatedQuestionIds("search-1");

    expect(sessionsChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(sessionsChain.eq).toHaveBeenCalledWith("search_id", "search-1");
    expect(result).toEqual({ ids: ["question-2"], success: true });
  });

  it("returns an empty id set when the interview has no practice sessions yet", async () => {
    const sessionsChain = createSelectChain({ data: [], error: null });

    mockSupabase.from.mockReturnValueOnce(sessionsChain);

    const result = await searchService.getLowRatedQuestionIds("search-empty");

    expect(result).toEqual({ ids: [], success: true });
    // No second query — we short-circuited before hitting practice_answers.
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("upserts question flags by question and flag type so favorites can coexist with needs-work", async () => {
    const upsert = vi.fn();
    const select = vi.fn();
    const single = vi.fn(async () => ({
      data: { id: "flag-needs-work", flag_type: "needs_work" },
      error: null,
    }));

    select.mockReturnValue({ single });
    upsert.mockReturnValue({ select });
    mockSupabase.from.mockReturnValueOnce({ upsert });

    const result = await searchService.setQuestionFlag("question-1", "needs_work");

    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        question_id: "question-1",
        flag_type: "needs_work",
      }),
      { onConflict: "user_id,question_id,flag_type" },
    );
  });

  it("removes only the selected question flag type", async () => {
    const deleteChain = {
      eq: vi.fn(() => deleteChain),
      then: (onFulfilled: (value: { error: unknown }) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled),
    };
    const deleteFn = vi.fn(() => deleteChain);
    mockSupabase.from.mockReturnValueOnce({ delete: deleteFn });

    const result = await searchService.removeQuestionFlag("question-1", "needs_work");

    expect(result.success).toBe(true);
    expect(deleteChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteChain.eq).toHaveBeenCalledWith("question_id", "question-1");
    expect(deleteChain.eq).toHaveBeenCalledWith("flag_type", "needs_work");
  });

  it("loads multiple flag types for the same question", async () => {
    const flagsChain = createSelectChain({
      data: [
        { id: "flag-favorite", question_id: "question-1", flag_type: "favorite" },
        { id: "flag-needs-work", question_id: "question-1", flag_type: "needs_work" },
      ],
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(flagsChain);

    const result = await searchService.getQuestionFlags(["question-1"]);

    expect(result).toEqual({
      success: true,
      flags: {
        "question-1": {
          favorite: { id: "flag-favorite", flag_type: "favorite" },
          needs_work: { id: "flag-needs-work", flag_type: "needs_work" },
        },
      },
    });
  });

  it("creates a lightweight research preview without requiring a signed-in user", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        preview: {
          previewId: "preview-1",
          status: "completed",
          company: "Stripe",
          role: "Platform Engineer",
          confidence: "medium",
          sourceSummary: "4 public signals.",
          stages: [],
          assessmentSignals: [],
          questions: [],
          expiresAt: "2026-05-18T00:00:00.000Z",
        },
      },
      error: null,
    });

    const result = await searchService.createResearchPreview({
      company: " Stripe ",
      role: " Platform Engineer ",
    });

    expect(result.success).toBe(true);
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("research-preview", {
      body: {
        company: "Stripe",
        role: "Platform Engineer",
        country: undefined,
      },
    });
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
      roleLinks: ["https://example.com/job-1", "https://example.com/job-2"],
      cv: "Resume text",
      level: "senior_ic",
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
        userId: "user-1",
        searchId: "search-1",
      },
    });
  });

  it("does not fail startup when the research function acknowledgement takes longer than 15 seconds", async () => {
    vi.useFakeTimers();
    mockSupabase.functions.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: { status: "accepted" },
              error: null,
            });
          }, 16_000);
        }),
    );

    const resultPromise = searchService.startProcessing("search-slow-ack", {
      company: "OpenAI",
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockSupabase.from).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(resultPromise).resolves.toEqual({ success: true });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("fails startup when the acknowledgement never arrives", async () => {
    vi.useFakeTimers();
    const updates: Array<Record<string, unknown>> = [];
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // A gateway that accepts the connection but never responds: without a bound
    // this promise stays pending forever and the search row stays `pending`.
    mockSupabase.functions.invoke.mockImplementation(() => new Promise(() => {}));
    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain(
        { error: null },
        (payload) => updates.push(payload as Record<string, unknown>),
      ),
    );

    const resultPromise = searchService.startProcessing("search-stalled", {
      company: "OpenAI",
    });

    await vi.advanceTimersByTimeAsync(60_000);

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(updates[0]).toMatchObject({
      status: "failed",
      error_message: "Timed out while starting research",
    });

    consoleErrorSpy.mockRestore();
  });

  it("marks the search as failed when the research function cannot be started", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const eqFilters: Array<[string, unknown]> = [];

    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("relay down"),
    });
    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain(
        { error: null },
        (payload) => updates.push(payload as Record<string, unknown>),
        (column, value) => eqFilters.push([column, value]),
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
    // Scoped to a still-pending row so a startup failure cannot overwrite the
    // terminal status of a run the pipeline has already picked up.
    expect(eqFilters).toEqual([
      ["id", "search-2"],
      ["status", "pending"],
    ]);
  });

  it("skips prep plan lookups while research is still pending", async () => {
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
    ).not.toContain("prep_plans");
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
      roleLinks: ["https://anthropic.com/jobs/1"],
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
      role_links: [],
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

  it("updatePracticeAnswerTranscript patches transcript_text scoped by id and audio_path", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const eqCalls: Array<[string, unknown]> = [];

    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain(
        { error: null },
        (payload) => updates.push(payload as Record<string, unknown>),
        (column, value) => eqCalls.push([column, value]),
      ),
    );

    const result = await searchService.updatePracticeAnswerTranscript(
      "answer-1",
      "user-1/session-1/q-1-1717000000000.webm",
      "transcribed answer",
    );

    expect(result.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("practice_answers");
    expect(updates[0]).toEqual({ transcript_text: "transcribed answer" });
    // The audio_path filter is what protects against a stale transcription
    // overwriting a row whose audio has since been re-recorded.
    expect(eqCalls).toEqual([
      ["id", "answer-1"],
      ["audio_path", "user-1/session-1/q-1-1717000000000.webm"],
    ]);
  });

  it("updatePracticeAnswerTranscript returns success:false when the update errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockSupabase.from.mockReturnValueOnce(
      createUpdateChain({ error: new Error("update failed") }),
    );

    const result = await searchService.updatePracticeAnswerTranscript(
      "answer-1",
      "user-1/session-1/q-1.webm",
      "transcribed answer",
    );

    expect(result.success).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});

describe("answer feedback service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps unrecognized function error codes to unknown_error", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          clone: () => ({
            json: async () => ({ error: "future_backend_error" }),
          }),
          json: async () => ({ error: "future_backend_error" }),
        },
      },
    });

    const result = await searchService.generateAnswerFeedback("answer-1");

    expect(result).toEqual({
      success: false,
      errorCode: "unknown_error",
    });
  });

  it("maps the feedback_already_exists race response to its structured error code", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          clone: () => ({
            json: async () => ({ error: "feedback_already_exists" }),
          }),
          json: async () => ({ error: "feedback_already_exists" }),
        },
      },
    });

    const result = await searchService.generateAnswerFeedback("answer-1", true);

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("answer-feedback", {
      body: { practiceAnswerId: "answer-1", regenerate: true },
    });
    expect(result).toEqual({
      success: false,
      errorCode: "feedback_already_exists",
    });
  });

  it("loads and normalizes current feedback for unique answer ids", async () => {
    const chain = createSelectChain({
      data: [
        {
          id: "feedback-1",
          practice_answer_id: "answer-1",
          strengths: ["Clear structure"],
          improvements: [{ text: "Add a metric", evidence: "No result was quantified" }],
          star_breakdown: { situation: "S", task: "T", action: "A", result: "R" },
          next_action: { text: "Re-tell it with a number." },
          model: "gpt-4o-mini",
          created_at: "2026-06-18T07:00:00.000Z",
        },
      ],
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await searchService.getAnswerFeedbackForAnswers([
      "answer-1",
      "",
      "answer-1",
    ]);

    expect(mockSupabase.from).toHaveBeenCalledWith("answer_feedback");
    expect(chain.in).toHaveBeenCalledWith("practice_answer_id", ["answer-1"]);
    expect(chain.is).toHaveBeenCalledWith("superseded_by", null);
    expect(result).toEqual({
      success: true,
      feedback: {
        "answer-1": {
          id: "feedback-1",
          practiceAnswerId: "answer-1",
          model: "gpt-4o-mini",
          createdAt: "2026-06-18T07:00:00.000Z",
          strengths: [{ text: "Clear structure" }],
          improvements: [{ text: "Add a metric", evidence: "No result was quantified" }],
          starBreakdown: { situation: "S", task: "T", action: "A", result: "R" },
          nextAction: { text: "Re-tell it with a number." },
        },
      },
    });
  });

  it("invokes answer-feedback with regeneration intent and normalizes the response", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: {
        feedbackId: "feedback-2",
        model: "gpt-4o-mini",
        feedback: {
          strengths: ["Owned the outcome"],
          improvements: ["Quantify impact"],
          starBreakdown: { situation: "S", task: "T", action: "A", result: "R" },
          nextAction: { text: "Add the percentage improvement." },
        },
      },
      error: null,
    });

    const result = await searchService.generateAnswerFeedback("answer-2", true);

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("answer-feedback", {
      body: { practiceAnswerId: "answer-2", regenerate: true },
    });
    expect(result).toEqual({
      success: true,
      feedback: {
        id: "feedback-2",
        practiceAnswerId: "answer-2",
        model: "gpt-4o-mini",
        createdAt: null,
        strengths: [{ text: "Owned the outcome" }],
        improvements: [{ text: "Quantify impact" }],
        starBreakdown: { situation: "S", task: "T", action: "A", result: "R" },
        nextAction: { text: "Add the percentage improvement." },
      },
    });
  });
});
