-- Post likes & comments with counter triggers

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_id_idx
  on public.post_likes (user_id);

create index if not exists post_likes_post_id_idx
  on public.post_likes (post_id);

alter table public.post_likes enable row level security;

drop policy if exists "Post likes are viewable by authenticated users" on public.post_likes;
create policy "Post likes are viewable by authenticated users"
on public.post_likes for select
to authenticated
using (true);

drop policy if exists "Users can like posts" on public.post_likes;
create policy "Users can like posts"
on public.post_likes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can unlike posts" on public.post_likes;
create policy "Users can unlike posts"
on public.post_likes for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- post_comments
-- ---------------------------------------------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at asc);

create index if not exists post_comments_user_id_idx
  on public.post_comments (user_id);

drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
before update on public.post_comments
for each row
execute function public.set_updated_at();

alter table public.post_comments enable row level security;

drop policy if exists "Post comments are viewable by authenticated users" on public.post_comments;
create policy "Post comments are viewable by authenticated users"
on public.post_comments for select
to authenticated
using (true);

drop policy if exists "Users can comment on posts" on public.post_comments;
create policy "Users can comment on posts"
on public.post_comments for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own comments" on public.post_comments;
create policy "Users can update own comments"
on public.post_comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own comments" on public.post_comments;
create policy "Users can delete own comments"
on public.post_comments for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Counter triggers (bypass posts UPDATE RLS)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set likes_count = likes_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_adjust_count on public.post_likes;
create trigger post_likes_adjust_count
after insert or delete on public.post_likes
for each row
execute function public.adjust_post_likes_count();

create or replace function public.adjust_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comments_count = comments_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_comments_adjust_count on public.post_comments;
create trigger post_comments_adjust_count
after insert or delete on public.post_comments
for each row
execute function public.adjust_post_comments_count();
