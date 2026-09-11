-- Free Time Manager — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);
create policy "Profiles are self-editable" on public.profiles
  for update using (auth.uid() = id);
create policy "Profiles are self-insertable" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  weekly_target_minutes integer,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "Subjects are owner-only" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- timetable_entries (recurring weekly busy blocks, e.g. classes/work)
-- ---------------------------------------------------------------------------
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > 0 and end_minute <= 1440),
  recurrence text not null default 'weekly' check (recurrence in ('weekly', 'odd_weeks', 'even_weeks')),
  source text not null default 'manual' check (source in ('manual', 'ocr')),
  created_at timestamptz not null default now(),
  constraint valid_range check (end_minute > start_minute)
);

alter table public.timetable_entries enable row level security;

create policy "Timetable entries are owner-only" on public.timetable_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists timetable_entries_user_day_idx
  on public.timetable_entries (user_id, day_of_week);

-- ---------------------------------------------------------------------------
-- study_sessions (generated or manually placed study blocks for a given week)
-- ---------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > 0 and end_minute <= 1440),
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  source text not null default 'auto' check (source in ('auto', 'manual')),
  week_start date not null,
  skip_reason text,
  is_review boolean not null default false,
  created_at timestamptz not null default now(),
  constraint valid_session_range check (end_minute > start_minute)
);

alter table public.study_sessions enable row level security;

create policy "Study sessions are owner-only" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists study_sessions_user_week_idx
  on public.study_sessions (user_id, week_start);

-- ---------------------------------------------------------------------------
-- exams
-- ---------------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_date date not null,
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > 0 and end_minute <= 1440),
  notes text,
  created_at timestamptz not null default now(),
  constraint valid_exam_range check (end_minute > start_minute)
);

alter table public.exams enable row level security;

create policy "Exams are owner-only" on public.exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists exams_user_date_idx on public.exams (user_id, exam_date);

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day_start_minute integer not null default 420,   -- 07:00
  day_end_minute integer not null default 1380,    -- 23:00
  min_session_minutes integer not null default 25,
  max_session_minutes integer not null default 60,
  buffer_minutes integer not null default 10,
  daily_study_target_minutes integer not null default 120,
  preferred_study_start_minute integer not null default 900,  -- 15:00
  preferred_study_end_minute integer not null default 1320,   -- 22:00
  min_gap_for_study_minutes integer not null default 240,     -- 4h
  major text,
  program_intensity smallint check (program_intensity is null or program_intensity between 1 and 5),
  reminders_enabled boolean not null default true,
  reminder_lead_minutes integer not null default 10
);

alter table public.user_settings enable row level security;

create policy "Settings are owner-only" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
