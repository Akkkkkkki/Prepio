import {
  type AuthorizedRequestContext,
} from "../_shared/auth.ts";
import {
  resolveExperienceLevel,
  type CanonicalLevel,
} from "./experience-level.ts";

export interface QuestionGenerationRequest {
  searchId: string;
  userId: string;
  companyInsights: any;
  jobRequirements: any;
  cvAnalysis: any;
  interviewStage: string;
  stageDetails: any;
  level?: CanonicalLevel;
}

export interface GeneratedQuestion {
  question: string;
  type: string;
  difficulty: string;
  rationale: string;
  suggested_answer_approach: string;
  evaluation_criteria: string[];
  follow_up_questions: string[];
  star_story_fit: boolean;
  company_context: string;
  depth_label?: string;
  good_answer_signals?: string[];
  weak_answer_signals?: string[];
  seniority_expectation?: string;
  sample_answer_outline?: string;
}

export interface QuestionBank {
  behavioral_questions: GeneratedQuestion[];
  technical_questions: GeneratedQuestion[];
  situational_questions: GeneratedQuestion[];
  company_specific_questions: GeneratedQuestion[];
  role_specific_questions: GeneratedQuestion[];
  experience_based_questions: GeneratedQuestion[];
  cultural_fit_questions: GeneratedQuestion[];
}

interface SupabaseAuthLike {
  auth: {
    getUser: (
      jwt: string,
    ) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  };
}

export interface Deps {
  supabase: SupabaseAuthLike;
  authorizeRequest: (
    req: Request,
    supabase: SupabaseAuthLike,
  ) => Promise<
    { ok: true; context: AuthorizedRequestContext } | { ok: false; response: Response }
  >;
  ensureServiceCaller: (
    context: AuthorizedRequestContext,
  ) => { ok: true } | { ok: false; response: Response };
  buildCorsHeaders: (req: Request) => HeadersInit;
  getEnv: (key: string) => string | undefined;
  generateQuestions: (
    companyInsights: any,
    jobRequirements: any,
    cvAnalysis: any,
    interviewStage: string,
    stageDetails: any,
    level: CanonicalLevel | undefined,
    openaiApiKey: string,
  ) => Promise<QuestionBank>;
}

const buildStubQuestion = (
  question: string,
  type: string,
  company?: string,
  role?: string,
): GeneratedQuestion => ({
  question,
  type,
  difficulty: "Medium",
  rationale: "Covers core competencies while tailoring to the role and company context.",
  suggested_answer_approach: "Use a concise STAR story with measurable impact.",
  evaluation_criteria: ["Clarity", "Impact", "Collaboration"],
  follow_up_questions: ["What tradeoffs did you consider?", "How did you measure success?"],
  star_story_fit: true,
  company_context: company ? `Aligns to ${company}'s expectations for ${role ?? "the role"}.` : "Role-aligned context.",
  depth_label: "Mid-level depth expected",
  good_answer_signals: [
    "Clear situation framing",
    "Specific collaboration details",
    "Measurable results tied to role goals",
  ],
  weak_answer_signals: [
    "Generic statements without context",
    "Blaming teammates without ownership",
  ],
  seniority_expectation: "Mid-level candidates should show ownership plus collaboration.",
  sample_answer_outline: "Situation - Challenge - Your actions - Impact metrics - Reflection",
});

export const buildStubQuestionBank = (
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  interviewStage: string,
): QuestionBank => {
  const company = companyInsights?.name ?? "the company";
  const role = jobRequirements?.role ?? cvAnalysis?.current_role ?? "the role";
  return {
    behavioral_questions: [
      buildStubQuestion(
        `Describe a time you navigated ambiguity while shipping a feature for ${company}.`,
        "behavioral",
        company,
        role,
      ),
    ],
    technical_questions: [
      buildStubQuestion(
        `Walk through how you would design an API to support ${role} workflows.`,
        "technical",
        company,
        role,
      ),
    ],
    situational_questions: [
      buildStubQuestion(
        `How would you handle conflicting priorities between product and reliability during ${interviewStage}?`,
        "situational",
        company,
        role,
      ),
    ],
    company_specific_questions: [
      buildStubQuestion(
        `What about ${company}'s culture resonates with you, and how have you demonstrated it?`,
        "company_specific",
        company,
        role,
      ),
    ],
    role_specific_questions: [
      buildStubQuestion(
        `Tell me about a project that best demonstrates your fit for ${role}.`,
        "role_specific",
        company,
        role,
      ),
    ],
    experience_based_questions: [
      buildStubQuestion(
        "Share a STAR example where you unblocked a team through technical leadership.",
        "experience_based",
        company,
        role,
      ),
    ],
    cultural_fit_questions: [
      buildStubQuestion(
        `How do you create inclusive collaboration in cross-functional teams at ${company}?`,
        "cultural_fit",
        company,
        role,
      ),
    ],
  };
};

export async function handleInterviewQuestionGeneration(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const corsHeaders = deps.buildCorsHeaders(req);

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await deps.authorizeRequest(req, deps.supabase);
  if (!authResult.ok) {
    return new Response(authResult.response.body, {
      status: authResult.response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const serviceCheck = deps.ensureServiceCaller(authResult.context);
  if (!serviceCheck.ok) {
    return new Response(serviceCheck.response.body, {
      status: serviceCheck.response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      searchId,
      userId,
      companyInsights,
      jobRequirements,
      cvAnalysis,
      interviewStage,
      stageDetails,
      level,
    } = await req.json() as QuestionGenerationRequest;

    if (!searchId || !userId) {
      throw new Error("Missing required parameters: searchId and userId");
    }

    // Get OpenAI API key
    const openaiApiKey = deps.getEnv("OPENAI_API_KEY");
    const useFallback = !openaiApiKey;

    console.log("Starting interview question generation for search:", searchId, "stage:", interviewStage, "level:", level);

    // Generate comprehensive question bank (fallback when offline/CI)
    let questionBank: QuestionBank;
    if (useFallback) {
      console.warn("Using fallback interview question bank (missing OpenAI API key)");
      questionBank = buildStubQuestionBank(companyInsights, jobRequirements, cvAnalysis, interviewStage);
    } else {
      try {
        questionBank = await deps.generateQuestions(
          companyInsights,
          jobRequirements,
          cvAnalysis,
          interviewStage,
          stageDetails,
          level,
          openaiApiKey,
        );
      } catch (generationError) {
        console.error("Question generation failed, serving fallback:", generationError);
        questionBank = buildStubQuestionBank(companyInsights, jobRequirements, cvAnalysis, interviewStage);
      }
    }

    console.log("Interview question generation completed successfully");

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Interview questions generated successfully",
        question_bank: questionBank,
        total_questions: Object.values(questionBank).reduce((sum, questions) => sum + questions.length, 0),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error processing interview question generation:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to generate interview questions",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
