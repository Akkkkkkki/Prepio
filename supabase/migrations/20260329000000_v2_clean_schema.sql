-- ============================================================================
-- V2 CLEAN SCHEMA
-- Fresh start for new Supabase project (vjwrirrqprjzdorignlz)
-- Designed from product requirements, not inherited from v1 cruft
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- TABLE 1: profiles
-- Auto-created on signup via trigger. Stores user preferences.
-- ============================================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  seniority   TEXT CHECK (seniority IN ('junior','mid','senior')),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 2: searches
-- One row per company+role research session. Progress tracked here.
-- ============================================================================
CREATE TABLE searches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company            TEXT NOT NULL,
  role               TEXT,
  country            TEXT,
  role_links         TEXT,
  target_seniority   TEXT CHECK (target_seniority IN ('junior','mid','senior')),
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','failed')),
  progress_step      TEXT DEFAULT 'Initializing...',
  progress_pct       SMALLINT DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 3: resumes
-- User CV storage. Latest resume loaded by created_at DESC.
-- ============================================================================
CREATE TABLE resumes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  parsed_data JSONB,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 4: search_artifacts
-- Raw research data + synthesized results. Frontend reads only
-- comparison_analysis and preparation_guidance.
-- ============================================================================
CREATE TABLE search_artifacts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id              UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE UNIQUE,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comparison_analysis    JSONB,
  preparation_guidance   JSONB,
  raw_research           JSONB,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 5: interview_stages
-- 7 stages per search (Phone Screen, Technical, Onsite, etc.)
-- ============================================================================
CREATE TABLE interview_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id   UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  duration    TEXT,
  interviewer TEXT,
  content     TEXT,
  guidance    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 6: interview_questions
-- 120-150 questions per search with answer guidance and rubric fields.
-- ============================================================================
CREATE TABLE interview_questions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id                 UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  stage_id                  UUID NOT NULL REFERENCES interview_stages(id) ON DELETE CASCADE,
  question                  TEXT NOT NULL,
  category                  TEXT NOT NULL CHECK (category IN (
                              'behavioral','technical','situational',
                              'company_specific','role_specific',
                              'experience_based','cultural_fit'
                            )),
  difficulty                TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  rationale                 TEXT,
  suggested_answer_approach TEXT,
  evaluation_criteria       TEXT[],
  follow_up_questions       TEXT[],
  company_context           TEXT,
  star_story_fit            BOOLEAN DEFAULT false,
  depth_label               TEXT,
  good_answer_signals       TEXT[],
  weak_answer_signals       TEXT[],
  seniority_expectation     TEXT,
  sample_answer_outline     TEXT,
  created_at                TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 7: user_question_flags
-- Favorite / needs_work / skipped per user per question.
-- ============================================================================
CREATE TABLE user_question_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  flag_type   TEXT NOT NULL CHECK (flag_type IN ('favorite','needs_work','skipped')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- ============================================================================
-- TABLE 8: practice_sessions
-- One row per practice attempt.
-- ============================================================================
CREATE TABLE practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_id     UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at  TIMESTAMPTZ,
  session_notes TEXT
);

-- ============================================================================
-- TABLE 9: practice_answers
-- User's text answers per question in a session.
-- ============================================================================
CREATE TABLE practice_answers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id         UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  text_answer         TEXT,
  answer_time_seconds INTEGER,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 10: scraped_urls
-- Backend-only URL cache for research pipeline deduplication.
-- ============================================================================
CREATE TABLE scraped_urls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url                   TEXT NOT NULL,
  url_hash              TEXT NOT NULL,
  company_name          TEXT NOT NULL,
  role_title            TEXT,
  domain                TEXT,
  title                 TEXT,
  full_content          TEXT,
  ai_summary            TEXT,
  content_quality_score FLOAT DEFAULT 0.0,
  times_reused          INTEGER DEFAULT 0,
  first_scraped_at      TIMESTAMPTZ DEFAULT now(),
  last_reused_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(url_hash, company_name)
);

