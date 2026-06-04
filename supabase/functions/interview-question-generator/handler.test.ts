import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureServiceCaller } from "../_shared/auth.ts";
import {
  handleInterviewQuestionGeneration,
  type Deps,
  type QuestionBank,
  type QuestionGenerationRequest,
} from "./handler.ts";

const serviceContext = {
  kind: "service" as const,
  token: "service-token",
  userId: null,
};

const userContext = {
  kind: "user" as const,
  token: "user-jwt",
  userId: "user-123",
};

const payload: QuestionGenerationRequest = {
  searchId: "search-123",
  userId: "user-123",
  companyInsights: {
    name: "Acme",
    industry: "Developer tools",
    culture: "Ownership and customer focus",
  },
  jobRequirements: {
    role: "Platform Engineer",
    technical_skills: ["TypeScript"],
  },
  cvAnalysis: {
    current_role: "Senior Engineer",
    experience_years: 8,
  },
  interviewStage: "Technical screen",
  stageDetails: { interviewer: "Engineering manager" },
  level: "senior_ic",
};

const emptyQuestionBank = (): QuestionBank => ({
  behavioral_questions: [],
  technical_questions: [],
  situational_questions: [],
  company_specific_questions: [],
  role_specific_questions: [],
  experience_based_questions: [],
  cultural_fit_questions: [],
});

const generatedQuestionBank = (): QuestionBank => ({
  ...emptyQuestionBank(),
  behavioral_questions: [
    {
      question: "How did Acme's platform constraints shape your technical plan?",
      type: "behavioral",
      difficulty: "Hard",
      rationale: "Tests senior judgment.",
      suggested_answer_approach: "Use STAR with tradeoffs.",
      evaluation_criteria: ["specificity"],
      follow_up_questions: ["What did you measure?"],
      star_story_fit: true,
      company_context: "Acme platform work.",
    },
  ],
  technical_questions: [
    {
      question: "Design an API migration for Acme.",
      type: "technical",
      difficulty: "Hard",
      rationale: "Tests architecture depth.",
      suggested_answer_approach: "Discuss constraints and rollout.",
      evaluation_criteria: ["architecture"],
      follow_up_questions: ["How would you monitor it?"],
      star_story_fit: false,
      company_context: "Acme platform work.",
    },
  ],
});

function makeRequest(body: unknown = payload, init: RequestInit = {}) {
  return new Request("https://prepio.test/functions/v1/interview-question-generator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function buildDeps({
  authContext = serviceContext,
  env = {},
  generateQuestions = vi.fn(async () => generatedQuestionBank()),
}: {
  authContext?: typeof serviceContext | typeof userContext;
  env?: Record<string, string | undefined>;
  generateQuestions?: Deps["generateQuestions"];
} = {}) {
  const authorizeRequest = vi.fn(async () => ({
    ok: true as const,
    context: authContext,
  }));
  const deps: Deps = {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
    },
    authorizeRequest,
    ensureServiceCaller,
    buildCorsHeaders: () => ({
      "Access-Control-Allow-Origin": "https://app.prepio.test",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    }),
    getEnv: (key) => env[key],
    generateQuestions,
  };

  return { deps, authorizeRequest, generateQuestions };
}

describe("handleInterviewQuestionGeneration", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns CORS preflight without requiring auth", async () => {
    const { deps, authorizeRequest } = buildDeps();

    const response = await handleInterviewQuestionGeneration(
      new Request("https://prepio.test/functions/v1/interview-question-generator", {
        method: "OPTIONS",
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.prepio.test");
    expect(authorizeRequest).not.toHaveBeenCalled();
  });

  it("rejects a user caller before parsing the request body or generating questions", async () => {
    const { deps, generateQuestions } = buildDeps({ authContext: userContext });

    const response = await handleInterviewQuestionGeneration(makeRequest("not-json"), deps);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Service caller required",
    });
    expect(generateQuestions).not.toHaveBeenCalled();
  });

  it("uses the deterministic fallback question bank when OpenAI is not configured", async () => {
    const { deps, generateQuestions } = buildDeps({ env: { OPENAI_API_KEY: undefined } });

    const response = await handleInterviewQuestionGeneration(makeRequest(), deps);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.total_questions).toBe(7);
    expect(body.question_bank.behavioral_questions[0]).toMatchObject({
      question: "Describe a time you navigated ambiguity while shipping a feature for Acme.",
      type: "behavioral",
      company_context: "Aligns to Acme's expectations for Platform Engineer.",
    });
    expect(generateQuestions).not.toHaveBeenCalled();
  });

  it("falls back to deterministic questions when the model generator fails", async () => {
    const generateQuestions = vi.fn(async () => {
      throw new Error("OpenAI unavailable");
    });
    const { deps } = buildDeps({
      env: { OPENAI_API_KEY: "sk-test" },
      generateQuestions,
    });

    const response = await handleInterviewQuestionGeneration(makeRequest(), deps);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total_questions).toBe(7);
    expect(body.question_bank.technical_questions[0].question).toBe(
      "Walk through how you would design an API to support Platform Engineer workflows.",
    );
    expect(generateQuestions).toHaveBeenCalledOnce();
  });

  it("returns generated questions and a computed total for service-role callers", async () => {
    const generateQuestions = vi.fn(async () => generatedQuestionBank());
    const { deps } = buildDeps({
      env: { OPENAI_API_KEY: "sk-test" },
      generateQuestions,
    });

    const response = await handleInterviewQuestionGeneration(makeRequest(), deps);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.question_bank.behavioral_questions[0].question).toContain("Acme");
    expect(body.total_questions).toBe(2);
    expect(generateQuestions).toHaveBeenCalledWith(
      payload.companyInsights,
      payload.jobRequirements,
      payload.cvAnalysis,
      payload.interviewStage,
      payload.stageDetails,
      payload.level,
      "sk-test",
    );
  });
});
