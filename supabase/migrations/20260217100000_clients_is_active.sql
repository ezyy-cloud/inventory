-- Add is_active to clients so they can be hidden from the default list without deleting.
alter table public.clients
  add column if not exists is_active boolean not null default true;

comment on column public.clients.is_active is 'When false, client is excluded from default (active-only) lists.';
