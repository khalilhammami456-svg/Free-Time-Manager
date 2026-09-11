-- Marks a study session as a pre-class "review" session (the strategic session the
-- planner places right before its linked class) so the UI/reminders can call it out
-- distinctly from a regular study block.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table public.study_sessions
  add column if not exists is_review boolean not null default false;
