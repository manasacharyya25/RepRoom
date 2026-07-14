-- Follows + 1:1 direct messages with Realtime
-- Run this entire script from the top in the SQL Editor (not a mid-file selection).

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx
  on public.follows (following_id);

create index if not exists follows_follower_id_idx
  on public.follows (follower_id);

alter table public.follows enable row level security;

do $$ begin
  drop policy if exists "Follows are viewable by authenticated users" on public.follows;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can follow" on public.follows;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can unfollow" on public.follows;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Follows are viewable by authenticated users"
  on public.follows for select
  to authenticated
  using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can follow"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can unfollow"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);
exception when duplicate_object then null;
end $$;

grant select, insert, delete on public.follows to authenticated;

-- ---------------------------------------------------------------------------
-- conversations / members / messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_id_idx
  on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = cid
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.bump_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
after insert on public.messages
for each row
execute procedure public.bump_conversation_updated_at();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

do $$ begin
  drop policy if exists "Members can view conversations" on public.conversations;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Members can view conversation members" on public.conversation_members;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Members can update own membership" on public.conversation_members;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Members can view messages" on public.messages;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Members can send messages" on public.messages;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Members can view conversation members"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Members can update own membership"
  on public.conversation_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Members can view messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_conversation_member(conversation_id)
  );
exception when duplicate_object then null;
end $$;

grant select on public.conversations to authenticated;
grant select, update on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- get_or_create_dm RPC
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id is null or other_user_id = me then
    raise exception 'Invalid DM recipient';
  end if;

  if not exists (select 1 from public.profiles p where p.id = other_user_id) then
    raise exception 'User not found';
  end if;

  select c.id
  into existing_id
  from public.conversations c
  where exists (
      select 1 from public.conversation_members m1
      where m1.conversation_id = c.id and m1.user_id = me
    )
    and exists (
      select 1 from public.conversation_members m2
      where m2.conversation_id = c.id and m2.user_id = other_user_id
    )
    and (
      select count(*) from public.conversation_members m
      where m.conversation_id = c.id
    ) = 2
  order by c.updated_at desc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.conversations default values
  returning id into new_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (new_id, me),
    (new_id, other_user_id);

  return new_id;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
