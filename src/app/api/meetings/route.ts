import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Meetings list + calendar connection status.
// GET /api/meetings -> { connected: {google, microsoft}, meetings: [...] }
// Meetings come from the cached `meetings` table (populated by calendar sync once
// a provider is connected). Until then this returns an empty list + connection
// flags so the UI can show a "Connect your calendar" empty state.
// POST /api/meetings { title, start_at, end_at, company?, attendees? } -> add a
// manual meeting (works with no calendar connected).
// PATCH /api/meetings { id, title?, start_at?, end_at?, location?, description? }
//   -> edit a meeting. For google/microsoft events it writes the change BACK to
//   the provider (needs the write scope: Google calendar.events / MS
//   Calendars.ReadWrite — reconnect after deploy to grant it). If the remote
//   write fails for lack of scope, we DON'T touch the local copy and return a
//   clear needsReconnect flag so the UI can prompt a reconnect.
export const runtime = "nodejs";

// --- token refresh (mirrors /api/calendar/sync) --------------------------
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() < 60_000;
}
async function refreshToken(provider: string, refresh: string) {
  const cfg =
    provider === "google"
      ? { url: "https://oauth2.googleapis.com/token", id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET }
      : { url: "https://login.microsoftonline.com/common/oauth2/v2.0/token", id: process.env.MICROSOFT_CLIENT_ID, secret: process.env.MICROSOFT_CLIENT_SECRET };
  if (!cfg.id || !cfg.secret) return null;
  try {
    const resp = await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret, refresh_token: refresh, grant_type: "refresh_token" }),
    });
    const j = await resp.json();
    if (!resp.ok || !j.access_token) return null;
    return j as { access_token: string; expires_in?: number; refresh_token?: string };
  } catch { return null; }
}
function msLocal(iso: string): string {
  // Microsoft Graph wants 'YYYY-MM-DDTHH:mm:ss' (no trailing Z), paired with timeZone.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 19);
}

