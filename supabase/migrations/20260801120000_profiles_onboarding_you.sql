-- Onboarding Step 2 ("You"): gender, activity level, fitness experience

alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  add column if not exists activity_level text;

alter table public.profiles
  add column if not exists fitness_experience text;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check check (
    gender is null
    or gender in ('woman', 'man', 'non_binary', 'prefer_not')
  );

alter table public.profiles
  drop constraint if exists profiles_activity_level_check;

alter table public.profiles
  add constraint profiles_activity_level_check check (
    activity_level is null
    or activity_level in (
      'sedentary',
      'beginner',
      'somewhat_active',
      'regular_gym',
      'athlete'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_fitness_experience_check;

alter table public.profiles
  add constraint profiles_fitness_experience_check check (
    fitness_experience is null
    or fitness_experience in (
      'just_starting',
      'under_1_year',
      '1_3_years',
      '3_plus_years'
    )
  );
