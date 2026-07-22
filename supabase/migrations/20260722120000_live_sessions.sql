-- Live broadcast sessions (kept for archival; discovery filters by status + stale window).

create table if not exists public.live_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id text not null,
  r2_folder text not null,
  status text not null default 'live'
    check (status in ('live', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_chunk_number integer not null default 0
    check (last_chunk_number >= 0),
  last_chunk_uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active live session per user.
create unique index if not exists live_sessions_one_live_per_user_idx
  on public.live_sessions (user_id)
  where (status = 'live');

create index if not exists live_sessions_room_live_fresh_idx
  on public.live_sessions (room_id, last_chunk_uploaded_at desc, session_id desc)
  where (status = 'live');

create index if not exists live_sessions_user_started_idx
  on public.live_sessions (user_id, started_at desc);

alter table public.live_sessions enable row level security;

do $$ begin
  drop policy if exists "Live sessions are viewable by everyone" on public.live_sessions;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can create their live sessions" on public.live_sessions;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can update their live sessions" on public.live_sessions;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Live sessions are viewable by everyone"
  on public.live_sessions for select
  to anon, authenticated
  using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can create their live sessions"
  on public.live_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update their live sessions"
  on public.live_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

grant select on public.live_sessions to anon, authenticated;
grant insert, update on public.live_sessions to authenticated;
