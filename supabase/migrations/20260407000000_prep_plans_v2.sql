-- ============================================================================
-- V2 PREP PLANS MIGRATION
-- Replaces search_artifacts with prep_plans.
-- Updates searches.level, adds self_rating to practice_answers,
-- updates interview_stages and interview_questions for new schema.
-- Made idempotent so it can safely re-run if already applied.
-- ============================================================================

-- ============================================================================
-- 1. Update searches: replace target_seniority with level
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'level'
  ) THEN
    ALTER TABLE searches
      ADD COLUMN level TEXT CHECK (level IN ('junior','mid','senior_ic','people_manager','unknown'));

    -- Migrate existing data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'target_seniority'
    ) THEN
      UPDATE searches SET level = target_seniority WHERE target_seniority IS NOT NULL;
      UPDATE searches SET level = 'senior_ic' WHERE level = 'senior';
      ALTER TABLE searches DROP COLUMN target_seniority;
    END IF;
  END IF;
END $$;

-- Add user_note and job_description columns for intake
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'user_note'
  ) THEN
    ALTER TABLE searches ADD COLUMN user_note TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'job_description'
  ) THEN
    ALTER TABLE searches ADD COLUMN job_description TEXT;
  END IF;
END $$;

-- ============================================================================
-- 2. Create prep_plans table (replaces search_artifacts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prep_plans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id              UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE UNIQUE,
  summary                JSONB NOT NULL,
  assessment_signals     JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_roadmap          JSONB NOT NULL DEFAULT '[]'::jsonb,
  prep_priorities        JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_positioning  JSONB NOT NULL DEFAULT '{}'::jsonb,
  practice_sequence      JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_plan          JSONB NOT NULL DEFAULT '{}'::jsonb,
  internal_evidence_log  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prep_plans_search ON prep_plans(search_id);

-- RLS: users read their own; service role writes
ALTER TABLE prep_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'prep_plans_read' AND tablename = 'prep_plans'
  ) THEN
    CREATE POLICY prep_plans_read ON prep_plans FOR SELECT
      USING (search_id IN (SELECT id FROM searches WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'prep_plans_service' AND tablename = 'prep_plans'
  ) THEN
    CREATE POLICY prep_plans_service ON prep_plans FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 3. Update interview_stages for new schema
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_stages' AND column_name = 'confidence'
  ) THEN
    ALTER TABLE interview_stages
      ADD COLUMN confidence TEXT CHECK (confidence IN ('high','medium','low')),
      ADD COLUMN what_it_tests TEXT[],
      ADD COLUMN why_likely TEXT,
      ADD COLUMN prep_priority TEXT CHECK (prep_priority IN ('high','medium','low')),
      ADD COLUMN question_themes TEXT[],
      ADD COLUMN prep_actions TEXT[],
      ADD COLUMN low_confidence_guidance TEXT;
  END IF;
END $$;

-- ============================================================================
-- 4. Update interview_questions for tiered question model
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_questions' AND column_name = 'tier'
  ) THEN
    ALTER TABLE interview_questions
      ADD COLUMN tier TEXT CHECK (tier IN ('core_must_practice','likely_follow_ups','extra_depth')),
      ADD COLUMN linked_priority TEXT,
      ADD COLUMN reason TEXT,
      ADD COLUMN answer_guidance_status TEXT DEFAULT 'pending'
        CHECK (answer_guidance_status IN ('pending','generated'));
  END IF;
END $$;

-- Make stage_id nullable (questions may not be tied to a specific stage)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_questions'
      AND column_name = 'stage_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE interview_questions ALTER COLUMN stage_id DROP NOT NULL;
  END IF;
END $$;

-- Relax category constraint for new model (keep old values valid, add new)
ALTER TABLE interview_questions DROP CONSTRAINT IF EXISTS interview_questions_category_check;
ALTER TABLE interview_questions
  ADD CONSTRAINT interview_questions_category_check
  CHECK (category IN (
    'behavioral','technical','situational',
    'company_specific','role_specific',
    'experience_based','cultural_fit',
    'case','analytical','leadership','communication'
  ));

-- ============================================================================
-- 5. Add self_rating to practice_answers
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'self_rating'
  ) THEN
    ALTER TABLE practice_answers
      ADD COLUMN self_rating SMALLINT CHECK (self_rating BETWEEN 1 AND 5);
  END IF;
END $$;

-- ============================================================================
-- 6. Add completion banner dismissal tracking
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'searches' AND column_name = 'banner_dismissed'
  ) THEN
    ALTER TABLE searches
      ADD COLUMN banner_dismissed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- 7. Update profiles seniority → level
-- ============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_seniority_check;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_level_check
      CHECK (seniority IN ('junior','mid','senior','senior_ic','people_manager'));
  END IF;
END $$;

-- ============================================================================
-- 8. Keep search_artifacts for now (backward compat during transition)
-- We don't drop it yet — new code writes to prep_plans, old data stays.
-- ============================================================================
