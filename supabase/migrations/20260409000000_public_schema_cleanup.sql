-- Canonical public schema cleanup.
-- Destructive by design: moves backend-only tables to ops, removes legacy
-- compatibility tables/columns, and tightens canonical invariants.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;

REVOKE ALL ON SCHEMA ops FROM PUBLIC;
REVOKE ALL ON SCHEMA ops FROM anon;
REVOKE ALL ON SCHEMA ops FROM authenticated;
GRANT USAGE ON SCHEMA ops TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scraped_urls'
  ) THEN
    EXECUTE 'ALTER TABLE public.scraped_urls SET SCHEMA ops';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tavily_searches'
  ) THEN
    EXECUTE 'ALTER TABLE public.tavily_searches SET SCHEMA ops';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.find_reusable_urls_simple(text,text,integer,double precision)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.find_reusable_urls_simple(text, text, integer, double precision) SET SCHEMA ops';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.increment_url_reuse_count(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.increment_url_reuse_count(uuid) SET SCHEMA ops';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'seniority'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'level'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN seniority TO level;
  END IF;
END $$;

UPDATE public.profiles
SET level = CASE
  WHEN level = 'senior' THEN 'senior_ic'
  WHEN level IN ('junior', 'mid', 'senior_ic', 'people_manager') THEN level
  ELSE NULL
END
WHERE level IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_seniority_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_level_check
  CHECK (level IS NULL OR level IN ('junior', 'mid', 'senior_ic', 'people_manager'));

DO $$
DECLARE
  role_links_udt text;
BEGIN
  SELECT c.udt_name
  INTO role_links_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'searches'
    AND c.column_name = 'role_links';

  IF role_links_udt = 'text' THEN
    ALTER TABLE public.searches
      ALTER COLUMN role_links TYPE text[]
      USING CASE
        WHEN role_links IS NULL OR btrim(role_links) = '' THEN '{}'::text[]
        ELSE regexp_split_to_array(role_links, E'\\s*\\n\\s*')
      END;
  END IF;
END $$;

ALTER TABLE public.searches ALTER COLUMN role_links SET DEFAULT '{}'::text[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'audio_url'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'audio_path'
  ) THEN
    ALTER TABLE public.practice_answers RENAME COLUMN audio_url TO audio_path;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'audio_path'
  ) THEN
    ALTER TABLE public.practice_answers ADD COLUMN audio_path text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'transcript_text'
  ) THEN
    ALTER TABLE public.practice_answers ADD COLUMN transcript_text text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'self_rating'
  ) THEN
    ALTER TABLE public.practice_answers
      ADD COLUMN self_rating smallint CHECK (self_rating BETWEEN 1 AND 5);
  END IF;
END $$;

INSERT INTO public.prep_plans (
  search_id,
  summary,
  assessment_signals,
  stage_roadmap,
  prep_priorities,
  candidate_positioning,
  practice_sequence,
  question_plan,
  internal_evidence_log,
  created_at
)
SELECT
  s.id,
  jsonb_build_object(
    'company', s.company,
    'roleName', s.role,
    'industryFocus', 'unknown',
    'level', COALESCE(s.level, 'unknown'),
    'overallConfidence', 'low',
    'weakSignalCase', false
  ),
  '[]'::jsonb,
  '[]'::jsonb,
  COALESCE(sa.preparation_guidance, '[]'::jsonb),
  COALESCE(
    sa.comparison_analysis,
    jsonb_build_object(
      'strengthsToLeanOn', '[]'::jsonb,
      'weakSpotsToAddress', '[]'::jsonb,
      'storyCoverageGaps', '[]'::jsonb,
      'mismatchRisks', '[]'::jsonb
    )
  ),
  '[]'::jsonb,
  jsonb_build_object(
    'coreMustPractice', '[]'::jsonb,
    'likelyFollowUps', '[]'::jsonb,
    'extraDepth', '[]'::jsonb
  ),
  '[]'::jsonb,
  COALESCE(sa.created_at, now())
FROM public.searches s
JOIN public.search_artifacts sa
  ON sa.search_id = s.id
LEFT JOIN public.prep_plans pp
  ON pp.search_id = s.id
WHERE pp.search_id IS NULL;

ALTER TABLE public.searches DROP COLUMN IF EXISTS overall_fit_score;
ALTER TABLE public.searches DROP COLUMN IF EXISTS preparation_priorities;
ALTER TABLE public.searches DROP COLUMN IF EXISTS cv_job_comparison;

DROP TABLE IF EXISTS public.search_artifacts;

ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_profile_or_snapshot_source_check;
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_snapshot_inactive_check;

ALTER TABLE public.resumes
  ADD CONSTRAINT resumes_profile_or_snapshot_source_check
  CHECK (
    (search_id IS NULL AND source IN ('manual', 'upload')) OR
    (search_id IS NOT NULL AND source = 'search_snapshot')
  );

ALTER TABLE public.resumes
  ADD CONSTRAINT resumes_snapshot_inactive_check
  CHECK (search_id IS NULL OR is_active = false);

COMMIT;
