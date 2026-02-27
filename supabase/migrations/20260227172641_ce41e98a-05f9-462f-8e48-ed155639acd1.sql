
DROP VIEW IF EXISTS public.quiz_questions_public;

CREATE VIEW public.quiz_questions_public
WITH (security_invoker = false) AS
SELECT 
  id,
  topic_id,
  created_at,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  difficulty
FROM public.quiz_questions;
