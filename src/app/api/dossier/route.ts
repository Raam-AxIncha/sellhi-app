import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Fields we persist from the onboarding step. Kept small + explicit.
const FIELDS = [
  "name",
  "title",
  "company",
  "company_url",
  "linkedin_url",
  "industries",
  "deal_size",
] as const;

// GET /api/dossier -> the signed-in user's saved onboarding inputs (or {}).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false }, { status: 401 });

  const { data } = await supabase
    .from("dossiers")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ signedIn: true, dossier: data ?? null });
}

// POST /api/dossier -> upsert the user's onboarding inputs.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const row: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() };
  for (const f of FIELDS) {
    if (typeof body[f] === "string") row[f] = body[f];
  }
  if (body.data && typeof body.data === "object") row.data = body.data;

  const { error } = await supabase.from("dossiers").upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the sidebar identity (profiles) in sync with what they typed.
  const profilePatch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) profilePatch.full_name = body.name.trim();
  if (typeof body.title === "string" && body.title.trim()) profilePatch.title = body.title.trim();
  if (typeof body.company === "string" && body.company.trim()) profilePatch.company = body.company.trim();
  if (Object.keys(profilePatch).length) {
    await supabase.from("profiles").update(profilePatch).eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
