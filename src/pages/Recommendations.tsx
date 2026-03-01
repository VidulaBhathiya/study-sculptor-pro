import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Video, FileText, BookOpen, Newspaper, Calendar } from "lucide-react";

const typeIcons: Record<string, any> = {
  video: Video,
  document: FileText,
  tutorial: BookOpen,
  article: Newspaper,
};

const typeColors: Record<string, string> = {
  video: "bg-info text-info-foreground",
  document: "bg-secondary text-secondary-foreground",
  tutorial: "bg-success text-success-foreground",
  article: "bg-accent text-accent-foreground",
};

interface Recommendation {
  id: string;
  reason: string;
  resource: {
    id: string;
    title: string;
    description: string;
    url: string;
    resource_type: string;
  };
  topic: {
    name: string;
    category: string;
  };
}

export default function Recommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("resource_recommendations")
      .select(`
        id, reason,
        resource:learning_resources(id, title, description, url, resource_type),
        topic:topics(name, category)
      `)
      .eq("user_id", user.id);

    if (!error && data) {
      setRecommendations(data as unknown as Recommendation[]);
    }
    setLoading(false);
  };

  const grouped = recommendations.reduce<Record<string, Recommendation[]>>((acc, rec) => {
    const cat = rec.topic?.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rec);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Recommended Resources</h1>
          <p className="text-muted-foreground mt-1">
            Curated learning materials based on your quiz performance
          </p>
        </div>

        <Card className="shadow-card border-dashed border-2 border-secondary/30 bg-secondary/5">
          <CardContent className="flex items-center justify-between py-6 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Generate Your Study Plan</h3>
                <p className="text-sm text-muted-foreground">Create a personalized schedule based on your weak areas and availability</p>
              </div>
            </div>
            <Button variant="hero" size="lg" className="shrink-0" asChild>
              <Link to="/study-plan">Generate Study Plan</Link>
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
          </div>
        ) : recommendations.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No recommendations yet. Take the placement quiz to get personalized resources!
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([category, recs]) => (
            <div key={category}>
              <h2 className="text-xl font-display font-semibold mb-4">{category}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {recs.map((rec) => {
                  const Icon = typeIcons[rec.resource?.resource_type] || BookOpen;
                  return (
                    <Card key={rec.id} className="shadow-card hover:shadow-elevated transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[rec.resource?.resource_type] || "bg-muted"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1 truncate">{rec.resource?.title}</h3>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {rec.resource?.description}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {rec.topic?.name}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {rec.resource?.resource_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-4"
                          onClick={() => window.open(rec.resource?.url, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Resource
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
