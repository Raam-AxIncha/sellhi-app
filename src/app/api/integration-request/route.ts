import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Captures "Request an integration" demand from the Connect page so the button is
// real, not a fake toast. Appended to dossiers.data.integrationRequests (same
// zero-migration pattern as campaigns). Per-user, auth-gated.
//
// POST /api/integration-request { category, tool? } -> { ok }
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const category = typeof body.category === "string" ? body.category.slice(0, 60) : "";
  const tool = typeof body.tool === "string" ? body.tool.slice(0, 80) : "";
  if (!category && !tool) return NextResponse.json({ error: "missing category/tool" }, { status: 400 });

  const { data: row } = await supabase.from("dossiers").select("data").eq("id", user.id).single();
  const data = (row?.data as Record<string, unknown> | undefined) || {};
  const list = Array.isArray((data as { integrationRequests?: unknown }).integrationRequests)
    ? ((data as { integrationRequests?: unknown[] }).integrationRequests as unknown[])
    : [];
  list.unshift({ category, tool, at: new Date().toISOString() });
  const newData = { ...data, integrationRequests: list.slice(0, 100) };

  await supabase.from("dossiers").upsert(
    { id: user.id, data: newData, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  return NextResponse.json({ ok: true });
}
