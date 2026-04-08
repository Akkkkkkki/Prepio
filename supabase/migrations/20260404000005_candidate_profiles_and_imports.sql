-- Canonical interview profiles, import drafts, and non-destructive resume version history.
-- Made idempotent so it can safely re-run if already applied.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE resumes
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN superseded_at TIMESTAMPTZ;

    -- Backfill: mark latest profile resume as active
    WITH ranked_profile_resumes AS (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS row_number
      FROM resumes
      WHERE search_id IS NULL
    )
    UPDATE resumes
    SET
      is_active = ranked_profile_resumes.row_number = 1,
      superseded_at = CASE
        WHEN ranked_profile_resumes.row_number = 1 THEN NULL
        ELSE now()
      END
    FROM ranked_profile_resumes
    WHERE resumes.id = ranked_profile_resumes.id;

    UPDATE resumes
    SET
      is_active = false,
      superseded_at = COALESCE(superseded_at, created_at)
    WHERE search_id IS NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS resumes_user_active_profile_idx
  ON resumes (user_id)
  WHERE search_id IS NULL AND is_active;

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  experiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion_score INTEGER NOT NULL DEFAULT 0 CHECK (completion_score BETWEEN 0 AND 100),
  last_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'upload', 'search_snapshot')),
  draft_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  merge_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  import_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'dismissed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS candidate_profiles_last_resume_idx
  ON candidate_profiles (last_resume_id);

CREATE INDEX IF NOT EXISTS profile_imports_user_status_idx
  ON profile_imports (user_id, status, created_at DESC);

ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_imports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidate_profiles_own' AND tablename = 'candidate_profiles'
  ) THEN
    CREATE POLICY candidate_profiles_own ON candidate_profiles FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidate_profiles_service' AND tablename = 'candidate_profiles'
  ) THEN
    CREATE POLICY candidate_profiles_service ON candidate_profiles FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profile_imports_own' AND tablename = 'profile_imports'
  ) THEN
    CREATE POLICY profile_imports_own ON profile_imports FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profile_imports_service' AND tablename = 'profile_imports'
  ) THEN
    CREATE POLICY profile_imports_service ON profile_imports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'candidate_profiles_updated_at'
  ) THEN
    CREATE TRIGGER candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;
