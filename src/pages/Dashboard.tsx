import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Calendar, TrendingUp, AlertTriangle } from "lucide-react";

interface TopicPerformance {
  topic_name: string;
  category: string;
  correct: number;
  total: number;
  percentage: number;
}

export default function Dashboard() {
  const { user, role, hasTakenQuiz } = useAuth();
  const [latestAttempt, setLatestAttempt] = useState<any>(null);
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([]);
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
          .from("quiz_questions")
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
      }
    }
    setLoading(false);
  };

  if (role === "admin") {
    return (
      <DashboardLayout>
        <AdminDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {hasTakenQuiz ? "Your learning progress at a glance" : "Welcome! Take the placement quiz to get started."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
          </div>
        ) : !hasTakenQuiz ? (
          <div className="flex items-center justify-center py-16">
            <Card className="shadow-card max-w-md w-full text-center p-8 space-y-6">
              <CardContent className="p-0 space-y-4">
                <h2 className="text-2xl font-display font-bold">Welcome to CodePath</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Take the placement quiz to assess your HTML, CSS, and JavaScript skills. We'll build a personalized learning path just for you.
                </p>
                <Button
                  variant="hero"
                  size="lg"
                  className="px-10 text-base transition-transform duration-200 hover:scale-105"
                  asChild
                >
                  <Link to="/quiz">Start Placement Quiz</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Score summary cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Quiz Score</CardTitle>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resources</CardTitle>
                  <BookOpen className="h-4 w-4 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold">
                    <Link to="/recommendations" className="text-secondary hover:underline">View</Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Recommended for you</p>
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
            <div className="grid md:grid-cols-2 gap-4">
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

function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, questions: 0, resources: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: users }, { count: questions }, { count: resources }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("quiz_questions").select("*", { count: "exact", head: true }),
        supabase.from("learning_resources").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        users: users || 0,
        questions: questions || 0,
        resources: resources || 0,
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your learning platform</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: stats.users, link: "/admin/users" },
          { label: "Quiz Questions", value: stats.questions, link: "/admin/questions" },
          { label: "Learning Resources", value: stats.resources, link: "/admin/resources" },
        ].map((stat) => (
          <Link key={stat.label} to={stat.link}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