// Get a usable access token for a provider (refreshing + persisting if expired).
// Returns "" when the connection is missing or can't be refreshed.
async function getConnToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  provider: string
): Promise<string> {
  const { data: conn } = await supabase
    .from("calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId).eq("provider", provider).single();
  if (!conn) return "";
  let token = conn.access_token || "";
  if (isExpired(conn.expires_at) && conn.refresh_token) {
    const refreshed = await refreshToken(provider, conn.refresh_token);
    if (refreshed) {
      token = refreshed.access_token;
      await supabase.from("calendar_connections").update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? conn.refresh_token,
        expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("provider", provider);
    }
  }
  return token;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: conns } = await supabase
    .from("calendar_connections")
    .select("provider, email")
    .eq("user_id", user.id);

  const connected = {
    google: !!conns?.find((c) => c.provider === "google"),
    microsoft: !!conns?.find((c) => c.provider === "microsoft"),
  };

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, provider, external_id, title, start_at, end_at, location, join_url, attendees")
    .eq("user_id", user.id)
    .order("start_at", { ascending: true });

  return NextResponse.json({ ok: true, connected, meetings: meetings ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });

  const start_at = typeof body.start_at === "string" ? body.start_at : null;
  const end_at = typeof body.end_at === "string" ? body.end_at : null;
  const location = typeof body.location === "string" ? body.location : null;
  const description = typeof body.description === "string" ? body.description : "";
  const wantProvider = typeof body.provider === "string" ? body.provider : "manual";

  let provider = "manual";
  let external_id = "manual-" + Date.now();

  // If asked to create on a real calendar, write it to the provider first.
  if (wantProvider === "google" || wantProvider === "microsoft") {
    const token = await getConnToken(supabase, user.id, wantProvider);
    if (!token) return NextResponse.json({ error: wantProvider + " calendar not connected", needsReconnect: true }, { status: 409 });
    try {
      let resp: Response;
      if (wantProvider === "google") {
        const gbody: Record<string, unknown> = { summary: title };
        if (location) gbody.location = location;
        if (description) gbody.description = description;
        if (start_at) gbody.start = { dateTime: new Date(start_at).toISOString(), timeZone: "UTC" };
        if (end_at) gbody.end = { dateTime: new Date(end_at).toISOString(), timeZone: "UTC" };
        resp = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(gbody),
        });
      } else {
        const mbody: Record<string, unknown> = { subject: title };
        if (location) mbody.location = { displayName: location };
        if (description) mbody.body = { contentType: "text", content: description };
        if (start_at) mbody.start = { dateTime: msLocal(start_at), timeZone: "UTC" };
        if (end_at) mbody.end = { dateTime: msLocal(end_at), timeZone: "UTC" };
        resp = await fetch("https://graph.microsoft.com/v1.0/me/events", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(mbody),
        });
      }
      if (!resp.ok) {
        const detail = (await resp.text().catch(() => "")).slice(0, 300);
        const needsReconnect = resp.status === 401 || resp.status === 403;
        return NextResponse.json({ error: "Couldn't create the event" + (needsReconnect ? " — reconnect to grant edit access." : "."), needsReconnect, detail }, { status: 502 });
      }
      const created = await resp.json().catch(() => ({}));
      if (created && created.id) { provider = wantProvider; external_id = String(created.id); }
    } catch (e) {
      return NextResponse.json({ error: "Calendar create failed", detail: String(e).slice(0, 200) }, { status: 502 });
    }
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    provider,
    external_id,
    title,
    start_at,
    end_at,
    location,
    attendees: Array.isArray(body.attendees) ? body.attendees : [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("meetings").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id, provider, external_id });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { data: mtg } = await supabase
    .from("meetings")
    .select("id, provider, external_id")
    .eq("user_id", user.id).eq("id", id).single();
  if (!mtg) return NextResponse.json({ error: "meeting not found" }, { status: 404 });

  // Remove from the real calendar first (best-effort: a 404 there = already gone).
  if ((mtg.provider === "google" || mtg.provider === "microsoft") && mtg.external_id) {
    const token = await getConnToken(supabase, user.id, mtg.provider);
    if (!token) return NextResponse.json({ error: "calendar not connected", needsReconnect: true }, { status: 409 });
    try {
      const url = mtg.provider === "google"
        ? "https://www.googleapis.com/calendar/v3/calendars/primary/events/" + encodeURIComponent(mtg.external_id)
        : "https://graph.microsoft.com/v1.0/me/events/" + encodeURIComponent(mtg.external_id);
      const resp = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
        const needsReconnect = resp.status === 401 || resp.status === 403;
        const detail = (await resp.text().catch(() => "")).slice(0, 300);
        return NextResponse.json({ error: "Couldn't delete the event" + (needsReconnect ? " — reconnect to grant edit access." : "."), needsReconnect, detail }, { status: 502 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Calendar delete failed", detail: String(e).slice(0, 200) }, { status: 502 });
    }
  }

  const { error: delErr } = await supabase.from("meetings").delete().eq("user_id", user.id).eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // Only allow these fields to change.
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const patch: { title?: string; start_at?: string; end_at?: string; location?: string } = {};
  if (str(body.title) !== undefined) patch.title = str(body.title);
  if (str(body.start_at) !== undefined) patch.start_at = str(body.start_at);
  if (str(body.end_at) !== undefined) patch.end_at = str(body.end_at);
  if (str(body.location) !== undefined) patch.location = str(body.location);
  const description = str(body.description);
  if (!Object.keys(patch).length && description === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // Load the meeting (RLS scopes to the owner).
  const { data: mtg } = await supabase
    .from("meetings")
    .select("id, provider, external_id, title, start_at, end_at, location")
    .eq("user_id", user.id).eq("id", id).single();
  if (!mtg) return NextResponse.json({ error: "meeting not found" }, { status: 404 });

  // For real calendar events, write the change back to the provider first.
  const provider = mtg.provider;
  if ((provider === "google" || provider === "microsoft") && mtg.external_id) {
    const { data: conn } = await supabase
      .from("calendar_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id).eq("provider", provider).single();
    if (!conn) return NextResponse.json({ error: "calendar not connected", needsReconnect: true }, { status: 409 });

    let token = conn.access_token || "";
    if (isExpired(conn.expires_at) && conn.refresh_token) {
      const refreshed = await refreshToken(provider, conn.refresh_token);
      if (refreshed) {
        token = refreshed.access_token;
        await supabase.from("calendar_connections").update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? conn.refresh_token,
          expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("provider", provider);
      }
    }
    if (!token) return NextResponse.json({ error: "no access token", needsReconnect: true }, { status: 409 });

    try {
      let resp: Response;
      if (provider === "google") {
        const gbody: Record<string, unknown> = {};
        if (patch.title !== undefined) gbody.summary = patch.title;
        if (patch.location !== undefined) gbody.location = patch.location;
        if (description !== undefined) gbody.description = description;
        if (patch.start_at !== undefined) gbody.start = { dateTime: new Date(patch.start_at).toISOString(), timeZone: "UTC" };
        if (patch.end_at !== undefined) gbody.end = { dateTime: new Date(patch.end_at).toISOString(), timeZone: "UTC" };
        resp = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events/" + encodeURIComponent(mtg.external_id),
          { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(gbody) }
        );
      } else {
        const mbody: Record<string, unknown> = {};
        if (patch.title !== undefined) mbody.subject = patch.title;
        if (patch.location !== undefined) mbody.location = { displayName: patch.location };
        if (description !== undefined) mbody.body = { contentType: "text", content: description };
        if (patch.start_at !== undefined) mbody.start = { dateTime: msLocal(patch.start_at), timeZone: "UTC" };
        if (patch.end_at !== undefined) mbody.end = { dateTime: msLocal(patch.end_at), timeZone: "UTC" };
        resp = await fetch(
          "https://graph.microsoft.com/v1.0/me/events/" + encodeURIComponent(mtg.external_id),
          { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(mbody) }
        );
      }
      if (!resp.ok) {
        const detail = (await resp.text().catch(() => "")).slice(0, 300);
        // 401/403 almost always means the old read-only scope — prompt a reconnect.
        const needsReconnect = resp.status === 401 || resp.status === 403;
        return NextResponse.json(
          { error: "Couldn't update the event in your calendar" + (needsReconnect ? " — reconnect to grant edit access." : "."), needsReconnect, detail },
          { status: 502 }
        );
      }
    } catch (e) {
      return NextResponse.json({ error: "Calendar write failed", detail: String(e).slice(0, 200) }, { status: 502 });
    }
  }

  // Remote write succeeded (or it's a manual meeting) -> update our cached copy.
  const localPatch: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { error: upErr } = await supabase.from("meetings").update(localPatch).eq("user_id", user.id).eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id, updated: patch });
}
