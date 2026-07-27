-- Track when an onboarding recorder has been promoted to a real profile / archived in admin.

alter table public.onboarding_recorders
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_user_id uuid
    references public.profiles (id) on delete set null;

create index if not exists onboarding_recorders_promoted_at_idx
  on public.onboarding_recorders (promoted_at desc nulls last);
