const jsonHeaders = {
  "Content-Type": "application/json",
};

const getBearerToken = (req: Request) => {
  const authorization = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
};

const isPrivilegedToken = (token: string | null) => {
  if (!token) {
    return false;
  }

  const privilegedKeys = [
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    Deno.env.get("SUPABASE_SECRET_KEY"),
  ].filter((value): value is string => Boolean(value));

  return privilegedKeys.includes(token);
};

export interface AuthorizedRequestContext {
  kind: "service" | "user";
  token: string;
  userId: string | null;
}

export async function authorizeRequest(
  req: Request,
  supabase: {
    auth: {
      getUser: (
        jwt: string,
      ) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
    };
  },
): Promise<
  { ok: true; context: AuthorizedRequestContext } | { ok: false; response: Response }
> {
  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Missing bearer token" }),
        { status: 401, headers: jsonHeaders },
      ),
    };
  }

  if (isPrivilegedToken(token)) {
    return {
      ok: true,
      context: {
        kind: "service",
        token,
        userId: null,
      },
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: error?.message || "Invalid or expired bearer token",
        }),
        { status: 401, headers: jsonHeaders },
      ),
    };
  }

  return {
    ok: true,
    context: {
      kind: "user",
      token,
      userId: data.user.id,
    },
  };
}
