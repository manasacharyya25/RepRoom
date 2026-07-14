-- Inbox actions: block users + delete own DMs

-- ---------------------------------------------------------------------------
-- user_blocks
-- ---------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

do $$ begin
  drop policy if exists "Users can view own blocks" on public.user_blocks;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can block others" on public.user_blocks;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can unblock" on public.user_blocks;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Users can view own blocks"
  on public.user_blocks for select
  to authenticated
  using (auth.uid() = blocker_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can block others"
  on public.user_blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can unblock"
  on public.user_blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);
exception when duplicate_object then null;
end $$;

grant select, insert, delete on public.user_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- delete_dm: remove conversation for both parties
-- ---------------------------------------------------------------------------
create or replace function public.delete_dm(conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = delete_dm.conversation_id
      and m.user_id = me
  ) then
    raise exception 'Not a conversation member';
  end if;

  delete from public.conversations c
  where c.id = delete_dm.conversation_id;
end;
$$;

revoke all on function public.delete_dm(uuid) from public;
grant execute on function public.delete_dm(uuid) to authenticated;

-- Blocked users cannot open/create DMs
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

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = me and b.blocked_id = other_user_id)
       or (b.blocker_id = other_user_id and b.blocked_id = me)
  ) then
    raise exception 'You cannot message this user';
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
