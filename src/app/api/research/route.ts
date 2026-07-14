import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// This route calls Claude with the web-search tool to research the user's
// company + person, then returns a structured dossier and saves it. It can
// take 20-40s, so give it room and run on Node.
export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_CAP = Number(process.env.RESEARCH_DAILY_CAP || "5");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// The exact shape we ask Claude to return — mirrors the demo's dossier sections.
const SCHEMA = `{
  "headline": "one-sentence positioning summary of this person's practice",
  "practice": {
    "name": "company / practice name",
    "summary": "2-sentence description of what the practice does",
    "industry": "short industry label",
    "headcount": "e.g. '~5-15' or a number; note if estimated",
    "funding": "e.g. 'Bootstrapped' or funding raised; note if unknown",
    "hq": "city, country; note if inferred",
    "founded": "year or 'Unknown'"
  },
  "seat": {
    "initials": "person's initials, 2 letters",
    "nameTitle": "Full Name · Title",
    "bio": "2-sentence bio of the person's role and background"
  },
  "experience": {
    "industries": ["up to 4 industries served"],
    "stages": ["up to 3 company stages, e.g. Seed, Series A-B, Growth"],
    "dealSize": "typical deal size range, e.g. '$250K - $1M'"
  },
  "achievement": "one notable, specific achievement (with numbers if available)",
  "positioning": [
    { "label": "segment name", "text": "one-sentence positioning angle" }
  ],
  "confidence": 0
}`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Research is not configured yet (missing API key)." },
      { status: 503 }
    );
  }

  // Load the user's saved onboarding inputs (from Phase 2).
  const { data: dossierRow } = await supabase
    .from("dossiers")
    .select("*")
    .eq("id", user.id)
    .single();

  const inputs = {
    name: dossierRow?.name || "",
    title: dossierRow?.title || "",
    company: dossierRow?.company || "",
    company_url: dossierRow?.company_url || "",
    linkedin_url: dossierRow?.linkedin_url || "",
    industries: dossierRow?.industries || "",
    deal_size: dossierRow?.deal_size || "",
  };
  if (!inputs.company && !inputs.company_url && !inputs.name) {
    return NextResponse.json(
      { error: "Please fill in your details first." },
      { status: 400 }
    );
  }

  // --- Per-user daily cap (cost seatbelt) ---
  const meta = (dossierRow?.data && (dossierRow.data as Record<string, unknown>).research) as
    | { day?: string; count?: number }
    | undefined;
  const usedToday = meta && meta.day === today() ? meta.count || 0 : 0;
  if (usedToday >= DAILY_CAP) {
    return NextResponse.json(
      { error: `Daily research limit reached (${DAILY_CAP}/day). Try again tomorrow.` },
      { status: 429 }
    );
  }

  const system = `You are a B2B go-to-market research analyst. Research the person and their company/practice using web search, then produce a concise executive dossier.

Rules:
- Use web search to find real, current facts. Prioritise the company website and reputable sources.
- Never invent specifics. If a fact isn't findable, use a clearly-hedged estimate (e.g. "~10-20 (estimated)") or "Unknown".
- Keep every field tight and factual. No marketing fluff.
- "confidence" is your 0-100 self-assessment of how well-supported the dossier is by real sources.
- Respond with ONLY a single valid JSON object matching this schema exactly (no prose, no code fences):
${SCHEMA}`;

  const userMsg = `Research this person and their practice:
- Name: ${inputs.name || "(unknown)"}
- Title: ${inputs.title || "(unknown)"}
- Company / practice: ${inputs.company || "(unknown)"}
- Company URL: ${inputs.company_url || "(none)"}
- LinkedIn URL: ${inputs.linkedin_url || "(none)"}
- Industries they mention: ${inputs.industries || "(none)"}
- Deal size they mention: ${inputs.deal_size || "(none)"}

Return the JSON dossier now.`;

  let anthropicJson: unknown;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        system,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: "Research service error", detail: detail.slice(0, 400) },
        { status: 502 }
      );
    }
    anthropicJson = await resp.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach research service", detail: String(e).slice(0, 200) },
      { status: 502 }
    );
  }

  // Pull the final text blocks and parse the JSON dossier out of them.
  const blocks = (anthropicJson as { content?: Array<{ type: string; text?: string }> })
    .content || [];
  const text = blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  let dossier: unknown;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    dossier = JSON.parse(text.slice(start, end + 1));
  } catch {
    return NextResponse.json(
      { error: "Could not parse research result", raw: text.slice(0, 400) },
      { status: 502 }
    );
  }

  // Save the dossier + bump the daily counter.
  const newData = {
    ...(dossierRow?.data as Record<string, unknown> | undefined),
    dossier,
    research: { day: today(), count: usedToday + 1, lastAt: new Date().toISOString() },
  };
  await supabase
    .from("dossiers")
    .update({ data: newData, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, dossier, usedToday: usedToday + 1, cap: DAILY_CAP });
}
