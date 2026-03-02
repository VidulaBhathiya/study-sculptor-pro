import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Calendar, TrendingUp, AlertTriangle, Sparkles, Rocket, Code2, Zap, Palette, Server, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { motion } from "framer-motion";

interface TopicPerformance {
  topic_name: string;
  category: string;
  correct: number;
  total: number;
  percentage: number;
}

interface CategoryScore {
  category: string;
  correct: number;
  total: number;
  percentage: number;
  attempted: boolean;
  icon: any;
  gradient: string;
}

export default function Dashboard() {
  const { user, role, hasTakenQuiz } = useAuth();
  const [latestAttempt, setLatestAttempt] = useState<any>(null);
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([]);
  const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role === "admin") {
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [user, role]);

  const fetchDashboardData = async () => {
    if (!user) return;

    // Get latest quiz attempt
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLatestAttempt(attempt);

    if (attempt) {
      // Get answers with question and topic info
      const { data: answers } = await supabase
        .from("quiz_answers")
        .select("is_correct, question_id")
        .eq("attempt_id", attempt.id);

      if (answers && answers.length > 0) {
        const questionIds = answers.map((a) => a.question_id);
        const { data: questions } = await supabase
          .from("quiz_questions_public")
          .select("id, topic_id")
          .in("id", questionIds);

        const topicIds = [...new Set(questions?.map((q) => q.topic_id) || [])];
        const { data: topics } = await supabase
          .from("topics")
          .select("id, name, category")
          .in("id", topicIds);

        // Compute per-topic performance
        const perfMap: Record<string, TopicPerformance> = {};
        for (const answer of answers) {
          const q = questions?.find((x) => x.id === answer.question_id);
          const t = topics?.find((x) => x.id === q?.topic_id);
          if (!t) continue;
          if (!perfMap[t.id]) {
            perfMap[t.id] = { topic_name: t.name, category: t.category, correct: 0, total: 0, percentage: 0 };
          }
          perfMap[t.id].total++;
          if (answer.is_correct) perfMap[t.id].correct++;
        }
        const perf = Object.values(perfMap).map((p) => ({
          ...p,
          percentage: Math.round((p.correct / p.total) * 100),
        }));
        perf.sort((a, b) => a.percentage - b.percentage);
        setTopicPerformance(perf);

        // Compute per-category scores
        const categoryConfig: Record<string, { icon: any; gradient: string }> = {
          HTML: { icon: Code2, gradient: "from-orange-500 to-red-500" },
          CSS: { icon: Palette, gradient: "from-blue-500 to-cyan-500" },
          JavaScript: { icon: Server, gradient: "from-violet-500 to-purple-500" },
        };
        const catMap: Record<string, { correct: number; total: number }> = {};
        for (const p of perf) {
          if (!catMap[p.category]) catMap[p.category] = { correct: 0, total: 0 };
          catMap[p.category].correct += p.correct;
          catMap[p.category].total += p.total;
        }
        const cats: CategoryScore[] = ["HTML", "CSS", "JavaScript"].map((cat) => {
          const data = catMap[cat];
          const cfg = categoryConfig[cat];
          return {
            category: cat,
            correct: data?.correct || 0,
            total: data?.total || 0,
            percentage: data ? Math.round((data.correct / data.total) * 100) : 0,
            attempted: !!data,
            icon: cfg.icon,
            gradient: cfg.gradient,
          };
        });
        setCategoryScores(cats);
      } else {
        // No answers — set all categories as not attempted
        setCategoryScores(["HTML", "CSS", "JavaScript"].map((cat) => ({
          category: cat,
          correct: 0,
          total: 0,
          percentage: 0,
          attempted: false,
          icon: cat === "HTML" ? Code2 : cat === "CSS" ? Palette : Server,
          gradient: cat === "HTML" ? "from-orange-500 to-red-500" : cat === "CSS" ? "from-blue-500 to-cyan-500" : "from-violet-500 to-purple-500",
        })));
      }
    }
    setLoading(false);
  };

  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-display font-bold">
            {hasTakenQuiz ? "Dashboard" : `Hey, ${user?.user_metadata?.full_name || "there"}!`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {hasTakenQuiz ? "Your learning progress at a glance" : "Let's get your learning journey started."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
          </div>
        ) : !hasTakenQuiz ? (
          <div className="flex flex-col items-center justify-center py-12 gap-8">
            {/* Animated floating icons background */}
            <div className="relative w-full max-w-2xl">
              <motion.div
                className="absolute -top-4 left-10 text-secondary/20"
                animate={{ y: [0, -12, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Code2 className="h-10 w-10" />
              </motion.div>
              <motion.div
                className="absolute top-8 right-8 text-accent/25"
                animate={{ y: [0, 10, 0], rotate: [0, -15, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <Zap className="h-8 w-8" />
              </motion.div>
              <motion.div
                className="absolute bottom-0 left-1/4 text-secondary/15"
                animate={{ y: [0, -8, 0], x: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <Sparkles className="h-7 w-7" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Card className="shadow-elevated border-0 bg-gradient-to-br from-card via-card to-secondary/5 max-w-2xl mx-auto overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-accent/5 pointer-events-none" />
                  <CardContent className="p-10 space-y-8 relative z-10">
                    {/* Greeting */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-full accent-gradient flex items-center justify-center">
                        <span className="text-lg">👋</span>
                      </div>
                      <p className="text-lg text-muted-foreground font-medium">
                        Welcome back, <span className="text-foreground font-semibold">{user?.user_metadata?.full_name || "Learner"}</span>
                      </p>
                    </motion.div>

                    {/* Main heading */}
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35, duration: 0.5 }}
                      className="text-center space-y-3"
                    >
                      <h2 className="text-3xl md:text-4xl font-display font-bold leading-tight">
                        Ready to discover your{" "}
                        <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
                          coding strengths
                        </span>
                        ?
                      </h2>
                      <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
                        Take a quick placement quiz covering HTML, CSS & JavaScript. We'll craft a personalized learning path just for you.
                      </p>
                    </motion.div>

                    {/* Skill chips */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className="flex items-center justify-center gap-3 flex-wrap"
                    >
                      {["HTML", "CSS", "JavaScript"].map((skill, i) => (
                        <motion.span
                          key={skill}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + i * 0.1, duration: 0.3 }}
                          className="px-4 py-1.5 rounded-full text-sm font-medium border border-border bg-muted/50 text-muted-foreground"
                        >
                          {skill}
                        </motion.span>
                      ))}
                    </motion.div>

                    {/* CTA */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.4 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <Button
                        variant="hero"
                        size="lg"
                        className="px-12 py-6 text-base gap-2 transition-all duration-300 hover:scale-105 hover:shadow-xl"
                        asChild
                      >
                        <Link to="/quiz">
                          <Rocket className="h-5 w-5" />
                          Start Placement Quiz
                        </Link>
                      </Button>
                      <p className="text-xs text-muted-foreground">Takes about 5–10 minutes • No prep needed</p>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        ) : (
          <>
            {/* Category Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {categoryScores.map((cat, i) => (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                >
                  <Card className="overflow-hidden shadow-card border-0">
                    <div className={`bg-gradient-to-br ${cat.gradient} p-5 text-white relative`}>
                      <div className="flex items-center justify-between mb-3">
                        <cat.icon className="h-7 w-7 opacity-90" />
                        {cat.attempted ? (
                          cat.percentage >= 80 ? (
                            <CheckCircle2 className="h-5 w-5 opacity-80" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 opacity-80" />
                          )
                        ) : (
                          <MinusCircle className="h-5 w-5 opacity-60" />
                        )}
                      </div>
                      <h3 className="text-lg font-display font-bold">{cat.category}</h3>
                      {cat.attempted ? (
                        <>
                          <div className="text-3xl font-display font-bold mt-1">{cat.percentage}%</div>
                          <p className="text-sm opacity-80 mt-1">
                            {cat.correct}/{cat.total} correct
                          </p>
                          <div className="mt-3 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/80 transition-all duration-700"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-medium mt-1 opacity-80">Not Attempted</div>
                          <p className="text-sm opacity-60 mt-1">Take the quiz to see your score</p>
                          <div className="mt-3 h-1.5 w-full rounded-full bg-white/20" />
                        </>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Overall Score + Weak Areas row */}
            <div className="grid md:grid-cols-3 gap-5">
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overall Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-secondary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold">
                    {latestAttempt ? `${latestAttempt.score}/${latestAttempt.total_questions}` : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {latestAttempt
                      ? `${Math.round((latestAttempt.score / latestAttempt.total_questions) * 100)}% correct`
                      : "No attempts yet"}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Weak Areas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold">
                    {topicPerformance.filter((t) => t.percentage < 60).length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Topics needing attention</p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Categories Attempted</CardTitle>
                  <BookOpen className="h-4 w-4 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold">
                    {categoryScores.filter((c) => c.attempted).length}/3
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">HTML, CSS & JavaScript</p>
                </CardContent>
              </Card>
            </div>

            {/* Topic Performance */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">Topic Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topicPerformance.map((topic) => (
                  <div key={topic.topic_name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{topic.topic_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {topic.correct}/{topic.total} ({topic.percentage}%)
                      </span>
                    </div>
                    <Progress
                      value={topic.percentage}
                      className={`h-2 ${topic.percentage < 60 ? "[&>div]:bg-destructive" : topic.percentage < 80 ? "[&>div]:bg-accent" : "[&>div]:bg-success"}`}
                    />
                  </div>
                ))}
                {topicPerformance.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No performance data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-5">
              <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                <Link to="/recommendations">
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className="h-12 w-12 rounded-lg accent-gradient flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">View Recommendations</h3>
                      <p className="text-sm text-muted-foreground">Resources matched to your weak areas</p>
                    </div>
                  </CardContent>
                </Link>
              </Card>
              <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                <Link to="/study-plan">
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">Create Study Plan</h3>
                      <p className="text-sm text-muted-foreground">Generate a schedule based on your availability</p>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

