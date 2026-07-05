// Stripe Customer Portal entrypoint. Creates a hosted Portal Session for the
// authenticated user's existing Stripe Customer and returns its URL.
//
// Deployed with verify_jwt = false (see supabase/config.toml). Auth is enforced
// here via the shared authorizeRequest helper.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { authorizeRequest } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createPortalSession, type SupabaseLike } from "./handler.ts";

const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, fn: "create-portal-session", ...fields }));

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

  let stripeSecret: string;
  let supabaseUrl: string;
  let supabaseServiceKey: string;
  let appBaseUrl: string;
  try {
    stripeSecret = readEnv("STRIPE_SECRET_KEY");
    supabaseUrl = readEnv("SUPABASE_URL");
    supabaseServiceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    appBaseUrl = readEnv("APP_BASE_URL");
  } catch (err) {
    log("create_portal_misconfigured", {
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

  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });

  const result = await createPortalSession(
    {
      supabase: supabase as unknown as SupabaseLike,
      stripe,
      appBaseUrl,
      log,
    },
    { userId: authResult.context.userId },
  );

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: jsonHeaders,
    });
  }

  return new Response(
    JSON.stringify({ url: result.url, sessionId: result.sessionId }),
    { status: 200, headers: jsonHeaders },
  );
});
