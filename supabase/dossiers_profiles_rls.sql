-- ============================================================================
-- REVIEW BEFORE RUNNING. The `dossiers` and `profiles` tables already exist in
-- the live database (the app reads/writes them today) but have NO migration file
-- in this repo, so their Row-Level Security is UNVERIFIED. This script is written
-- to be SAFE to run against the existing tables: it only (a) ensures the tables
-- exist, (b) turns RLS on, and (c) (re)creates per-user policies. It does NOT drop
-- or alter existing columns/data. Confirm column names match production first.
--
-- WHY THIS MATTERS: every other user table (connect_config, meetings,
-- calendar_connections, transcripts) enforces auth.uid() = owner. `dossiers` holds
-- each user's entire pipeline (marketCompanies, campaigns, contentGen counters) —
-- if RLS is off or mis-scoped, one user could read another's pipeline. Verify.
-- ============================================================================

create table if not exists public.dossiers (
  id          uuid primary key references auth.users(id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.dossiers enable row level security;
drop policy if exists "dossiers_select_own" on public.dossiers;
drop policy if exists "dossiers_insert_own" on public.dossiers;
drop policy if exists "dossiers_update_own" on public.dossiers;
create policy "dossiers_select_own" on public.dossiers for select using (auth.uid() = id);
create policy "dossiers_insert_own" on public.dossiers for insert with check (auth.uid() = id);
create policy "dossiers_update_own" on public.dossiers for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  title       text,
  company     text,
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_upsert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
