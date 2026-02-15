-- Add subscription plans, provider billing history, and Super Admin profile management

-- Subscription plans (contract/plan templates)
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  billing_cycle public.billing_cycle not null default 'monthly',
  amount numeric(12, 2) not null,
  currency text default 'USD',
  applicable_device_types public.device_type[],
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_subscription_plans_updated_at on public.subscription_plans;
create trigger set_subscription_plans_updated_at
before update on public.subscription_plans
for each row
execute function public.set_updated_at();

-- Link subscriptions to plans (optional)
alter table public.subscriptions
  add column if not exists plan_id uuid references public.subscription_plans (id) on delete set null;

-- Provider billing history (for accounting)
create table if not exists public.provider_billing_history (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  provider_payment_id uuid references public.provider_payments (id) on delete set null,
  period_start date,
  period_end date,
  invoice_number text,
  invoice_date date,
  due_date date,
  paid_date date,
  amount numeric(12, 2) not null,
  currency text default 'USD',
  status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provider_billing_history_provider_idx on public.provider_billing_history (provider_id);
create index if not exists provider_billing_history_device_idx on public.provider_billing_history (device_id);

drop trigger if exists set_provider_billing_history_updated_at on public.provider_billing_history;
create trigger set_provider_billing_history_updated_at
before update on public.provider_billing_history
for each row
execute function public.set_updated_at();

-- Add is_super_admin helper
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'super_admin';
$$;

-- Super Admin can manage profiles (roles)
drop policy if exists "Super admins manage profiles" on public.profiles;
create policy "Super admins manage profiles"
  on public.profiles for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Subscription plans RLS
alter table public.subscription_plans enable row level security;

drop policy if exists "Authenticated read subscription_plans" on public.subscription_plans;
create policy "Authenticated read subscription_plans"
  on public.subscription_plans for select
  to authenticated
  using (true);

drop policy if exists "Front desk manage subscription_plans" on public.subscription_plans;
create policy "Front desk manage subscription_plans"
  on public.subscription_plans for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

-- Provider billing history RLS
alter table public.provider_billing_history enable row level security;

drop policy if exists "Authenticated read provider_billing_history" on public.provider_billing_history;
create policy "Authenticated read provider_billing_history"
  on public.provider_billing_history for select
  to authenticated
  using (true);

drop policy if exists "Front desk manage provider_billing_history" on public.provider_billing_history;
create policy "Front desk manage provider_billing_history"
  on public.provider_billing_history for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());
