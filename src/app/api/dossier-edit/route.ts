import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Saves the user's EDITED dossier back into dossiers.data.dossier, merging so the
// rest of the JSON blob (research counters, marketCompanies, etc.) is preserved.
// The generic /api/dossier POST replaces the whole `data` column, which would wipe
// those — hence this dedicated merge endpoint.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: { dossier?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.dossier || typeof body.dossier !== "object") {
    return NextResponse.json({ error: "missing dossier" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("dossiers")
    .select("data")
    .eq("id", user.id)
    .single();

  const existing = (row?.data as Record<string, unknown> | undefined) || {};
  const newData = {
    ...existing,
    dossier: body.dossier,
    dossierEditedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("dossiers")
    .update({ data: newData, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
