-- Allow optional set / reps / weight / duration on workout logs
-- (name + at least one other field enforced in app).

alter table public.workout_logs
  alter column set_number drop not null;

alter table public.workout_logs
  alter column reps drop not null;

alter table public.workout_logs
  alter column duration_seconds drop not null;

do $$ begin
  alter table public.workout_logs
    drop constraint if exists workout_logs_set_number_check;
exception when undefined_object then null;
end $$;

do $$ begin
  alter table public.workout_logs
    drop constraint if exists workout_logs_reps_check;
exception when undefined_object then null;
end $$;

do $$ begin
  alter table public.workout_logs
    drop constraint if exists workout_logs_duration_seconds_check;
exception when undefined_object then null;
end $$;

alter table public.workout_logs
  add constraint workout_logs_set_number_check
  check (set_number is null or (set_number >= 1 and set_number <= 100));

alter table public.workout_logs
  add constraint workout_logs_reps_check
  check (reps is null or (char_length(trim(reps)) > 0 and char_length(reps) <= 40));

alter table public.workout_logs
  add constraint workout_logs_duration_seconds_check
  check (
    duration_seconds is null
    or (duration_seconds > 0 and duration_seconds <= 86400)
  );
