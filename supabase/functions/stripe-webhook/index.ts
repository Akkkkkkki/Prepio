// Stripe webhook entrypoint.
//
// Deployed with verify_jwt = false (see supabase/config.toml). Stripe is the
// only legitimate caller; authenticity is enforced via STRIPE_WEBHOOK_SECRET.
//
// Contract: docs/BILLING.md → "Webhook".

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { processEvent, type WebhookEvent } from "./handlers.ts";
import type { CadenceLookup } from "./cadence.ts";

const jsonHeaders = { "Content-Type": "application/json" };

const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, fn: "stripe-webhook", ...fields }));

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

// Resolve our user_id from a Stripe customer ID. Primary path is the
// billing_customers row written by the Checkout edge function. Fallback fetches
// the Stripe Customer and reads metadata.user_id, then upserts so future
// events resolve from the DB.
function buildResolveUserId(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
) {
  return async (stripeCustomerId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (error) {
      log("billing_customers_read_failed", { stripeCustomerId, message: error.message });
      return null;
    }
    if (data?.user_id) return data.user_id as string;

    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer.deleted) return null;
      const userId = customer.metadata?.user_id;
      if (!userId) return null;
      const { error: upsertError } = await supabase
        .from("billing_customers")
        .upsert(
          { user_id: userId, stripe_customer_id: stripeCustomerId },
          { onConflict: "user_id" },
        );
      if (upsertError) {
        log("billing_customers_backfill_failed", { stripeCustomerId, message: upsertError.message });
      }
      return userId;
    } catch (err) {
      log("stripe_customer_fetch_failed", {
        stripeCustomerId,
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log("stripe_sig_missing");
    return new Response(JSON.stringify({ error: "missing_signature" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  let stripeSecret: string;
  let webhookSecret: string;
  let supabaseUrl: string;
  let supabaseServiceKey: string;
  let cadenceLookup: CadenceLookup;
  try {
    stripeSecret = readEnv("STRIPE_SECRET_KEY");
    webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");
    supabaseUrl = readEnv("SUPABASE_URL");
    supabaseServiceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    cadenceLookup = buildCadenceLookup();
  } catch (err) {
    log("stripe_webhook_misconfigured", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ error: "misconfigured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });
  const rawBody = await req.text();

  let event: WebhookEvent;
  try {
    event = (await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )) as unknown as WebhookEvent;
  } catch (err) {
    log("stripe_sig_fail", { message: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  log("stripe_event_received", { id: event.id, type: event.type, created: event.created });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await processEvent(
      {
        supabase: supabase as unknown as Parameters<typeof processEvent>[0]["supabase"],
        cadenceLookup,
        resolveUserId: buildResolveUserId(supabase, stripe),
        log,
      },
      event,
    );
    return new Response(JSON.stringify({ received: true, ...result }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    // Surfaces a 500 so Stripe retries — DB infra failures are transient.
    log("stripe_event_processing_failed", {
      id: event.id,
      type: event.type,
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ error: "processing_failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
