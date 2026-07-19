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
  // return null so the UI shows a clean "no transcript yet" state. Matching is by
  // company name in the title OR by an attendee's email domain, then most-recent.
  type FfAttendee = { displayName?: string; email?: string; name?: string };
  type FfTranscript = {
    id: string; title?: string; dateString?: string; organizer_email?: string;
    participants?: string[]; meeting_attendees?: FfAttendee[];
    summary?: { overview?: string; action_items?: string; keywords?: string[] };
  };
  try {
    const query = `query {
      transcripts(limit: 30) {
        id title dateString organizer_email participants
        meeting_attendees { displayName email name }
        summary { overview action_items keywords }
      }
    }`;
    const resp = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query }),
    });
    const j = await resp.json();
    const list: FfTranscript[] = j?.data?.transcripts || [];

    // newest-first (Fireflies usually returns this order, but be explicit)
    list.sort((a, b) => (Date.parse(b.dateString || "") || 0) - (Date.parse(a.dateString || "") || 0));

    let match: FfTranscript | undefined;
    if (company) {
      const c = company.toLowerCase();
      const core = c.replace(/\b(inc|llc|ltd|limited|corp|co|gmbh|plc|group)\b\.?/g, "").replace(/[^a-z0-9]+/g, "");
      const emailsOf = (t: FfTranscript): string[] => {
        const fromAtt = (t.meeting_attendees || []).map((a) => (a.email || "").toLowerCase());
        const fromParts = (t.participants || []).map((p) => String(p || "").toLowerCase());
        return fromAtt.concat(fromParts, [(t.organizer_email || "").toLowerCase()]);
      };
      match = list.find((t) => {
        const title = (t.title || "").toLowerCase();
        if (title.includes(c) || (core.length > 2 && title.replace(/[^a-z0-9]+/g, "").includes(core))) return true;
        if (core.length > 2) {
          return emailsOf(t).some((e) => {
            const dom = (e.split("@")[1] || "").replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9]+/g, "");
            return dom && (dom === core || dom.includes(core) || core.includes(dom));
          });
        }
        return false;
      });
    }
    if (!match) return NextResponse.json({ ok: true, transcript: null });

    const attendees = (match.meeting_attendees || [])
      .map((a) => ({ name: a.displayName || a.name || "", email: a.email || "" }))
      .filter((a) => a.name || a.email);

    return NextResponse.json({
      ok: true,
      transcript: {
        title: match.title || "Meeting",
        date: match.dateString || "",
        summary: match.summary?.overview || "",
        actionItems: match.summary?.action_items || "",
        keywords: Array.isArray(match.summary?.keywords) ? match.summary?.keywords : [],
        attendees,
        external_id: match.id,
        url: match.id ? "https://app.fireflies.ai/view/" + match.id : "",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Fireflies fetch failed", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
