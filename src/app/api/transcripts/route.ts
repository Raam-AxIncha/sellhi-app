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

  const key = new URL(request.url).searchParams.get("key") || "";

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

  // 2) Pull the latest transcript from Fireflies as a starting point.
  try {
    const query = `query { transcripts(limit: 1) { id title summary { overview } dateString } }`;
    const resp = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query }),
    });
    const j = await resp.json();
    const t = j?.data?.transcripts?.[0];
    if (!t) return NextResponse.json({ ok: true, transcript: null });
    const transcript = {
      title: t.title || "Meeting",
      summary: t.summary?.overview || "",
      external_id: t.id,
    };
    return NextResponse.json({ ok: true, transcript });
  } catch (e) {
    return NextResponse.json({ error: "Fireflies fetch failed", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
