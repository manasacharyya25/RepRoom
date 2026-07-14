-- Satara: posts + posts storage
-- Run in Supabase Dashboard → SQL Editor (or via CLI)

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('standard', 'transform')),
  category text not null check (
    category in (
      'fit_check',
      'pump_check',
      'meal_prep',
      'weight_check',
      'motivation',
      'achievement',
      'transformation',
      'goal_completed'
    )
  ),
  caption text not null check (char_length(caption) > 0 and char_length(caption) <= 500),
  image_url text,
  before_image_url text,
  after_image_url text,
  location text,
  tags text[] not null default '{}',
  likes_count int not null default 0 check (likes_count >= 0),
  comments_count int not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_standard_image check (
    kind <> 'standard'
    or category = 'motivation'
    or category = 'goal_completed'
    or image_url is not null
  ),
  constraint posts_transform_images check (
    kind <> 'transform'
    or (before_image_url is not null and after_image_url is not null)
  ),
  constraint posts_transform_category check (
    (kind = 'transform' and category = 'transformation')
    or (kind = 'standard' and category <> 'transformation')
  )
);

create index if not exists posts_user_id_created_at_idx
  on public.posts (user_id, created_at desc);

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists "Posts are viewable by authenticated users" on public.posts;
create policy "Posts are viewable by authenticated users"
on public.posts for select
to authenticated
using (true);

drop policy if exists "Users can insert own posts" on public.posts;
create policy "Users can insert own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own posts" on public.posts;
create policy "Users can update own posts"
on public.posts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
on public.posts for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: posts bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Post images are publicly accessible" on storage.objects;
create policy "Post images are publicly accessible"
on storage.objects for select
using (bucket_id = 'posts');

drop policy if exists "Users can upload own post images" on storage.objects;
create policy "Users can upload own post images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'posts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own post images" on storage.objects;
create policy "Users can update own post images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'posts'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'posts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own post images" on storage.objects;
create policy "Users can delete own post images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'posts'
  and auth.uid()::text = (storage.foldername(name))[1]
);
