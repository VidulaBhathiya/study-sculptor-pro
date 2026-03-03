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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    // FIX 1: Deduplicate recommendations by resource_id
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

    // FIX 3: Sort topics by weakness (lowest score first)
    const sortedTargetTopics = (topics || [])
      .filter((t: any) => targetTopicIds.has(t.id))
      .sort((a: any, b: any) => {
        const perfA = topicPerformance[a.id];
        const perfB = topicPerformance[b.id];
        const scoreA = perfA ? (perfA.correct / perfA.total) : 0; // untested = 0 (weakest)
        const scoreB = perfB ? (perfB.correct / perfB.total) : 0;
        return scoreA - scoreB; // ascending = weakest first
      });

    // Build resource lookup by id for estimated_minutes
    const resourceById = new Map((resources || []).map((r: any) => [r.id, r]));

    const targetTopicSummary = sortedTargetTopics
      .map((t: any, i: number) => {
        const perf = topicPerformance[t.id];
        const score = perf ? Math.round((perf.correct / perf.total) * 100) : null;
        return `- [Priority ${i + 1}] ${t.name} (${t.category}): ${score !== null ? `${score}% correct` : "not tested yet"}`;
      }).join("\n");

    // FIX 2: Include exact estimated_minutes in resource summary
    const targetResourceSummary = (resources || [])
      .filter((r: any) => targetTopicIds.has(r.topic_id))
      .map((r: any) => {
        const topic = (topics || []).find((t: any) => t.id === r.topic_id);
        return `- [${r.id}] "${r.title}" (${r.resource_type}, EXACT duration: ${r.estimated_minutes}min) for topic "${topic?.name || "unknown"}" [topic_id: ${r.topic_id}]`;
      }).join("\n");

    const dailyMinutes = Math.round(hours_per_day * 60);

    const prompt = `You are a study plan generator. Create a 4-week study plan based on student performance.

Student availability:
- Minutes per study day: ${dailyMinutes}
- Preferred study days: ${preferred_days.join(", ")}

Topics ordered by PRIORITY (weakest first — schedule these FIRST):
${targetTopicSummary || "No topics identified."}

Available resources (use EXACT duration_minutes from each resource):
${targetResourceSummary || "No resources available."}

STRICT RULES:
1. ONLY use topics from the list above
2. Schedule weakest topics (Priority 1, 2, etc.) in the EARLIEST days
3. For duration_minutes, you MUST use the EXACT estimated_minutes value shown for each resource — do NOT invent or change durations
4. Each day's total duration_minutes must NOT exceed ${dailyMinutes} minutes
5. Start from today: ${new Date().toISOString().split("T")[0]}
6. Only schedule on preferred days: ${preferred_days.join(", ")}
7. Use exact resource IDs and topic IDs provided
8. Fill all 4 weeks with at least 1 item per preferred day
9. Do NOT use the same resource_id more than once in the entire plan`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a study plan generator. Use the provided tool to return structured study plan items." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_study_plan",
              description: "Create a structured study plan with scheduled items",
              parameters: {
                type: "object",
                properties: {
                  plan_name: { type: "string", description: "A descriptive name for the plan" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_id: { type: "string", description: "UUID of the topic" },
                        resource_id: { type: "string", description: "UUID of the resource, or null" },
                        scheduled_date: { type: "string", description: "YYYY-MM-DD format" },
                        duration_minutes: { type: "number", description: "MUST match the resource's estimated_minutes exactly" },
                      },
                      required: ["topic_id", "scheduled_date", "duration_minutes"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["plan_name", "items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_study_plan" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI did not return structured output");
    }

    const planData = JSON.parse(toolCall.function.arguments);

    const validTopicIds = new Set((topics || []).map((t: any) => t.id));
    const validResourceIds = new Set((resources || []).map((r: any) => r.id));

    // FIX 1+2+4: Deduplicate, enforce exact durations, enforce daily cap
    const usedResourceIds = new Set<string>();
    const dailyUsage: Record<string, number> = {};

    const validItems: any[] = [];
    for (const item of (planData.items || [])) {
      if (!validTopicIds.has(item.topic_id)) continue;

      // Deduplicate resources
      if (item.resource_id && usedResourceIds.has(item.resource_id)) continue;
      if (item.resource_id && !validResourceIds.has(item.resource_id)) {
        item.resource_id = null;
      }

      // FIX 2: Override duration with exact estimated_minutes from resource
      let duration = item.duration_minutes || 30;
      if (item.resource_id) {
        const res = resourceById.get(item.resource_id);
        if (res) {
          duration = res.estimated_minutes;
        }
      }

      // FIX 4: Enforce daily cap
      const date = item.scheduled_date;
      const currentDayUsage = dailyUsage[date] || 0;
      if (currentDayUsage + duration > dailyMinutes) continue;

      dailyUsage[date] = currentDayUsage + duration;
      if (item.resource_id) usedResourceIds.add(item.resource_id);

      validItems.push({
        plan_id: "", // placeholder, set below
        topic_id: item.topic_id,
        resource_id: item.resource_id || null,
        scheduled_date: date,
        duration_minutes: duration,
        is_completed: false,
      });
    }

    // Create the study plan
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: newPlan, error: planError } = await supabase
      .from("study_plans")
      .insert({
        user_id: user.id,
        name: planData.plan_name || "AI Study Plan",
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
