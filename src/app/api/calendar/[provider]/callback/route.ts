import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Step 2 of calendar OAuth: exchange the code for tokens and store them, then
// bounce back to /meetings. Env-gated on the client secret.
export const runtime = "nodejs";

const CFG: Record<string, { idEnv: string; secretEnv: string; tokenUrl: string }> = {
  google: {
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
    tokenUrl: "https://oauth2.googleapis.com/token",
  },
  microsoft: {
    idEnv: "MICROSOFT_CLIENT_ID",
    secretEnv: "MICROSOFT_CLIENT_SECRET",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  },
};

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const cfg = CFG[provider];
  const { origin, searchParams } = new URL(request.url);
  if (!cfg) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const clientId = process.env[cfg.idEnv];
  const clientSecret = process.env[cfg.secretEnv];
  if (!clientId || !clientSecret) {
    return new NextResponse(`Calendar (${provider}) isn't configured yet.`, {
      status: 503, headers: { "content-type": "text/plain" },
    });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")?.split(";").map((c) => c.trim())
    .find((c) => c.startsWith(`sh_oauth_state_${provider}=`))?.split("=")[1];
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${origin}/meetings?calendar_error=state`);
  }

  const redirectUri = `${origin}/api/calendar/${provider}/callback`;
  let tokenJson: {
    access_token?: string; refresh_token?: string; expires_in?: number; scope?: string;
  };
  try {
    const resp = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: "authorization_code",
      }),
    });
    tokenJson = await resp.json();
    if (!resp.ok || !tokenJson.access_token) {
      return NextResponse.redirect(`${origin}/meetings?calendar_error=token`);
    }
  } catch {
    return NextResponse.redirect(`${origin}/meetings?calendar_error=network`);
  }

  // Best-effort: fetch the connected account's email for display.
  let email: string | null = null;
  try {
    if (provider === "google") {
      const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      }).then((r) => r.json());
      email = u.email || null;
    } else {
      const u = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      }).then((r) => r.json());
      email = u.mail || u.userPrincipalName || null;
    }
  } catch { /* non-fatal */ }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : null;

  await supabase.from("calendar_connections").upsert(
    {
      user_id: user.id,
      provider,
      email,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokenJson.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  const res = NextResponse.redirect(`${origin}/meetings?calendar=connected`);
  res.cookies.set(`sh_oauth_state_${provider}`, "", { path: "/", maxAge: 0 });
  return res;
}
