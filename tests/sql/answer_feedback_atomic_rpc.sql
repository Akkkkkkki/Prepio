-- DB-backed contract check for public.create_answer_feedback_atomic.
-- Run against a local or hosted non-production Supabase database:
--   DATABASE_URL=postgres://... npm run test:answer-feedback-rpc-db

BEGIN;

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '10000000-0000-0000-0000-000000000109',
  'authenticated',
  'authenticated',
  'prepio-109-answer-feedback@example.test',
  '',
  now(),
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.searches (
  id,
  user_id,
  company,
  role,
  country,
  status,
  level,
  job_description
) VALUES (
  '20000000-0000-0000-0000-000000000109',
  '10000000-0000-0000-0000-000000000109',
  'Acme',
  'Staff Product Engineer',
  'US',
  'completed',
  'senior_ic',
  'Lead platform initiatives.'
);

INSERT INTO public.practice_sessions (
  id,
  user_id,
  search_id
) VALUES (
  '30000000-0000-0000-0000-000000000109',
  '10000000-0000-0000-0000-000000000109',
  '20000000-0000-0000-0000-000000000109'
);

INSERT INTO public.interview_questions (
  id,
  search_id,
  question,
  category,
  difficulty
) VALUES (
  '40000000-0000-0000-0000-000000000109',
  '20000000-0000-0000-0000-000000000109',
  'Tell me about a time you changed technical direction after new evidence.',
  'behavioral',
  'Medium'
);

INSERT INTO public.practice_answers (
  id,
  session_id,
  question_id,
  text_answer
) VALUES (
  '50000000-0000-0000-0000-000000000109',
  '30000000-0000-0000-0000-000000000109',
  '40000000-0000-0000-0000-000000000109',
  'I changed the plan after production traces disproved our initial assumption.'
);

SELECT public.create_answer_feedback_atomic(
  '60000000-0000-0000-0000-000000000109',
  '10000000-0000-0000-0000-000000000109',
  '50000000-0000-0000-0000-000000000109',
  '30000000-0000-0000-0000-000000000109',
  '40000000-0000-0000-0000-000000000109',
  '[{"text":"Clear context","evidence":"Named the trace evidence."}]'::jsonb,
  '[{"text":"Add a metric","evidence":"Outcome was qualitative."}]'::jsonb,
  '{"situation":"clear","task":"specific","action":"specific","result":"needs metric"}'::jsonb,
  '{"text":"Add one quantified result","practicePrompt":"Rewrite with a before and after metric."}'::jsonb,
  'test-model',
  '{"source":"db-check","attempt":1}'::jsonb,
  NULL::uuid
);

DO $$
DECLARE
  v_current_count integer;
  v_current_id uuid;
BEGIN
  SELECT count(*), max(id)
    INTO v_current_count, v_current_id
    FROM public.answer_feedback
   WHERE practice_answer_id = '50000000-0000-0000-0000-000000000109'
     AND superseded_by IS NULL;

  IF v_current_count <> 1 OR v_current_id <> '60000000-0000-0000-0000-000000000109' THEN
    RAISE EXCEPTION 'first atomic insert did not create exactly one current feedback row';
  END IF;
END $$;

SELECT public.create_answer_feedback_atomic(
  '70000000-0000-0000-0000-000000000109',
  '10000000-0000-0000-0000-000000000109',
  '50000000-0000-0000-0000-000000000109',
  '30000000-0000-0000-0000-000000000109',
  '40000000-0000-0000-0000-000000000109',
  '[{"text":"Sharper context","evidence":"Named the trace evidence."}]'::jsonb,
  '[{"text":"Close with impact","evidence":"Metric still missing."}]'::jsonb,
  '{"situation":"clear","task":"specific","action":"specific","result":"clearer"}'::jsonb,
  '{"text":"Practice the ending","practicePrompt":"Close with team or system impact."}'::jsonb,
  'test-model',
  '{"source":"db-check","attempt":2}'::jsonb,
  '60000000-0000-0000-0000-000000000109'
);

DO $$
DECLARE
  v_old_superseded_by uuid;
  v_current_count integer;
  v_current_id uuid;
BEGIN
  SELECT superseded_by
    INTO v_old_superseded_by
    FROM public.answer_feedback
   WHERE id = '60000000-0000-0000-0000-000000000109';

  SELECT count(*), max(id)
    INTO v_current_count, v_current_id
    FROM public.answer_feedback
   WHERE practice_answer_id = '50000000-0000-0000-0000-000000000109'
     AND superseded_by IS NULL;

  IF v_old_superseded_by <> '70000000-0000-0000-0000-000000000109' THEN
    RAISE EXCEPTION 'regeneration did not supersede the previous current row';
  END IF;

  IF v_current_count <> 1 OR v_current_id <> '70000000-0000-0000-0000-000000000109' THEN
    RAISE EXCEPTION 'regeneration did not leave exactly one current feedback row';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM public.create_answer_feedback_atomic(
    '80000000-0000-0000-0000-000000000109',
    '10000000-0000-0000-0000-000000000109',
    '50000000-0000-0000-0000-000000000109',
    '30000000-0000-0000-0000-000000000109',
    '40000000-0000-0000-0000-000000000109',
    '[]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    'test-model',
    '{"source":"db-check","attempt":3}'::jsonb,
    '60000000-0000-0000-0000-000000000109'
  );

  RAISE EXCEPTION 'stale expected current feedback id was accepted';
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.answer_feedback
     WHERE id = '80000000-0000-0000-0000-000000000109'
  ) THEN
    RAISE EXCEPTION 'stale atomic insert left a partial feedback row';
  END IF;

  IF (
    SELECT count(*)
      FROM public.answer_feedback
     WHERE practice_answer_id = '50000000-0000-0000-0000-000000000109'
       AND superseded_by IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'stale atomic insert changed current feedback cardinality';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.create_answer_feedback_atomic(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon unexpectedly has execute privilege on create_answer_feedback_atomic';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.create_answer_feedback_atomic(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated unexpectedly has execute privilege on create_answer_feedback_atomic';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.create_answer_feedback_atomic(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role does not have execute privilege on create_answer_feedback_atomic';
  END IF;
END $$;

ROLLBACK;
