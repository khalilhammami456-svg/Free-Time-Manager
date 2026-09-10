-- Adds a skip_reason to study_sessions, so aborting a focus session records why.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table public.study_sessions
  add column if not exists skip_reason text;
