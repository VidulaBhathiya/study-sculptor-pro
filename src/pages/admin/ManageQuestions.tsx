import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";

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

export default function ManageQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    question_text: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "a",
    difficulty: "medium",
    topic_name: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: qs }, { data: ts }] = await Promise.all([
      supabase.from("quiz_questions").select("*, topic:topics(id, name, category)").order("created_at", { ascending: false }),
      supabase.from("topics").select("*").order("name"),
    ]);
    setQuestions((qs as unknown as Question[]) || []);
    setTopics(ts || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", difficulty: "medium", topic_name: "" });
    setEditId(null);
  };

  const resolveTopicId = async (topicName: string): Promise<string | null> => {
    const trimmed = topicName.trim();
    const existing = topics.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const { data, error } = await supabase.from("topics").insert({ name: trimmed, category: "general" }).select().single();
    if (error) { toast.error("Failed to create topic: " + error.message); return null; }
    return data.id;
  };

  const handleSave = async () => {
    if (!form.question_text || !form.topic_name.trim()) {
      toast.error("Fill in required fields");
      return;
    }
    setSaving(true);
    const topicId = await resolveTopicId(form.topic_name);
    if (!topicId) { setSaving(false); return; }
    const payload = {
      question_text: form.question_text, option_a: form.option_a, option_b: form.option_b,
      option_c: form.option_c, option_d: form.option_d, correct_option: form.correct_option,
      difficulty: form.difficulty, topic_id: topicId,
    };
    if (editId) {
      const { error } = await supabase.from("quiz_questions").update(payload).eq("id", editId);
      if (error) toast.error(error.message);
      else toast.success("Question updated");
    } else {
      const { error } = await supabase.from("quiz_questions").insert(payload);
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
      topic_name: q.topic?.name || "",
    });
    setEditId(q.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Question deleted");
      fetchData();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Manage Questions</h1>
            <p className="text-muted-foreground mt-1">{questions.length} questions total</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="hero"><Plus className="h-4 w-4 mr-2" />Add Question</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editId ? "Edit" : "Add"} Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Topic Name</Label>
                  <Input
                    placeholder="Type a topic name (e.g. Flexbox)"
                    value={form.topic_name}
                    onChange={(e) => setForm({ ...form, topic_name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Type an existing or new topic name.</p>
                </div>
                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} rows={3} />
                </div>
                {(["a", "b", "c", "d"] as const).map((opt) => (
                  <div key={opt} className="space-y-2">
                    <Label>Option {opt.toUpperCase()}</Label>
                    <Input value={form[`option_${opt}`]} onChange={(e) => setForm({ ...form, [`option_${opt}`]: e.target.value })} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Select value={form.correct_option} onValueChange={(v) => setForm({ ...form, correct_option: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["a", "b", "c", "d"].map((o) => <SelectItem key={o} value={o}>Option {o.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["easy", "medium", "hard"].map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <Card key={q.id} className="shadow-card">
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-1">{q.question_text}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
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
            ))}
            {questions.length === 0 && (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No questions yet. Add your first question!
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
