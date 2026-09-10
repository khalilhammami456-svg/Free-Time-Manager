-- Adds exam scheduling to an already-running project. Run this once in the
-- Supabase SQL editor. Safe to re-run.

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

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'exams' and policyname = 'Exams are owner-only') then
    create policy "Exams are owner-only" on public.exams
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists exams_user_date_idx on public.exams (user_id, exam_date);
