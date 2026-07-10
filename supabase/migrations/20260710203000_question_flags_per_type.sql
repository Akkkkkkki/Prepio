-- Allow a user to keep independent flags, such as favorite and needs_work,
-- on the same interview question.
ALTER TABLE public.user_question_flags
  DROP CONSTRAINT IF EXISTS user_question_flags_user_id_question_id_key;

ALTER TABLE public.user_question_flags
  ADD CONSTRAINT user_question_flags_user_id_question_id_flag_type_key
  UNIQUE (user_id, question_id, flag_type);
