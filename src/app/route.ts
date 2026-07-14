import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves the EXACT live SellHi demo (public/demo.html) at the web root, but only
 * to signed-in users. We inject the real logged-in identity so the sidebar corner
 * shows the user's own Name / Title. The demo file itself is byte-for-byte; only a
 * tiny identity bootstrap is appended before </body>. Serving at "/" keeps every
 * relative asset path (time-invoicing.js, sellhi-voice-clips.js, /music/*) resolving
 * exactly as on sellhi.ai.
 */
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

  const filePath = path.join(process.cwd(), "public", "demo.html");
  let html = await readFile(filePath, "utf8");

  // Layer app-only UI refinements without touching the exact demo markup.
  if (html.includes("</head>")) {
    html = html.replace(
      "</head>",
      `<link rel="stylesheet" href="/sellhi-overrides.css"></head>`
    );
  }

  const bootstrap =
    `<script>window.__SELLHI_USER__=${JSON.stringify(identity)};try{localStorage.setItem('sellhi_auth','1');}catch(e){}</script>` +
    `<script src="/sellhi-identity.js"></script>` +
    `<script src="/sellhi-onboarding.js"></script>` +
    `<script src="/sellhi-research.js"></script>` +
    `<script src="/sellhi-preview-badges.js"></script>`;
  html = html.includes("</body>")
    ? html.replace("</body>", `${bootstrap}</body>`)
    : html + bootstrap;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
