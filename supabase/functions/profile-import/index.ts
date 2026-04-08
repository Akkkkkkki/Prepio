import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

import { authorizeRequest } from "../_shared/auth.ts";
import { getOpenAIModel } from "../_shared/config.ts";
import { parseJsonResponse } from "../_shared/openai-client.ts";
import {
  buildProfileImportReview,
  candidateProfileFromLegacyParsedData,
  createEmptyCandidateProfile,
  normalizeCandidateProfile,
} from "../../../src/lib/candidateProfile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileImportRequest {
  resumeText: string;
  userId: string;
  resumeId?: string | null;
  source?: string;
  existingProfile?: unknown;
}

interface AiDraftProfile {
  headline?: string;
  summary?: string;
  location?: string;
  links?: Array<{ label?: string; url?: string }>;
  experiences?: Array<{
    company?: string;
    title?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    summary?: string;
    bullets?: Array<{
      text?: string;
      competencyTags?: string[];
      interviewThemes?: string[];
      industries?: string[];
      focusAreas?: string[];
      starStory?: boolean;
    }>;
  }>;
  projects?: Array<{
    title?: string;
    context?: string;
    technologies?: string[];
    tags?: string[];
    links?: Array<{ label?: string; url?: string }>;
    bullets?: Array<{
      text?: string;
      competencyTags?: string[];
      interviewThemes?: string[];
      industries?: string[];
      focusAreas?: string[];
      starStory?: boolean;
    }>;
  }>;
  skills?: Array<{ name?: string; skills?: string[] }>;
  education?: Array<{
    degree?: string;
    institution?: string;
    year?: string;
    description?: string;
  }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    year?: string;
  }>;
  languages?: Array<{
    language?: string;
    proficiency?: string;
  }>;
  preferences?: {
    targetRoles?: string[];
    targetIndustries?: string[];
    locations?: string[];
    workModes?: string[];
    notes?: string;
  };
}

const buildSimpleDraftProfile = (resumeText: string, userId: string) => {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const profile = normalizeCandidateProfile(
    {
      userId,
      headline: lines[1] || lines[0] || "",
      summary: resumeText.slice(0, 280).trim(),
      links: emailMatch
        ? [{ label: "Email", url: `mailto:${emailMatch[0]}` }]
        : [],
    },
    userId,
  );

  return profile;
};

const buildAiPrompt = (resumeText: string) => `Analyze this resume and return JSON only.

Return this exact shape:
{
  "headline": "string",
  "summary": "string",
  "location": "string",
  "links": [{ "label": "string", "url": "string" }],
  "experiences": [
    {
      "company": "string",
      "title": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "current": true,
      "summary": "string",
      "bullets": [
        {
          "text": "string",
          "competencyTags": ["string"],
          "interviewThemes": ["string"],
          "industries": ["string"],
          "focusAreas": ["leadership | technical | client-facing | operational"],
          "starStory": true
        }
      ]
    }
  ],
  "projects": [
    {
      "title": "string",
      "context": "string",
      "technologies": ["string"],
      "tags": ["string"],
      "links": [{ "label": "string", "url": "string" }],
      "bullets": [
        {
          "text": "string",
          "competencyTags": ["string"],
          "interviewThemes": ["string"],
          "industries": ["string"],
          "focusAreas": ["leadership | technical | client-facing | operational"],
          "starStory": true
        }
      ]
    }
  ],
  "skills": [{ "name": "string", "skills": ["string"] }],
  "education": [{ "degree": "string", "institution": "string", "year": "string", "description": "string" }],
  "certifications": [{ "name": "string", "issuer": "string", "year": "string" }],
  "languages": [{ "language": "string", "proficiency": "string" }],
  "preferences": {
    "targetRoles": [],
    "targetIndustries": [],
    "locations": [],
    "workModes": [],
    "notes": ""
  }
}

Requirements:
- Prefer fidelity to the resume over embellishment.
- Keep bullets as first-class items, not one concatenated paragraph.
- Extract projects separately when possible.
- Leave arrays empty instead of inventing data.
- If dates are unclear, keep raw strings.
- Do not wrap the JSON in markdown.

Resume:
${resumeText}`;

const callOpenAIForDraft = async (resumeText: string, openaiApiKey: string) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAIModel("cvAnalysis"),
      messages: [
        {
          role: "system",
          content:
            "You are an expert resume parser. Return JSON only and preserve explicit structure for interview prep.",
        },
        {
          role: "user",
          content: buildAiPrompt(resumeText),
        },
      ],
      max_tokens: 3500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Profile import analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return parseJsonResponse<AiDraftProfile>(content, {});
};

const callLegacyCvAnalysis = async (resumeText: string, userId: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const response = await fetch(`${supabaseUrl}/functions/v1/cv-analysis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cvText: resumeText,
      userId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Legacy CV analysis failed: ${response.status}`);
  }

  return response.json();
};

const buildDraftProfile = async (resumeText: string, userId: string) => {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (openaiApiKey) {
    try {
      const aiDraft = await callOpenAIForDraft(resumeText, openaiApiKey);
      return normalizeCandidateProfile(
        {
          userId,
          ...aiDraft,
        },
        userId,
      );
    } catch (error) {
      console.warn("Profile import AI parse failed. Falling back to legacy CV analysis.", error);
    }
  }

  try {
    const legacyResult = await callLegacyCvAnalysis(resumeText, userId);
    if (legacyResult?.success && legacyResult?.parsedData) {
      return candidateProfileFromLegacyParsedData(legacyResult.parsedData, userId);
    }
  } catch (error) {
    console.warn("Legacy CV analysis fallback failed.", error);
  }

  return buildSimpleDraftProfile(resumeText, userId);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authResult = await authorizeRequest(req, supabase);

    if (!authResult.ok) {
      return new Response(authResult.response.body, {
        status: authResult.response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { resumeText, userId, resumeId, source, existingProfile } =
      (await req.json()) as ProfileImportRequest;

    if (!resumeText || !userId) {
      throw new Error("Missing required parameters: resumeText and userId");
    }

    if (authResult.context.kind === "user" && authResult.context.userId !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID does not match authenticated user" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const currentProfile = existingProfile
      ? normalizeCandidateProfile(existingProfile as Record<string, unknown>, userId)
      : createEmptyCandidateProfile(userId);

    const draftProfile = await buildDraftProfile(resumeText, userId);
    const normalizedDraft = normalizeCandidateProfile(
      {
        ...draftProfile,
        userId,
        lastResumeId: resumeId ?? null,
      },
      userId,
    );
    const review = buildProfileImportReview(currentProfile, normalizedDraft);

    const { data, error } = await supabase
      .from("profile_imports")
      .insert({
        user_id: userId,
        resume_id: resumeId ?? null,
        source: source || "manual",
        draft_profile: normalizedDraft,
        merge_suggestions: review.mergeSuggestions,
        import_summary: review.importSummary,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    const { error: dismissError } = await supabase
      .from("profile_imports")
      .update({ status: "dismissed" })
      .eq("user_id", userId)
      .eq("status", "pending")
      .neq("id", data.id);

    if (dismissError) {
      console.warn("Failed to dismiss older pending profile imports.", dismissError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        profileImport: data,
        draftProfile: normalizedDraft,
        mergeSuggestions: review.mergeSuggestions,
        importSummary: review.importSummary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Profile import error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown profile import error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
