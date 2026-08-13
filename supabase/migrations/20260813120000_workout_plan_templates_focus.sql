-- Extend plan cache key with focus / equipment / style.

alter table public.workout_plan_templates
  add column if not exists focus text not null default 'full_body',
  add column if not exists equipment text not null default 'full_gym',
  add column if not exists style text not null default 'strength';

alter table public.workout_plan_templates
  drop constraint if exists workout_plan_templates_focus_check;
alter table public.workout_plan_templates
  add constraint workout_plan_templates_focus_check
  check (focus in ('full_body', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'));

alter table public.workout_plan_templates
  drop constraint if exists workout_plan_templates_equipment_check;
alter table public.workout_plan_templates
  add constraint workout_plan_templates_equipment_check
  check (equipment in ('none', 'bands', 'dumbbells', 'home_gym', 'full_gym'));

alter table public.workout_plan_templates
  drop constraint if exists workout_plan_templates_style_check;
alter table public.workout_plan_templates
  add constraint workout_plan_templates_style_check
  check (style in ('strength', 'hiit', 'yoga', 'pilates', 'walking', 'jump_rope'));

alter table public.workout_plan_templates
  drop constraint if exists workout_plan_templates_unique;

alter table public.workout_plan_templates
  add constraint workout_plan_templates_unique
  unique (goal, experience, days_per_week, session_minutes, focus, equipment, style);

drop index if exists public.workout_plan_templates_lookup_idx;
create index if not exists workout_plan_templates_lookup_idx
  on public.workout_plan_templates (
    goal,
    experience,
    days_per_week,
    session_minutes,
    focus,
    equipment,
    style
  );
