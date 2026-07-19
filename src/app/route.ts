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

  // Cache-buster: changes on every deploy (Vercel commit SHA), so browsers fetch
  // the newest app-layer CSS/JS immediately without a manual hard refresh.
  const v = "?v=" + (process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())).slice(0, 8);

  // Layer app-only UI refinements without touching the exact demo markup.
  if (html.includes("</head>")) {
    html = html.replace(
      "</head>",
      `<link rel="stylesheet" href="/sellhi-overrides.css${v}"><link rel="stylesheet" href="/sellhi-premium.css${v}"></head>`
    );
  }

  const bootstrap =
    `<script>window.__SELLHI_USER__=${JSON.stringify(identity)};try{localStorage.setItem('sellhi_auth','1');}catch(e){}</script>` +
    `<script>(function(){if(window.__SELLHI_FIXES__)return;window.__SELLHI_FIXES__=true;var o=window.fetch.bind(window),f=Object.create(null);window.fetch=function(i,n){try{var u=(typeof i==="string")?i:(i&&i.url)||"";var m=((n&&n.method)||(i&&i.method)||"GET").toUpperCase();if(m==="GET"&&u.indexOf("/api/dossier")!==-1&&u.indexOf("dossier-edit")===-1){var k=u;if(f[k])return f[k].then(function(r){return r.clone()});var p=o(i,n);f[k]=p;var c=function(){delete f[k]};p.then(c,c);return p.then(function(r){return r.clone()})}}catch(e){}return o(i,n)}})();</script>` +
    `<script src="/sellhi-identity.js${v}"></script>` +
    `<script src="/sellhi-onboarding.js${v}"></script>` +
    `<script src="/sellhi-research.js${v}"></script>` +
    `<script src="/sellhi-market.js${v}"></script>` +
    `<script src="/sellhi-nav.js${v}"></script>` +
    `<script src="/sellhi-preview-badges.js${v}"></script>` +
    `<script src="/sellhi-content.js${v}"></script>` +
    `<script src="/sellhi-command.js${v}"></script>` +
    `<script src="/sellhi-campaign.js${v}"></script>` +
    `<script src="/sellhi-loader.js${v}"></script>`;
  html = html.includes("</body>")
    ? html.replace("</body>", `${bootstrap}</body>`)
    : html + bootstrap;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
