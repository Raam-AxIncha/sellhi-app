// ============================================================================
// SellHi — Stripe server helpers (TEST-mode safe).
//
// Secrets & price IDs are read from ENVIRONMENT VARIABLES ONLY — nothing here is
// hardcoded and nothing secret is ever committed. Set these in Vercel (Project
// Settings > Environment Variables) and in .env.local for local dev:
//
//   STRIPE_SECRET_KEY                    (sk_test_... while testing)
//   STRIPE_WEBHOOK_SECRET                (whsec_... from the webhook endpoint)
//   STRIPE_PRICE_SEED_MONTHLY / _ANNUAL
//   STRIPE_PRICE_GROWTH_MONTHLY / _ANNUAL
//   STRIPE_PRICE_SCALE_MONTHLY / _ANNUAL
//   STRIPE_PRICE_SCALEMANAGED_MONTHLY / _ANNUAL
//
// The plan keys below MUST match the tier ids used in connect.html / api/connect
// (scout|seed|growth|scale|scaleManaged|enterprise). Only the four PAID plans are
// self-serve checkout-able; scout is free and enterprise is contact-sales.
// ============================================================================
import Stripe from "stripe";

export type PlanKey = "seed" | "growth" | "scale" | "scaleManaged";
export type Interval = "monthly" | "annual";

export const PAID_PLANS: PlanKey[] = ["seed", "growth", "scale", "scaleManaged"];

// Lazy singleton so importing this module never throws at build time when the
// key isn't set yet. getStripe() throws only when actually used without a key.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

// plan -> interval -> env var value (price id). Missing entries read as undefined.
function priceEnv(): Record<PlanKey, Record<Interval, string | undefined>> {
  return {
    seed: {
      monthly: process.env.STRIPE_PRICE_SEED_MONTHLY,
      annual: process.env.STRIPE_PRICE_SEED_ANNUAL,
    },
    growth: {
      monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
      annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL,
    },
    scale: {
      monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY,
      annual: process.env.STRIPE_PRICE_SCALE_ANNUAL,
    },
    scaleManaged: {
      monthly: process.env.STRIPE_PRICE_SCALEMANAGED_MONTHLY,
      annual: process.env.STRIPE_PRICE_SCALEMANAGED_ANNUAL,
    },
  };
}

export function isPaidPlan(plan: unknown): plan is PlanKey {
  return typeof plan === "string" && (PAID_PLANS as string[]).includes(plan);
}

export function isInterval(v: unknown): v is Interval {
  return v === "monthly" || v === "annual";
}

// Forward lookup: (plan, interval) -> price id, or null if not configured.
export function priceIdFor(plan: PlanKey, interval: Interval): string | null {
  const id = priceEnv()[plan]?.[interval];
  return id && id.trim() ? id.trim() : null;
}

// Reverse lookup: price id -> plan key. Built only from configured (set) price
// ids so unset envs never collide. Used by the webhook to map a subscription's
// price back to the entitlement tier.
export function tierForPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  const env = priceEnv();
  for (const plan of PAID_PLANS) {
    const m = env[plan];
    if (m.monthly && m.monthly.trim() === priceId) return plan;
    if (m.annual && m.annual.trim() === priceId) return plan;
  }
  return null;
}

// interval label for a Stripe price's recurring interval ("year" -> annual).
export function intervalForRecurring(recurringInterval: string | null | undefined): Interval {
  return recurringInterval === "year" ? "annual" : "monthly";
}
