-- =============================================================
-- SellHi — Phase 2: persist each user's onboarding inputs
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run
-- (Safe to re-run.)
-- =============================================================

-- One dossier row per user. We keep the well-known identity fields as columns
-- (so they're easy to query / reuse for the sidebar) and stash everything else
-- as JSON so the shape can grow in Phase 3 without another migration.
create table if not exists public.dossiers (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text,
  title        text,
  company      text,
  company_url  text,
  linkedin_url text,
  industries   text,
  deal_size    text,
  data         jsonb default '{}'::jsonb,   -- free-form extras (Phase 3 research, etc.)
  updated_at   timestamptz default now()
);

alter table public.dossiers enable row level security;

drop policy if exists "dossiers_select_own" on public.dossiers;
create policy "dossiers_select_own" on public.dossiers
  for select using (auth.uid() = id);

drop policy if exists "dossiers_upsert_own" on public.dossiers;
create policy "dossiers_upsert_own" on public.dossiers
  for insert with check (auth.uid() = id);

drop policy if exists "dossiers_update_own" on public.dossiers;
create policy "dossiers_update_own" on public.dossiers
  for update using (auth.uid() = id);
