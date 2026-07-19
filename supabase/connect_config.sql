-- ============================================================================
-- SellHi Connect — per-subscriber channel/mode/tool configuration.
-- Run this once in the Supabase SQL editor (or via your migration tool).
-- Row-Level Security is ENABLED: a signed-in user can only ever read or write
-- their OWN row (auth.uid() = user_id). No user can see another's config.
-- ============================================================================

create table if not exists public.connect_config (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  tier        text        not null default 'seed',
  -- per-category delivery mode: { crm|email|linkedin|calls : 'byo' | 'managed' }
  modes       jsonb       not null default '{}'::jsonb,
  -- per-category chosen BYO tool: { crm|email|linkedin|calls : 'HubSpot' | ... }
  tools       jsonb       not null default '{}'::jsonb,
  -- Enterprise-only: subscriber supplies their own Anthropic (Claude) key
  byo_key     boolean     not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.connect_config enable row level security;

-- Idempotent policy (re)creation
drop policy if exists "connect_select_own" on public.connect_config;
drop policy if exists "connect_insert_own" on public.connect_config;
drop policy if exists "connect_update_own" on public.connect_config;
drop policy if exists "connect_delete_own" on public.connect_config;

create policy "connect_select_own" on public.connect_config
  for select using (auth.uid() = user_id);

create policy "connect_insert_own" on public.connect_config
  for insert with check (auth.uid() = user_id);

create policy "connect_update_own" on public.connect_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "connect_delete_own" on public.connect_config
  for delete using (auth.uid() = user_id);
