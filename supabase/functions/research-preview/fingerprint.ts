// Rate-limit fingerprint for the guest preview function. Uses only the first
// IP from `x-forwarded-for` (set by Supabase's edge gateway, not client-
// controllable). Client headers like `x-preview-session` and `user-agent` are
// intentionally not part of the key — including them lets a caller from one
// IP rotate the header and land in a separate `research_preview_rate_limits`
// row, defeating the per-fingerprint cap. See PREPIO-61.
export const getFingerprint = (req: Request): string => {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor && forwardedFor.length ? forwardedFor : "unknown";
};
