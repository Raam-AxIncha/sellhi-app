import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, title, company")
    .eq("id", user.id)
    .single();

  const meta = user.user_metadata || {};
  const fullName = profile?.full_name || meta.full_name || meta.name || (user.email ?? "").split("@")[0];
  const title = profile?.title || meta.title || "Fractional CXO";
  const company = profile?.company || meta.company || "";

  return NextResponse.json({
    signedIn: true,
    email: user.email,
    fullName,
    title,
    company,
  });
}
