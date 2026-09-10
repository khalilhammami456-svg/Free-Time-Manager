-- Adds productive-hours preferences, the minimum-gap-for-study rule, and major/program
-- intensity to an already-running project. Run this once in the Supabase SQL editor.
-- Safe to re-run.

alter table public.user_settings
  add column if not exists preferred_study_start_minute integer not null default 900,  -- 15:00
  add column if not exists preferred_study_end_minute integer not null default 1320,   -- 22:00
  add column if not exists min_gap_for_study_minutes integer not null default 240,     -- 4h
  add column if not exists major text,
  add column if not exists program_intensity smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_settings_program_intensity_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_program_intensity_check
      check (program_intensity is null or program_intensity between 1 and 5);
  end if;
end $$;
