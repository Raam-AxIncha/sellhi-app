import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves the SellHi Connect surface (public/connect.html) at /connect, only to
 * signed-in users. Self-contained page (own scoped styles) so it never collides
 * with the demo's global class names. Choices persist per-user via /api/connect
 * (RLS-protected connect_config table). Same auth gate + cache-buster as "/".
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const filePath = path.join(process.cwd(), "public", "connect.html");
  let html = await readFile(filePath, "utf8");

  const v = "?v=" + (process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())).slice(0, 8);
  html = html.replace(/(\/connect\.js|\/connect\.css)(?=")/g, `$1${v}`);

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
