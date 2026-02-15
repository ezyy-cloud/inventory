-- Add plan_id and device_id to client_invoices (required for subscription invoices per plan)

alter table public.client_invoices
  add column if not exists plan_id uuid references public.subscription_plans (id) on delete set null;

alter table public.client_invoices
  add column if not exists device_id uuid references public.devices (id) on delete set null;

create index if not exists client_invoices_plan_idx on public.client_invoices (plan_id);
create index if not exists client_invoices_device_idx on public.client_invoices (device_id);
