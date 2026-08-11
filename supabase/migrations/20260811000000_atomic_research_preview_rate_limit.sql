-- Claim a guest preview slot in one statement so concurrent requests cannot
-- all read the same counter and independently pass the spend guard.
CREATE OR REPLACE FUNCTION public.claim_research_preview_request(
  p_fingerprint text,
  p_max_requests integer DEFAULT 8,
  p_window_seconds integer DEFAULT 3600
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_fingerprint IS NULL OR btrim(p_fingerprint) = '' THEN
    RAISE EXCEPTION 'fingerprint is required';
  END IF;
  IF p_max_requests < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate limit values must be positive';
  END IF;

  INSERT INTO public.research_preview_rate_limits AS limits (
    fingerprint,
    window_start,
    request_count,
    updated_at
  ) VALUES (
    p_fingerprint,
    now(),
    1,
    now()
  )
  ON CONFLICT (fingerprint) DO UPDATE
  SET request_count = CASE
        WHEN limits.window_start <= now() - make_interval(secs => p_window_seconds) THEN 1
        ELSE limits.request_count + 1
      END,
      window_start = CASE
        WHEN limits.window_start <= now() - make_interval(secs => p_window_seconds) THEN now()
        ELSE limits.window_start
      END,
      updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_research_preview_request(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_research_preview_request(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_research_preview_request(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_research_preview_request(text, integer, integer) TO service_role;
