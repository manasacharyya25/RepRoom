-- Workout set logs (rooms chat) + daily completions for weekly plan.

alter table public.lobby_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists payload jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.lobby_messages
    drop constraint if exists lobby_messages_message_type_check;
exception when undefined_object then null;
end $$;

alter table public.lobby_messages
  add constraint lobby_messages_message_type_check
  check (message_type in ('text', 'workout_log'));

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  exercise_name text not null check (char_length(trim(exercise_name)) > 0 and char_length(exercise_name) <= 120),
  set_number integer null check (set_number is null or (set_number >= 1 and set_number <= 100)),
  reps text null check (reps is null or (char_length(trim(reps)) > 0 and char_length(reps) <= 40)),
  weight text null check (weight is null or char_length(weight) <= 40),
  duration_seconds integer null check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 86400)),
  plan_day_index integer null check (plan_day_index is null or plan_day_index >= 0),
  lobby_message_id uuid null references public.lobby_messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workout_logs_user_day_idx
  on public.workout_logs (user_id, logged_on);

create index if not exists workout_logs_lobby_message_idx
  on public.workout_logs (lobby_message_id);

create table if not exists public.workout_day_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  plan_day_index integer null check (plan_day_index is null or plan_day_index >= 0),
  completed_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists workout_day_completions_user_day_idx
  on public.workout_day_completions (user_id, logged_on);

alter table public.workout_logs enable row level security;
alter table public.workout_day_completions enable row level security;

do $$ begin
  drop policy if exists "Users can view own workout logs" on public.workout_logs;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can insert own workout logs" on public.workout_logs;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can view own workout day completions" on public.workout_day_completions;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Users can insert own workout day completions" on public.workout_day_completions;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Users can view own workout logs"
  on public.workout_logs for select
  to authenticated
  using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can insert own workout logs"
  on public.workout_logs for insert
  to authenticated
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can view own workout day completions"
  on public.workout_day_completions for select
  to authenticated
  using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can insert own workout day completions"
  on public.workout_day_completions for insert
  to authenticated
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  drop policy if exists "Users can update own workout day completions" on public.workout_day_completions;
exception when undefined_table then null;
end $$;

do $$ begin
  create policy "Users can update own workout day completions"
  on public.workout_day_completions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

grant select, insert on public.workout_logs to authenticated;
grant select, insert, update on public.workout_day_completions to authenticated;