-- ============================================================================
-- TABLE 11: tavily_searches
-- API call logging for cost tracking and analytics.
-- ============================================================================
CREATE TABLE tavily_searches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id           UUID REFERENCES searches(id) ON DELETE CASCADE,
  api_type            TEXT NOT NULL CHECK (api_type IN ('search','extract')),
  query_text          TEXT NOT NULL,
  response_status     INTEGER NOT NULL,
  results_count       INTEGER DEFAULT 0,
  request_duration_ms INTEGER,
  credits_used        INTEGER DEFAULT 1,
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Search listing and progress polling
CREATE INDEX idx_searches_user       ON searches(user_id, created_at DESC);
CREATE INDEX idx_searches_processing ON searches(status) WHERE status IN ('pending','processing');

-- Dashboard: load stages + questions
CREATE INDEX idx_stages_search       ON interview_stages(search_id);
CREATE INDEX idx_questions_stage     ON interview_questions(stage_id);
CREATE INDEX idx_questions_search    ON interview_questions(search_id);

-- Practice: filter questions by category/difficulty
CREATE INDEX idx_questions_filter    ON interview_questions(search_id, category, difficulty);

-- Practice: load answers and sessions
CREATE INDEX idx_answers_session     ON practice_answers(session_id);
CREATE INDEX idx_sessions_search     ON practice_sessions(search_id, user_id);

-- Backend: URL deduplication lookups
CREATE INDEX idx_scraped_company     ON scraped_urls(company_name, role_title);

-- Tavily analytics
CREATE INDEX idx_tavily_search       ON tavily_searches(search_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- profiles: users see/edit only their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own ON profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- searches: users manage their own; service role updates progress
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY searches_own ON searches FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY searches_service ON searches FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- search_artifacts: users read their own; service role writes
ALTER TABLE search_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY artifacts_read ON search_artifacts FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY artifacts_service ON search_artifacts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- interview_stages: readable if user owns the search
ALTER TABLE interview_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY stages_read ON interview_stages FOR SELECT
  USING (search_id IN (SELECT id FROM searches WHERE user_id = auth.uid()));
CREATE POLICY stages_service ON interview_stages FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- interview_questions: readable if user owns the search
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY questions_read ON interview_questions FOR SELECT
  USING (search_id IN (SELECT id FROM searches WHERE user_id = auth.uid()));
CREATE POLICY questions_service ON interview_questions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- user_question_flags: users manage their own
ALTER TABLE user_question_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY flags_own ON user_question_flags FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- practice_sessions: users manage their own
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_own ON practice_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- practice_answers: users manage answers in their own sessions
ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY answers_own ON practice_answers FOR ALL
  USING (session_id IN (SELECT id FROM practice_sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM practice_sessions WHERE user_id = auth.uid()));

-- resumes: users manage their own; service role can read for analysis
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY resumes_own ON resumes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY resumes_service ON resumes FOR SELECT
  TO service_role USING (true);

-- scraped_urls: service role only (backend cache, no user access)
ALTER TABLE scraped_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY scraped_service ON scraped_urls FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- tavily_searches: users can read their own search logs; service role writes
ALTER TABLE tavily_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tavily_read ON tavily_searches FOR SELECT
  USING (search_id IN (SELECT id FROM searches WHERE user_id = auth.uid()));
CREATE POLICY tavily_service ON tavily_searches FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Progress tracking RPC (called by edge functions via progress-tracker.ts)
CREATE OR REPLACE FUNCTION update_search_progress(
  search_uuid UUID,
  new_status TEXT DEFAULT NULL,
  new_step TEXT DEFAULT NULL,
  new_percentage SMALLINT DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE searches SET
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER searches_updated_at BEFORE UPDATE ON searches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER flags_updated_at BEFORE UPDATE ON user_question_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- REALTIME (for search progress subscriptions)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE searches;
