import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Pulls the signed-in user's upcoming calendar events from every connected
// provider into the `meetings` table, so the Meeting Prep list is populated.
// Refreshes the access token first when it's expired. Called by the client on
// load (and after returning from an OAuth connect). Safe to call repeatedly —
// events upsert on (user_id, provider, external_id).
export const runtime = "nodejs";
export const maxDuration = 30;

const WINDOW_DAYS = 30;

type Conn = {
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type Meeting = {
  external_id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  join_url: string | null;
  attendees: Array<{ name?: string; email?: string }>;
};

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() < 60_000; // 1-min skew
}

// --- token refresh -------------------------------------------------------
async function refreshToken(
  provider: string,
  refresh: string
): Promise<{ access_token: string; expires_in?: number; refresh_token?: string } | null> {
  const cfg =
    provider === "google"
      ? { url: "https://oauth2.googleapis.com/token", id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET }
      : { url: "https://login.microsoftonline.com/common/oauth2/v2.0/token", id: process.env.MICROSOFT_CLIENT_ID, secret: process.env.MICROSOFT_CLIENT_SECRET };
  if (!cfg.id || !cfg.secret) return null;
  try {
    const resp = await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.id,
        client_secret: cfg.secret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
    });
    const j = await resp.json();
    if (!resp.ok || !j.access_token) return null;
    return j;
  } catch {
    return null;
  }
}

// --- event fetch per provider -------------------------------------------
async function fetchGoogle(token: string): Promise<Meeting[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + WINDOW_DAYS * 864e5).toISOString();
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
    new URLSearchParams({
      timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "30",
    }).toString();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items || []).map((e: Record<string, unknown>) => {
    const start = e.start as { dateTime?: string; date?: string } | undefined;
    const end = e.end as { dateTime?: string; date?: string } | undefined;
    const conf = e.conferenceData as { entryPoints?: Array<{ uri?: string }> } | undefined;
    const join = (e.hangoutLink as string) || conf?.entryPoints?.find((p) => p.uri)?.uri || null;
    return {
      external_id: String(e.id),
      title: (e.summary as string) || "(no title)",
      start_at: start?.dateTime || start?.date || null,
      end_at: end?.dateTime || end?.date || null,
      location: (e.location as string) || null,
      join_url: join,
      attendees: ((e.attendees as Array<{ displayName?: string; email?: string }>) || []).map((a) => ({ name: a.displayName, email: a.email })),
    };
  });
}

async function fetchMicrosoft(token: string): Promise<Meeting[]> {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + WINDOW_DAYS * 864e5).toISOString();
  const url =
    "https://graph.microsoft.com/v1.0/me/calendarView?" +
    new URLSearchParams({ startDateTime: start, endDateTime: end, $orderby: "start/dateTime", $top: "30" }).toString();
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.value || []).map((e: Record<string, unknown>) => {
    const s = e.start as { dateTime?: string } | undefined;
    const en = e.end as { dateTime?: string } | undefined;
    const loc = e.location as { displayName?: string } | undefined;
    const online = e.onlineMeeting as { joinUrl?: string } | undefined;
    const toIso = (dt?: string) => (dt ? (dt.endsWith("Z") ? dt : dt + "Z") : null);
    return {
      external_id: String(e.id),
      title: (e.subject as string) || "(no title)",
      start_at: toIso(s?.dateTime),
      end_at: toIso(en?.dateTime),
      location: loc?.displayName || null,
      join_url: online?.joinUrl || null,
      attendees: ((e.attendees as Array<{ emailAddress?: { name?: string; address?: string } }>) || []).map((a) => ({ name: a.emailAddress?.name, email: a.emailAddress?.address })),
    };
  });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: conns } = await supabase
    .from("calendar_connections")
    .select("provider, access_token, refresh_token, expires_at")
    .eq("user_id", user.id);

  if (!conns || !conns.length) return NextResponse.json({ ok: true, synced: 0, providers: [] });

  let total = 0;
  const providersDone: string[] = [];

  for (const conn of conns as Conn[]) {
    let token = conn.access_token || "";
    // Refresh if needed.
    if (isExpired(conn.expires_at) && conn.refresh_token) {
      const refreshed = await refreshToken(conn.provider, conn.refresh_token);
      if (refreshed) {
        token = refreshed.access_token;
        await supabase
          .from("calendar_connections")
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token ?? conn.refresh_token,
            expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("provider", conn.provider);
      }
    }
    if (!token) continue;

    let events: Meeting[] = [];
    try {
      events = conn.provider === "google" ? await fetchGoogle(token) : await fetchMicrosoft(token);
    } catch {
      events = [];
    }

    if (events.length) {
      const rows = events.map((m) => ({
        user_id: user.id,
        provider: conn.provider,
        external_id: m.external_id,
        title: m.title,
        start_at: m.start_at,
        end_at: m.end_at,
        location: m.location,
        join_url: m.join_url,
        attendees: m.attendees,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("meetings").upsert(rows, { onConflict: "user_id,provider,external_id" });
      if (!error) total += rows.length;
    }
    providersDone.push(conn.provider);
  }

  return NextResponse.json({ ok: true, synced: total, providers: providersDone });
}
