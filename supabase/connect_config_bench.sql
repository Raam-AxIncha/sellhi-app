-- ============================================================================
-- Bench (keep-warm) state for connect_config.
-- Adds a per-user subscription STATE so the usage meter can enforce the Bench
-- cap when a member downshifts while booked. Safe + idempotent: default
-- 'hunting' means existing members behave exactly as before until they Bench.
--
-- Run this in the Supabase SQL editor (same place you ran connect_config.sql).
-- RLS already protects connect_config per-user; no policy change needed.
-- ============================================================================

-- 1) Subscription state: 'hunting' (full cap) | 'bench' (keep-warm cap).
alter table if exists public.connect_config
  add column if not exists state text not null default 'hunting';

-- 2) Guard against typos / bad values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'connect_config_state_chk'
  ) then
    alter table public.connect_config
      add constraint connect_config_state_chk
      check (state in ('hunting', 'bench'));
  end if;
end $$;

-- 3) Billing term (for the plan toggle): 'annual_monthly' (annual commit, billed
--    monthly, no free months) | 'annual_upfront' (paid yearly, 2 months free).
--    Default annual_monthly. Scout ignores this.
alter table if exists public.connect_config
  add column if not exists billing_term text not null default 'annual_monthly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'connect_config_billing_term_chk'
  ) then
    alter table public.connect_config
      add constraint connect_config_billing_term_chk
      check (billing_term in ('annual_monthly', 'annual_upfront'));
  end if;
end $$;
