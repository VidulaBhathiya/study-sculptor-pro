
-- Create roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (roles stored separately per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  has_taken_quiz BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Topics table
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Quiz questions
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Quiz attempts
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Quiz answers
CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('a','b','c','d')),
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- Learning resources
CREATE TABLE public.learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('video','document','tutorial','article')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

-- Study plans
CREATE TABLE public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Study Plan',
  hours_per_day NUMERIC DEFAULT 1,
  preferred_days TEXT[] DEFAULT '{}',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

-- Study plan items
CREATE TABLE public.study_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES public.learning_resources(id) ON DELETE SET NULL,
  scheduled_date DATE,
  duration_minutes INTEGER DEFAULT 30,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

-- Resource recommendations
CREATE TABLE public.resource_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES public.learning_resources(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.resource_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- user_roles: users can read own, admins can read all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- topics: readable by all authenticated, manageable by admin
CREATE POLICY "Anyone can read topics" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage topics" ON public.topics FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- quiz_questions: readable by all authenticated, manageable by admin
CREATE POLICY "Anyone can read questions" ON public.quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage questions" ON public.quiz_questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- quiz_attempts: own data for users, all for admins
CREATE POLICY "Users can view own attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.quiz_attempts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON public.quiz_attempts FOR UPDATE USING (auth.uid() = user_id);

-- quiz_answers
CREATE POLICY "Users can view own answers" ON public.quiz_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quiz_attempts WHERE id = quiz_answers.attempt_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can view all answers" ON public.quiz_answers FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own answers" ON public.quiz_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_attempts WHERE id = quiz_answers.attempt_id AND user_id = auth.uid())
);

-- learning_resources: readable by all, manageable by admin
CREATE POLICY "Anyone can read resources" ON public.learning_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage resources" ON public.learning_resources FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- study_plans
CREATE POLICY "Users can view own plans" ON public.study_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all plans" ON public.study_plans FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own plans" ON public.study_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.study_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.study_plans FOR DELETE USING (auth.uid() = user_id);

-- study_plan_items
CREATE POLICY "Users can view own plan items" ON public.study_plan_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.study_plans WHERE id = study_plan_items.plan_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can view all plan items" ON public.study_plan_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own plan items" ON public.study_plan_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.study_plans WHERE id = study_plan_items.plan_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update own plan items" ON public.study_plan_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.study_plans WHERE id = study_plan_items.plan_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own plan items" ON public.study_plan_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.study_plans WHERE id = study_plan_items.plan_id AND user_id = auth.uid())
);

-- resource_recommendations
CREATE POLICY "Users can view own recommendations" ON public.resource_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all recommendations" ON public.resource_recommendations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage recommendations" ON public.resource_recommendations FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own recommendations" ON public.resource_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile and assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed some topics
INSERT INTO public.topics (name, category, description) VALUES
  ('HTML Basics', 'HTML', 'Fundamental HTML tags and structure'),
  ('HTML Forms', 'HTML', 'Form elements, inputs, and validation'),
  ('HTML Semantic Elements', 'HTML', 'Semantic HTML5 elements'),
  ('CSS Selectors', 'CSS', 'CSS selectors and specificity'),
  ('CSS Box Model', 'CSS', 'Margin, padding, border, and content'),
  ('CSS Flexbox', 'CSS', 'Flexbox layout system'),
  ('CSS Grid', 'CSS', 'CSS Grid layout'),
  ('JavaScript Variables', 'JavaScript', 'Variables, data types, and scope'),
  ('JavaScript Functions', 'JavaScript', 'Function declarations and expressions'),
  ('JavaScript DOM', 'JavaScript', 'DOM manipulation and events'),
  ('JavaScript Arrays', 'JavaScript', 'Array methods and iteration'),
  ('JavaScript Async', 'JavaScript', 'Promises, async/await, and fetch');
