-- Password-gated early-user onboarding recorder links (/onboard/{username})
-- Admin creates rows via SQL; credentials are NOT Supabase Auth accounts.

create extension if not exists "pgcrypto";

create table if not exists public.onboarding_recorders (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  max_seconds integer not null default 3600
    check (max_seconds > 0),
  seconds_used integer not null default 0
    check (seconds_used >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_recorders_username_format check (
    username ~ '^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$'
  ),
  constraint onboarding_recorders_seconds_lte_max check (
    seconds_used <= max_seconds
  )
);

create unique index if not exists onboarding_recorders_username_lower_idx
  on public.onboarding_recorders (lower(username));

create table if not exists public.onboarding_recorder_sessions (
  session_id uuid primary key default gen_random_uuid(),
  recorder_id uuid not null
    references public.onboarding_recorders (id) on delete cascade,
  status text not null default 'live'
    check (status in ('live', 'ended')),
  last_chunk_number integer not null default 0,
  last_chunk_uploaded_at timestamptz,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_recorder_sessions_recorder_live_idx
  on public.onboarding_recorder_sessions (recorder_id)
  where status = 'live';

alter table public.onboarding_recorders enable row level security;
alter table public.onboarding_recorder_sessions enable row level security;

-- No anon/authenticated policies: access only via service role from Next.js APIs.
revoke all on table public.onboarding_recorders from public, anon, authenticated;
revoke all on table public.onboarding_recorder_sessions from public, anon, authenticated;

grant all on table public.onboarding_recorders to service_role;
grant all on table public.onboarding_recorder_sessions to service_role;

/*
  Admin: create a recorder (password hashed with pgcrypto bcrypt):

  insert into public.onboarding_recorders (username, password_hash)
  values (
    'alex',
    crypt('choose-a-strong-password', gen_salt('bf'))
  );

  Or paste a bcrypt hash from:
    node scripts/hash-onboarding-password.mjs 'your-password'

  Raise lifetime budget later:
  update public.onboarding_recorders
  set max_seconds = 7200, updated_at = now()
  where username = 'alex';
*/
