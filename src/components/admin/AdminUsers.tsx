import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, CheckCircle2, XCircle } from "lucide-react";

interface UserProfile {
  id: string; user_id: string; full_name: string | null;
  has_taken_quiz: boolean; created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setUsers(data || []);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{users.length} registered users</p>
      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u.id} className="shadow-card">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{u.full_name || "Unnamed User"}</p>
                <p className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
              <Badge variant={u.has_taken_quiz ? "default" : "secondary"} className="flex items-center gap-1">
                {u.has_taken_quiz ? <><CheckCircle2 className="h-3 w-3" /> Quiz Taken</> : <><XCircle className="h-3 w-3" /> No Quiz</>}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && <Card className="shadow-card"><CardContent className="py-12 text-center text-muted-foreground">No users yet.</CardContent></Card>}
      </div>
    </div>
  );
}
