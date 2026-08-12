-- Profile story linking snapshots for generated interview questions.
-- Candidate bullets live in candidate_profiles JSONB, so keep a soft ref plus
-- generation-time text/source snapshots for stable Practice rendering.
ALTER TABLE public.interview_questions
  ADD COLUMN IF NOT EXISTS linked_story_bullet_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_story_text TEXT,
  ADD COLUMN IF NOT EXISTS linked_story_source TEXT;
