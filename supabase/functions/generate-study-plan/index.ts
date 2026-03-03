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

    // Verify user
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

    // Fetch quiz answers with topic info
    const attemptIds = (attempts || []).map((a: any) => a.id);
    let answersWithTopics: any[] = [];
    if (attemptIds.length > 0) {
      const { data } = await supabase
        .from("quiz_answers")
        .select("is_correct, question:quiz_questions(topic_id, difficulty)")
        .in("attempt_id", attemptIds);
      answersWithTopics = data || [];
    }

    // Fetch all topics
    const { data: topics } = await supabase.from("topics").select("id, name, category, description");

    // Fetch available resources with estimated time
    const { data: resources } = await supabase
      .from("learning_resources")
      .select("id, title, topic_id, resource_type, estimated_minutes, description");

    // Calculate per-topic performance
    const topicPerformance: Record<string, { correct: number; total: number }> = {};
    for (const ans of answersWithTopics) {
      const topicId = ans.question?.topic_id;
      if (!topicId) continue;
      if (!topicPerformance[topicId]) topicPerformance[topicId] = { correct: 0, total: 0 };
      topicPerformance[topicId].total++;
      if (ans.is_correct) topicPerformance[topicId].correct++;
    }

    // Build context for AI
    const topicSummary = (topics || []).map((t: any) => {
      const perf = topicPerformance[t.id];
      const score = perf ? Math.round((perf.correct / perf.total) * 100) : null;
      return `- ${t.name} (${t.category}): ${score !== null ? `${score}% correct (${perf!.correct}/${perf!.total})` : "not tested"}`;
    }).join("\n");

    const resourceSummary = (resources || []).map((r: any) => {
      const topic = (topics || []).find((t: any) => t.id === r.topic_id);
      return `- [${r.id}] "${r.title}" (${r.resource_type}, ${r.estimated_minutes}min) for topic "${topic?.name || "unknown"}" [topic_id: ${r.topic_id}]`;
    }).join("\n");

    // Identify weak topics (score < 70% or not tested)
    const weakTopicIds = (topics || [])
      .filter((t: any) => {
        const perf = topicPerformance[t.id];
        if (!perf) return true; // not tested = weak
        return (perf.correct / perf.total) < 0.7;
      })
      .map((t: any) => t.id);

    const weakTopicSummary = (topics || [])
      .filter((t: any) => weakTopicIds.includes(t.id))
      .map((t: any) => {
        const perf = topicPerformance[t.id];
        const score = perf ? Math.round((perf.correct / perf.total) * 100) : null;
        return `- ${t.name} (${t.category}): ${score !== null ? `${score}% correct (${perf!.correct}/${perf!.total})` : "not tested yet"}`;
      }).join("\n");

    const weakResourceSummary = (resources || [])
      .filter((r: any) => weakTopicIds.includes(r.topic_id))
      .map((r: any) => {
        const topic = (topics || []).find((t: any) => t.id === r.topic_id);
        return `- [${r.id}] "${r.title}" (${r.resource_type}, ${r.estimated_minutes}min) for topic "${topic?.name || "unknown"}" [topic_id: ${r.topic_id}]`;
      }).join("\n");

    const prompt = `You are a study plan generator for an educational platform. Based on the student's quiz performance, create a 4-week study plan focusing ONLY on their WEAK topics (topics they scored poorly on or haven't been tested on).

Student availability:
- Hours per day: ${hours_per_day}
- Preferred study days: ${preferred_days.join(", ")}
- Minutes per study day: ${Math.round(hours_per_day * 60)}

WEAK topics to focus on (these are the ONLY topics to include):
${weakTopicSummary || "No weak topics identified."}

Available learning resources for weak topics:
${weakResourceSummary || "No resources available."}

Rules:
1. ONLY include topics from the weak topics list above — do NOT include strong topics
2. Prioritize the weakest topics (lowest scores) with more sessions
3. Each study item should have a topic_id, an optional resource_id, a scheduled_date (YYYY-MM-DD format), and duration_minutes
4. Start from today: ${new Date().toISOString().split("T")[0]}
5. Only schedule on the preferred days
6. Total daily duration should not exceed ${Math.round(hours_per_day * 60)} minutes
7. Use the exact resource IDs and topic IDs provided above
8. Generate 3-4 weeks of items`;

    // Use tool calling for structured output
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
                        resource_id: { type: "string", description: "UUID of the resource, or null if no specific resource" },
                        scheduled_date: { type: "string", description: "YYYY-MM-DD format" },
                        duration_minutes: { type: "number", description: "Duration in minutes" },
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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Validate topic_ids and resource_ids exist
    const validTopicIds = new Set((topics || []).map((t: any) => t.id));
    const validResourceIds = new Set((resources || []).map((r: any) => r.id));

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

    // Filter and insert valid items
    const validItems = (planData.items || [])
      .filter((item: any) => validTopicIds.has(item.topic_id))
      .map((item: any) => ({
        plan_id: newPlan.id,
        topic_id: item.topic_id,
        resource_id: item.resource_id && validResourceIds.has(item.resource_id) ? item.resource_id : null,
        scheduled_date: item.scheduled_date,
        duration_minutes: item.duration_minutes || 30,
        is_completed: false,
      }));

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
