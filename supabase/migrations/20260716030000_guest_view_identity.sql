-- Guest view identity: map device fingerprint → guest_id so returning
-- unlogged users keep the same daily view quota when the cookie is missing.

create table if not exists public.guest_device_map (
  device_hash text primary key,
  guest_id text not null,
  updated_at timestamptz not null default now()
);

create index if not exists guest_device_map_guest_id_idx
  on public.guest_device_map (guest_id);

alter table public.guest_device_map enable row level security;

create or replace function public.guest_resolve_id(
  p_device_hash text,
  p_cookie_guest_id text default null,
  p_client_guest_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cookie text := nullif(trim(coalesce(p_cookie_guest_id, '')), '');
  v_client text := nullif(trim(coalesce(p_client_guest_id, '')), '');
  v_device text := nullif(trim(coalesce(p_device_hash, '')), '');
  v_mapped text;
  v_guest text;
begin
  if v_cookie is not null and length(v_cookie) >= 8 then
    v_guest := v_cookie;
  elsif v_device is not null then
    select m.guest_id into v_mapped
    from public.guest_device_map m
    where m.device_hash = v_device;

    if found and v_mapped is not null and length(v_mapped) >= 8 then
      v_guest := v_mapped;
    elsif v_client is not null and length(v_client) >= 8 then
      v_guest := v_client;
    else
      v_guest := gen_random_uuid()::text;
    end if;
  elsif v_client is not null and length(v_client) >= 8 then
    v_guest := v_client;
  else
    v_guest := gen_random_uuid()::text;
  end if;

  if v_device is not null then
    insert into public.guest_device_map as m (device_hash, guest_id, updated_at)
    values (v_device, v_guest, now())
    on conflict (device_hash)
    do update set
      guest_id = excluded.guest_id,
      updated_at = now();
  end if;

  return v_guest;
end;
$$;

revoke all on function public.guest_resolve_id(text, text, text) from public;
grant execute on function public.guest_resolve_id(text, text, text) to anon, authenticated;
