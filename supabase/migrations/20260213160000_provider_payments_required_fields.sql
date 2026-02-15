-- Add provider_plan_id to provider_payments (required for new payments per plan)

alter table public.provider_payments
  add column if not exists provider_plan_id uuid references public.provider_plans (id) on delete restrict;

create index if not exists provider_payments_provider_plan_idx on public.provider_payments (provider_plan_id);
