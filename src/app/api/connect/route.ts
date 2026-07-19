import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// SellHi Connect config — persisted per-user in the RLS-protected `connect_config`
// table (run supabase/connect_config.sql once). Each subscriber's tier + per-channel
// delivery mode + chosen BYO tool survive across devices. RLS guarantees a user can
// only read/write their own row.
//
// GET  /api/connect                                   -> { ok, config }
// POST /api/connect { tier, modes, tools, byoKey }    -> { ok, config }
export const runtime = "nodejs";

const TIERS = ["scout", "seed", "growth", "scale", "scaleManaged", "enterprise"];
const CATS = ["crm", "email", "linkedin", "calls"];
const MODES = ["byo", "managed"];

type Config = {
  tier: string;
  modes: Record<string, string>;
  tools: Record<string, string>;
  byoKey: boolean;
};

function defaults(): Config {
  return {
    tier: "seed",
    modes: { crm: "byo", email: "managed", linkedin: "byo", calls: "byo" },
    tools: { crm: "", email: "", linkedin: "", calls: "" },
    byoKey: false,
  };
}

// Coerce arbitrary input into a safe, whitelisted Config.
function sanitize(body: Record<string, unknown>): Config {
  const d = defaults();
  const tier = typeof body.tier === "string" && TIERS.includes(body.tier) ? body.tier : d.tier;

  const modes: Record<string, string> = { ...d.modes };
  const inModes = (body.modes && typeof body.modes === "object" ? body.modes : {}) as Record<string, unknown>;
  CATS.forEach((c) => {
    const v = inModes[c];
    if (typeof v === "string" && MODES.includes(v)) modes[c] = v;
  });

  const tools: Record<string, string> = { ...d.tools };
  const inTools = (body.tools && typeof body.tools === "object" ? body.tools : {}) as Record<string, unknown>;
  CATS.forEach((c) => {
    const v = inTools[c];
    if (typeof v === "string") tools[c] = v.slice(0, 80);
  });

  return { tier, modes, tools, byoKey: body.byoKey === true };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("connect_config")
    .select("tier, modes, tools, byo_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: true, config: defaults(), note: "no row yet" });

  const config: Config = row
    ? sanitize({ tier: row.tier, modes: row.modes, tools: row.tools, byoKey: row.byo_key })
    : defaults();
  return NextResponse.json({ ok: true, config });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const config = sanitize(body);
  const { error } = await supabase.from("connect_config").upsert(
    {
      user_id: user.id,
      tier: config.tier,
      modes: config.modes,
      tools: config.tools,
      byo_key: config.byoKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json(
      { error: "save failed — has supabase/connect_config.sql been run?", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, config });
}
