import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Generates two personalized outreach variants (pain-led + insight-led) from the
// user's saved dossier and a chosen target company/signal. No web search — pure
// generation from context — so it's fast. Runs on Node with a per-user daily cap.
export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_CAP = Number(process.env.CONTENT_DAILY_CAP || "40");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const SCHEMA = `{
  "variants": [
    { "label": "Pain-led", "subject": "email subject line (empty string for LinkedIn/InMail)", "body": "the message body" },
    { "label": "Insight-led", "subject": "email subject line (empty string for LinkedIn/InMail)", "body": "the message body" }
  ]
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
      { error: "Content generation is not configured yet (missing API key)." },
      { status: 503 }
    );
  }

  let body: {
    company?: string;
    signal?: string;
    tone?: string;
    length?: string;
    channel?: string;
    instructions?: string;
    persona?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  const { data: dossierRow } = await supabase
    .from("dossiers")
    .select("*")
    .eq("id", user.id)
    .single();

  const data = (dossierRow?.data as Record<string, unknown> | undefined) || {};
  const dossier = (data.dossier as Record<string, unknown> | undefined) || {};
  const practice = (dossier.practice as Record<string, unknown> | undefined) || {};
  const experience = (dossier.experience as Record<string, unknown> | undefined) || {};

  const seller = {
    name: dossierRow?.name || "",
    title: dossierRow?.title || "",
    company: dossierRow?.company || (practice.name as string) || "",
    headline: (dossier.headline as string) || "",
    achievement: (dossier.achievement as string) || "",
    industries: experience.industries || dossierRow?.industries || "",
    dealSize: (experience.dealSize as string) || dossierRow?.deal_size || "",
  };

  // Per-user daily cap (cost seatbelt).
  const meta = data.contentGen as { day?: string; count?: number } | undefined;
  const usedToday = meta && meta.day === today() ? meta.count || 0 : 0;
  if (usedToday >= DAILY_CAP) {
    return NextResponse.json(
      { error: `Daily content limit reached (${DAILY_CAP}/day). Try again tomorrow.` },
      { status: 429 }
    );
  }

  const tone = body.tone || "Professional";
  const length = body.length || "Medium";
  const channel = body.channel || "Email";
  const company = body.company || "the target company";
  const signal = body.signal || "";
  const instructions = (body.instructions || "").slice(0, 600);

  // Identity pack (function × level) — makes the message sound like THIS person.
  const pRaw = (body.persona && typeof body.persona === "object")
    ? (body.persona as Record<string, unknown>)
    : null;
  const persona = pRaw
    ? {
        functionLabel: typeof pRaw.functionLabel === "string" ? pRaw.functionLabel : "",
        level: pRaw.level === "delivery" ? "delivery" : "exec",
        messages: Array.isArray(pRaw.messages)
          ? (pRaw.messages as unknown[]).filter((x) => typeof x === "string").slice(0, 4) as string[]
          : [],
      }
    : null;
  const personaRole = persona && persona.functionLabel
    ? `fractional ${persona.functionLabel} ${persona.level === "delivery" ? "delivery professional" : "leader"}`
    : "fractional sales executive";
  const voiceGuide = persona && persona.messages.length
    ? `\n- Voice for this identity — write like a ${personaRole}: ${persona.messages.join("; ")}`
    : "";

  const lengthGuide =
    length === "Short"
      ? "Under 60 words."
      : length === "Long"
      ? "120-170 words."
      : "70-110 words.";

  const system = `You are an expert B2B outbound copywriter writing on behalf of a ${personaRole}. Write two distinct ${channel} outreach variants to a target company, grounded in a real buying signal and the seller's real positioning.

Rules:
- Variant A is "Pain-led" (open on the prospect's likely pain/inflection). Variant B is "Insight-led" (open with a useful insight/pattern).
- Tone: ${tone}. Length each: ${lengthGuide}${voiceGuide}
- ${channel === "Email" ? "Include a specific, non-clickbait subject line." : "This is a " + channel + " message — set subject to an empty string."}
- Ground the message in the seller's REAL positioning and the target's signal. Do NOT invent facts about the target beyond the given signal. Use a [First Name] placeholder for the recipient.
- Natural, credible, concise. No fluff, no clichés, no fake urgency.
- Respond with ONLY a single valid JSON object matching this schema exactly (no prose, no code fences):
${SCHEMA}`;

  const userMsg = `SELLER (writing the outreach — a ${personaRole}):
- Name/Title: ${seller.name || "(unknown)"} / ${seller.title || "Fractional Pro"}
- Practice: ${seller.company || "(unknown)"}
- Positioning: ${seller.headline || "(none)"}
- Notable proof point: ${seller.achievement || "(none)"}
- Industries served: ${Array.isArray(seller.industries) ? (seller.industries as string[]).join(", ") : seller.industries || "(none)"}
- Typical deal size: ${seller.dealSize || "(none)"}

TARGET:
- Company: ${company}
- Signal / context: ${signal || "(general fit — no specific signal provided)"}

${instructions ? "SELLER'S CUSTOM INSTRUCTIONS (follow these): " + instructions : ""}

Write the two ${channel} variants now as JSON.`;

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
        max_tokens: 1600,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: "Content service error", detail: detail.slice(0, 400) },
        { status: 502 }
      );
    }
    anthropicJson = await resp.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach content service", detail: String(e).slice(0, 200) },
      { status: 502 }
    );
  }

  const blocks =
    (anthropicJson as { content?: Array<{ type: string; text?: string }> }).content || [];
  const text = blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  let parsed: { variants?: Array<{ label: string; subject: string; body: string }> };
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return NextResponse.json(
      { error: "Could not parse generated content", raw: text.slice(0, 400) },
      { status: 502 }
    );
  }

  // Bump the daily counter (best-effort; don't fail the response if this errors).
  try {
    const newData = {
      ...data,
      contentGen: { day: today(), count: usedToday + 1, lastAt: new Date().toISOString() },
    };
    // Upsert so the daily-cap counter also persists for a user with no dossier row
    // yet (an .update() would hit 0 rows and let the cost cap be bypassed).
    await supabase
      .from("dossiers")
      .upsert({ id: user.id, data: newData, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    ok: true,
    variants: Array.isArray(parsed.variants) ? parsed.variants.slice(0, 2) : [],
    usedToday: usedToday + 1,
    cap: DAILY_CAP,
  });
}
