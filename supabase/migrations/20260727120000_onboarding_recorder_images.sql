-- Onboarding recorder profile images (max 5 per user in app logic).
-- R2 keys: live/onboarding/{recorder_id}/images/{image_id}.{ext}

create table if not exists public.onboarding_recorder_images (
  image_id uuid primary key default gen_random_uuid(),
  recorder_id uuid not null
    references public.onboarding_recorders (id) on delete cascade,
  r2_key text not null,
  content_type text not null,
  bytes integer not null default 0
    check (bytes >= 0),
  original_filename text,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_recorder_images_recorder_idx
  on public.onboarding_recorder_images (recorder_id, created_at desc);

alter table public.onboarding_recorder_images enable row level security;

revoke all on table public.onboarding_recorder_images from public, anon, authenticated;
grant all on table public.onboarding_recorder_images to service_role;
