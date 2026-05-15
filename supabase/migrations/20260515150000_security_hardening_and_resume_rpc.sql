-- Adds the missing save_resume_version RPC (called by the frontend), the
-- practice-audio storage bucket, and hardens three functions flagged by the
-- Supabase security linter (mutable search_path + anon/authenticated execute
-- on SECURITY DEFINER functions).

-- ============================================================================
-- save_resume_version RPC
-- Frontend (src/services/search/profile.ts) calls this; remote was missing it.
-- SECURITY INVOKER: runs as the caller, scoped to their own user_id.
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
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.save_resume_version(
  TEXT, JSONB, TEXT, TEXT, INTEGER, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_resume_version(
  TEXT, JSONB, TEXT, TEXT, INTEGER, TEXT, TEXT
) TO authenticated;

-- ============================================================================
-- practice-audio storage bucket + per-user RLS
-- Wires the bucket the practice-audio-transcribe edge function expects.
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
-- Harden update_search_progress
-- Was SECURITY DEFINER + executable by anon/authenticated with no ownership
-- check, so any caller could clobber any search's progress. Switch to
-- SECURITY INVOKER (only edge functions call it via service_role anyway) and
-- pin search_path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_search_progress(
  search_uuid UUID,
  new_status TEXT DEFAULT NULL,
  new_step TEXT DEFAULT NULL,
  new_percentage SMALLINT DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.searches SET
    status         = COALESCE(new_status, status),
    progress_step  = COALESCE(new_step, progress_step),
    progress_pct   = COALESCE(new_percentage, progress_pct),
    error_message  = COALESCE(error_msg, error_message),
    started_at     = CASE WHEN new_status = 'processing' AND started_at IS NULL
                     THEN now() ELSE started_at END,
    completed_at   = CASE WHEN new_status IN ('completed','failed')
                     THEN now() ELSE completed_at END,
    updated_at     = now()
  WHERE id = search_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.update_search_progress(UUID, TEXT, TEXT, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_search_progress(UUID, TEXT, TEXT, SMALLINT, TEXT) TO service_role;

-- ============================================================================
-- Harden handle_new_user
-- Trigger-only function (fires from on_auth_user_created on auth.users).
-- Triggers don't require EXECUTE on the function, so revoking PUBLIC execute
-- is safe and silences the linter. Already has SET search_path = ''.
-- ============================================================================

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ============================================================================
-- Harden update_updated_at
-- Trigger function used by profiles.updated_at. Pin search_path for hygiene.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
