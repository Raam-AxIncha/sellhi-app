import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

// ============================================================================
// POST /api/stripe/portal  -> { url }
// Returns a Stripe Billing (Customer) Portal link so a subscriber can update
// their card, switch plans, or cancel. Requires a stored stripe_customer_id
// (created during checkout). No customer yet => 400 with a clear message.
// ============================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let customerId: string | undefined;
  try {
    const { data: cc } = await supabase
      .from("connect_config")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cc && typeof cc.stripe_customer_id === "string" && cc.stripe_customer_id) {
      customerId = cc.stripe_customer_id;
    }
  } catch {
    /* column may not exist yet */
  }

  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account yet", detail: "Subscribe to a plan first, then manage it here." },
      { status: 400 }
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Billing not configured", detail: "STRIPE_SECRET_KEY is not set." },
      { status: 500 }
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/connect`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portal failed";
    return NextResponse.json({ error: "Could not open billing portal", detail: msg }, { status: 502 });
  }
}
