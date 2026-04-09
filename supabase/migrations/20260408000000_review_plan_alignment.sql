-- Align schema with the current product review implementation plan.
-- Adds prep plan storage, real practice audio fields, safe resume versioning,
-- and missing columns already expected by the frontend and research function.

-- ============================================================================
-- SEARCHES
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'banner_dismissed'
  ) THEN
    ALTER TABLE public.searches
      ADD COLUMN banner_dismissed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'overall_fit_score'
  ) THEN
    ALTER TABLE public.searches
      ADD COLUMN overall_fit_score NUMERIC;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'preparation_priorities'
  ) THEN
    ALTER TABLE public.searches
      ADD COLUMN preparation_priorities JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'cv_job_comparison'
  ) THEN
    ALTER TABLE public.searches
      ADD COLUMN cv_job_comparison JSONB;
  END IF;
END $$;

-- ============================================================================
-- SEARCH ARTIFACTS
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'company_research_raw'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN company_research_raw JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'job_analysis_raw'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN job_analysis_raw JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'cv_analysis_raw'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN cv_analysis_raw JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'interview_stages'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN interview_stages JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'interview_questions_data'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN interview_questions_data JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'synthesis_metadata'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN synthesis_metadata JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN processing_status TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'processing_raw_save_at'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN processing_raw_save_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'processing_synthesis_end_at'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN processing_synthesis_end_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_artifacts' AND column_name = 'processing_completed_at'
  ) THEN
    ALTER TABLE public.search_artifacts
      ADD COLUMN processing_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- INTERVIEW STAGES / QUESTIONS
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_stages' AND column_name = 'preparation_tips'
  ) THEN
    ALTER TABLE public.interview_stages
      ADD COLUMN preparation_tips TEXT[] DEFAULT '{}'::text[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_stages' AND column_name = 'common_questions'
  ) THEN
    ALTER TABLE public.interview_stages
      ADD COLUMN common_questions TEXT[] DEFAULT '{}'::text[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_stages' AND column_name = 'red_flags_to_avoid'
  ) THEN
    ALTER TABLE public.interview_stages
      ADD COLUMN red_flags_to_avoid TEXT[] DEFAULT '{}'::text[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_questions' AND column_name = 'question_type'
  ) THEN
    ALTER TABLE public.interview_questions
      ADD COLUMN question_type TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_questions' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.interview_questions
      ADD COLUMN confidence_score NUMERIC;
  END IF;
END $$;

-- ============================================================================
-- PRACTICE ANSWERS
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE public.practice_answers
      ADD COLUMN audio_url TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'transcript_text'
  ) THEN
    ALTER TABLE public.practice_answers
      ADD COLUMN transcript_text TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'self_rating'
  ) THEN
    ALTER TABLE public.practice_answers
      ADD COLUMN self_rating SMALLINT CHECK (self_rating BETWEEN 1 AND 5);
  END IF;
END $$;

-- ============================================================================
-- RESUMES
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.resumes
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'superseded_at'
  ) THEN
    ALTER TABLE public.resumes
      ADD COLUMN superseded_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resumes_user_active_idx
  ON public.resumes (user_id, created_at DESC)
  WHERE search_id IS NULL AND is_active = true;

-- ============================================================================
-- PREP PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prep_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id             UUID NOT NULL REFERENCES public.searches(id) ON DELETE CASCADE UNIQUE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary               JSONB NOT NULL DEFAULT '{}'::jsonb,
  assessment_signals    JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_roadmap         JSONB NOT NULL DEFAULT '[]'::jsonb,
  prep_priorities       JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_positioning JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_plan         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prep_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prep_plans' AND policyname = 'prep_plans_own'
  ) THEN
    CREATE POLICY prep_plans_own
      ON public.prep_plans
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- PRACTICE AUDIO STORAGE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practice-audio',
  'practice-audio',
  false,
  31457280,
  ARRAY[
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp3',
    'audio/ogg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'practice_audio_select'
  ) THEN
    CREATE POLICY practice_audio_select
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'practice-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'practice_audio_insert'
  ) THEN
    CREATE POLICY practice_audio_insert
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'practice-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'practice_audio_update'
  ) THEN
    CREATE POLICY practice_audio_update
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'practice-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'practice-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'practice_audio_delete'
  ) THEN
    CREATE POLICY practice_audio_delete
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'practice-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ============================================================================
-- SAFE RESUME VERSIONING RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_resume_version(
  p_content TEXT,
  p_parsed_data JSONB DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_path TEXT DEFAULT NULL,
  p_file_size_bytes INTEGER DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
)
RETURNS public.resumes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_resume public.resumes;
  v_new_resume public.resumes;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  IF p_source NOT IN ('manual', 'upload', 'search_snapshot') THEN
    RAISE EXCEPTION 'Invalid resume source: %', p_source;
  END IF;

  SELECT *
  INTO v_current_resume
  FROM public.resumes
  WHERE user_id = v_user_id
    AND search_id IS NULL
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_resume.id IS NOT NULL THEN
    UPDATE public.resumes
    SET is_active = false,
        superseded_at = now()
    WHERE id = v_current_resume.id;
  END IF;

  INSERT INTO public.resumes (
    content,
    parsed_data,
    user_id,
    file_name,
    file_path,
    file_size_bytes,
    mime_type,
    source,
    is_active,
    superseded_at
  )
  VALUES (
    p_content,
    p_parsed_data,
    v_user_id,
    p_file_name,
    p_file_path,
    p_file_size_bytes,
    p_mime_type,
    p_source,
    true,
    NULL
  )
  RETURNING *
  INTO v_new_resume;

  RETURN v_new_resume;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_resume_version(
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  INTEGER,
  TEXT,
  TEXT
) TO authenticated;
