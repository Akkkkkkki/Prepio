import { supabase } from "@/integrations/supabase/client";

export class AccountError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message?: string, status?: number) {
    super(message ?? code);
    this.name = "AccountError";
    this.code = code;
    this.status = status;
  }
}

type FunctionErrorShape = {
  message?: string;
  context?: Response;
};

const getAccountRedirectUrl = () =>
  typeof window === "undefined" ? undefined : `${window.location.origin}/profile/account`;

const readFunctionError = async (error: unknown): Promise<AccountError> => {
  const functionError = error as FunctionErrorShape;
  const context = functionError?.context;

  if (context) {
    try {
      const body: unknown = await context.clone().json();
      if (body && typeof body === "object") {
        const code = (body as { error?: unknown }).error;
        if (typeof code === "string" && code.trim()) {
          return new AccountError(code, functionError.message, context.status);
        }
      }
    } catch {
      // Fall through to the generic function error below.
    }
  }

  return new AccountError("function_error", functionError?.message ?? "Account request failed");
};

export async function updateAccountEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: getAccountRedirectUrl() },
  );

  if (error) {
    throw new AccountError("email_update_failed", error.message);
  }
}

export async function updateAccountPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new AccountError("password_update_failed", error.message);
  }
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", {
    body: { confirmation: "DELETE" },
  });

  if (error) {
    throw await readFunctionError(error);
  }

  await supabase.auth.signOut();
}
