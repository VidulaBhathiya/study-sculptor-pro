import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { question_id, selected_option } = await req.json();

  if (!question_id || !selected_option) {
    return new Response(JSON.stringify({ error: "Missing question_id or selected_option" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Validate selected_option
  if (!["a", "b", "c", "d"].includes(selected_option)) {
    return new Response(JSON.stringify({ error: "Invalid option" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Use service role to read correct_option
  const { data: question, error } = await supabase
    .from("quiz_questions")
    .select("correct_option")
    .eq("id", question_id)
    .single();

  if (error || !question) {
    return new Response(JSON.stringify({ error: "Question not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const is_correct = selected_option === question.correct_option;

  return new Response(
    JSON.stringify({ is_correct, correct_option: question.correct_option }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
