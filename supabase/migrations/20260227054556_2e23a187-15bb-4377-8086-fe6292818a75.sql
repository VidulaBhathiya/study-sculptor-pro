
-- Create a public view that excludes correct_option
CREATE VIEW public.quiz_questions_public
WITH (security_invoker = on) AS
SELECT id, topic_id, question_text, option_a, option_b, option_c, option_d, difficulty, created_at
FROM public.quiz_questions;

-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "Anyone can read questions" ON public.quiz_questions;

-- Create a new policy: only admins can SELECT from the base table
CREATE POLICY "Only admins can read base questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.quiz_questions_public TO authenticated;
GRANT SELECT ON public.quiz_questions_public TO anon;
