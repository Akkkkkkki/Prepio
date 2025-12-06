-- Add rubric-focused metadata to interview questions
ALTER TABLE public.interview_questions
  ADD COLUMN depth_label TEXT,
  ADD COLUMN good_answer_signals TEXT[],
  ADD COLUMN weak_answer_signals TEXT[],
  ADD COLUMN seniority_expectation TEXT,
  ADD COLUMN sample_answer_outline TEXT;

COMMENT ON COLUMN public.interview_questions.depth_label IS 'Short descriptor that explains the expected depth for this question';
COMMENT ON COLUMN public.interview_questions.good_answer_signals IS 'Array of bullet points that describe what interviewers look for in a strong response';
COMMENT ON COLUMN public.interview_questions.weak_answer_signals IS 'Array of bullet points that describe common pitfalls or red flags';
COMMENT ON COLUMN public.interview_questions.seniority_expectation IS 'One-line summary of how seniority impacts the expected answer';
COMMENT ON COLUMN public.interview_questions.sample_answer_outline IS 'High-level outline structure candidates can follow when answering.';

