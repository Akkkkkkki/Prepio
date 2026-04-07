-- Add resume file metadata, search snapshots, and the storage bucket used for uploads.
-- Made idempotent so it can safely re-run if already applied.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'search_id'
  ) THEN
    ALTER TABLE resumes
      ADD COLUMN search_id UUID REFERENCES searches(id) ON DELETE CASCADE,
      ADD COLUMN file_name TEXT,
      ADD COLUMN file_path TEXT,
      ADD COLUMN file_size_bytes INTEGER,
      ADD COLUMN mime_type TEXT,
      ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'upload', 'search_snapshot'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resumes_user_profile_idx
  ON resumes (user_id, created_at DESC)
  WHERE search_id IS NULL;

CREATE INDEX IF NOT EXISTS resumes_search_snapshot_idx
  ON resumes (search_id, created_at DESC)
  WHERE search_id IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resume-files',
  'resume-files',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'resume_files_select' AND tablename = 'objects'
  ) THEN
    CREATE POLICY resume_files_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'resume-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'resume_files_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY resume_files_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'resume-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'resume_files_update' AND tablename = 'objects'
  ) THEN
    CREATE POLICY resume_files_update ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'resume-files' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'resume-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'resume_files_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY resume_files_delete ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'resume-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
