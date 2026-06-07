-- Profile story linking snapshots for generated interview questions.
-- The bullet is JSONB-resident in candidate_profiles, so this keeps a soft ref
-- plus the generation-time text/source shown in Practice.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'interview_questions'
      AND column_name = 'linked_story_bullet_id'
  ) THEN
    ALTER TABLE interview_questions
      ADD COLUMN linked_story_bullet_id TEXT,
      ADD COLUMN linked_story_text TEXT,
      ADD COLUMN linked_story_source TEXT;
  END IF;
END $$;
