-- Allow both PDF and DOCX resume uploads in the shared storage bucket.
-- Idempotent: UPDATE is naturally safe to re-run.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'resume-files';
