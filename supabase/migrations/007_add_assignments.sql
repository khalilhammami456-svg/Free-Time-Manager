-- Adds an assignments table (homework/deliverable deadlines), given the same
-- deadline-urgency treatment as exams in the planner.
-- Run this once in the Supabase SQL editor. Safe to re-run.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  due_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.assignments enable row level security;

drop policy if exists "Assignments are owner-only" on public.assignments;
create policy "Assignments are owner-only" on public.assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists assignments_user_date_idx on public.assignments (user_id, due_date);
