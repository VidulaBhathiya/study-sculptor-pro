import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ArrowRight, Trophy, Code2, Palette, Zap, Sparkles, Target, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const startQuiz = (category: string) => {
    setSelectedCategory(category);
    setStarted(true);
    setLoading(true);
    fetchQuestions(category);
  };

  const fetchQuestions = async (category: string) => {
    // First get topics to filter by category
    let topicIds: string[] | null = null;
    const { data: topics } = await supabase
      .from("topics")
      .select("id")
      .ilike("category", category);
    topicIds = topics?.map((t) => t.id) || [];
    if (topicIds.length === 0) {
      toast.error(`No ${category} questions available yet.`);
      setLoading(false);
      setStarted(false);
      return;
    }

    let query = supabase
      .from("quiz_questions_public" as any)
      .select("*")
      .in("topic_id", topicIds)
      .order("created_at");

    const { data, error } = await query;

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

  const userName = user?.user_metadata?.full_name || "Learner";

  if (quizComplete) {
    const score = answers.filter((a) => a.correct).length;
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-lg mx-auto text-center space-y-6 py-12"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="h-24 w-24 rounded-2xl accent-gradient flex items-center justify-center mx-auto shadow-glow"
          >
            <Trophy className="h-12 w-12 text-accent-foreground" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-display font-bold"
          >
            Amazing work, {userName}! 🎉
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="text-6xl font-display font-bold text-secondary"
          >
            {percentage}%
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-muted-foreground"
          >
            You scored {score} out of {questions.length} questions correctly.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex gap-4 justify-center"
          >
            <Button asChild>
              <a href="/dashboard">View Dashboard</a>
            </Button>
            <Button variant="secondary" asChild>
              <a href="/recommendations">View Resources</a>
            </Button>
          </motion.div>
        </motion.div>
      </DashboardLayout>
    );
  }

  if (!started) {
    const categories = [
      {
        name: "HTML",
        icon: Code2,
        description: "Structure & semantics — headings, forms, tables, and accessibility basics.",
        gradient: "from-[hsl(25,95%,53%)] to-[hsl(0,84%,60%)]",
        bgGlow: "hsl(25 95% 53% / 0.12)",
        borderAccent: "hsl(25 95% 53% / 0.3)",
        textAccent: "hsl(25 95% 53%)",
      },
      {
        name: "CSS",
        icon: Palette,
        description: "Layout & styling — flexbox, grid, responsive design, and animations.",
        gradient: "from-[hsl(210,80%,55%)] to-[hsl(190,80%,50%)]",
        bgGlow: "hsl(210 80% 55% / 0.12)",
        borderAccent: "hsl(210 80% 55% / 0.3)",
        textAccent: "hsl(210 80% 55%)",
      },
      {
        name: "JavaScript",
        icon: Zap,
        description: "Logic & interactivity — variables, functions, DOM manipulation, and async.",
        gradient: "from-[hsl(270,60%,55%)] to-[hsl(280,70%,50%)]",
        bgGlow: "hsl(270 60% 55% / 0.12)",
        borderAccent: "hsl(270 60% 55% / 0.3)",
        textAccent: "hsl(270 60% 55%)",
      },
    ];

    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-10 py-8 relative overflow-hidden">
          {/* Floating background elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[Target, Brain, Sparkles, Code2].map((Icon, i) => (
              <motion.div
                key={i}
                className="absolute text-muted-foreground/10"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  y: [0, -20, 0],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 4 + i,
                  repeat: Infinity,
                  delay: i * 0.8,
                }}
                style={{
                  top: `${15 + i * 20}%`,
                  left: i % 2 === 0 ? `${5 + i * 5}%` : undefined,
                  right: i % 2 !== 0 ? `${5 + i * 5}%` : undefined,
                }}
              >
                <Icon className="h-10 w-10" />
              </motion.div>
            ))}
          </div>

          {/* Header section */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center relative z-10 space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-medium"
            >
              <Sparkles className="h-4 w-4" />
              Personalized Assessment
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight">
              Ready to test your skills,{" "}
              <span className="bg-gradient-to-r from-secondary to-[hsl(200,70%,50%)] bg-clip-text text-transparent">
                {userName}
              </span>
              ?
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Choose a track below and we'll craft a personalized learning path based on your results.
            </p>
          </motion.div>

          {/* Category cards */}
          <div className="grid md:grid-cols-3 gap-6 relative z-10">
            {categories.map((cat, index) => {
              const Icon = cat.icon;
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.15, duration: 0.5 }}
                  whileHover={{ y: -8, transition: { duration: 0.25 } }}
                >
                  <Card
                    className="group relative overflow-hidden border-0 shadow-card hover:shadow-elevated transition-shadow duration-300 cursor-pointer h-full"
                    style={{ background: cat.bgGlow }}
                    onClick={() => startQuiz(cat.name)}
                  >
                    {/* Animated border glow */}
                    <motion.div
                      className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        boxShadow: `inset 0 0 0 2px ${cat.borderAccent}, 0 0 30px ${cat.bgGlow}`,
                      }}
                    />

                    <CardContent className="relative pt-8 pb-6 flex flex-col items-center gap-4 text-center">
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                        className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shadow-lg`}
                      >
                        <Icon className="h-8 w-8 text-primary-foreground" />
                      </motion.div>

                      <h3 className="font-display font-bold text-xl">{cat.name}</h3>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {cat.description}
                      </p>

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 group-hover:scale-105 transition-transform duration-200"
                        style={{
                          borderColor: cat.borderAccent,
                          color: cat.textAccent,
                        }}
                      >
                        Start {cat.name} Quiz
                        <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-sm text-muted-foreground/60 relative z-10"
          >
            💡 Each quiz contains up to 20 questions · Results shape your study plan
          </motion.p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold">
            {selectedCategory} Quiz
          </h1>
          <p className="text-muted-foreground mt-1">
            Let's see what you know, {userName}!
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="h-10 w-10 rounded-full border-2 border-secondary border-t-transparent"
            />
            <p className="text-sm text-muted-foreground">Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No questions available yet. Please check back later.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2.5 [&>div]:bg-secondary" />
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="shadow-card border-0">
                  <CardHeader>
                    <CardTitle className="font-display text-lg leading-relaxed">
                      {currentQ?.question_text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {["a", "b", "c", "d"].map((opt, i) => {
                      const text = currentQ?.[`option_${opt}` as keyof Question] as string;
                      const isSelected = selected === opt;
                      const isCorrect = opt === currentQ?.correct_option;
                      let borderClass = "border-border hover:border-secondary/50 hover:shadow-sm";
                      if (showResult) {
                        if (isCorrect) borderClass = "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]";
                        else if (isSelected && !isCorrect) borderClass = "border-destructive bg-destructive/10";
                      } else if (isSelected) {
                        borderClass = "border-secondary bg-secondary/10 shadow-sm";
                      }

                      return (
                        <motion.button
                          key={opt}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          onClick={() => handleSelect(opt)}
                          disabled={showResult}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${borderClass} flex items-center gap-3`}
                          whileHover={!showResult ? { scale: 1.01 } : undefined}
                          whileTap={!showResult ? { scale: 0.99 } : undefined}
                        >
                          <span className="h-8 w-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-bold shrink-0 uppercase">
                            {opt}
                          </span>
                          <span className="flex-1">{text}</span>
                          {showResult && isCorrect && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
                            </motion.span>
                          )}
                          {showResult && isSelected && !isCorrect && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                              <XCircle className="h-5 w-5 text-destructive shrink-0" />
                            </motion.span>
                          )}
                        </motion.button>
                      );
                    })}

                    <div className="flex justify-end gap-3 pt-4">
                      {!showResult ? (
                        <Button onClick={handleSubmitAnswer} disabled={!selected} size="lg">
                          Submit Answer
                        </Button>
                      ) : (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <Button onClick={handleNext} disabled={submitting} size="lg">
                            {currentIndex + 1 >= questions.length ? (
                              submitting ? "Finishing..." : "Finish Quiz 🎉"
                            ) : (
                              <>
                                Next <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
