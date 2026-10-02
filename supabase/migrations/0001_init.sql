-- MeetHub database schema.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Security model
--   * profiles: public (the booking page shows name + hours), editable by owner
--   * meetings: visible to the host and to invitees (matched by email)
--   * guests never read meetings directly — they use the functions at the
--     bottom, which only expose busy time ranges and validate bookings.

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  username text not null unique check (username ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(username) between 2 and 40),
  timezone text not null default 'UTC',
  -- index 0 = Sunday … 6 = Saturday, each {enabled, start "HH:MM", end "HH:MM"}
  availability jsonb not null default '[
    {"enabled": false, "start": "09:00", "end": "17:00"},
    {"enabled": true,  "start": "09:00", "end": "17:00"},
    {"enabled": true,  "start": "09:00", "end": "17:00"},
    {"enabled": true,  "start": "09:00", "end": "17:00"},
    {"enabled": true,  "start": "09:00", "end": "17:00"},
    {"enabled": true,  "start": "09:00", "end": "17:00"},
    {"enabled": false, "start": "09:00", "end": "17:00"}
  ]'::jsonb check (jsonb_typeof(availability) = 'array' and jsonb_array_length(availability) = 7),
  meeting_length int not null default 30 check (meeting_length in (15, 30, 45, 60, 90)),
  booking_title text not null default 'Intro call' check (char_length(booking_title) between 1 and 120),
  booking_message text not null default 'Pick a time that works for you.' check (char_length(booking_message) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are public"
  on public.profiles for select
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Valid IANA timezone names only
create or replace function public.valid_timezone(tz text)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

alter table public.profiles
  add constraint profiles_timezone_valid check (public.valid_timezone(timezone));

-- Create a profile (with a unique username) whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
  base text;
  candidate text;
  n int := 1;
  tz text;
begin
  display_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 80);

  base := trim(both '-' from lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if char_length(base) < 2 then base := 'user'; end if;
  base := trim(both '-' from left(base, 32));
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  tz := new.raw_user_meta_data ->> 'timezone';
  if tz is null or not public.valid_timezone(tz) then tz := 'UTC'; end if;

  insert into public.profiles (id, name, username, timezone)
  values (new.id, display_name, candidate, tz);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- meetings

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  start_at timestamptz not null,
  duration int not null check (duration between 5 and 600),
  invitees text[] not null default '{}' check (cardinality(invitees) <= 100),
  source text not null default 'manual' check (source in ('manual', 'booking')),
  guest_name text,
  guest_email text,
  guest_note text check (char_length(guest_note) <= 1000),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now()
);

create index meetings_host_start_idx on public.meetings (host_id, start_at);
create index meetings_invitees_idx on public.meetings using gin (invitees);

alter table public.meetings enable row level security;

create policy "Hosts and invitees can see meetings"
  on public.meetings for select
  using (
    host_id = auth.uid()
    or lower(auth.jwt() ->> 'email') = any (invitees)
  );

-- Hosts create their own meetings; bookings go through book_meeting()
create policy "Hosts create meetings"
  on public.meetings for insert
  with check (host_id = auth.uid() and source = 'manual');

create policy "Hosts update their meetings"
  on public.meetings for update
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "Hosts delete their meetings"
  on public.meetings for delete
  using (host_id = auth.uid());

-- ---------------------------------------------------------------- chat transcript

create table public.meeting_messages (
  id text primary key, -- LiveKit message id, so each message is stored once
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  sender_identity text not null,
  sender_name text not null check (char_length(sender_name) <= 80),
  body text not null check (char_length(body) between 1 and 2000),
  sent_at timestamptz not null,
  saved_by uuid not null default auth.uid() references public.profiles (id) on delete cascade
);

create index meeting_messages_meeting_idx on public.meeting_messages (meeting_id, sent_at);

alter table public.meeting_messages enable row level security;

create policy "People in a meeting can read its chat"
  on public.meeting_messages for select
  using (exists (select 1 from public.meetings m where m.id = meeting_id));

create policy "People in a meeting can save its chat"
  on public.meeting_messages for insert
  with check (
    saved_by = auth.uid()
    and exists (select 1 from public.meetings m where m.id = meeting_id)
  );

