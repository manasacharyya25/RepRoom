-- Dodo billing: prepaid broadcast credits + subscription/payment tracking

alter table public.profiles
  add column if not exists broadcast_credit_seconds integer not null default 0
    check (broadcast_credit_seconds >= 0);

create table if not exists public.billing_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dodo_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  dodo_subscription_id text not null unique,
  product text not null check (product in ('monthly', 'annual')),
  status text not null default 'active',
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_id_idx
  on public.billing_subscriptions (user_id);

create index if not exists billing_subscriptions_user_status_idx
  on public.billing_subscriptions (user_id, status);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  dodo_payment_id text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('hours', 'subscription')),
  hours integer check (hours is null or hours > 0),
  amount_cents integer,
  status text not null default 'succeeded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_payments_user_id_idx
  on public.billing_payments (user_id);

-- Atomically burn prepaid broadcast credits. Returns new balance + remaining.
create or replace function public.broadcast_credit_burn(
  p_user_id uuid,
  p_seconds int
)
returns table (credit_seconds int, burned int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_add int := greatest(0, p_seconds);
  v_before int;
  v_burn int;
  v_after int;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  select broadcast_credit_seconds into v_before
  from public.profiles
  where id = p_user_id
  for update;

  if v_before is null then
    raise exception 'profile not found';
  end if;

  v_burn := least(v_before, v_add);
  v_after := v_before - v_burn;

  update public.profiles
  set
    broadcast_credit_seconds = v_after,
    updated_at = now()
  where id = p_user_id;

  credit_seconds := v_after;
  burned := v_burn;
  return next;
end;
$$;

create or replace function public.broadcast_credit_add(
  p_user_id uuid,
  p_seconds int
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_add int := greatest(0, p_seconds);
  v_after int;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  update public.profiles
  set
    broadcast_credit_seconds = broadcast_credit_seconds + v_add,
    updated_at = now()
  where id = p_user_id
  returning broadcast_credit_seconds into v_after;

  if v_after is null then
    raise exception 'profile not found';
  end if;

  return v_after;
end;
$$;

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;

revoke all on table public.billing_customers from public, anon, authenticated;
revoke all on table public.billing_subscriptions from public, anon, authenticated;
revoke all on table public.billing_payments from public, anon, authenticated;

grant all on table public.billing_customers to service_role;
grant all on table public.billing_subscriptions to service_role;
grant all on table public.billing_payments to service_role;

grant execute on function public.broadcast_credit_burn(uuid, int) to service_role;
grant execute on function public.broadcast_credit_add(uuid, int) to service_role;
-- Authenticated users may burn their own credits via app using service role APIs.
-- Also allow authenticated to execute when called with their uid from server routes
-- that use the user-scoped client — prefer service role in billing/room routes.
grant execute on function public.broadcast_credit_burn(uuid, int) to authenticated;
grant execute on function public.broadcast_credit_add(uuid, int) to authenticated;
