import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Common connections" for the TCP dossier, via Common Room.
// POST /api/common-connections { company }
//   - if COMMON_ROOM_API_KEY is not set -> 503 (UI shows "Connect Common Room").
//   - if set -> queries Common Room for people linked to this account. Common
//     Room's relationship data is the compliant source here (NOT LinkedIn
//     scraping). The exact endpoint/shape is finalised against Raam's Common Room
//     workspace — see MEETINGS-SPEC.md. Until confirmed, returns an empty list
//     rather than inventing connections.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: { company?: unknown } = {};
  try { body = await request.json(); } catch { /* company optional */ }
  const company = typeof body.company === "string" ? body.company.trim() : "";

  const apiKey = process.env.COMMON_ROOM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Common Room not configured" }, { status: 503 });
  }

  // Scaffold: wire to Common Room once the workspace + endpoint are confirmed.
  // Shape returned to the UI: { connections: [{ name, role }] }.
  try {
    // Example call pattern (adjust to the confirmed Common Room API):
    //   const r = await fetch(`https://api.commonroom.io/community/v1/members?search=${encodeURIComponent(company)}`,
    //     { headers: { Authorization: `Bearer ${apiKey}` } });
    //   const j = await r.json();
    //   const connections = (j.items || []).map((m) => ({ name: m.full_name, role: m.title }));
    void company;
    const connections: Array<{ name: string; role?: string }> = [];
    return NextResponse.json({ ok: true, connections, note: "Common Room connected; mapping pending confirmation." });
  } catch (e) {
    return NextResponse.json({ error: "Common Room fetch failed", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
