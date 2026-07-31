-- Persist discovered archive chunk indices so R2 ListObjects runs at most once per session.

alter table public.onboarding_recorder_sessions
  add column if not exists available_chunks integer[];

alter table public.live_sessions
  add column if not exists available_chunks integer[];

do $$
begin
  if to_regclass('public.archive_sessions') is not null then
    execute 'alter table public.archive_sessions add column if not exists available_chunks integer[]';
  end if;
end $$;
