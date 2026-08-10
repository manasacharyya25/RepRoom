-- Public profile workout logs + likes/comments (mirrors post social).

alter table public.workout_logs
  add column if not exists likes_count int not null default 0 check (likes_count >= 0),
  add column if not exists comments_count int not null default 0 check (comments_count >= 0);

-- Anyone authenticated can view any member's logs (profile tabs).
do $$ begin
  drop policy if exists "Users can view own workout logs" on public.workout_logs;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Workout logs are viewable by authenticated users" on public.workout_logs;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Workout logs are viewable by authenticated users"
  on public.workout_logs for select
  to authenticated
  using (true);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- workout_log_likes
-- ---------------------------------------------------------------------------
create table if not exists public.workout_log_likes (
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_log_id, user_id)
);

create index if not exists workout_log_likes_user_id_idx
  on public.workout_log_likes (user_id);

create index if not exists workout_log_likes_log_id_idx
  on public.workout_log_likes (workout_log_id);

alter table public.workout_log_likes enable row level security;

drop policy if exists "Workout log likes are viewable by authenticated users" on public.workout_log_likes;
create policy "Workout log likes are viewable by authenticated users"
on public.workout_log_likes for select
to authenticated
using (true);

drop policy if exists "Users can like workout logs" on public.workout_log_likes;
create policy "Users can like workout logs"
on public.workout_log_likes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can unlike workout logs" on public.workout_log_likes;
create policy "Users can unlike workout logs"
on public.workout_log_likes for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- workout_log_comments
-- ---------------------------------------------------------------------------
create table if not exists public.workout_log_comments (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_log_comments_log_created_at_idx
  on public.workout_log_comments (workout_log_id, created_at asc);

create index if not exists workout_log_comments_user_id_idx
  on public.workout_log_comments (user_id);

drop trigger if exists workout_log_comments_set_updated_at on public.workout_log_comments;
create trigger workout_log_comments_set_updated_at
before update on public.workout_log_comments
for each row
execute function public.set_updated_at();

alter table public.workout_log_comments enable row level security;

drop policy if exists "Workout log comments are viewable by authenticated users" on public.workout_log_comments;
create policy "Workout log comments are viewable by authenticated users"
on public.workout_log_comments for select
to authenticated
using (true);

drop policy if exists "Users can comment on workout logs" on public.workout_log_comments;
create policy "Users can comment on workout logs"
on public.workout_log_comments for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout log comments" on public.workout_log_comments;
create policy "Users can update own workout log comments"
on public.workout_log_comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout log comments" on public.workout_log_comments;
create policy "Users can delete own workout log comments"
on public.workout_log_comments for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Counter triggers
-- ---------------------------------------------------------------------------
create or replace function public.adjust_workout_log_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.workout_logs
    set likes_count = likes_count + 1
    where id = new.workout_log_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.workout_logs
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.workout_log_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists workout_log_likes_adjust_count on public.workout_log_likes;
create trigger workout_log_likes_adjust_count
after insert or delete on public.workout_log_likes
for each row
execute function public.adjust_workout_log_likes_count();

create or replace function public.adjust_workout_log_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.workout_logs
    set comments_count = comments_count + 1
    where id = new.workout_log_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.workout_logs
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.workout_log_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists workout_log_comments_adjust_count on public.workout_log_comments;
create trigger workout_log_comments_adjust_count
after insert or delete on public.workout_log_comments
for each row
execute function public.adjust_workout_log_comments_count();

grant select, insert, delete on public.workout_log_likes to authenticated;
grant select, insert, update, delete on public.workout_log_comments to authenticated;
