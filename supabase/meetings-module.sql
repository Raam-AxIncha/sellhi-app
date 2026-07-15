-- =============================================================
-- SellHi — Meetings & Prep module database
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run
-- (Safe to re-run — everything is idempotent.)
--
-- Tables:
--   calendar_connections  one row per (user, provider) — OAuth tokens
--   meetings              cached calendar events per user
--   prep_notes            per-meeting (or per-company) notes + scribble canvas
--   transcripts           Fireflies transcript/summary per meeting
-- Every table is row-level-secured so a user can only ever touch their own rows.
-- =============================================================

-- ---- 1) Calendar connections (OAuth tokens, per provider) -----------------
create table if not exists public.calendar_connections (
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('google','microsoft')),
  email         text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  primary key (user_id, provider)
);

alter table public.calendar_connections enable row level security;
drop policy if exists "cal_conn_select_own" on public.calendar_connections;
create policy "cal_conn_select_own" on public.calendar_connections for select using (auth.uid() = user_id);
drop policy if exists "cal_conn_insert_own" on public.calendar_connections;
create policy "cal_conn_insert_own" on public.calendar_connections for insert with check (auth.uid() = user_id);
drop policy if exists "cal_conn_update_own" on public.calendar_connections;
create policy "cal_conn_update_own" on public.calendar_connections for update using (auth.uid() = user_id);
drop policy if exists "cal_conn_delete_own" on public.calendar_connections;
create policy "cal_conn_delete_own" on public.calendar_connections for delete using (auth.uid() = user_id);

-- ---- 2) Meetings (cached calendar events) ---------------------------------
create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null,               -- 'google' | 'microsoft' | 'manual'
  external_id  text,                         -- provider event id (null for manual)
  title        text,
  start_at     timestamptz,
  end_at       timestamptz,
  location     text,
  join_url     text,                         -- Teams/Meet/Zoom link if present
  attendees    jsonb default '[]'::jsonb,    -- [{name,email}]
  raw          jsonb default '{}'::jsonb,
  updated_at   timestamptz default now(),
  unique (user_id, provider, external_id)
);

alter table public.meetings enable row level security;
drop policy if exists "meetings_select_own" on public.meetings;
create policy "meetings_select_own" on public.meetings for select using (auth.uid() = user_id);
drop policy if exists "meetings_insert_own" on public.meetings;
create policy "meetings_insert_own" on public.meetings for insert with check (auth.uid() = user_id);
drop policy if exists "meetings_update_own" on public.meetings;
create policy "meetings_update_own" on public.meetings for update using (auth.uid() = user_id);
drop policy if exists "meetings_delete_own" on public.meetings;
create policy "meetings_delete_own" on public.meetings for delete using (auth.uid() = user_id);

create index if not exists meetings_user_start_idx on public.meetings (user_id, start_at);

-- ---- 3) Prep notes (+ scribble canvas) ------------------------------------
-- meeting_key is either a meeting id/external_id OR a freeform company slug, so
-- prep notes work even before the calendar is connected.
create table if not exists public.prep_notes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  meeting_key text not null,
  company     text,
  notes       text default '',
  canvas      text,                          -- PNG data URL of the scribble pad
  updated_at  timestamptz default now(),
  primary key (user_id, meeting_key)
);

alter table public.prep_notes enable row level security;
drop policy if exists "prep_notes_select_own" on public.prep_notes;
create policy "prep_notes_select_own" on public.prep_notes for select using (auth.uid() = user_id);
drop policy if exists "prep_notes_insert_own" on public.prep_notes;
create policy "prep_notes_insert_own" on public.prep_notes for insert with check (auth.uid() = user_id);
drop policy if exists "prep_notes_update_own" on public.prep_notes;
create policy "prep_notes_update_own" on public.prep_notes for update using (auth.uid() = user_id);

-- ---- 4) Transcripts (Fireflies) -------------------------------------------
create table if not exists public.transcripts (
  user_id     uuid not null references auth.users(id) on delete cascade,
  meeting_key text not null,
  provider    text default 'fireflies',
  external_id text,
  title       text,
  summary     text,
  transcript  jsonb default '{}'::jsonb,
  updated_at  timestamptz default now(),
  primary key (user_id, meeting_key)
);

alter table public.transcripts enable row level security;
drop policy if exists "transcripts_select_own" on public.transcripts;
create policy "transcripts_select_own" on public.transcripts for select using (auth.uid() = user_id);
drop policy if exists "transcripts_insert_own" on public.transcripts;
create policy "transcripts_insert_own" on public.transcripts for insert with check (auth.uid() = user_id);
drop policy if exists "transcripts_update_own" on public.transcripts;
create policy "transcripts_update_own" on public.transcripts for update using (auth.uid() = user_id);
