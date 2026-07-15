import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Meetings list + calendar connection status.
// GET /api/meetings -> { connected: {google, microsoft}, meetings: [...] }
// Meetings come from the cached `meetings` table (populated by calendar sync once
// a provider is connected). Until then this returns an empty list + connection
// flags so the UI can show a "Connect your calendar" empty state.
// POST /api/meetings { title, start_at, end_at, company?, attendees? } -> add a
// manual meeting (works with no calendar connected).
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: conns } = await supabase
    .from("calendar_connections")
    .select("provider, email")
    .eq("user_id", user.id);

  const connected = {
    google: !!conns?.find((c) => c.provider === "google"),
    microsoft: !!conns?.find((c) => c.provider === "microsoft"),
  };

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, provider, external_id, title, start_at, end_at, location, join_url, attendees")
    .eq("user_id", user.id)
    .order("start_at", { ascending: true });

  return NextResponse.json({ ok: true, connected, meetings: meetings ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });

  const row: Record<string, unknown> = {
    user_id: user.id,
    provider: "manual",
    external_id: "manual-" + Date.now(),
    title,
    start_at: typeof body.start_at === "string" ? body.start_at : null,
    end_at: typeof body.end_at === "string" ? body.end_at : null,
    attendees: Array.isArray(body.attendees) ? body.attendees : [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("meetings").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id });
}
