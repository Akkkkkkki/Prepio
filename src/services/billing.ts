import { supabase } from "@/integrations/supabase/client";

export type BillingCadence = "monthly" | "quarterly" | "annual";

export class BillingError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message?: string, status?: number) {
    super(message ?? code);
    this.name = "BillingError";
    this.code = code;
    this.status = status;
  }
}

type FunctionErrorShape = {
  message?: string;
  context?: Response;
};

const readFunctionError = async (error: unknown): Promise<BillingError> => {
  const functionError = error as FunctionErrorShape;
  const context = functionError?.context;
  if (context) {
    try {
      const body: unknown = await context.clone().json();
      if (body && typeof body === "object") {
        const code = (body as { error?: unknown }).error;
        if (typeof code === "string" && code.trim()) {
          return new BillingError(code, functionError.message, context.status);
        }
      }
    } catch {
      // Fall through to the generic function error below.
    }
  }

  return new BillingError("function_error", functionError?.message ?? "Billing request failed");
};

export async function createCheckoutSession(cadence: BillingCadence): Promise<{
  url: string;
  sessionId: string;
}> {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { cadence },
  });

  if (error) {
    throw await readFunctionError(error);
  }

  const payload = data as Partial<{ url: string; sessionId: string }> | null;
  if (!payload?.url || !payload.sessionId) {
    throw new BillingError("invalid_response", "Checkout did not return a redirect URL");
  }

  return { url: payload.url, sessionId: payload.sessionId };
}

export async function createPortalSession(): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("create-portal-session", {
    body: {},
  });

  if (error) {
    throw await readFunctionError(error);
  }

  const payload = data as Partial<{ url: string }> | null;
  if (!payload?.url) {
    throw new BillingError("invalid_response", "Customer Portal did not return a redirect URL");
  }

  return { url: payload.url };
}
