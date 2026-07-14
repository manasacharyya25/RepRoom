-- Social links on profiles (edited via profile editor, not onboarding)
alter table public.profiles
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text,
  add column if not exists x_url text,
  add column if not exists website_url text;
