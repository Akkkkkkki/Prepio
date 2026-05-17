import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

import { callOpenAI, parseJsonResponse } from "../_shared/openai-client.ts";
import { getOpenAIModel } from "../_shared/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-preview-session",
};

type Confidence = "high" | "medium" | "low";

interface ResearchPreviewRequest {
  company: string;
  role?: string;
  country?: string;
}

interface PreviewPayload {
  confidence: Confidence;
  sourceSummary: string;
  stages: Array<{ name: string; whyLikely: string; confidence: Confidence }>;
  assessmentSignals: Array<{ name: string; importance: "high" | "medium" | "low"; rationale: string }>;
  questions: Array<{ stage: string; difficulty: string; question: string; rationale: string }>;
}

const fallbackPayload = (company: string, role?: string): PreviewPayload => ({
  confidence: "low",
  sourceSummary: "Limited live source signal was available, so this preview uses a conservative role-based starting point.",
  stages: [
    {
      name: "Recruiter screen",
      whyLikely: "Most structured interview processes start with motivation, role fit, and logistics.",
      confidence: "medium",
    },
    {
      name: "Hiring manager",
      whyLikely: "The hiring manager usually probes role scope, recent experience, and judgment.",
      confidence: "medium",
    },
    {
      name: "Panel interview",
      whyLikely: "Cross-functional panels are common for mid-to-senior roles where collaboration matters.",
      confidence: "low",
    },
  ],
  assessmentSignals: [
    {
      name: "Role judgment",
      importance: "high",
      rationale: `${company}${role ? ` ${role}` : ""} prep should show how you make decisions in realistic role constraints.`,
    },
    {
      name: "Company motivation",
      importance: "medium",
      rationale: "Interviewers will expect a specific reason for this company beyond generic interest.",
    },
    {
      name: "Evidence quality",
      importance: "medium",
      rationale: "Strong answers need concrete examples with measurable impact.",
    },
  ],
  questions: [
    {
      stage: "Hiring manager",
      difficulty: "Medium",
      question: `Why ${company}, and why this role now?`,
      rationale: "This quickly separates specific preparation from generic motivation.",
    },
    {
      stage: "Panel interview",
      difficulty: "Hard",
      question: "Tell me about a decision where you had incomplete information and meaningful downside risk.",
      rationale: "This tests judgment, tradeoffs, and communication under ambiguity.",
    },
    {
      stage: "Behavioral",
      difficulty: "Medium",
      question: "Describe a time you changed your approach after stakeholder feedback.",
      rationale: "Most interview loops probe coachability and collaboration.",
    },
    {
      stage: "Role deep dive",
      difficulty: "Hard",
      question: role
        ? `What would excellent performance look like in the first 90 days as a ${role}?`
        : "What would excellent performance look like in the first 90 days?",
      rationale: "This tests whether you understand the role's likely operating context.",
    },
    {
      stage: "Close",
      difficulty: "Medium",
      question: "What questions would you ask to understand whether this team is set up to succeed?",
      rationale: "Strong candidates assess team constraints, not just sell themselves.",
    },
  ],
});

const normalizeInput = (value?: string) => value?.trim().replace(/\s+/g, " ") || "";

const buildCacheKey = (company: string, role?: string, country?: string) =>
  [company, role, country].map((part) => normalizeInput(part).toLowerCase()).join("|");

const getFingerprint = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const session = req.headers.get("x-preview-session")?.trim();
  return session || forwardedFor || "unknown";
};

const checkRateLimit = async (supabase: any, fingerprint: string) => {
  const windowMinutes = 60;
  const maxRequests = 8;
  const now = new Date();

  const { data } = await supabase
    .from("research_preview_rate_limits")
    .select("*")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (!data) {
    await supabase.from("research_preview_rate_limits").insert({ fingerprint });
    return true;
  }

  const windowStart = new Date(data.window_start);
  const isExpired = now.getTime() - windowStart.getTime() > windowMinutes * 60 * 1000;
  const nextCount = isExpired ? 1 : data.request_count + 1;

  await supabase
    .from("research_preview_rate_limits")
    .update({
      request_count: nextCount,
      window_start: isExpired ? now.toISOString() : data.window_start,
      updated_at: now.toISOString(),
    })
    .eq("fingerprint", fingerprint);

  return isExpired || nextCount <= maxRequests;
};

const getCachedPreview = async (supabase: any, cacheKey: string) => {
  const { data } = await supabase
    .from("research_previews")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return data ?? null;
};

const buildPrompt = (company: string, role: string | undefined, country: string | undefined, sourceText: string) => `
Build a compact interview-prep preview for a guest user.

Company: ${company}
Role: ${role || "Not specified"}
Country: ${country || "Not specified"}

Source snippets:
${sourceText}

Return JSON only with:
{
  "confidence": "high" | "medium" | "low",
  "sourceSummary": "short sentence describing the source basis",
  "stages": [{"name": "...", "whyLikely": "...", "confidence": "high|medium|low"}],
  "assessmentSignals": [{"name": "...", "importance": "high|medium|low", "rationale": "..."}],
  "questions": [{"stage": "...", "difficulty": "...", "question": "...", "rationale": "..."}]
}

Rules:
- exactly 3 stages
- exactly 3 assessmentSignals
- exactly 5 questions
- questions must be role/company specific where sources support it
- be honest when source signal is weak
`;

