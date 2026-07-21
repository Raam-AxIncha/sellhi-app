-- ============================================================================
-- SellHi usage metering — the per-account ledger behind signal-account billing.
-- Run once in the Supabase SQL editor. Row-Level Security ON: a user can only ever
-- read/write their OWN rows (auth.uid() = user_id).
--
-- Usage for a billing month = count(*) of rows for (user_id, period). The composite
-- primary key makes recording idempotent — re-running Market Intel never double-counts
-- the same account within the same month.
-- ============================================================================

create table if not exists public.signal_account_usage (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  period        text        not null,               -- 'YYYY-MM'
  account_key   text        not null,               -- normalized company key
  account_name  text,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, period, account_key)
);
create index if not exists sau_user_period on public.signal_account_usage (user_id, period);

alter table public.signal_account_usage enable row level security;
drop policy if exists "sau_select_own" on public.signal_account_usage;
drop policy if exists "sau_insert_own" on public.signal_account_usage;
create policy "sau_select_own" on public.signal_account_usage
  for select using (auth.uid() = user_id);
create policy "sau_insert_own" on public.signal_account_usage
  for insert with check (auth.uid() = user_id);
