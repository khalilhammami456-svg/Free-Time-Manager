-- Marks whether the user has already acted on (or dismissed) the "catch up on
-- this skipped session" suggestion, so it doesn't keep reappearing forever.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table public.study_sessions
  add column if not exists catch_up_dismissed boolean not null default false;
