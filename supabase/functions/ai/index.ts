// Supabase Edge Function: "ai"
// Proxies resume-building and resume-tailoring requests to the Anthropic API,
// keeping the ANTHROPIC_API_KEY secret on the server side (never in client JS).
// Deploy with: supabase functions deploy ai
// Set the secret with: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Supabase verifies the caller's JWT automatically before this code runs
// (unless deployed with --no-verify-jwt), so only signed-in users can call it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-3-5-sonnet-latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callClaude(prompt: string): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
  }
  const data = await resp.json();
  return (data.content || []).map((b: any) => b.text || "").join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const body = await req.json();
    const mode = body.mode;

    if (mode === "build") {
      const f = body;
      const prompt = `Format the following into a clean, ATS-friendly plain-text resume. Use clear section headers (SUMMARY, EXPERIENCE, EDUCATION, SKILLS), keep bullet points concise and achievement-oriented, fix grammar, but do not invent any facts, employers, dates, or numbers that are not given below. Output only the finished resume text, no commentary.\n\nName: ${f.name}\nLocation: ${f.loc}\nEmail: ${f.email}\nPhone: ${f.phone}\nSummary notes: ${f.summary}\nExperience notes:\n${f.exp}\nEducation: ${f.edu}\nSkills: ${f.skills}`;
      const text = await callClaude(prompt);
      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (mode === "tailor") {
      const prompt = `You are helping a job seeker tailor their materials for one specific job. Do not invent employers, dates, degrees, or facts not present in the resume below.\n\nRESUME:\n${String(body.resume || "").slice(0, 6000)}\n\nJOB TITLE: ${body.title}\nCOMPANY: ${body.company}\nJOB DESCRIPTION:\n${String(body.description || "").slice(0, 6000)}\n\nReply with exactly two sections, in plain text, separated by the line "=====":\n1. A tailored version of the resume (reordered/reworded to emphasize the most relevant experience and skills for this job, same facts only).\n2. A concise 3-paragraph cover letter for this specific role.`;
      const text = await callClaude(prompt);
      const [resumePart, coverPart] = text.split("=====");
      return new Response(
        JSON.stringify({ resume: (resumePart || "").trim(), coverLetter: (coverPart || "").trim() }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
