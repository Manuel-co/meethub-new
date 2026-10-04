-- Short meeting codes like "abc-def-ghi" (easy to read out and type),
-- used in links (/meet/abc-def-ghi) and in "Join with a code".
-- Run once in Supabase AFTER 0004: Dashboard → SQL Editor → New query → paste → Run.

-- Letters only, without ones that are easy to confuse (i, l, o)
create or replace function public.new_meeting_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..9 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i in (3, 6) then v_code := v_code || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.meetings m where m.code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table public.meetings add column if not exists code text;
update public.meetings set code = public.new_meeting_code() where code is null;
alter table public.meetings
  alter column code set default public.new_meeting_code(),
  alter column code set not null;
-- drop first so the file can be re-run safely
alter table public.meetings drop constraint if exists meetings_code_format;
alter table public.meetings
  add constraint meetings_code_format check (code ~ '^[a-z]{3}-[a-z]{3}-[a-z]{3}$');
create unique index if not exists meetings_code_key on public.meetings (code);

-- Look up a meeting by its code (anyone with the code; the meeting's own
-- access rules and waiting room still decide who gets in)
create or replace function public.get_meeting_id_by_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- accept "abc-def-ghi", "abc def ghi", "ABCDEFGHI"…: keep the 9 letters, re-add dashes
  with c as (select lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z]', '', 'g')) as raw)
  select m.id
  from public.meetings m, c
  where length(c.raw) = 9
    and m.code = substr(c.raw, 1, 3) || '-' || substr(c.raw, 4, 3) || '-' || substr(c.raw, 7, 3)
  limit 1;
$$;

revoke all on function public.get_meeting_id_by_code(text) from public;
grant execute on function public.get_meeting_id_by_code(text) to anon, authenticated;

-- The meeting room page also gets the code (for the short invite link)
drop function if exists public.get_meeting_public(uuid);
create function public.get_meeting_public(p_id uuid)
returns table (id uuid, title text, start_at timestamptz, duration int, status text, host_name text, access text, code text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.start_at, m.duration, m.status, p.name, m.access, m.code
  from public.meetings m
  join public.profiles p on p.id = m.host_id
  where m.id = p_id;
$$;

revoke all on function public.get_meeting_public(uuid) from public;
grant execute on function public.get_meeting_public(uuid) to anon, authenticated;
