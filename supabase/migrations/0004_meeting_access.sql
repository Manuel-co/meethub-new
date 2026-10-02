-- Who can get into a meeting:
--   anyone_with_link  host + invited people join directly; anyone else with the
--                     link can ask, and waits for the host to approve (default)
--   invite_only       host + invited people only (signed in with the invited
--                     email); nobody else can join or ask
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

alter table public.meetings
  add column if not exists access text not null default 'anyone_with_link'
  check (access in ('invite_only', 'anyone_with_link'));

-- The meeting room page also needs to know the access mode
drop function if exists public.get_meeting_public(uuid);
create function public.get_meeting_public(p_id uuid)
returns table (id uuid, title text, start_at timestamptz, duration int, status text, host_name text, access text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.start_at, m.duration, m.status, p.name, m.access
  from public.meetings m
  join public.profiles p on p.id = m.host_id
  where m.id = p_id;
$$;

revoke all on function public.get_meeting_public(uuid) from public;
grant execute on function public.get_meeting_public(uuid) to anon, authenticated;

-- Used by the server before issuing a meeting pass: may the caller skip the
-- waiting room? Only the host, or a signed-in user whose email was invited.
create or replace function public.can_join_directly(p_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting
      and m.status = 'scheduled'
      and (
        m.host_id = auth.uid()
        or (auth.uid() is not null and lower(auth.jwt() ->> 'email') = any (m.invitees))
      )
  );
$$;

revoke all on function public.can_join_directly(uuid) from public;
grant execute on function public.can_join_directly(uuid) to anon, authenticated;

-- Asking to join is only possible for "anyone with the link" meetings
create or replace function public.request_to_join(
  p_meeting uuid,
  p_name text,
  p_secret text,
  p_avatar jsonb default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m public.meetings;
  clean_name text := left(trim(coalesce(p_name, '')), 40);
  new_id uuid;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found then raise exception 'meeting_not_found'; end if;
  if m.status <> 'scheduled' then raise exception 'meeting_cancelled'; end if;
  if m.access = 'invite_only' then raise exception 'invite_only'; end if;
  if char_length(clean_name) < 1 then raise exception 'invalid_name'; end if;
  if char_length(coalesce(p_secret, '')) < 32 then raise exception 'invalid_secret'; end if;
  -- keep a single meeting's queue from being flooded
  if (select count(*) from public.join_requests r
      where r.meeting_id = p_meeting and r.status = 'pending'
        and r.created_at > now() - interval '1 hour') >= 50 then
    raise exception 'too_many_requests';
  end if;

  insert into public.join_requests (meeting_id, name, avatar, user_id, secret_hash)
  values (
    p_meeting,
    clean_name,
    case when p_avatar is not null and pg_column_size(p_avatar) < 20000 then p_avatar end,
    auth.uid(),
    encode(extensions.digest(p_secret, 'sha256'), 'hex')
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- New sign-ups: random avatar without the "glass" style (looked like an empty bubble)
create or replace function public.random_avatar(seed text)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', 'dicebear',
    'style', (array['notionists', 'lorelei', 'openPeeps', 'thumbs', 'pixelArt'])[1 + floor(random() * 5)::int],
    'seed', left(seed, 12)
  );
$$;

-- An admitted request stops working if the host later makes the meeting invite-only
create or replace function public.claim_join_request(p_id uuid, p_secret text)
returns table (meeting_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.meeting_id, r.name
  from public.join_requests r
  join public.meetings m on m.id = r.meeting_id
  where r.id = p_id
    and r.secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
    and r.status = 'admitted'
    and m.status = 'scheduled'
    and m.access = 'anyone_with_link'
    and r.created_at > now() - interval '12 hours';
$$;
