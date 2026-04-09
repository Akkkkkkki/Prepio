import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { authorizeRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PracticeAudioTranscribeRequest {
  path: string;
  mimeType?: string;
  fileName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const authResult = await authorizeRequest(req, supabase);
    if (!authResult.ok) {
      return new Response(authResult.response.body, {
        status: authResult.response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authResult.context.kind !== "user" || !authResult.context.userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Only signed-in users can transcribe practice audio." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { path, mimeType, fileName }: PracticeAudioTranscribeRequest = await req.json();

    if (!path) {
      return new Response(JSON.stringify({ success: false, error: "Missing audio path." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pathOwner = path.split("/")[0];
    if (pathOwner !== authResult.context.userId) {
      return new Response(JSON.stringify({ success: false, error: "Audio path is not owned by this user." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.storage
      .from("practice-audio")
      .download(path);

    if (error || !data) {
      throw error ?? new Error("Failed to download practice audio");
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const extension = mimeType?.split("/")[1] || "webm";
    const uploadFile = new File(
      [data],
      fileName || `practice-answer.${extension}`,
      { type: mimeType || data.type || "audio/webm" },
    );

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("response_format", "json");

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      throw new Error(`OpenAI transcription failed: ${transcriptionResponse.status} ${errorText}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcript = typeof transcriptionData.text === "string" ? transcriptionData.text.trim() : "";

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("practice-audio-transcribe failed", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Transcription failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
