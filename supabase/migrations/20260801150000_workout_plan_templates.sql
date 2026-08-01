-- Cached AI workout plans keyed by onboarding combination.
-- Few discrete inputs → store once, reuse forever.

create table if not exists public.workout_plan_templates (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  experience text not null,
  days_per_week integer not null,
  session_minutes integer not null,
  plan jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plan_templates_experience_check
    check (experience in ('beginner', 'intermediate', 'advanced')),
  constraint workout_plan_templates_days_check
    check (days_per_week between 2 and 6),
  constraint workout_plan_templates_minutes_check
    check (session_minutes in (20, 30, 45, 60, 90)),
  constraint workout_plan_templates_unique
    unique (goal, experience, days_per_week, session_minutes)
);

create index if not exists workout_plan_templates_lookup_idx
  on public.workout_plan_templates (goal, experience, days_per_week, session_minutes);

alter table public.workout_plan_templates enable row level security;

-- No policies: only service role (bypasses RLS) reads/writes this cache.
