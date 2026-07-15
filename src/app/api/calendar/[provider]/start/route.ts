import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Step 1 of calendar OAuth: redirect the user to the provider's consent screen.
// Env-gated — until the client id/secret are set in Vercel, this returns a clear
// "not configured" message instead of a broken redirect.
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//   MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET
// Redirect URI to register with each provider:
//   https://app.sellhi.ai/api/calendar/google/callback
//   https://app.sellhi.ai/api/calendar/microsoft/callback
export const runtime = "nodejs";

const CFG: Record<string, { idEnv: string; authUrl: string; scope: string; extra: string }> = {
  google: {
    idEnv: "GOOGLE_CLIENT_ID",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
    extra: "access_type=offline&prompt=select_account%20consent",
  },
  microsoft: {
    idEnv: "MICROSOFT_CLIENT_ID",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    scope: "openid email offline_access https://graph.microsoft.com/Calendars.Read",
    extra: "response_mode=query",
  },
};

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const cfg = CFG[provider];
  if (!cfg) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env[cfg.idEnv];
  if (!clientId) {
    return new NextResponse(
      `Calendar (${provider}) isn't configured yet. Set ${cfg.idEnv} + secret in Vercel, then reconnect.`,
      { status: 503, headers: { "content-type": "text/plain" } }
    );
  }

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/calendar/${provider}/callback`;
  // CSRF state -> also carries nothing sensitive; verified in the callback cookie.
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  const url = `${cfg.authUrl}?${params.toString()}&${cfg.extra}`;

  const res = NextResponse.redirect(url);
  res.cookies.set(`sh_oauth_state_${provider}`, state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  return res;
}
