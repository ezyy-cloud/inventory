-- Allow deleting clients while keeping subscriptions and invoices (set client_id to null).
-- Deleting a client will: CASCADE delete device_assignments and client_tag_assignments;
-- SET NULL on subscriptions and client_invoices so those records are preserved.

alter table public.subscriptions
  alter column client_id drop not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_client_id_fkey,
  add constraint subscriptions_client_id_fkey
    foreign key (client_id) references public.clients (id) on delete set null;

alter table public.client_invoices
  alter column client_id drop not null;

alter table public.client_invoices
  drop constraint if exists client_invoices_client_id_fkey,
  add constraint client_invoices_client_id_fkey
    foreign key (client_id) references public.clients (id) on delete set null;
