import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Meeting transcript via Fireflies (already in Raam's stack).
// GET /api/transcripts?key=<meeting_key>
//   - returns any transcript we've already saved for this key, else
//   - if FIREFLIES_API_KEY is set, fetches the most recent Fireflies transcript
//     as a starting point (mapping a transcript to a specific meeting is refined
//     later via the meeting's date/title — see MEETINGS-SPEC.md).
//   - if not configured, returns 503 so the UI shows a "Connect Fireflies" state.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const reqUrl = new URL(request.url);
  const key = reqUrl.searchParams.get("key") || "";
  const company = (reqUrl.searchParams.get("company") || "").trim();

  // 1) Already-saved transcript for this meeting?
  if (key) {
    const { data: saved } = await supabase
      .from("transcripts")
      .select("title, summary, transcript")
      .eq("user_id", user.id)
      .eq("meeting_key", key)
      .single();
    if (saved) return NextResponse.json({ ok: true, transcript: saved });
  }

  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Fireflies not configured" }, { status: 503 });
  }

  // 2) Find a Fireflies transcript that actually MATCHES this meeting/company.
  // We do NOT return an unrelated "latest" transcript — if nothing matches, we
  // return null so the UI shows a clean "no transcript yet" state.
  try {
    const query = `query { transcripts(limit: 25) { id title summary { overview } dateString } }`;
    const resp = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query }),
    });
    const j = await resp.json();
    const list: Array<{ id: string; title?: string; summary?: { overview?: string } }> =
      j?.data?.transcripts || [];

    let match: { id: string; title?: string; summary?: { overview?: string } } | undefined;
    if (company) {
      const c = company.toLowerCase();
      // strip common company suffixes so "Acmeware Inc" still matches "Acmeware ..."
      const core = c.replace(/\b(inc|llc|ltd|limited|corp|co|gmbh|plc|group)\b\.?/g, "").trim();
      match = list.find((t) => {
        const title = (t.title || "").toLowerCase();
        return title.includes(c) || (core.length > 2 && title.includes(core));
      });
    }
    if (!match) return NextResponse.json({ ok: true, transcript: null });
    return NextResponse.json({
      ok: true,
      transcript: { title: match.title || "Meeting", summary: match.summary?.overview || "", external_id: match.id },
    });
  } catch (e) {
    return NextResponse.json({ error: "Fireflies fetch failed", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
