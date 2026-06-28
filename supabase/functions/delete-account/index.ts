import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

import { authorizeRequest } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { deleteAccount, type SupabaseLike } from "./handler.ts";

const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, fn: "delete-account", ...fields }));

function readEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing env var: ${name}`);
  return value;
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
  try {
    supabaseUrl = readEnv("SUPABASE_URL");
    supabaseServiceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch (err) {
    log("delete_account_misconfigured", {
      message: err instanceof Error ? err.message : String(err),
    });
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

  let body: { confirmation?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const result = await deleteAccount(
    {
      supabase: supabase as unknown as SupabaseLike,
      log,
    },
    {
      confirmation: typeof body.confirmation === "string" ? body.confirmation : "",
      userId: authResult.context.userId,
    },
  );

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ success: true, deleted: result.deleted }), {
    status: 200,
    headers: jsonHeaders,
  });
});
