import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Serves the standalone Meeting Prep workspace (public/meetings.html) to
// signed-in users only, injecting the logged-in identity for the header +
// dossier context. Mirrors the pattern used to serve the demo at "/".
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, title, company")
    .eq("id", user.id)
    .single();

  const meta = user.user_metadata || {};
  const identity = {
    signedIn: true,
    email: user.email,
    fullName: profile?.full_name || meta.full_name || meta.name || (user.email ?? "").split("@")[0],
    title: profile?.title || meta.title || "Fractional CXO",
    company: profile?.company || meta.company || "",
  };

  const filePath = path.join(process.cwd(), "public", "meetings.html");
  let html = await readFile(filePath, "utf8");

  const bootstrap = `<script>window.__SELLHI_USER__=${JSON.stringify(identity)};</script>`;
  html = html.includes("</body>") ? html.replace("</body>", `${bootstrap}</body>`) : html + bootstrap;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
