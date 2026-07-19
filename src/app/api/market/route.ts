import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Market Intel (Phase 4). Mirrors /api/research: calls Claude with the web-search
// tool to build a list of REAL companies that match the user's ICP, using their
// saved dossier (Phase 3a) + the ICP criteria posted from the p2 wizard.
// Can take 20-40s, so give it room and run on Node.
export const runtime = "nodejs";
export const maxDuration = 60;

// Reuse the same daily-cap env var as research, but keep a SEPARATE counter
// (data.market) so Market Intel and Dossier don't share the same budget.
const DAILY_CAP = Number(process.env.RESEARCH_DAILY_CAP || "5");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// The exact shape we ask Claude to return. Counts are DERIVED FROM REAL RESULTS
// (no invented "247") to keep the honesty ethos of the pilot.
const SCHEMA = `{
  "counts": {
    "found": 0,
    "matchICP": 0,
    "activeSignals": 0
  },
  "companies": [
    {
      "name": "real company name",
      "initials": "2-letter monogram from the name",
      "industry": "ONE short vertical label, 1-2 words max, no slashes or sub-categories, e.g. 'Fintech', 'AI/ML', 'B2B SaaS', 'Cybersecurity', 'DevTools', 'Healthtech'",
      "employees": "approx headcount as a number-ish string, e.g. '120'; note if estimated",
      "stage": "funding stage, e.g. 'Series B', 'Seed', 'Bootstrapped', or 'Unknown'",
      "arr": "revenue/ARR if public, e.g. '$12M ARR', else 'Unknown'",
      "tier": 1,
      "why": "one-sentence reason this company fits the ICP (a real, current signal if you found one)",
      "scores": {
        "industry": 0,
        "size": 0,
        "growth": 0,
        "pain": 0,
        "funding": 0
      }
    }
  ]
}`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Market Intel is not configured yet (missing API key)." },
      { status: 503 }
    );
  }

  // ICP criteria posted from the p2 wizard (these live only in the browser DOM).
  let body: {
    industries?: unknown;
    minEmp?: unknown;
    maxEmp?: unknown;
    buyingAuth?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional-ish; fall through with empties.
  }
  const industries = Array.isArray(body.industries)
    ? (body.industries as unknown[]).filter((x) => typeof x === "string").slice(0, 12)
    : [];
  const minEmp = Number(body.minEmp) || 0;
  const maxEmp = Number(body.maxEmp) || 0;
  const buyingAuth =
    typeof body.buyingAuth === "string" && body.buyingAuth.trim() &&
    !/^select/i.test(body.buyingAuth)
      ? body.buyingAuth
      : "";

  // Load the user's saved onboarding inputs + Phase 3a dossier for ICP grounding.
  const { data: dossierRow } = await supabase
    .from("dossiers")
    .select("*")
    .eq("id", user.id)
    .single();

  const savedData = (dossierRow?.data as Record<string, unknown> | undefined) || undefined;
  const dossier = savedData?.dossier as Record<string, unknown> | undefined;

  const inputs = {
    name: dossierRow?.name || "",
    title: dossierRow?.title || "",
    company: dossierRow?.company || "",
    industries: dossierRow?.industries || "",
    deal_size: dossierRow?.deal_size || "",
  };

  // --- Per-user daily cap (cost seatbelt), separate from research ---
  const meta = savedData?.market as { day?: string; count?: number } | undefined;
  const usedToday = meta && meta.day === today() ? meta.count || 0 : 0;
  if (usedToday >= DAILY_CAP) {
    return NextResponse.json(
      { error: `Daily Market Intel limit reached (${DAILY_CAP}/day). Try again tomorrow.` },
      { status: 429 }
    );
  }

  const dossierContext = dossier
    ? `Their researched profile (use as ICP context):
${JSON.stringify(dossier).slice(0, 2000)}`
    : `No researched profile yet — infer the ICP from the criteria below.`;

  const system = `You are a B2B go-to-market research analyst building a target-account long-list for a fractional sales/GTM leader.

Task: using web search, return a list of REAL, currently-operating companies that fit the Ideal Customer Profile (ICP) below. These are prospects the user could sell into.

Rules:
- Use web search to find real companies. Every company must be a real, findable business — never invent names.
- Respect the size band (employee count) and target industries as hard filters where possible.
- Prefer companies showing a current buying signal (recent funding, hiring a sales/revenue role, leadership change, market expansion).
- Return exactly 5-6 companies. Fewer real matches is fine — never pad with invented ones.
- Work FAST: use at most ~4 web searches total, then answer. Do not exhaustively verify every field — a solid, well-sourced shortlist matters more than perfect completeness (this runs under a strict time limit).
- Keep "why" to one short clause (<= 12 words). Output ONLY the JSON and make sure it is complete and valid.
- Each "industry" must be a single short vertical (1-2 words, no "/" and no sub-category), so filters and segments read cleanly.
- Assign a tier: 1 = strong fit across size + industry + a live signal; 2 = partial fit; 3 = exploratory/weaker fit.
- For each company, also give a "scores" object with five 0-100 sub-scores reflecting your honest per-criterion assessment: industry (vertical match to their targets), size (headcount fit to the band), growth (strength of current buying signals), pain (fit between the company's likely challenges and a fractional GTM leader's value), funding (how well the funding stage matches). These let the user re-weight the ranking.
- Counts must reflect reality: "matchICP" = number of companies you return; "found" = roughly how many real candidates you evaluated; "activeSignals" = how many of the returned companies have a current public buying signal.
- Keep every field tight and factual. No marketing fluff.
- Respond with ONLY a single valid JSON object matching this schema exactly (no prose, no code fences):
${SCHEMA}`;

  const userMsg = `Build the target-account long-list.

The user (fractional GTM leader):
- Name: ${inputs.name || "(unknown)"}
- Title: ${inputs.title || "(unknown)"}
- Practice/company: ${inputs.company || "(unknown)"}
- Industries they serve: ${inputs.industries || "(none stated)"}
- Typical deal size: ${inputs.deal_size || "(none stated)"}

${dossierContext}

ICP criteria for the companies to find:
- Target industries: ${industries.length ? industries.join(", ") : "(none selected — infer from their profile)"}
- Company size: ${minEmp || "?"} to ${maxEmp || "?"} employees
- Buying authority they want to reach: ${buyingAuth || "(unspecified)"}

Return the JSON object now.`;

  // Web-search round-trips are the main latency; fewer uses = faster, more reliable
  // completion inside the function window. Abort a few seconds BEFORE the platform
  // timeout so we return a clean "try again" instead of a raw 502.
  const SEARCH_MAX_USES = Number(process.env.MARKET_SEARCH_MAX_USES || "3");
  const TIME_BUDGET_MS = Number(process.env.MARKET_TIMEOUT_MS || "52000");

  let anthropicJson: unknown;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIME_BUDGET_MS);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3800,
        system,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: SEARCH_MAX_USES }],
        messages: [{ role: "user", content: userMsg }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: "Market Intel service error", detail: detail.slice(0, 400) },
        { status: 502 }
      );
    }
    anthropicJson = await resp.json();
  } catch (e) {
    const aborted = !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";
    // On our own timeout, return 200 with an empty list + friendly message so the
    // client shows a clean "run it again" state (no scary 502 in the console).
    return NextResponse.json(
      aborted
        ? { error: "Market Intel took longer than usual this time — please run it again.", companies: [], counts: null }
        : { error: "Could not reach Market Intel service", detail: String(e).slice(0, 200) },
      { status: aborted ? 200 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }

  // Pull the final text blocks and parse the JSON out of them.
  const blocks =
    (anthropicJson as { content?: Array<{ type: string; text?: string }> }).content || [];
  const text = blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: { counts?: unknown; companies?: unknown };
  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return NextResponse.json(
      { error: "Could not parse Market Intel result", raw: cleaned.slice(0, 400) },
      { status: 502 }
    );
  }

  // Normalise the companies list so the client can trust the shape.
  const clamp = (n: unknown, fallback: number) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : fallback;
  };
  // Compute a size-fit score from the employee count vs the requested band, so
  // "Company size fit" is real even if Claude omits it.
  const sizeFit = (employees: string): number => {
    const n = parseInt(employees.replace(/[^0-9]/g, ""), 10);
    if (!n || !minEmp || !maxEmp || maxEmp <= minEmp) return 70;
    if (n < minEmp) return Math.max(20, 70 - Math.round(((minEmp - n) / minEmp) * 60));
    if (n > maxEmp) return Math.max(20, 70 - Math.round(((n - maxEmp) / maxEmp) * 60));
    const center = (minEmp + maxEmp) / 2;
    const half = (maxEmp - minEmp) / 2 || 1;
    return Math.round(100 - (Math.abs(n - center) / half) * 20); // 80-100 inside band
  };

  const rawCompanies = Array.isArray(parsed.companies) ? parsed.companies : [];
  const companies = rawCompanies
    .map((c) => {
      const o = (c || {}) as Record<string, unknown>;
      const name = String(o.name || "").trim();
      if (!name) return null;
      const tierNum = Number(o.tier);
      const tier = tierNum === 1 || tierNum === 2 || tierNum === 3 ? tierNum : 3;
      const initials =
        String(o.initials || "").trim().slice(0, 2).toUpperCase() ||
        name.slice(0, 2).toUpperCase();
      const employees = String(o.employees || "").trim();
      // Fallbacks scale with tier so recalculation still behaves sensibly if Claude
      // returns no scores.
      const tierBase = tier === 1 ? 85 : tier === 2 ? 68 : 48;
      const s = (o.scores || {}) as Record<string, unknown>;
      const scores = {
        industry: clamp(s.industry, tierBase),
        size: clamp(s.size, sizeFit(employees)),
        growth: clamp(s.growth, tierBase),
        pain: clamp(s.pain, tierBase),
        funding: clamp(s.funding, tierBase),
      };
      return {
        name,
        initials,
        industry: String(o.industry || "Other").trim(),
        employees,
        stage: String(o.stage || "").trim(),
        arr: String(o.arr || "").trim(),
        tier,
        why: String(o.why || "").trim(),
        scores,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const rawCounts = (parsed.counts || {}) as Record<string, unknown>;
  const activeFromList = companies.filter(
    (c) => typeof c.why === "string" && (c.why as string).length > 0
  ).length;
  const counts = {
    matchICP: companies.length,
    found: Number(rawCounts.found) > companies.length ? Number(rawCounts.found) : companies.length,
    activeSignals:
      Number(rawCounts.activeSignals) >= 0 && Number(rawCounts.activeSignals) <= companies.length
        ? Number(rawCounts.activeSignals)
        : activeFromList,
  };

  // Save the list + bump the daily counter.
  const newData = {
    ...(savedData || {}),
    marketCompanies: { companies, counts, criteria: { industries, minEmp, maxEmp, buyingAuth } },
    market: { day: today(), count: usedToday + 1, lastAt: new Date().toISOString() },
  };
  await supabase
    .from("dossiers")
    .update({ data: newData, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({
    ok: true,
    companies,
    counts,
    usedToday: usedToday + 1,
    cap: DAILY_CAP,
  });
}
