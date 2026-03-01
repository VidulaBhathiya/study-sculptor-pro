import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit, ExternalLink, Code2, Palette, Server } from "lucide-react";

interface Topic { id: string; name: string; category: string; }
interface Resource {
  id: string; title: string; description: string | null; url: string;
  resource_type: string; topic_id: string; topic?: Topic;
}

const categoryConfig: Record<string, { icon: any; gradient: string; border: string }> = {
  HTML: { icon: Code2, gradient: "from-orange-500 to-red-500", border: "border-orange-500/30" },
  CSS: { icon: Palette, gradient: "from-blue-500 to-cyan-500", border: "border-blue-500/30" },
  javascript: { icon: Server, gradient: "from-violet-500 to-purple-500", border: "border-violet-500/30" },
};

export default function AdminResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", url: "", resource_type: "video", topic_id: "" });

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

  const resetForm = () => { setForm({ title: "", description: "", url: "", resource_type: "video", topic_id: "" }); setEditId(null); setLockedCategory(null); };

  const handleAddForCategory = (category: string) => {
    resetForm();
    setLockedCategory(category);
    setDialogOpen(true);
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
    setLockedCategory(r.topic?.category || null);
    setEditId(r.id); setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("learning_resources").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchData(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" /></div>;
  }

  // Count resources per category
  const categoryCounts: Record<string, number> = {};
  resources.forEach((r) => {
    const cat = r.topic?.category || "Other";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // Filter topics by locked category for the dialog
  const filteredTopics = lockedCategory ? topics.filter((t) => t.category === lockedCategory) : topics;

  const filteredResources = activeCategory ? resources.filter((r) => r.topic?.category === activeCategory) : resources;

  return (
    <div className="space-y-6">
      {/* Category Filter Cards */}
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
                    {count} resource{count !== 1 ? "s" : ""} • Click to {isActive ? "show all" : "filter"}
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
                    Add {cat} Resource
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
            ? `${filteredResources.length} ${activeCategory} resources`
            : `${resources.length} resources total`}
        </p>
      </div>

      {/* Add/Edit Resource Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Add"} Resource</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select value={form.topic_id} onValueChange={(v) => setForm({ ...form, topic_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                <SelectContent>{filteredTopics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              {lockedCategory && <p className="text-xs text-muted-foreground">Showing {lockedCategory} topics only</p>}
            </div>
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["video", "document", "tutorial", "article"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : editId ? "Update" : "Add Resource"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resource List */}
      <div className="space-y-3">
        {filteredResources.map((r) => {
          const catConfig = categoryConfig[r.topic?.category || ""] || { border: "border-border" };
          return (
            <Card key={r.id} className={`shadow-card border-l-4 ${catConfig.border}`}>
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
          );
        })}
        {filteredResources.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              {activeCategory ? `No ${activeCategory} resources yet.` : "No resources yet."}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
