import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Code2, Palette, Server } from "lucide-react";

interface Topic {
  id: string;
  name: string;
  category: string;
}
interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  difficulty: string;
  topic_id: string;
  topic?: Topic;
}

const categoryConfig: Record<string, { icon: any; gradient: string; border: string }> = {
  HTML: { icon: Code2, gradient: "from-orange-500 to-red-500", border: "border-orange-500/30" },
  CSS: { icon: Palette, gradient: "from-blue-500 to-cyan-500", border: "border-blue-500/30" },
  javascript: { icon: Server, gradient: "from-violet-500 to-purple-500", border: "border-violet-500/30" },
};

export default function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [form, setForm] = useState({
    question_text: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "a",
    difficulty: "medium",
    topic_id: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: qs }, { data: ts }] = await Promise.all([
      supabase
        .from("quiz_questions")
        .select("*, topic:topics(id, name, category)")
        .order("created_at", { ascending: false }),
      supabase.from("topics").select("*").order("name"),
    ]);
    setQuestions((qs as unknown as Question[]) || []);
    setTopics(ts || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      question_text: "",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_option: "a",
      difficulty: "medium",
      topic_id: "",
    });
    setEditId(null);
    setLockedCategory(null);
  };

  const handleAddForCategory = (category: string) => {
    resetForm();
    setLockedCategory(category);
    // Pre-select first topic in this category
    const firstTopic = topics.find((t) => t.category === category);
    if (firstTopic) {
      setForm((f) => ({ ...f, topic_id: firstTopic.id }));
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question_text || !form.topic_id) {
      toast.error("Fill in required fields");
      return;
    }
    setSaving(true);
    if (editId) {
      const { error } = await supabase.from("quiz_questions").update(form).eq("id", editId);
      if (error) toast.error(error.message);
      else toast.success("Question updated");
    } else {
      const { error } = await supabase.from("quiz_questions").insert(form);
      if (error) toast.error(error.message);
      else toast.success("Question added");
    }
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleEdit = (q: Question) => {
    setForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      difficulty: q.difficulty || "medium",
      topic_id: q.topic_id,
    });
    setEditId(q.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Count questions per category
  const categoryCounts: Record<string, number> = {};
  questions.forEach((q) => {
    const cat = q.topic?.category || "Other";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const filteredQuestions = activeCategory ? questions.filter((q) => q.topic?.category === activeCategory) : questions;

  return (
    <div className="space-y-6">
      {/* Category Filter Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["HTML", "CSS", "javascript"].map((cat) => {
          const config = categoryConfig[cat];
          const count = categoryCounts[cat] || 0;
          const isActive = activeCategory === cat;
          const Icon = config.icon;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              className={`text-left transition-all rounded-xl overflow-hidden ${
                isActive
                  ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-[1.02]"
                  : "hover:scale-[1.01]"
              }`}
            >
              <Card className={`border-0 shadow-card overflow-hidden ${isActive ? "shadow-elevated" : ""}`}>
                <div className={`bg-gradient-to-br ${config.gradient} p-5 text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="h-6 w-6 opacity-90" />
                    <span className="text-2xl font-display font-bold">{count}</span>
                  </div>
                  <h3 className="text-lg font-display font-bold">{cat}</h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    {count} question{count !== 1 ? "s" : ""} • Click to {isActive ? "show all" : "filter"}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddForCategory(cat);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add {cat} Question
                  </Button>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {activeCategory
            ? `${filteredQuestions.length} ${activeCategory} questions`
            : `${questions.length} questions total`}
        </p>
      </div>

      {/* Add/Edit Question Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editId ? "Edit" : "Add"} Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!lockedCategory && (
              <div className="space-y-2">
                <Label>Topic</Label>
                <Select value={form.topic_id} onValueChange={(v) => setForm({ ...form, topic_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea
                value={form.question_text}
                onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                rows={3}
              />
            </div>
            {(["a", "b", "c", "d"] as const).map((opt) => (
              <div key={opt} className="space-y-2">
                <Label>Option {opt.toUpperCase()}</Label>
                <Input
                  value={form[`option_${opt}`]}
                  onChange={(e) => setForm({ ...form, [`option_${opt}`]: e.target.value })}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select value={form.correct_option} onValueChange={(v) => setForm({ ...form, correct_option: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["a", "b", "c", "d"].map((o) => (
                      <SelectItem key={o} value={o}>
                        Option {o.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["easy", "medium", "hard"].map((d) => (
                      <SelectItem key={d} value={d} className="capitalize">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : editId ? "Update Question" : "Add Question"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question List */}
      <div className="space-y-3">
        {filteredQuestions.map((q) => {
          const catConfig = categoryConfig[q.topic?.category || ""] || { border: "border-border" };
          return (
            <Card key={q.id} className={`shadow-card border-l-4 ${catConfig.border}`}>
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm mb-1">{q.question_text}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold">{q.topic?.category}</span>
                    <span>•</span>
                    <span>{q.topic?.name}</span>
                    <span>•</span>
                    <span className="capitalize">{q.difficulty}</span>
                    <span>•</span>
                    <span>Answer: {q.correct_option.toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(q)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredQuestions.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              {activeCategory ? `No ${activeCategory} questions yet.` : "No questions yet. Add your first question!"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
