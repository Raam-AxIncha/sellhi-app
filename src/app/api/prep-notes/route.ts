import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Prep notes (+ scribble canvas) for a meeting or a company.
// GET  /api/prep-notes?key=<meeting_key>  -> the saved note (or empty shell)
// POST /api/prep-notes { key, company?, notes?, canvas? } -> upsert
// meeting_key is either a calendar meeting id/external_id or a freeform company
// slug, so prep works even before the calendar is connected.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const { data } = await supabase
    .from("prep_notes")
    .select("meeting_key, company, notes, canvas, updated_at")
    .eq("user_id", user.id)
    .eq("meeting_key", key)
    .single();

  return NextResponse.json({ ok: true, note: data ?? { meeting_key: key, company: "", notes: "", canvas: null } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: { key?: unknown; company?: unknown; notes?: unknown; canvas?: unknown } = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const row: Record<string, unknown> = {
    user_id: user.id,
    meeting_key: key,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.company === "string") row.company = body.company;
  if (typeof body.notes === "string") row.notes = body.notes;
  // Guardrail: cap the canvas payload so a huge scribble can't blow up the row.
  if (typeof body.canvas === "string") {
    if (body.canvas.length > 1_500_000) {
      return NextResponse.json({ error: "scribble too large" }, { status: 413 });
    }
    row.canvas = body.canvas;
  }

  const { error } = await supabase.from("prep_notes").upsert(row, { onConflict: "user_id,meeting_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
