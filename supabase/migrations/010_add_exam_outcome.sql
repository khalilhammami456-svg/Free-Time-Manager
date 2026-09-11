-- Lets the user self-rate how an exam went once its date has passed, so the app
-- can eventually show whether more prep time correlated with a better outcome.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table public.exams
  add column if not exists outcome_rating smallint check (outcome_rating is null or outcome_rating between 1 and 5),
  add column if not exists outcome_notes text;
