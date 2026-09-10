-- Adds support for "par quinzaine" (biweekly/alternating) classes to an
-- already-running project. Run this once in the Supabase SQL editor.
-- Safe to re-run: uses IF NOT EXISTS / DROP+CREATE guards throughout.

alter table public.timetable_entries
  add column if not exists recurrence text not null default 'weekly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'timetable_entries_recurrence_check'
  ) then
    alter table public.timetable_entries
      add constraint timetable_entries_recurrence_check
      check (recurrence in ('weekly', 'odd_weeks', 'even_weeks'));
  end if;
end $$;
