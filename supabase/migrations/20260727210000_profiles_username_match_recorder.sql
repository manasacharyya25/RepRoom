-- Align profiles.username with onboarding_recorders username format
-- (a-z, 0-9, underscore, hyphen; length 1–32 with edge rules).

alter table public.profiles
  drop constraint if exists username_format;

alter table public.profiles
  add constraint username_format check (
    username is null
    or username ~ '^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$'
  );
