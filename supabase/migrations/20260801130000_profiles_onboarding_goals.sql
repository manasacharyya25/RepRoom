-- Onboarding Step 3 ("Goals"): primary goal, frequency, session length, milestone

alter table public.profiles
  add column if not exists primary_fitness_goal text;

alter table public.profiles
  add column if not exists workout_days_per_week integer;

alter table public.profiles
  add column if not exists session_minutes integer;

alter table public.profiles
  add column if not exists success_milestone text;

alter table public.profiles
  drop constraint if exists profiles_primary_fitness_goal_check;

alter table public.profiles
  add constraint profiles_primary_fitness_goal_check check (
    primary_fitness_goal is null
    or primary_fitness_goal in (
      'build_muscle',
      'lose_fat',
      'get_stronger',
      'improve_endurance',
      'more_flexible',
      'stay_healthy',
      'stay_consistent'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_workout_days_per_week_check;

alter table public.profiles
  add constraint profiles_workout_days_per_week_check check (
    workout_days_per_week is null
    or workout_days_per_week between 1 and 7
  );

alter table public.profiles
  drop constraint if exists profiles_session_minutes_check;

alter table public.profiles
  add constraint profiles_session_minutes_check check (
    session_minutes is null
    or session_minutes in (20, 30, 45, 60, 90)
  );
