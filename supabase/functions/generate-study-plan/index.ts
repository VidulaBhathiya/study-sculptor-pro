import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { hours_per_day, preferred_days } = await req.json();

    // Fetch quiz performance data
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("id, score, total_questions, completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const attemptIds = (attempts || []).map((a: any) => a.id);
    let answersWithTopics: any[] = [];
    if (attemptIds.length > 0) {
      const { data } = await supabase
        .from("quiz_answers")
        .select("is_correct, question:quiz_questions(topic_id, difficulty)")
        .in("attempt_id", attemptIds);
      answersWithTopics = data || [];
    }

    const { data: topics } = await supabase.from("topics").select("id, name, category, description");
    const { data: resources } = await supabase
      .from("learning_resources")
      .select("id, title, topic_id, resource_type, estimated_minutes, description");

    const { data: recommendations } = await supabase
      .from("resource_recommendations")
      .select("topic_id, resource_id")
      .eq("user_id", user.id);

    // Calculate per-topic performance
    const topicPerformance: Record<string, { correct: number; total: number }> = {};
    for (const ans of answersWithTopics) {
      const topicId = ans.question?.topic_id;
      if (!topicId) continue;
      if (!topicPerformance[topicId]) topicPerformance[topicId] = { correct: 0, total: 0 };
      topicPerformance[topicId].total++;
      if (ans.is_correct) topicPerformance[topicId].correct++;
    }

    // Deduplicate recommendations by resource_id
    const seenResourceIds = new Set<string>();
    const uniqueRecommendations = (recommendations || []).filter((r: any) => {
      if (seenResourceIds.has(r.resource_id)) return false;
      seenResourceIds.add(r.resource_id);
      return true;
    });

    const recommendedTopicIds = new Set(uniqueRecommendations.map((r: any) => r.topic_id));
    const recommendedResourceIds = new Set(uniqueRecommendations.map((r: any) => r.resource_id));

    let targetTopicIds: Set<string>;
    if (recommendedTopicIds.size > 0) {
      targetTopicIds = recommendedTopicIds;
    } else {
      targetTopicIds = new Set(
        (topics || [])
          .filter((t: any) => {
            const perf = topicPerformance[t.id];
            if (!perf) return true;
            return (perf.correct / perf.total) < 0.7;
          })
          .map((t: any) => t.id)
      );
    }

    // Sort topics by weakness (lowest score first)
    const sortedTargetTopics = (topics || [])
      .filter((t: any) => targetTopicIds.has(t.id))
      .sort((a: any, b: any) => {
        const perfA = topicPerformance[a.id];
        const perfB = topicPerformance[b.id];
        const scoreA = perfA ? (perfA.correct / perfA.total) : 0;
        const scoreB = perfB ? (perfB.correct / perfB.total) : 0;
        return scoreA - scoreB;
      });

    const dailyMinutes = Math.round(hours_per_day * 60);

    // Deterministic sessions calculation (replaces AI call)
    // sessions_needed = Math.ceil(resource_duration_mins / dailyMinutes)
    const topicPriority = new Map(sortedTargetTopics.map((t: any, index: number) => [t.id, index]));
    const usedResourceIds = new Set<string>();
    const candidateItems: Array<{ topic_id: string; resource_id: string | null; duration_minutes: number }> = [];

    // Build candidates from target resources, ordered by topic priority
    for (const resource of (resources || [])
      .filter((r: any) => targetTopicIds.has(r.topic_id))
      .sort((a: any, b: any) => (topicPriority.get(a.topic_id) ?? 999) - (topicPriority.get(b.topic_id) ?? 999))) {
      if (usedResourceIds.has(resource.id)) continue;

      const durationFromDb = Number(resource.estimated_minutes);
      if (!Number.isFinite(durationFromDb) || durationFromDb <= 0) continue;

      usedResourceIds.add(resource.id);
      candidateItems.push({
        topic_id: resource.topic_id,
        resource_id: resource.id,
        duration_minutes: durationFromDb,
      });
    }

    // Fallback: if there are no resources, create topic-only sessions
    if (candidateItems.length === 0 && sortedTargetTopics.length > 0) {
      const fallbackDuration = Math.max(30, dailyMinutes);
      for (const topic of sortedTargetTopics) {
        candidateItems.push({
          topic_id: topic.id,
          resource_id: null,
          duration_minutes: fallbackDuration,
        });
      }
    }

    const preferredDaySet = new Set((preferred_days || []).map((d: string) => d));
    const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const toISODate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const schedulableDates: string[] = [];
    const today = new Date();
    for (let offset = 0; offset < 28; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      if (preferredDaySet.has(weekDays[date.getDay()])) {
        schedulableDates.push(toISODate(date));
      }
    }

    const pendingItems = candidateItems.map((item) => ({
      topic_id: item.topic_id,
      resource_id: item.resource_id,
      remaining_minutes: item.duration_minutes,
    }));
    const validItems: any[] = [];

    for (const scheduledDate of schedulableDates) {
      let remainingMinutes = dailyMinutes;

      // PACKING WITH SPLITS: split oversized resources across days with carry-over
      while (remainingMinutes > 0 && pendingItems.length > 0) {
        const current = pendingItems[0];
        const allocatedMinutes = Math.min(remainingMinutes, current.remaining_minutes);

        if (allocatedMinutes <= 0) {
          pendingItems.shift();
          continue;
        }

        validItems.push({
          plan_id: "", // placeholder, set below
          topic_id: current.topic_id,
          resource_id: current.resource_id,
          scheduled_date: scheduledDate,
          duration_minutes: allocatedMinutes,
          is_completed: false,
        });

        current.remaining_minutes -= allocatedMinutes;
        remainingMinutes -= allocatedMinutes;

        if (current.remaining_minutes <= 0) {
          pendingItems.shift();
        }
      }

      if (pendingItems.length === 0) break;
    }

    // Create the study plan
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: newPlan, error: planError } = await supabase
      .from("study_plans")
      .insert({
        user_id: user.id,
        name: "Personalized Study Plan",
        hours_per_day,
        preferred_days,
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single();

    if (planError || !newPlan) {
      throw new Error("Failed to create study plan");
    }

    // Set plan_id on all items
    for (const item of validItems) {
      item.plan_id = newPlan.id;
    }

    if (validItems.length > 0) {
      const { error: itemsError } = await supabase.from("study_plan_items").insert(validItems);
      if (itemsError) {
        console.error("Error inserting items:", itemsError);
      }
    }

    console.log("generate-study-plan result", {
      user_id: user.id,
      success: true,
      items_count: validItems.length,
      plan_id: newPlan.id,
    });

    return new Response(
      JSON.stringify({ success: true, plan_id: newPlan.id, items_count: validItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
