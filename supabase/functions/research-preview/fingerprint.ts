// Rate-limit fingerprint for the guest preview function. Uses the first IP
// from `x-forwarded-for` (set by Supabase's edge gateway) and a coarse
// user-agent bucket. Client-controlled session headers are intentionally not
// trusted — see PREPIO-61.
export const getFingerprint = (req: Request): string => {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = req.headers.get("user-agent")?.trim() ?? "";
  const ip = forwardedFor && forwardedFor.length ? forwardedFor : "unknown";
  const uaBucket = userAgent.slice(0, 64);
  return uaBucket ? `${ip}|${uaBucket}` : ip;
};
