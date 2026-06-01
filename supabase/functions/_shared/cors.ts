const DEFAULT_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

const readAllowedOriginsFromEnv = (): string[] | null => {
  const denoEnv = (globalThis as { Deno?: { env: { get: (name: string) => string | undefined } } }).Deno?.env;
  const raw = denoEnv?.get("APP_ALLOWED_ORIGINS");
  if (!raw) return null;
  const list = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return list.length ? list : null;
};

export interface BuildCorsHeadersOptions {
  allowHeaders?: string;
  allowedOrigins?: string[] | null;
}

export function buildCorsHeaders(
  req: Request,
  options: BuildCorsHeadersOptions = {},
): Record<string, string> {
  const allowHeaders = options.allowHeaders ?? DEFAULT_ALLOW_HEADERS;
  const configured =
    options.allowedOrigins !== undefined ? options.allowedOrigins : readAllowedOriginsFromEnv();

  if (!configured || !configured.length) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": allowHeaders,
    };
  }

  const requestOrigin = req.headers.get("origin");
  const matched = requestOrigin && configured.includes(requestOrigin) ? requestOrigin : configured[0];

  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Headers": allowHeaders,
    "Vary": "Origin",
  };
}
