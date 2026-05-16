// Stripe Checkout entrypoint. Creates a Checkout Session for one of the three
// subscription cadences and returns its hosted URL.
//
// Deployed with verify_jwt = false (see supabase/config.toml). Auth is enforced
// here via the shared authorizeRequest helper, matching the rest of the
// codebase.
//
// Contract: docs/BILLING.md → "Upgrade".

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { authorizeRequest } from "../_shared/auth.ts";
import type { CadenceLookup } from "../_shared/cadence.ts";
import { createCheckoutSession, type SupabaseLike } from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, fn: "create-checkout-session", ...fields }));

function readEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing env var: ${name}`);
  return value;
}

function buildCadenceLookup(): CadenceLookup {
  return {
    monthly: readEnv("STRIPE_PRICE_MONTHLY"),
    quarterly: readEnv("STRIPE_PRICE_QUARTERLY"),
    annual: readEnv("STRIPE_PRICE_ANNUAL"),
  };
}

serve(async (req) => {
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
  let cadenceLookup: CadenceLookup;
  try {
    stripeSecret = readEnv("STRIPE_SECRET_KEY");
    supabaseUrl = readEnv("SUPABASE_URL");
    supabaseServiceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    appBaseUrl = readEnv("APP_BASE_URL");
    cadenceLookup = buildCadenceLookup();
  } catch (err) {
    log("create_checkout_misconfigured", {
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
  const userId = authResult.context.userId;

  let body: { cadence?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // Fetch the user's email so Stripe Checkout can pre-fill it. Failure here is
  // non-fatal — we proceed without an email rather than blocking checkout.
  let userEmail: string | null = null;
  try {
    const { data: userLookup, error: userLookupError } =
      await supabase.auth.admin.getUserById(userId);
    if (userLookupError) {
      log("user_email_lookup_failed", { userId, message: userLookupError.message });
    } else {
      userEmail = userLookup.user?.email ?? null;
    }
  } catch (err) {
    log("user_email_lookup_failed", {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });

  const result = await createCheckoutSession(
    {
      supabase: supabase as unknown as SupabaseLike,
      stripe,
      cadenceLookup,
      appBaseUrl,
      log,
    },
    { userId, userEmail, cadence: body.cadence },
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
