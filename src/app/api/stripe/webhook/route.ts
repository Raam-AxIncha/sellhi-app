import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, tierForPriceId, intervalForRecurring } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// POST /api/stripe/webhook
// Stripe -> SellHi sync. Verifies the Stripe signature (STRIPE_WEBHOOK_SECRET),
// then on subscription lifecycle events writes the authoritative entitlement to
// the user's connect_config row via the SERVICE-ROLE client (bypasses RLS):
//   - connect_config.tier    (mapped from the subscription's price id)
//   - connect_config.status  (active | trialing | past_due | canceled | ...)
//   plus stripe_customer_id, stripe_subscription_id, plan_interval, period end.
//
// Canceled/deleted subscriptions drop the user back to the free "scout" tier.
// Owner accounts (OWNER_EMAILS in api/usage) stay unlimited regardless — the
// usage route overrides tier to enterprise for them, so this can never gate them.
//
// IMPORTANT: this route reads the RAW request body (request.text()) — required
// for signature verification. Do not add body parsing/middleware ahead of it.
// ============================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });

  const raw = await request.text();

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad signature";
    return NextResponse.json({ error: "signature verification failed", detail: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId =
          (session.metadata && session.metadata.supabase_user_id) ||
          session.client_reference_id ||
          null;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id || null;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id || null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(stripe, sub, userId, customerId, false);
        } else if (userId && customerId) {
          await writeConfig(userId, { stripe_customer_id: customerId });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(stripe, sub, null, null, event.type === "customer.subscription.deleted");
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // 500 so Stripe retries transient failures (e.g. brief DB hiccup).
    const msg = e instanceof Error ? e.message : "handler error";
    return NextResponse.json({ error: "handler error", detail: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Map a Stripe subscription to the user's connect_config entitlement and persist it.
async function applySubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  fallbackUserId: string | null,
  fallbackCustomerId: string | null,
  deleted: boolean
) {
  const subAny = sub as unknown as Record<string, unknown>;
  const customerId =
    (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ||
    fallbackCustomerId ||
    null;

  const firstItem = sub.items?.data?.[0];
  const priceId = firstItem?.price?.id || null;
  const recurringInterval = firstItem?.price?.recurring?.interval || null;
  const status = sub.status;

  const isCanceled = deleted || status === "canceled";
  const mappedTier = tierForPriceId(priceId);
  const tier = isCanceled ? "scout" : mappedTier; // null if price unmapped

  // current_period_end lives on the subscription in older API versions and on
  // the item in newer ones — read whichever is present.
  const periodEndUnix =
    (typeof subAny.current_period_end === "number" ? (subAny.current_period_end as number) : null) ||
    (firstItem && (firstItem as unknown as Record<string, unknown>).current_period_end
      ? ((firstItem as unknown as Record<string, unknown>).current_period_end as number)
      : null);
  const currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  // Resolve the Supabase user: subscription metadata first, then the value passed
  // in, then a lookup by the stored Stripe customer id.
  let userId =
    (sub.metadata && sub.metadata.supabase_user_id) || fallbackUserId || null;
  if (!userId && customerId) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("connect_config")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (data && typeof data.user_id === "string") userId = data.user_id;
    } catch {
      /* fall through */
    }
  }
  if (!userId) return; // nothing we can safely update

  const fields: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    status: isCanceled ? "canceled" : status,
    plan_interval: intervalForRecurring(recurringInterval),
    current_period_end: currentPeriodEnd,
  };
  if (customerId) fields.stripe_customer_id = customerId;
  if (tier) fields.tier = tier;

  await writeConfig(userId, fields);
}

// Upsert onto the user's connect_config row using the service-role client.
async function writeConfig(userId: string, fields: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("connect_config").upsert(
    { user_id: userId, ...fields, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}
