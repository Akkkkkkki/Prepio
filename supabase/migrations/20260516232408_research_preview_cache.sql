CREATE TABLE IF NOT EXISTS public.research_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  company text NOT NULL,
  role text,
  country text,
  confidence text NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('high', 'medium', 'low')),
  source_summary text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_previews_cache_key
  ON public.research_previews (cache_key);

CREATE INDEX IF NOT EXISTS idx_research_previews_expires_at
  ON public.research_previews (expires_at);

ALTER TABLE public.research_previews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_previews_service ON public.research_previews;
CREATE POLICY research_previews_service
  ON public.research_previews
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.research_preview_rate_limits (
  fingerprint text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_preview_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_preview_rate_limits_service ON public.research_preview_rate_limits;
CREATE POLICY research_preview_rate_limits_service
  ON public.research_preview_rate_limits
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.research_previews TO service_role;
GRANT ALL ON TABLE public.research_preview_rate_limits TO service_role;
