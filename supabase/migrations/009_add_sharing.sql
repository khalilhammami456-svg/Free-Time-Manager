-- Adds a per-user share code + sharing toggle, and a security-definer RPC that
-- lets another signed-in user look up only bare busy time blocks (never subject
-- names, sessions, or any other personal data) for a profile that has sharing on.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table public.profiles
  add column if not exists share_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  add column if not exists sharing_enabled boolean not null default false;

create or replace function public.get_shared_busy_blocks(p_share_code text)
returns table (day_of_week smallint, start_minute integer, end_minute integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id from public.profiles
    where share_code = p_share_code and sharing_enabled = true;

  if target_user_id is null then
    return;
  end if;

  return query
    select te.day_of_week, te.start_minute, te.end_minute
    from public.timetable_entries te
    where te.user_id = target_user_id;
end;
$$;

grant execute on function public.get_shared_busy_blocks(text) to authenticated;
