-- Store onboarding workout-plan preference + generated/static plan JSON

alter table public.profiles
  add column if not exists workout_plan_status text;

alter table public.profiles
  add column if not exists workout_plan jsonb;

alter table public.profiles
  drop constraint if exists profiles_workout_plan_status_check;

alter table public.profiles
  add constraint profiles_workout_plan_status_check check (
    workout_plan_status is null
    or workout_plan_status in ('has_own', 'rough_idea', 'needs_plan')
  );
