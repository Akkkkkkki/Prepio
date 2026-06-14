import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { authorizeRequest } from "../_shared/auth.ts";
import { RESEARCH_CONFIG } from "../_shared/config.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { getEntitlement } from "../_shared/entitlement.ts";
import { callOpenAI, parseJsonResponse } from "../_shared/openai-client.ts";
import {
  generateAnswerFeedback,
  type FeedbackModelInput,
  type StructuredFeedback,
  type SupabaseLike,
} from "./handler.ts";

const fallbackFeedback: StructuredFeedback = {
  strengths: [],
  improvements: [],
  starBreakdown: {
    situation: "",
    task: "",
    action: "",
    result: "",
  },
  nextAction: {
    text: "Practice this answer again with a specific example and measurable result.",
  },
};

function readEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing env var: ${name}`);
  return value;
}

function buildPrompt(input: FeedbackModelInput): string {
  return JSON.stringify({
    instruction: "Return concise structured coaching for this saved interview-practice answer.",
    output_shape: {
      strengths: [{ text: "string", evidence: "optional string" }],
      improvements: [{ text: "string", evidence: "optional string" }],
      starBreakdown: {
        situation: "string",
        task: "string",
        action: "string",
        result: "string",
      },
      nextAction: { text: "string", practicePrompt: "optional string" },
    },
    question: input.question,
    answer: input.answer,
    search: input.search,
    candidateProfile: input.candidateProfile,
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let supabaseUrl: string;
  let supabaseServiceKey: string;
  let openAiKey: string;
  try {
    supabaseUrl = readEnv("SUPABASE_URL");
    supabaseServiceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    openAiKey = readEnv("OPENAI_API_KEY");
  } catch (err) {
    console.error("answer-feedback misconfigured", err);
    return new Response(JSON.stringify({ error: "misconfigured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await authorizeRequest(req, supabase);
  if (!authResult.ok) {
    return new Response(authResult.response.body, {
      status: authResult.response.status,
      headers: jsonHeaders,
    });
  }
  if (authResult.context.kind !== "user" || !authResult.context.userId) {
    return new Response(JSON.stringify({ error: "user_token_required" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let body: { practiceAnswerId?: unknown; regenerate?: boolean };
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== "object") {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    body = parsed as { practiceAnswerId?: unknown; regenerate?: boolean };
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const modelName = RESEARCH_CONFIG.openai.models.contentSummarization;
  const result = await generateAnswerFeedback(
    {
      supabase: supabase as unknown as SupabaseLike,
      getEntitlement: (userId) => getEntitlement(supabase as unknown as SupabaseLike, userId),
      model: {
        async generate(input) {
          const response = await callOpenAI(openAiKey, {
            model: modelName,
            systemPrompt:
              "You are an interview coach. Return JSON only. Be specific, practical, and concise.",
            prompt: buildPrompt(input),
            maxTokens: 1400,
            useJsonMode: true,
          });
          return {
            feedback: parseJsonResponse<StructuredFeedback>(response.content, fallbackFeedback),
            model: modelName,
            metadata: { usage: response.raw?.usage ?? null },
          };
        },
      },
      log: (event, fields) =>
        console.log(JSON.stringify({ fn: "answer-feedback", event, ...(fields ?? {}) })),
    },
    {
      userId: authResult.context.userId,
      practiceAnswerId: body.practiceAnswerId,
      regenerate: body.regenerate === true,
    },
  );

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: jsonHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      feedbackId: result.feedbackId,
      supersededFeedbackId: result.supersededFeedbackId,
      feedback: result.feedback,
    }),
    { headers: jsonHeaders },
  );
});
