-- Add resume file metadata, search snapshots, and the storage bucket used for uploads.

ALTER TABLE resumes
ADD COLUMN search_id UUID REFERENCES searches(id) ON DELETE CASCADE,
ADD COLUMN file_name TEXT,
ADD COLUMN file_path TEXT,
ADD COLUMN file_size_bytes INTEGER,
ADD COLUMN mime_type TEXT,
ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'upload', 'search_snapshot'));

CREATE INDEX resumes_user_profile_idx
  ON resumes (user_id, created_at DESC)
  WHERE search_id IS NULL;

CREATE INDEX resumes_search_snapshot_idx
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

CREATE POLICY resume_files_select
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resume-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY resume_files_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resume-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY resume_files_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resume-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'resume-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY resume_files_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resume-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
