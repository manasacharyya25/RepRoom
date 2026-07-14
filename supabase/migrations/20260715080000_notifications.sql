-- In-app notifications for follows, likes, comments, and messages

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'comment', 'message')),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.post_comments (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  preview text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

do $$ begin
  drop policy if exists "Users can view own notifications" on public.notifications;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can update own notifications" on public.notifications;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = recipient_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
exception when duplicate_object then null;
end $$;

grant select, update on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id = new.following_id then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');

  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
after insert on public.follows
for each row
execute procedure public.notify_on_follow();

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select p.user_id into owner_id
  from public.posts p
  where p.id = new.post_id;

  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, post_id)
  values (owner_id, new.user_id, 'like', new.post_id);

  return new;
end;
$$;

drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify
after insert on public.post_likes
for each row
execute procedure public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  excerpt text;
begin
  select p.user_id into owner_id
  from public.posts p
  where p.id = new.post_id;

  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;

  excerpt := left(trim(new.body), 120);

  insert into public.notifications (
    recipient_id, actor_id, type, post_id, comment_id, preview
  )
  values (owner_id, new.user_id, 'comment', new.post_id, new.id, excerpt);

  return new;
end;
$$;

drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify
after insert on public.post_comments
for each row
execute procedure public.notify_on_comment();

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  excerpt text;
begin
  excerpt := left(trim(new.body), 120);

  for member in
    select m.user_id
    from public.conversation_members m
    where m.conversation_id = new.conversation_id
      and m.user_id <> new.sender_id
  loop
    insert into public.notifications (
      recipient_id,
      actor_id,
      type,
      conversation_id,
      message_id,
      preview
    )
    values (
      member.user_id,
      new.sender_id,
      'message',
      new.conversation_id,
      new.id,
      excerpt
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
after insert on public.messages
for each row
execute procedure public.notify_on_message();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
