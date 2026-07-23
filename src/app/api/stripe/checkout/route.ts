import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getStripe,
  priceIdFor,
  isPaidPlan,
  isInterval,
} from "@/lib/stripe/server";

// ============================================================================
// POST /api/stripe/checkout  { plan, interval }
// Creates a Stripe Checkout Session (subscription mode) for the signed-in user
// and returns { url } to redirect to. TEST mode until STRIPE_SECRET_KEY is a
// live key. Owner accounts stay unlimited regardless (see api/usage) — this just
// lets them exercise the flow in test mode.
//
// plan     : "seed" | "growth" | "scale" | "scaleManaged"
// interval : "monthly" | "annual"
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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const plan = body.plan;
  const interval = body.interval;
  if (!isPaidPlan(plan)) {
    return NextResponse.json(
      { error: "unknown or non-checkoutable plan (scout is free, enterprise is contact-sales)" },
      { status: 400 }
    );
  }
  if (!isInterval(interval)) {
    return NextResponse.json({ error: "interval must be 'monthly' or 'annual'" }, { status: 400 });
  }

  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Billing isn't switched on for ${plan}/${interval} yet.`,
        detail: `Set the STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()} env var to the Stripe price id.`,
      },
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

  // Reuse an existing Stripe customer for this user if we've stored one; else
  // create it and (best-effort) persist it on the user's own connect_config row
  // (RLS-allowed: auth.uid() = user_id). If the billing columns aren't migrated
  // yet the persist is skipped — checkout still works.
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
    /* column may not exist yet — fine */
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    try {
      await supabase
        .from("connect_config")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    } catch {
      /* best-effort — webhook will also capture the customer id */
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan, interval },
      },
      metadata: { supabase_user_id: user.id, plan, interval },
      success_url: `${origin}/connect?checkout=success`,
      cancel_url: `${origin}/connect?checkout=cancel`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout failed";
    return NextResponse.json({ error: "Could not start checkout", detail: msg }, { status: 502 });
  }
}
