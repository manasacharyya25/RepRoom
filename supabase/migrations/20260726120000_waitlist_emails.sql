-- Waitlist emails for pre-launch signup
create table if not exists public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now(),
  constraint waitlist_emails_email_format check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

create unique index if not exists waitlist_emails_email_lower_idx
  on public.waitlist_emails (lower(email));

alter table public.waitlist_emails enable row level security;

-- Public can join the waitlist; nobody can read via the anon/authenticated keys.
drop policy if exists waitlist_emails_insert_public on public.waitlist_emails;
create policy waitlist_emails_insert_public
  on public.waitlist_emails
  for insert
  to anon, authenticated
  with check (true);

revoke all on table public.waitlist_emails from public;
grant insert on table public.waitlist_emails to anon, authenticated;