const normalizePayload = (payload: Partial<PreviewPayload>, fallback: PreviewPayload): PreviewPayload => ({
  confidence: payload.confidence === "high" || payload.confidence === "medium" || payload.confidence === "low"
    ? payload.confidence
    : fallback.confidence,
  sourceSummary: typeof payload.sourceSummary === "string" && payload.sourceSummary.trim()
    ? payload.sourceSummary.trim()
    : fallback.sourceSummary,
  stages: Array.isArray(payload.stages) && payload.stages.length
    ? payload.stages.slice(0, 3).map((stage, index) => ({
        name: String(stage.name || fallback.stages[index]?.name || "Interview round"),
        whyLikely: String(stage.whyLikely || fallback.stages[index]?.whyLikely || "Likely based on similar interview processes."),
        confidence:
          stage.confidence === "high" || stage.confidence === "medium" || stage.confidence === "low"
            ? stage.confidence
            : "medium",
      }))
    : fallback.stages,
  assessmentSignals: Array.isArray(payload.assessmentSignals) && payload.assessmentSignals.length
    ? payload.assessmentSignals.slice(0, 3).map((signal, index) => ({
        name: String(signal.name || fallback.assessmentSignals[index]?.name || "Interview signal"),
        importance:
          signal.importance === "high" || signal.importance === "medium" || signal.importance === "low"
            ? signal.importance
            : "medium",
        rationale: String(signal.rationale || fallback.assessmentSignals[index]?.rationale || "Important for this role."),
      }))
    : fallback.assessmentSignals,
  questions: Array.isArray(payload.questions) && payload.questions.length
    ? payload.questions.slice(0, 5).map((question, index) => ({
        stage: String(question.stage || fallback.questions[index]?.stage || "Interview"),
        difficulty: String(question.difficulty || fallback.questions[index]?.difficulty || "Medium"),
        question: String(question.question || fallback.questions[index]?.question || "Tell me about your background."),
        rationale: String(question.rationale || fallback.questions[index]?.rationale || "Tests role fit."),
      }))
    : fallback.questions,
});

const generatePreview = async (company: string, role?: string, country?: string): Promise<PreviewPayload> => {
  const fallback = fallbackPayload(company, role);
  const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!tavilyApiKey || !openAiApiKey) {
    return fallback;
  }

  const query = `${company} ${role || ""} interview process questions hiring ${country || ""}`.trim();
  const tavilyResponse = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tavilyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!tavilyResponse.ok) {
    return fallback;
  }

  const tavily = await tavilyResponse.json() as {
    answer?: string;
    results?: Array<{ title?: string; content?: string }>;
  };

  const sourceText = [
    tavily?.answer,
    ...(tavily?.results ?? []).map((result) => `${result.title}\n${result.content}`),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  if (!sourceText.trim()) {
    return fallback;
  }

  const response = await callOpenAI(openAiApiKey, {
    model: getOpenAIModel(),
    systemPrompt: "You create concise, honest, source-grounded interview-prep previews.",
    prompt: buildPrompt(company, role, country, sourceText),
    maxTokens: 1400,
    useJsonMode: true,
  });

  return normalizePayload(parseJsonResponse<Partial<PreviewPayload>>(response.content, fallback), fallback);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase service configuration");
    }

    const body = await req.json() as ResearchPreviewRequest;
    const company = normalizeInput(body.company);
    const role = normalizeInput(body.role) || undefined;
    const country = normalizeInput(body.country) || undefined;

    if (!company) {
      return new Response(JSON.stringify({ success: false, error: "Company is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const cacheKey = buildCacheKey(company, role, country);
    const fingerprint = getFingerprint(req);

    const cached = await getCachedPreview(supabase, cacheKey);
    if (cached) {
      return new Response(JSON.stringify({
        success: true,
        preview: {
          previewId: cached.id,
          status: "cached",
          company: cached.company,
          role: cached.role,
          confidence: cached.confidence,
          sourceSummary: cached.source_summary,
          expiresAt: cached.expires_at,
          ...cached.payload,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = await checkRateLimit(supabase, fingerprint);
    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Preview limit reached. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await generatePreview(company, role, country);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("research_previews")
      .upsert({
        cache_key: cacheKey,
        company,
        role: role ?? null,
        country: country ?? null,
        confidence: payload.confidence,
        source_summary: payload.sourceSummary,
        payload,
        expires_at: expiresAt,
      }, { onConflict: "cache_key" })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      preview: {
        previewId: data.id,
        status: "completed",
        company,
        role: role ?? null,
        confidence: payload.confidence,
        sourceSummary: payload.sourceSummary,
        stages: payload.stages,
        assessmentSignals: payload.assessmentSignals,
        questions: payload.questions,
        expiresAt,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("research-preview failed", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unable to create preview",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
