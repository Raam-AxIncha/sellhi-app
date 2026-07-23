-- ============================================================================
-- SellHi — Stripe billing columns on connect_config.
-- Run ONCE in the Supabase SQL editor (idempotent — safe to re-run).
--
-- The Stripe webhook (/api/stripe/webhook) writes the authoritative billing
-- state here via the SERVICE-ROLE key (bypasses RLS). Regular users still only
-- touch their own row through /api/connect (which only writes tier/modes/tools/
-- byo_key), so users cannot forge status/customer/subscription values.
-- Existing RLS policies on connect_config already cover these new columns.
-- ============================================================================

alter table public.connect_config
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists status                 text,   -- active|trialing|past_due|canceled|...
  add column if not exists plan_interval          text,   -- monthly|annual
  add column if not exists current_period_end     timestamptz;

-- Webhook fallback lookup (user by Stripe customer) + fast joins.
create index if not exists connect_config_stripe_customer_idx
  on public.connect_config (stripe_customer_id);
