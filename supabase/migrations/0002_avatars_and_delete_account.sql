-- Profile avatars + "delete my account".
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- ---------------------------------------------------------------- avatars

-- Either {"kind":"dicebear","style":"…","seed":"…"} or
-- {"kind":"photo","src":"data:image/jpeg;base64,…"} (small, ~16 KB max).
-- The app re-validates before showing it.
alter table public.profiles
  add column if not exists avatar jsonb
  check (
    avatar is null
    or (
      avatar ->> 'kind' in ('dicebear', 'photo')
      and pg_column_size(avatar) < 20000
    )
  );

-- A random DiceBear avatar for anyone who doesn't have one yet
create or replace function public.random_avatar(seed text)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', 'dicebear',
    'style', (array['notionists', 'lorelei', 'openPeeps', 'thumbs', 'pixelArt', 'glass'])[1 + floor(random() * 6)::int],
    'seed', left(seed, 12)
  );
$$;

update public.profiles set avatar = public.random_avatar(id::text) where avatar is null;

-- New sign-ups: same as before, plus a random avatar
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

  insert into public.profiles (id, name, username, timezone, avatar)
  values (new.id, display_name, candidate, tz, public.random_avatar(new.id::text));
  return new;
end;
$$;

-- ---------------------------------------------------------------- delete account

-- Deleting the auth user cascades to: profiles → meetings they host →
-- those meetings' chat + attendance, plus their own attendance/chat rows.
-- Meetings hosted by other people are untouched.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
