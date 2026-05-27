-- ============================================================================
-- ANSWER FEEDBACK
-- Paid structured coaching feedback for a submitted practice answer.
-- Contract: PREPIO-5
-- ============================================================================

CREATE TABLE answer_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id         UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  practice_answer_id  UUID REFERENCES practice_answers(id) ON DELETE SET NULL,

  -- Stable coaching shape consumed by Practice and History surfaces.
  strengths           JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements        JSONB NOT NULL DEFAULT '[]'::jsonb,
  star_breakdown      JSONB NOT NULL,
  next_action         JSONB NOT NULL,

  model               TEXT,
  generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  superseded_by       UUID REFERENCES answer_feedback(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT answer_feedback_strengths_array
    CHECK (jsonb_typeof(strengths) = 'array'),
  CONSTRAINT answer_feedback_improvements_array
    CHECK (jsonb_typeof(improvements) = 'array'),
  CONSTRAINT answer_feedback_star_breakdown_object
    CHECK (jsonb_typeof(star_breakdown) = 'object'),
  CONSTRAINT answer_feedback_next_action_object
    CHECK (jsonb_typeof(next_action) = 'object'),
  CONSTRAINT answer_feedback_generation_metadata_object
    CHECK (jsonb_typeof(generation_metadata) = 'object'),
  CONSTRAINT answer_feedback_not_self_superseded
    CHECK (superseded_by IS NULL OR superseded_by <> id)
);

COMMENT ON COLUMN answer_feedback.strengths IS
  'Array of coaching strengths. Each item should include concise text and optional evidence.';
COMMENT ON COLUMN answer_feedback.improvements IS
  'Array of coaching improvements. Each item should include concise text and optional rewrite guidance.';
COMMENT ON COLUMN answer_feedback.star_breakdown IS
  'Object with situation, task, action, and result coaching fields.';
COMMENT ON COLUMN answer_feedback.next_action IS
  'Single top next action object for the next practice attempt.';
COMMENT ON COLUMN answer_feedback.superseded_by IS
  'Points to the replacement feedback row when feedback is regenerated.';

CREATE INDEX idx_answer_feedback_user
  ON answer_feedback(user_id, created_at DESC);
CREATE INDEX idx_answer_feedback_session
  ON answer_feedback(practice_session_id, created_at DESC);
CREATE INDEX idx_answer_feedback_question
  ON answer_feedback(question_id, created_at DESC);
CREATE UNIQUE INDEX idx_answer_feedback_current
  ON answer_feedback(practice_answer_id)
  WHERE superseded_by IS NULL AND practice_answer_id IS NOT NULL;

CREATE TRIGGER answer_feedback_updated_at
  BEFORE UPDATE ON answer_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Users can read their generated feedback; writes stay server-side because
-- entitlement and model calls are enforced in Edge Functions.
ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY answer_feedback_own_read ON answer_feedback FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY answer_feedback_service ON answer_feedback FOR ALL
  TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON answer_feedback TO authenticated;
GRANT ALL ON answer_feedback TO service_role;
