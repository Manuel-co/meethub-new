-- Waiting room: people ask to join a scheduled meeting and the host admits them.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- How it's enforced: the video server only issues a meeting pass to the host,
-- or to someone whose request the host admitted (checked server-side through
-- claim_join_request). Guests prove a request is theirs with a random secret
-- that only their browser knows; we store just its SHA-256 hash.

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar jsonb check (avatar is null or pg_column_size(avatar) < 20000),
  user_id uuid references public.profiles (id) on delete set null,
  secret_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'admitted', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index join_requests_meeting_idx on public.join_requests (meeting_id, status, created_at);

alter table public.join_requests enable row level security;

-- Only the meeting's host can see and decide on requests.
-- (Guests create and check requests through the functions below.)
create policy "Hosts see requests for their meetings"
  on public.join_requests for select
  using (exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid()));

create policy "Hosts admit or deny requests"
  on public.join_requests for update
  using (exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid()))
  with check (
    status in ('admitted', 'denied')
    and exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );

-- Ask to join. Returns the request id; the caller keeps `p_secret` private.
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

-- A guest checks their own request: 'pending' | 'admitted' | 'denied' | null
create or replace function public.join_request_status(p_id uuid, p_secret text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.status
  from public.join_requests r
  where r.id = p_id
    and r.secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex');
$$;

-- Used by the server before issuing a meeting pass: returns the meeting and
-- display name for an admitted request (valid for 12 hours).
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
    and r.created_at > now() - interval '12 hours';
$$;

-- Lets the server confirm the signed-in caller hosts this meeting
create or replace function public.is_meeting_host(p_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting and m.host_id = auth.uid() and m.status = 'scheduled'
  );
$$;

revoke all on function public.request_to_join(uuid, text, text, jsonb) from public;
revoke all on function public.join_request_status(uuid, text) from public;
revoke all on function public.claim_join_request(uuid, text) from public;
revoke all on function public.is_meeting_host(uuid) from public;
grant execute on function public.request_to_join(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.join_request_status(uuid, text) to anon, authenticated;
grant execute on function public.claim_join_request(uuid, text) to anon, authenticated;
grant execute on function public.is_meeting_host(uuid) to authenticated;

-- Hosts get new requests instantly (respects the RLS above)
alter publication supabase_realtime add table public.join_requests;
