-- =====================================================================
-- Party Quest — Phase 2 cloud schema.
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- Safe to re-run (idempotent).
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.profiles (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  profile_id uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  date       bigint,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.parties (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.party_members (
  party_id     uuid not null references public.parties(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index if not exists idx_profiles_user      on public.profiles(user_id);
create index if not exists idx_characters_user    on public.characters(user_id);
create index if not exists idx_sessions_user       on public.sessions(user_id);
create index if not exists idx_party_members_user  on public.party_members(user_id);

-- ---------- security-definer helpers (avoid RLS recursion on party_members) ----------
create or replace function public.my_party_ids()
returns setof uuid language sql security definer set search_path = public stable as $$
  select party_id from public.party_members where user_id = auth.uid();
$$;

create or replace function public.my_party_user_ids()
returns setof uuid language sql security definer set search_path = public stable as $$
  select distinct them.user_id
  from public.party_members me
  join public.party_members them on them.party_id = me.party_id
  where me.user_id = auth.uid();
$$;

-- ---------- create / join a party (server-side, atomic) ----------
create or replace function public.create_party(member_name text)
returns table(party_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare new_code text; pid uuid;
begin
  new_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
  insert into public.parties(code) values (new_code) returning id into pid;
  insert into public.party_members(party_id, user_id, display_name)
    values (pid, auth.uid(), member_name);
  return query select pid, new_code;
end;
$$;

create or replace function public.join_party(join_code text, member_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from public.parties where code = upper(trim(join_code));
  if pid is null then raise exception 'invalid party code'; end if;
  insert into public.party_members(party_id, user_id, display_name)
    values (pid, auth.uid(), member_name)
    on conflict (party_id, user_id) do update set display_name = excluded.display_name;
  return pid;
end;
$$;

grant execute on function public.create_party(text) to authenticated;
grant execute on function public.join_party(text, text) to authenticated;

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.characters    enable row level security;
alter table public.sessions      enable row level security;
alter table public.parties       enable row level security;
alter table public.party_members enable row level security;

-- profiles: own rows read/write; party members may read
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists profiles_party_read on public.profiles;
create policy profiles_party_read on public.profiles
  for select using (user_id in (select public.my_party_user_ids()));

-- characters: own rows read/write; party members may read
drop policy if exists characters_own on public.characters;
create policy characters_own on public.characters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists characters_party_read on public.characters;
create policy characters_party_read on public.characters
  for select using (user_id in (select public.my_party_user_ids()));

-- sessions: strictly own rows
drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- parties: readable only by members (join happens via the join_party RPC)
drop policy if exists parties_read on public.parties;
create policy parties_read on public.parties
  for select using (id in (select public.my_party_ids()));

-- party_members: read rows of parties I belong to; leave (delete) my own membership
drop policy if exists party_members_read on public.party_members;
create policy party_members_read on public.party_members
  for select using (party_id in (select public.my_party_ids()));
drop policy if exists party_members_delete on public.party_members;
create policy party_members_delete on public.party_members
  for delete using (user_id = auth.uid());

-- ---------- invite-code gate (Before User Created auth hook) ----------
-- Rejects any sign-up whose invite_code metadata isn't the shared secret.
-- The client passes options.data.invite_code; the code lives ONLY here (server).
-- After running this, enable it in the dashboard:
--   Authentication → Hooks → Before User Created → this function.
create or replace function public.enforce_invite_code(event jsonb)
returns jsonb language plpgsql as $$
declare code text;
begin
  code := event->'user'->'user_metadata'->>'invite_code';
  if code is not null and upper(trim(code)) = 'TUESDAY' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 400,
    'message', 'Invalid invite code — you need the code to create an account.'
  ));
end;
$$;

grant execute on function public.enforce_invite_code to supabase_auth_admin;
revoke execute on function public.enforce_invite_code from authenticated, anon, public;