-- ---------------------------------------------------------------- attendance

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index attendance_meeting_idx on public.attendance (meeting_id);
create index attendance_user_idx on public.attendance (user_id);

alter table public.attendance enable row level security;

create policy "See your own attendance, or attendance at meetings you host"
  on public.attendance for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );

create policy "Record your own attendance"
  on public.attendance for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.meetings m where m.id = meeting_id)
  );

create policy "Update your own attendance"
  on public.attendance for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------- public functions

-- Busy time ranges for a host's booking page (no titles or guest details)
create or replace function public.get_busy_times(p_host uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.start_at, m.start_at + make_interval(mins => m.duration)
  from public.meetings m
  where m.host_id = p_host
    and m.status = 'scheduled'
    and p_to - p_from <= interval '100 days'
    and m.start_at < p_to
    and m.start_at + make_interval(mins => m.duration) > p_from
  order by m.start_at;
$$;

-- What the meeting room shows to anyone holding the (unguessable) link
create or replace function public.get_meeting_public(p_id uuid)
returns table (id uuid, title text, start_at timestamptz, duration int, status text, host_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.start_at, m.duration, m.status, p.name
  from public.meetings m
  join public.profiles p on p.id = m.host_id
  where m.id = p_id;
$$;

-- A guest books a slot. Everything is re-checked here, in the host's timezone,
-- under a per-host lock so two guests can't take the same time.
create or replace function public.book_meeting(
  p_username text,
  p_start timestamptz,
  p_name text,
  p_email text,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.profiles;
  local_ts timestamp;
  day jsonb;
  mins int;
  open_m int;
  close_m int;
  new_id uuid;
  len int;
  clean_name text := trim(coalesce(p_name, ''));
  clean_email text := lower(trim(coalesce(p_email, '')));
begin
  select * into h from public.profiles where username = lower(trim(p_username));
  if not found then raise exception 'host_not_found'; end if;
  len := h.meeting_length;

  if char_length(clean_name) not between 2 and 80 then raise exception 'invalid_name'; end if;
  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(clean_email) > 200 then
    raise exception 'invalid_email';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'note_too_long'; end if;
  if p_start <= now() then raise exception 'slot_in_past'; end if;
  if p_start > now() + interval '61 days' then raise exception 'slot_too_far'; end if;

  -- inside the host's working hours, in the host's timezone
  local_ts := p_start at time zone h.timezone;
  day := h.availability -> extract(dow from local_ts)::int;
  if day is null or coalesce((day ->> 'enabled')::boolean, false) is false then
    raise exception 'slot_unavailable';
  end if;
  mins := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  open_m := split_part(day ->> 'start', ':', 1)::int * 60 + split_part(day ->> 'start', ':', 2)::int;
  close_m := split_part(day ->> 'end', ':', 1)::int * 60 + split_part(day ->> 'end', ':', 2)::int;
  if extract(second from local_ts) <> 0 or mins < open_m or mins + len > close_m then
    raise exception 'slot_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtext(h.id::text));
  if exists (
    select 1 from public.meetings m
    where m.host_id = h.id
      and m.status = 'scheduled'
      and m.start_at < p_start + make_interval(mins => len)
      and m.start_at + make_interval(mins => m.duration) > p_start
  ) then
    raise exception 'slot_taken';
  end if;

  insert into public.meetings (host_id, title, start_at, duration, invitees, source, guest_name, guest_email, guest_note)
  values (h.id, h.booking_title, p_start, len, array[clean_email], 'booking', clean_name, clean_email,
          nullif(trim(coalesce(p_note, '')), ''))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.get_busy_times(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_meeting_public(uuid) from public;
revoke all on function public.book_meeting(text, timestamptz, text, text, text) from public;
grant execute on function public.get_busy_times(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.get_meeting_public(uuid) to anon, authenticated;
grant execute on function public.book_meeting(text, timestamptz, text, text, text) to anon, authenticated;

-- Live updates on the dashboard when a guest books (respects the RLS above)
alter publication supabase_realtime add table public.meetings;
