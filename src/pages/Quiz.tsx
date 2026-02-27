import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ArrowRight, Trophy, Code2, BookOpen, Zap } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  topic_id: string;
}

export default function Quiz() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; selected: string; correct: boolean }[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) {
      setLoading(true);
      fetchQuestions();
    }
  }, [started]);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("quiz_questions_public" as any)
      .select("*")
      .order("created_at");

    if (error) {
      toast.error("Failed to load questions");
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      toast.error("No quiz questions available. Ask an admin to add some!");
      setLoading(false);
      return;
    }

    // Shuffle and take up to 20 questions
    const shuffled = (data as unknown as Question[]).sort(() => Math.random() - 0.5).slice(0, 20);
    setQuestions(shuffled);
    setLoading(false);
  };

  const handleSelect = (option: string) => {
    if (showResult) return;
    setSelected(option);
  };

  const handleSubmitAnswer = async () => {
    if (!selected) return;
    const question = questions[currentIndex];
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("check-answer", {
        body: { question_id: question.id, selected_option: selected },
      });
      
      if (response.error) {
        toast.error("Failed to check answer");
        return;
      }
      
      const { is_correct, correct_option } = response.data;
      // Store correct_option temporarily for UI display
      (question as any).correct_option = correct_option;
      setAnswers([...answers, { questionId: question.id, selected, correct: is_correct }]);
      setShowResult(true);
    } catch (err) {
      toast.error("Failed to check answer");
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      finishQuiz();
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelected(null);
      setShowResult(false);
    }
  };

  const finishQuiz = async () => {
    setSubmitting(true);
    const allAnswers = [...answers];
    const score = allAnswers.filter((a) => a.correct).length;

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: user!.id,
        score,
        total_questions: questions.length,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) {
      toast.error("Failed to save quiz results");
      setSubmitting(false);
      return;
    }

    // Save all answers
    const answerRows = allAnswers.map((a) => ({
      attempt_id: attempt.id,
      question_id: a.questionId,
      selected_option: a.selected,
      is_correct: a.correct,
    }));

    await supabase.from("quiz_answers").insert(answerRows);

    // Mark quiz as taken
    await supabase
      .from("profiles")
      .update({ has_taken_quiz: true })
      .eq("user_id", user!.id);

    // Generate recommendations for weak topics
    const wrongAnswers = allAnswers.filter((a) => !a.correct);
    const weakTopicIds = [...new Set(wrongAnswers.map((a) => {
      const q = questions.find((q) => q.id === a.questionId);
      return q?.topic_id;
    }).filter(Boolean))];

    if (weakTopicIds.length > 0) {
      // Fetch resources for weak topics
      const { data: resources } = await supabase
        .from("learning_resources")
        .select("id, topic_id")
        .in("topic_id", weakTopicIds as string[]);

      if (resources && resources.length > 0) {
        const recs = resources.map((r) => ({
          user_id: user!.id,
          resource_id: r.id,
          topic_id: r.topic_id,
          reason: "Recommended based on placement quiz performance",
        }));
        await supabase.from("resource_recommendations").insert(recs);
      }
    }

    await refreshProfile();
    setQuizComplete(true);
    setSubmitting(false);
  };

  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + (showResult ? 1 : 0)) / questions.length) * 100 : 0;

  if (quizComplete) {
    const score = answers.filter((a) => a.correct).length;
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center space-y-6 py-12">
          <div className="h-20 w-20 rounded-full accent-gradient flex items-center justify-center mx-auto animate-scale-in">
            <Trophy className="h-10 w-10 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold">Quiz Complete!</h1>
          <div className="text-5xl font-display font-bold text-secondary">{percentage}%</div>
          <p className="text-muted-foreground">
            You scored {score} out of {questions.length} questions correctly.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild>
              <a href="/dashboard">View Dashboard</a>
            </Button>
            <Button variant="secondary" asChild>
              <a href="/recommendations">View Resources</a>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!started) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold">Placement Quiz</h1>
            <p className="text-muted-foreground mt-2">
              We'll assess your skills in these three core areas to build a personalized learning path.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <Card className="shadow-card text-center">
              <CardContent className="pt-8 pb-6 flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Code2 className="h-7 w-7 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg">HTML</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Structure & semantics — headings, forms, tables, and accessibility basics.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card text-center">
              <CardContent className="pt-8 pb-6 flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-secondary-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg">CSS</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Layout & styling — flexbox, grid, responsive design, and animations.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card text-center">
              <CardContent className="pt-8 pb-6 flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Zap className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg">JavaScript</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Logic & interactivity — variables, functions, DOM manipulation, and async.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button variant="hero" size="lg" className="px-10 text-base" onClick={() => setStarted(true)}>
              Begin Quiz
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Placement Quiz</h1>
          <p className="text-muted-foreground mt-1">
            Answer the following questions to assess your skills
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No questions available yet. Please check back later.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 [&>div]:bg-secondary" />
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-lg leading-relaxed">
                  {currentQ?.question_text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["a", "b", "c", "d"].map((opt) => {
                  const text = currentQ?.[`option_${opt}` as keyof Question] as string;
                  const isSelected = selected === opt;
                  const isCorrect = opt === currentQ?.correct_option;
                  let borderClass = "border-border hover:border-secondary/50";
                  if (showResult) {
                    if (isCorrect) borderClass = "border-success bg-success/10";
                    else if (isSelected && !isCorrect) borderClass = "border-destructive bg-destructive/10";
                  } else if (isSelected) {
                    borderClass = "border-secondary bg-secondary/10";
                  }

                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      disabled={showResult}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${borderClass} flex items-center gap-3`}
                    >
                      <span className="h-8 w-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-bold shrink-0 uppercase">
                        {opt}
                      </span>
                      <span className="flex-1">{text}</span>
                      {showResult && isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                      {showResult && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                    </button>
                  );
                })}

                <div className="flex justify-end gap-3 pt-4">
                  {!showResult ? (
                    <Button onClick={handleSubmitAnswer} disabled={!selected}>
                      Submit Answer
                    </Button>
                  ) : (
                    <Button onClick={handleNext} disabled={submitting}>
                      {currentIndex + 1 >= questions.length ? (
                        submitting ? "Finishing..." : "Finish Quiz"
                      ) : (
                        <>
                          Next <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
