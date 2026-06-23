-- ============================================================================
-- ANSWER FEEDBACK ATOMIC SUPERSESSION (PREPIO-109)
--
-- Concurrent regenerations used to perform insert -> supersede old -> mark new
-- current as separate PostgREST statements. The partial unique index enforces a
-- single current row, but the loser of a mark-current race had to repair history
-- after partial writes. This RPC serializes the supersession for a single
-- practice answer and lets callers map a stale expected head to a 409.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_answer_feedback_atomic(
  p_feedback_id                  UUID,
  p_user_id                      UUID,
  p_practice_answer_id           UUID,
  p_practice_session_id          UUID,
  p_question_id                  UUID,
  p_strengths                    JSONB,
  p_improvements                 JSONB,
  p_star_breakdown               JSONB,
  p_next_action                  JSONB,
  p_model                        TEXT,
  p_generation_metadata          JSONB,
  p_expected_current_feedback_id UUID
) RETURNS public.answer_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_id UUID;
  v_inserted public.answer_feedback;
BEGIN
  -- Transaction-scoped lock keyed by answer id. This serializes the "no current
  -- row exists yet" case as well as normal regeneration for the same answer,
  -- without blocking feedback writes for unrelated answers.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_practice_answer_id::TEXT, 0));

  SELECT id
    INTO v_current_id
    FROM public.answer_feedback
   WHERE practice_answer_id = p_practice_answer_id
     AND superseded_by IS NULL
   LIMIT 1
   FOR UPDATE;

  IF v_current_id IS DISTINCT FROM p_expected_current_feedback_id THEN
    RAISE EXCEPTION
      USING ERRCODE = '23505',
            MESSAGE = 'current answer feedback changed before atomic insert';
  END IF;

  INSERT INTO public.answer_feedback (
    id,
    user_id,
    practice_answer_id,
    practice_session_id,
    question_id,
    strengths,
    improvements,
    star_breakdown,
    next_action,
    model,
    generation_metadata,
    superseded_by
  ) VALUES (
    p_feedback_id,
    p_user_id,
    p_practice_answer_id,
    p_practice_session_id,
    p_question_id,
    p_strengths,
    p_improvements,
    p_star_breakdown,
    p_next_action,
    p_model,
    p_generation_metadata,
    v_current_id
  )
  RETURNING * INTO v_inserted;

  IF v_current_id IS NOT NULL THEN
    UPDATE public.answer_feedback
       SET superseded_by = p_feedback_id
     WHERE id = v_current_id;

    UPDATE public.answer_feedback
       SET superseded_by = NULL
     WHERE id = p_feedback_id
     RETURNING * INTO v_inserted;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_answer_feedback_atomic(
  UUID, UUID, UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, TEXT, JSONB, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_answer_feedback_atomic(
  UUID, UUID, UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, TEXT, JSONB, UUID
) TO service_role;
