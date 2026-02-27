import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileQuestion, Library, TrendingUp, Code2, Palette, Server } from "lucide-react";

interface CategoryStats {
  category: string;
  questionCount: number;
  topicCount: number;
  icon: any;
  gradient: string;
}

export default function AdminOverview() {
  const [stats, setStats] = useState({ users: 0, questions: 0, resources: 0, attempts: 0 });
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: users }, { count: questions }, { count: resources }, { count: attempts }, { data: recent }, { data: topics }, { data: allQuestions }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("quiz_questions").select("*", { count: "exact", head: true }),
        supabase.from("learning_resources").select("*", { count: "exact", head: true }),
        supabase.from("quiz_attempts").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("topics").select("id, category"),
        supabase.from("quiz_questions").select("topic_id"),
      ]);

      setStats({ users: users || 0, questions: questions || 0, resources: resources || 0, attempts: attempts || 0 });
      setRecentUsers(recent || []);

      // Compute per-category stats
      const categoryConfig: Record<string, { icon: any; gradient: string }> = {
        HTML: { icon: Code2, gradient: "from-orange-500 to-red-500" },
        CSS: { icon: Palette, gradient: "from-blue-500 to-cyan-500" },
        JavaScript: { icon: Server, gradient: "from-violet-500 to-purple-500" },
      };

      const topicsByCategory: Record<string, string[]> = {};
      (topics || []).forEach((t: any) => {
        if (!topicsByCategory[t.category]) topicsByCategory[t.category] = [];
        topicsByCategory[t.category].push(t.id);
      });

      const cats: CategoryStats[] = ["HTML", "CSS", "JavaScript"].map((cat) => {
        const topicIds = topicsByCategory[cat] || [];
        const qCount = (allQuestions || []).filter((q: any) => topicIds.includes(q.topic_id)).length;
        return {
          category: cat,
          questionCount: qCount,
          topicCount: topicIds.length,
          icon: categoryConfig[cat].icon,
          gradient: categoryConfig[cat].gradient,
        };
      });
      setCategoryStats(cats);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats.users, icon: Users, color: "text-secondary" },
    { label: "Quiz Questions", value: stats.questions, icon: FileQuestion, color: "text-accent" },
    { label: "Learning Resources", value: stats.resources, icon: Library, color: "text-info" },
    { label: "Quiz Attempts", value: stats.attempts, icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      {/* Category Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categoryStats.map((cat) => (
          <Card key={cat.category} className="overflow-hidden shadow-card border-0">
            <div className={`bg-gradient-to-br ${cat.gradient} p-6 text-white`}>
              <div className="flex items-center justify-between mb-4">
                <cat.icon className="h-8 w-8 opacity-90" />
                <span className="text-3xl font-display font-bold">{cat.questionCount}</span>
              </div>
              <h3 className="text-xl font-display font-bold">{cat.category}</h3>
              <p className="text-sm opacity-80 mt-1">
                {cat.topicCount} topics • {cat.questionCount} questions
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* General Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Users */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Recent Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{u.full_name || "Unnamed User"}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                u.has_taken_quiz ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
              }`}>
                {u.has_taken_quiz ? "Quiz Taken" : "No Quiz"}
              </span>
            </div>
          ))}
          {recentUsers.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No users yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
