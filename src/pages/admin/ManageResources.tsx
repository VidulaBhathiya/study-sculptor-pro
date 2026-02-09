import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit, ExternalLink } from "lucide-react";

interface Topic { id: string; name: string; category: string; }
interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  resource_type: string;
  topic_id: string;
  topic?: Topic;
}

export default function ManageResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", url: "", resource_type: "video", topic_id: "",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: rs }, { data: ts }] = await Promise.all([
      supabase.from("learning_resources").select("*, topic:topics(id, name, category)").order("created_at", { ascending: false }),
      supabase.from("topics").select("*").order("name"),
    ]);
    setResources((rs as unknown as Resource[]) || []);
    setTopics(ts || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ title: "", description: "", url: "", resource_type: "video", topic_id: "" });
    setEditId(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.url || !form.topic_id) { toast.error("Fill required fields"); return; }
    setSaving(true);
    if (editId) {
      const { error } = await supabase.from("learning_resources").update(form).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Updated");
    } else {
      const { error } = await supabase.from("learning_resources").insert(form);
      if (error) toast.error(error.message); else toast.success("Added");
    }
    setSaving(false); setDialogOpen(false); resetForm(); fetchData();
  };

  const handleEdit = (r: Resource) => {
    setForm({ title: r.title, description: r.description || "", url: r.url, resource_type: r.resource_type, topic_id: r.topic_id });
    setEditId(r.id); setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("learning_resources").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchData(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Manage Resources</h1>
            <p className="text-muted-foreground mt-1">{resources.length} resources total</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="hero"><Plus className="h-4 w-4 mr-2" />Add Resource</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Add"} Resource</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Select value={form.topic_id} onValueChange={(v) => setForm({ ...form, topic_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                    <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                <div className="space-y-2"><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["video", "document", "tutorial", "article"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : editId ? "Update" : "Add Resource"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {resources.map((r) => (
              <Card key={r.id} className="shadow-card">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{r.topic?.name}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{r.resource_type}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => window.open(r.url, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {resources.length === 0 && <Card className="shadow-card"><CardContent className="py-12 text-center text-muted-foreground">No resources yet.</CardContent></Card>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
