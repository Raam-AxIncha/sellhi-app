-- =============================================================
-- SellHi — Phase 1 database: profiles + row-level security
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run
-- =============================================================

-- 1) Profiles table: one row per user, holds the identity shown in the corner.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  title      text default 'Fractional CXO',
  company    text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Row-level security: each user can see and edit ONLY their own profile.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3) Auto-create a profile whenever a new user signs up.
--    Pulls name/title/company from the signup metadata (email signup) or from
--    the provider (Google/Microsoft give us a name automatically).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, title, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'title', 'Fractional CXO'),
    coalesce(new.raw_user_meta_data->>'company', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
