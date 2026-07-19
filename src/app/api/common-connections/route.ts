import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Common connections" for the TCP dossier — built from the subscriber's OWN
// first-party data (compliant by design; NO LinkedIn scraping, NO Common Room):
//   1. Calendar attendees — everyone the user has a meeting with (synced from
//      Google/Microsoft into the `meetings` table).
//   2. Fireflies meeting participants — people on calls Fireflies recorded
//      (only when FIREFLIES_API_KEY is set; additive).
// We surface people whose work email belongs to the target ACCOUNT — i.e.
// "people you already know at this company." Matching is by email domain (and,
// when supplied, an explicit domain), never by scraping a third party.
//
// POST /api/common-connections { company, domain? }
//   -> { ok, connections: [{ name, email, source, context }], sources }
export const runtime = "nodejs";

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
  "msn.com", "gmx.com", "yandex.com", "zoho.com",
]);
const PUBLIC_SLD = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
const CO_SUFFIX = /\b(inc|llc|ltd|limited|corp|co|company|gmbh|plc|group|holdings|technologies|technology|software|labs|systems|solutions|ai|io)\b\.?/g;

function coreName(s: string): string {
  return String(s || "").toLowerCase().replace(CO_SUFFIX, "").replace(/[^a-z0-9]+/g, "");
}
function domainSld(domain: string): string {
  const parts = String(domain || "").toLowerCase().trim().replace(/^.*@/, "").split(".");
  if (parts.length < 2) return "";
  // Handle co.uk / com.au style: step back one more label if the penultimate is a public SLD.
  const penult = parts[parts.length - 2];
  const idx = parts.length >= 3 && PUBLIC_SLD.has(penult) ? parts.length - 3 : parts.length - 2;
  return (parts[idx] || "").replace(/[^a-z0-9]+/g, "");
}
function emailDomain(email: string): string {
  const m = String(email || "").toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: { company?: unknown; domain?: unknown } = {};
  try { body = await request.json(); } catch { /* both optional */ }
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const explicitDomain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";

  const core = coreName(company);
  const wantSld = explicitDomain ? domainSld(explicitDomain) : "";
  const selfEmail = (user.email || "").toLowerCase();
  const selfDomain = emailDomain(selfEmail);

  // A candidate belongs to the account if their email domain matches an explicit
  // domain, or its second-level label matches the company core name (length-guarded
  // to avoid weak 1-2 char coincidences).
  function belongsToAccount(email: string): boolean {
    const dom = emailDomain(email);
    if (!dom || FREEMAIL.has(dom) || dom === selfDomain) return false;
    if (explicitDomain && (dom === explicitDomain || dom.endsWith("." + explicitDomain))) return true;
    if (wantSld && wantSld.length >= 3 && domainSld(dom) === wantSld) return true;
    if (core.length >= 3) {
      const sld = domainSld(dom);
      if (sld && (sld === core || sld.includes(core) || core.includes(sld))) return true;
    }
    return false;
  }

  const byEmail = new Map<string, { name: string; email: string; source: string; context: string }>();
  function add(name: string, email: string, source: string, context: string) {
    const e = String(email || "").toLowerCase().trim();
    if (!e || e === selfEmail || !belongsToAccount(e)) return;
    const existing = byEmail.get(e);
    if (existing) {
      if (!existing.name && name) existing.name = name;
      if (existing.source.indexOf(source) === -1) existing.source += "+" + source;
      return;
    }
    byEmail.set(e, { name: name || e.split("@")[0], email: e, source, context: context || "" });
  }

  const sources = { calendar: false, fireflies: false };

  // 1) Calendar attendees from the user's synced meetings.
  try {
    const { data: meetings } = await supabase
      .from("meetings")
      .select("title, attendees")
      .eq("user_id", user.id)
      .order("start_at", { ascending: false })
      .limit(400);
    (meetings || []).forEach((m: { title?: string; attendees?: unknown }) => {
      const atts = Array.isArray(m.attendees) ? (m.attendees as Array<{ name?: string; email?: string }>) : [];
      atts.forEach((a) => add(a.name || "", a.email || "", "calendar", m.title ? "Met on: " + m.title : "From your calendar"));
    });
    if (meetings && meetings.length) sources.calendar = true;
  } catch { /* calendar source optional */ }

  // 2) Fireflies participants (only if configured).
  const ffKey = process.env.FIREFLIES_API_KEY;
  if (ffKey) {
    try {
      const query = `query { transcripts(limit: 50) { title dateString meeting_attendees { displayName email name } } }`;
      const resp = await fetch("https://api.fireflies.ai/graphql", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${ffKey}` },
        body: JSON.stringify({ query }),
      });
      const j = await resp.json();
      if (!j?.errors && Array.isArray(j?.data?.transcripts)) {
        sources.fireflies = true;
        (j.data.transcripts as Array<{ title?: string; meeting_attendees?: Array<{ displayName?: string; email?: string; name?: string }> }>)
          .forEach((t) => {
            (t.meeting_attendees || []).forEach((a) =>
              add(a.displayName || a.name || "", a.email || "", "fireflies", t.title ? "Call: " + t.title : "From a Fireflies call")
            );
          });
      }
    } catch { /* fireflies source optional */ }
  }

  const connections = Array.from(byEmail.values())
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
    .slice(0, 40);

  return NextResponse.json({ ok: true, connections, sources });
}
