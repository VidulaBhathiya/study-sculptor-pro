import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, CheckCircle2, Plus, Sparkles } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface PlanItem {
  id: string;
  scheduled_date: string | null;
  duration_minutes: number;
  is_completed: boolean;
  topic: { name: string; category: string } | null;
  resource: { title: string; url: string; resource_type: string } | null;
}

interface Plan {
  id: string;
  name: string;
  hours_per_day: number;
  preferred_days: string[];
  start_date: string;
  end_date: string | null;
  items: PlanItem[];
}

export default function StudyPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [hoursPerDay, setHoursPerDay] = useState("1");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Monday", "Wednesday", "Friday"]);
  const [showForm, setShowForm] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, [user]);

  const fetchPlan = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // Fetch items
      const { data: items } = await supabase
        .from("study_plan_items")
        .select(`
          id, scheduled_date, duration_minutes, is_completed,
          topic:topics(name, category),
          resource:learning_resources(title, url, resource_type)
        `)
        .eq("plan_id", data.id)
        .order("scheduled_date");

      setPlan({
        ...data,
        preferred_days: data.preferred_days || [],
        items: (items as unknown as PlanItem[]) || [],
      });
    }
    setLoading(false);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const generatePlan = async () => {
    if (!user || selectedDays.length === 0) {
      toast.error("Please select at least one day");
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-study-plan", {
        body: {
          hours_per_day: parseFloat(hoursPerDay),
          preferred_days: selectedDays,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast.error(data.error);
        setCreating(false);
        return;
      }

      toast.success(`AI study plan generated with ${data.items_count} sessions!`);
      setShowForm(false);
      fetchPlan();
    } catch (e: any) {
      console.error("Error generating plan:", e);
      toast.error(e?.message || "Failed to generate study plan");
    } finally {
      setCreating(false);
    }
  };

  const toggleComplete = async (itemId: string, completed: boolean) => {
    await supabase
      .from("study_plan_items")
      .update({ is_completed: !completed })
      .eq("id", itemId);
    fetchPlan();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Study Plan</h1>
            <p className="text-muted-foreground mt-1">Your personalized learning schedule</p>
          </div>
          <Button variant="hero" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {plan ? "New Plan" : "Create Plan"}
          </Button>
        </div>

        {showForm && (
          <Card className="shadow-card border-2 border-secondary/20">
            <CardHeader>
              <CardTitle className="font-display">Set Your Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Hours per day for studying</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Preferred study days</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DAYS.map((day) => (
                    <label
                      key={day}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedDays.includes(day)
                          ? "border-secondary bg-secondary/10"
                          : "border-border hover:border-secondary/30"
                      }`}
                    >
                      <Checkbox
                        checked={selectedDays.includes(day)}
                        onCheckedChange={() => toggleDay(day)}
                      />
                      <span className="text-sm font-medium">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={generatePlan} disabled={creating}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {creating ? "AI is generating..." : "Generate with AI"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
          </div>
        ) : plan ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {plan.hours_per_day}h/day
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {plan.preferred_days?.join(", ")}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <Button
                variant={filterCompleted ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCompleted(!filterCompleted)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {filterCompleted ? "Showing Completed Only" : "Show Completed Only"}
              </Button>
            </div>

            <div className="space-y-2">
              {plan.items
                .filter((item) => !filterCompleted || item.is_completed)
                .map((item) => (
                <Card
                  key={item.id}
                  className={`shadow-card transition-all ${item.is_completed ? "opacity-60" : ""}`}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <button
                      onClick={() => toggleComplete(item.id, item.is_completed)}
                      className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.is_completed
                          ? "bg-success border-success"
                          : "border-border hover:border-secondary"
                      }`}
                    >
                      {item.is_completed && <CheckCircle2 className="h-4 w-4 text-success-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${item.is_completed ? "line-through" : ""}`}>
                          {item.topic?.name || "Topic"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.duration_minutes}min
                        </span>
                      </div>
                      {item.resource && (
                        <a
                          href={item.resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-secondary hover:underline"
                        >
                          {item.resource.title}
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.scheduled_date}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : !showForm ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No study plan yet. Click "Create Plan" to generate one!
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
