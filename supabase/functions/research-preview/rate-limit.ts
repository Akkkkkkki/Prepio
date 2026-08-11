export interface RateLimitRpcClient {
  rpc<T>(fn: string, args: Record<string, unknown>): PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>;
}

export const claimPreviewRequest = async (
  supabase: RateLimitRpcClient,
  fingerprint: string,
): Promise<boolean> => {
  const { data, error } = await supabase.rpc<boolean>("claim_research_preview_request", {
    p_fingerprint: fingerprint,
    p_max_requests: 8,
    p_window_seconds: 60 * 60,
  });

  if (error) {
    throw new Error(`Unable to enforce preview rate limit: ${error.message}`);
  }

  // Fail closed if PostgREST returns an unexpected null response.
  return data === true;
};
