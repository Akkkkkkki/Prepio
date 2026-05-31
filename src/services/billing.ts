import { supabase } from "@/integrations/supabase/client";

export type BillingPortalErrorCode =
  | "no_billing_customer"
  | "misconfigured"
  | "stripe_error"
  | "internal_error"
  | "unknown";

export type BillingPortalSessionResult =
  | { success: true; url: string; sessionId: string | null }
  | { success: false; code: BillingPortalErrorCode; message: string };

const portalErrorMessages: Record<BillingPortalErrorCode, string> = {
  no_billing_customer: "No active billing account is linked yet. Start a subscription before using the portal.",
  misconfigured: "Billing management is not configured yet.",
  stripe_error: "Stripe could not open the billing portal. Please try again.",
  internal_error: "Billing management is temporarily unavailable. Please try again.",
  unknown: "Billing management is temporarily unavailable. Please try again.",
};

const isPortalErrorCode = (value: unknown): value is BillingPortalErrorCode =>
  value === "no_billing_customer" ||
  value === "misconfigured" ||
  value === "stripe_error" ||
  value === "internal_error";

async function readFunctionErrorCode(error: unknown): Promise<BillingPortalErrorCode> {
  const context = typeof error === "object" && error !== null ? (error as { context?: unknown }).context : null;

  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (isPortalErrorCode(body.error)) {
        return body.error;
      }
    } catch {
      return "unknown";
    }
  }

  return "unknown";
}

export async function createBillingPortalSession(): Promise<BillingPortalSessionResult> {
  let response: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    response = await supabase.functions.invoke("create-portal-session", {
      body: {},
    });
  } catch {
    return {
      success: false,
      code: "unknown",
      message: portalErrorMessages.unknown,
    };
  }

  const { data, error } = response;

  if (error) {
    const code = await readFunctionErrorCode(error);
    return { success: false, code, message: portalErrorMessages[code] };
  }

  const payload = data as { url?: unknown; sessionId?: unknown } | null;
  if (!payload || typeof payload.url !== "string" || !payload.url) {
    return {
      success: false,
      code: "unknown",
      message: portalErrorMessages.unknown,
    };
  }

  return {
    success: true,
    url: payload.url,
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : null,
  };
}

export function redirectToBillingPortal(url: string) {
  window.location.assign(url);
}
