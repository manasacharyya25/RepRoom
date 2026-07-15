-- Shared lobby chat on the rooms page (open to all authenticated users).
-- Run this entire script from the top in the SQL Editor (not a mid-file selection).

create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists lobby_messages_created_at_idx
  on public.lobby_messages (created_at asc);

alter table public.lobby_messages enable row level security;

do $$ begin
  drop policy if exists "Lobby messages are viewable by authenticated users" on public.lobby_messages;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can send lobby messages" on public.lobby_messages;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Lobby messages are viewable by authenticated users"
  on public.lobby_messages for select
  to authenticated
  using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can send lobby messages"
  on public.lobby_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);
exception when duplicate_object then null;
end $$;

grant select, insert on public.lobby_messages to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.lobby_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
