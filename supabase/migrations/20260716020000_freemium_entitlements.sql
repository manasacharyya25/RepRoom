-- Freemium: plan on profiles + daily room usage + guest/active room sessions
-- Run this entire script from the top in the SQL Editor.

-- ---------------------------------------------------------------------------
-- profiles.plan
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan text;

update public.profiles
set plan = 'free'
where plan is null;

alter table public.profiles
  alter column plan set default 'free';

do $$
begin
  alter table public.profiles
    alter column plan set not null;
exception
  when others then null;
end $$;

do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_plan_check;
  alter table public.profiles
    add constraint profiles_plan_check
    check (plan in ('free', 'premium'));
exception
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- room_usage_daily — quota bucket per subject (user id or guest key) per UTC day
-- ---------------------------------------------------------------------------
create table if not exists public.room_usage_daily (
  subject_key text not null,
  usage_date date not null,
  seconds_used int not null default 0 check (seconds_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_key, usage_date)
);

alter table public.room_usage_daily enable row level security;

-- Service/API uses authenticated user or server cookie path; allow authenticated
-- to read/update own subject_key (= auth.uid()::text). Guest usage is written
-- via routes using the anon key with subject_key prefixed "guest:" — use
-- security definer RPCs below for all mutations.

create or replace function public.room_usage_add_seconds(
  p_subject_key text,
  p_seconds int,
  p_quota int
)
returns table (seconds_used int, remaining_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (timezone('utc', now()))::date;
  v_used int;
  v_quota int := greatest(0, p_quota);
  v_add int := greatest(0, p_seconds);
begin
  if p_subject_key is null or length(trim(p_subject_key)) = 0 then
    raise exception 'subject_key required';
  end if;

  -- Unlimited quota (premium)
  if v_quota <= 0 then
    insert into public.room_usage_daily as u (subject_key, usage_date, seconds_used, updated_at)
    values (p_subject_key, v_date, v_add, now())
    on conflict (subject_key, usage_date)
    do update set
      seconds_used = public.room_usage_daily.seconds_used + v_add,
      updated_at = now()
    returning u.seconds_used into v_used;

    seconds_used := v_used;
    remaining_seconds := null;
    return next;
    return;
  end if;

  insert into public.room_usage_daily as u (subject_key, usage_date, seconds_used, updated_at)
  values (p_subject_key, v_date, least(v_add, v_quota), now())
  on conflict (subject_key, usage_date)
  do update set
    seconds_used = least(v_quota, public.room_usage_daily.seconds_used + v_add),
    updated_at = now()
  returning u.seconds_used into v_used;

  seconds_used := v_used;
  remaining_seconds := greatest(0, v_quota - v_used);
  return next;
end;
$$;

create or replace function public.room_usage_get(
  p_subject_key text,
  p_quota int
)
returns table (seconds_used int, remaining_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (timezone('utc', now()))::date;
  v_used int := 0;
  v_quota int := greatest(0, p_quota);
begin
  select coalesce(u.seconds_used, 0) into v_used
  from public.room_usage_daily u
  where u.subject_key = p_subject_key and u.usage_date = v_date;

  seconds_used := coalesce(v_used, 0);
  if v_quota <= 0 then
    remaining_seconds := null;
  else
    remaining_seconds := greatest(0, v_quota - coalesce(v_used, 0));
  end if;
  return next;
end;
$$;

revoke all on function public.room_usage_add_seconds(text, int, int) from public;
revoke all on function public.room_usage_get(text, int) from public;
grant execute on function public.room_usage_add_seconds(text, int, int) to anon, authenticated;
grant execute on function public.room_usage_get(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- active_room_sessions — single active immersive session per subject
-- ---------------------------------------------------------------------------
create table if not exists public.active_room_sessions (
  subject_key text primary key,
  active_room_id text not null,
  device_hash text not null,
  ip_hash text,
  last_seen_at timestamptz not null default now()
);

create index if not exists active_room_sessions_last_seen_idx
  on public.active_room_sessions (last_seen_at desc);

alter table public.active_room_sessions enable row level security;

create or replace function public.active_room_claim(
  p_subject_key text,
  p_room_id text,
  p_device_hash text,
  p_ip_hash text,
  p_stale_seconds int default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.active_room_sessions%rowtype;
  v_stale interval := make_interval(secs => greatest(30, p_stale_seconds));
begin
  select * into v_existing
  from public.active_room_sessions
  where subject_key = p_subject_key;

  if found then
    if v_existing.last_seen_at > now() - v_stale
       and v_existing.device_hash is distinct from p_device_hash then
      return jsonb_build_object(
        'ok', false,
        'reason', 'device_conflict',
        'message', 'Already active on another device'
      );
    end if;
  end if;

  insert into public.active_room_sessions as s (
    subject_key, active_room_id, device_hash, ip_hash, last_seen_at
  )
  values (p_subject_key, p_room_id, p_device_hash, p_ip_hash, now())
  on conflict (subject_key)
  do update set
    active_room_id = excluded.active_room_id,
    device_hash = excluded.device_hash,
    ip_hash = excluded.ip_hash,
    last_seen_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.active_room_heartbeat(
  p_subject_key text,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.active_room_sessions
  set last_seen_at = now()
  where subject_key = p_subject_key
    and device_hash = p_device_hash;

  return found;
end;
$$;

create or replace function public.active_room_release(
  p_subject_key text,
  p_device_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.active_room_sessions
  where subject_key = p_subject_key
    and device_hash = p_device_hash;
end;
$$;

revoke all on function public.active_room_claim(text, text, text, text, int) from public;
revoke all on function public.active_room_heartbeat(text, text) from public;
revoke all on function public.active_room_release(text, text) from public;
grant execute on function public.active_room_claim(text, text, text, text, int) to anon, authenticated;
grant execute on function public.active_room_heartbeat(text, text) to anon, authenticated;
grant execute on function public.active_room_release(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest-readable posts (app still enforces ~100 limit)
-- ---------------------------------------------------------------------------
drop policy if exists "Posts are viewable by anyone" on public.posts;
create policy "Posts are viewable by anyone"
on public.posts for select
to anon, authenticated
using (true);

-- Keep legacy authenticated policy if present (harmless duplicate name drop)
drop policy if exists "Posts are viewable by authenticated users" on public.posts;

-- Profiles readable for feed authors as guest
drop policy if exists "Profiles are viewable by anyone" on public.profiles;
create policy "Profiles are viewable by anyone"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
