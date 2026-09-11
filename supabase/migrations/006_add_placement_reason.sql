-- Records why the planner put a session where it did (difficulty, exam urgency,
-- productive hours, pre-class review) so the UI can explain it to the user.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table public.study_sessions
  add column if not exists placement_reason text;
