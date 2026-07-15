import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Disconnects a calendar provider: removes the stored OAuth tokens and the
// meetings that were synced from it, so the user can reconnect (or switch to a
// different account) cleanly.
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  await supabase.from("calendar_connections").delete().eq("user_id", user.id).eq("provider", provider);
  await supabase.from("meetings").delete().eq("user_id", user.id).eq("provider", provider);

  return NextResponse.json({ ok: true });
}
