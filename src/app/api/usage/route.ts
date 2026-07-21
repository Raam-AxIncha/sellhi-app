import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Signal-account usage meter. Reads the RLS-protected signal_account_usage ledger
// (run supabase/signal_account_usage.sql) and the user's tier (connect_config), and
// returns this billing month's usage vs. the tier cap. Read-only — no enforcement.
//
// GET /api/usage -> { ok, period, tier, used, cap, remaining, pct, resetsOn }
export const runtime = "nodejs";

const CAP: Record<string, number> = {
  scout: 0, seed: 25, growth: 100, scale: 300, scaleManaged: 300, enterprise: Number.POSITIVE_INFINITY,
};

function periodKey(d: Date) { return d.toISOString().slice(0, 7); }
function firstOfNextMonth(d: Date) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const nx = new Date(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1));
  return nx.toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const now = new Date();
  const period = periodKey(now);

  // Tier (default seed if the user hasn't configured a plan yet).
  let tier = "seed";
  try {
    const { data: cc } = await supabase
      .from("connect_config").select("tier").eq("user_id", user.id).maybeSingle();
    if (cc && typeof cc.tier === "string" && CAP[cc.tier] !== undefined) tier = cc.tier;
  } catch { /* default seed */ }

  // Used = ledger rows for this month (best-effort; 0 if the table isn't there yet).
  let used = 0;
  try {
    const { count } = await supabase
      .from("signal_account_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("period", period);
    used = count || 0;
  } catch { used = 0; }

  const capVal = CAP[tier];
  const unlimited = !Number.isFinite(capVal);
  const cap = unlimited ? null : capVal;
  const remaining = unlimited ? null : Math.max(0, capVal - used);
  const pct = unlimited || capVal === 0 ? 0 : Math.min(100, Math.round((used / capVal) * 100));

  return NextResponse.json({
    ok: true,
    period,
    tier,
    used,
    cap,
    remaining,
    pct,
    resetsOn: firstOfNextMonth(now),
  });
}
