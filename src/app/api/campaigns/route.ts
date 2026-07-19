import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Staged campaigns — persisted per-user so they survive across devices (unlike the
// earlier localStorage draft). Stored in the existing `dossiers.data.campaigns`
// JSON array, so NO database migration is needed (same pattern as marketCompanies).
// Nothing here sends email — staging only. Live send stays gated on an email sender.
//
// GET    /api/campaigns                    -> { ok, campaigns: [...] }
// POST   /api/campaigns { name, recipients, steps, tierLabel, companies, sequence }
//                                          -> { ok, campaign }
// DELETE /api/campaigns { id }             -> { ok }
export const runtime = "nodejs";

type Campaign = {
  id: string; name: string; recipients: number; steps: number; tierLabel: string;
  companies: string[]; sequence: Array<{ title: string; meta: string }>; createdAt: string;
};

async function readData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: row } = await supabase.from("dossiers").select("data").eq("id", userId).single();
  const data = (row?.data as Record<string, unknown> | undefined) || {};
  const campaigns = Array.isArray((data as { campaigns?: unknown }).campaigns)
    ? ((data as { campaigns?: Campaign[] }).campaigns as Campaign[])
    : [];
  return { data, campaigns };
}
async function writeData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: Record<string, unknown>,
  campaigns: Campaign[]
) {
  const newData = { ...data, campaigns };
  // Upsert so it works even if the user has no dossier row yet.
  await supabase.from("dossiers").upsert(
    { id: userId, data: newData, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const { campaigns } = await readData(supabase, user.id);
  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });

  const campaign: Campaign = {
    id: crypto.randomUUID(),
    name,
    recipients: Number(body.recipients) || 0,
    steps: Number(body.steps) || 0,
    tierLabel: typeof body.tierLabel === "string" ? body.tierLabel : "",
    companies: Array.isArray(body.companies) ? (body.companies as string[]).slice(0, 500) : [],
    sequence: Array.isArray(body.sequence) ? (body.sequence as Array<{ title: string; meta: string }>).slice(0, 50) : [],
    createdAt: new Date().toISOString(),
  };

  const { data, campaigns } = await readData(supabase, user.id);
  campaigns.unshift(campaign);
  await writeData(supabase, user.id, data, campaigns.slice(0, 50));
  return NextResponse.json({ ok: true, campaign });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { data, campaigns } = await readData(supabase, user.id);
  const next = campaigns.filter((c) => c.id !== id);
  await writeData(supabase, user.id, data, next);
  return NextResponse.json({ ok: true });
}
