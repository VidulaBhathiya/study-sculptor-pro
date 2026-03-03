
-- Fix all RESTRICTIVE policies to be PERMISSIVE across all tables

-- ============ profiles ============
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ user_roles ============
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ study_plans ============
DROP POLICY IF EXISTS "Users can view own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Admins can view all plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can create own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can delete own plans" ON public.study_plans;

CREATE POLICY "Users can view own plans" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all plans" ON public.study_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own plans" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ study_plan_items ============
DROP POLICY IF EXISTS "Users can view own plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Admins can view all plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Users can create own plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Users can update own plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Users can delete own plan items" ON public.study_plan_items;

CREATE POLICY "Users can view own plan items" ON public.study_plan_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.user_id = auth.uid()));
CREATE POLICY "Admins can view all plan items" ON public.study_plan_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own plan items" ON public.study_plan_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.user_id = auth.uid()));
CREATE POLICY "Users can update own plan items" ON public.study_plan_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.user_id = auth.uid()));
CREATE POLICY "Users can delete own plan items" ON public.study_plan_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.user_id = auth.uid()));

-- ============ quiz_attempts ============
DROP POLICY IF EXISTS "Users can view own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can update own attempts" ON public.quiz_attempts;

CREATE POLICY "Users can view own attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own attempts" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON public.quiz_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ quiz_answers ============
DROP POLICY IF EXISTS "Users can view own answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Admins can view all answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON public.quiz_answers;

CREATE POLICY "Users can view own answers" ON public.quiz_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.id = quiz_answers.attempt_id AND quiz_attempts.user_id = auth.uid()));
CREATE POLICY "Admins can view all answers" ON public.quiz_answers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own answers" ON public.quiz_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_attempts.id = quiz_answers.attempt_id AND quiz_attempts.user_id = auth.uid()));

-- ============ resource_recommendations ============
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.resource_recommendations;
DROP POLICY IF EXISTS "Admins can view all recommendations" ON public.resource_recommendations;
DROP POLICY IF EXISTS "Admins can manage recommendations" ON public.resource_recommendations;
DROP POLICY IF EXISTS "Users can insert own recommendations" ON public.resource_recommendations;

CREATE POLICY "Users can view own recommendations" ON public.resource_recommendations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all recommendations" ON public.resource_recommendations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage recommendations" ON public.resource_recommendations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own recommendations" ON public.resource_recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ topics ============
DROP POLICY IF EXISTS "Anyone can read topics" ON public.topics;
DROP POLICY IF EXISTS "Admins can manage topics" ON public.topics;

CREATE POLICY "Anyone can read topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Admins can manage topics" ON public.topics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ learning_resources ============
DROP POLICY IF EXISTS "Anyone can read resources" ON public.learning_resources;
DROP POLICY IF EXISTS "Admins can manage resources" ON public.learning_resources;

CREATE POLICY "Anyone can read resources" ON public.learning_resources FOR SELECT USING (true);
CREATE POLICY "Admins can manage resources" ON public.learning_resources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ quiz_questions ============
DROP POLICY IF EXISTS "Only admins can read base questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Admins can manage questions" ON public.quiz_questions;

CREATE POLICY "Only admins can read base questions" ON public.quiz_questions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage questions" ON public.quiz_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
