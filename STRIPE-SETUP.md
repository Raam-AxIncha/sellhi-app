# SellHi - Stripe Subscriptions: Raam's Setup Checklist

Everything in the CODE is done and references secrets via **environment variables only**.
No secret is in the repo. Do the steps below (all in **Stripe TEST mode** first - no real charges).

## What the code added
- `POST /api/stripe/checkout` - starts Stripe Checkout (subscription mode) for the signed-in user.
- `POST /api/stripe/webhook` - verifies the Stripe signature and writes the real plan to Supabase.
- `POST /api/stripe/portal` - opens the Stripe Billing Portal (manage / cancel).
- `/connect` now shows a **Monthly / Annual** toggle + **Subscribe** + **Manage billing**
  (via `public/connect-billing.js`).
- `supabase/stripe_billing.sql` - adds billing columns to `connect_config`.
- Owner (`raam@axincha.com`) stays **unlimited** - the webhook can never gate you.

---

## STEP 1 - Run the Supabase migration
Supabase -> SQL Editor -> paste and run `supabase/stripe_billing.sql`. (Idempotent, safe to re-run.)

## STEP 2 - Create the Stripe account + products (TEST mode)
1. Create/log in to Stripe. Toggle **Test mode** (top-right).
2. Create **4 Products**, each with a **Monthly** and an **Annual** recurring price:

   | Product                | Monthly   | Annual (proposed - 2 months free) |
   |------------------------|-----------|-----------------------------------|
   | SellHi Seed            | $78 / mo  | $780 / yr                         |
   | SellHi Growth          | $204 / mo | $2,040 / yr                       |
   | SellHi Scale (BYO)     | $501 / mo | $5,010 / yr                       |
   | SellHi Scale - Managed | $798 / mo | $7,980 / yr                       |

   NOTE: prices are my proposals - change any before creating. The code does NOT hardcode
   amounts; it only reads the **price IDs** you paste below.

3. Copy each **price ID** (starts with `price_...`).

## STEP 3 - Add environment variables (Vercel + local .env.local)
See `.env.local.example` for the full list. You need:

    STRIPE_SECRET_KEY=sk_test_...
    STRIPE_WEBHOOK_SECRET=whsec_...          # from STEP 4
    SUPABASE_SERVICE_ROLE_KEY=...            # Supabase > Settings > API > service_role (SECRET)
    STRIPE_PRICE_SEED_MONTHLY=price_...
    STRIPE_PRICE_SEED_ANNUAL=price_...
    STRIPE_PRICE_GROWTH_MONTHLY=price_...
    STRIPE_PRICE_GROWTH_ANNUAL=price_...
    STRIPE_PRICE_SCALE_MONTHLY=price_...
    STRIPE_PRICE_SCALE_ANNUAL=price_...
    STRIPE_PRICE_SCALEMANAGED_MONTHLY=price_...
    STRIPE_PRICE_SCALEMANAGED_ANNUAL=price_...

In Vercel: Project -> Settings -> Environment Variables (add to Production + Preview).
`.env.local` is gitignored - safe for local test keys.

## STEP 4 - Register the webhook
1. Stripe -> Developers -> Webhooks -> **Add endpoint**.
2. URL: `https://app.sellhi.ai/api/stripe/webhook`
3. Events: checkout.session.completed, customer.subscription.created,
   customer.subscription.updated, customer.subscription.deleted.
4. Copy the **Signing secret** (`whsec_...`) -> set as STRIPE_WEBHOOK_SECRET (STEP 3), redeploy.
   - Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## STEP 5 - Verify end-to-end (TEST mode)
1. Log in as a **non-owner** test user -> /connect -> pick a plan -> Monthly/Annual -> **Subscribe**.
2. Use Stripe test card 4242 4242 4242 4242, any future date/CVC.
3. Confirm `connect_config.tier` + `status` updated for that user in Supabase.
4. Click **Manage billing** -> cancel -> confirm tier drops back to `scout`.
5. Only after this works, swap TEST keys for LIVE keys.

---

## Notes / decisions for you
- **Enforcement:** the webhook writes the true `tier` + `status`. The `/api/usage` cap logic was
  left **unchanged** so current free testers are not locked out while you are away. When you are
  ready to hard-gate (only paid subscribers get paid caps), tell me and I will wire `status` into
  the cap check - it is a small, isolated change.
- **Annual pricing** is a proposal (2 months free ~= 17% off). Say the word for a flat 20% instead.
- Everything is **additive** - demo.html untouched; existing autosave/config flow intact.
