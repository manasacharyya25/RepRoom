-- Referrals: unique invite codes, referred_by, revenue-share flags, conversion tracking

-- ---------------------------------------------------------------------------
-- profiles columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists referral_code text;

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

alter table public.profiles
  add column if not exists revenue_share_eligible boolean not null default false;

alter table public.profiles
  add column if not exists revenue_share_interested boolean not null default false;

alter table public.profiles
  add column if not exists revenue_share_interested_at timestamptz;

do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_referred_by_not_self;
  alter table public.profiles
    add constraint profiles_referred_by_not_self
    check (referred_by is null or referred_by <> id);
exception
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- generate unique 8-char codes (no I/O/0/1)
-- ---------------------------------------------------------------------------
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  n int := 0;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.profiles where referral_code = result
    );
    n := n + 1;
    if n > 32 then
      raise exception 'could not generate unique referral_code';
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.profiles_assign_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or length(trim(new.referral_code)) = 0 then
    new.referral_code := public.generate_referral_code();
  else
    new.referral_code := upper(trim(new.referral_code));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_referral_code on public.profiles;
create trigger profiles_assign_referral_code
before insert on public.profiles
for each row execute function public.profiles_assign_referral_code();

do $$
declare
  r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles
    set referral_code = public.generate_referral_code()
    where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (referral_code);

alter table public.profiles
  alter column referral_code set not null;

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  converted_to_premium_at timestamptz,
  constraint referrals_not_self check (referrer_id <> referee_id),
  constraint referrals_referee_unique unique (referee_id)
);

create index if not exists referrals_referrer_id_idx
  on public.referrals (referrer_id);

alter table public.referrals enable row level security;

drop policy if exists "Referrers can view own referrals" on public.referrals;
create policy "Referrers can view own referrals"
on public.referrals for select
to authenticated
using (auth.uid() = referrer_id);

drop policy if exists "Referees can view own referral row" on public.referrals;
create policy "Referees can view own referral row"
on public.referrals for select
to authenticated
using (auth.uid() = referee_id);

-- ---------------------------------------------------------------------------
-- Guard protected profile columns (skip when RPC sets local GUC)
-- ---------------------------------------------------------------------------
create or replace function public.protect_referral_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('rhoq.skip_referral_guard', true) = 'on' then
    return new;
  end if;

  if old.referral_code is not null then
    new.referral_code := old.referral_code;
  end if;
  new.referred_by := old.referred_by;
  new.revenue_share_eligible := old.revenue_share_eligible;

  if old.revenue_share_interested then
    new.revenue_share_interested := true;
    new.revenue_share_interested_at := old.revenue_share_interested_at;
  elsif new.revenue_share_interested is true then
    new.revenue_share_interested := true;
    new.revenue_share_interested_at := coalesce(
      new.revenue_share_interested_at,
      now()
    );
  else
    new.revenue_share_interested := false;
    new.revenue_share_interested_at := old.revenue_share_interested_at;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_referral_columns on public.profiles;
create trigger profiles_protect_referral_columns
before update on public.profiles
for each row execute function public.protect_referral_profile_columns();

-- ---------------------------------------------------------------------------
-- Stamp premium conversion once when plan becomes premium
-- ---------------------------------------------------------------------------
create or replace function public.stamp_referral_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan = 'premium' and (old.plan is distinct from 'premium') then
    update public.referrals
    set converted_to_premium_at = now()
    where referee_id = new.id
      and converted_to_premium_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_stamp_referral_premium on public.profiles;
create trigger profiles_stamp_referral_premium
after update of plan on public.profiles
for each row execute function public.stamp_referral_premium();

-- ---------------------------------------------------------------------------
-- apply_referral_code
-- ---------------------------------------------------------------------------
create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_referrer uuid;
  v_already uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' or v_code !~ '^[A-HJ-NP-Z2-9]{6,12}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select referred_by into v_already
  from public.profiles
  where id = v_user;

  if v_already is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_applied');
  end if;

  select id into v_referrer
  from public.profiles
  where referral_code = v_code;

  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_referrer = v_user then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  perform set_config('rhoq.skip_referral_guard', 'on', true);

  update public.profiles
  set referred_by = v_referrer
  where id = v_user
    and referred_by is null;

  insert into public.referrals (referrer_id, referee_id)
  values (v_referrer, v_user)
  on conflict (referee_id) do nothing;

  return jsonb_build_object('ok', true, 'reason', 'applied');
end;
$$;

create or replace function public.mark_revenue_share_interest()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  perform set_config('rhoq.skip_referral_guard', 'on', true);

  update public.profiles
  set
    revenue_share_interested = true,
    revenue_share_interested_at = coalesce(revenue_share_interested_at, now())
  where id = v_user;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.apply_referral_code(text) from public;
revoke all on function public.mark_revenue_share_interest() from public;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.mark_revenue_share_interest() to authenticated;
