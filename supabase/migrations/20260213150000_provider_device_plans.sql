-- Provider device plans: plans offered by providers per device type, and device assignments

-- Provider plans (plans offered by a provider for specific device types)
create table if not exists public.provider_plans (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
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

create index if not exists provider_plans_provider_idx on public.provider_plans (provider_id);

drop trigger if exists set_provider_plans_updated_at on public.provider_plans;
create trigger set_provider_plans_updated_at
before update on public.provider_plans
for each row
execute function public.set_updated_at();

-- Device provider plans (junction: device assigned to a provider plan)
create table if not exists public.device_provider_plans (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  provider_plan_id uuid not null references public.provider_plans (id) on delete cascade,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'canceled', 'ended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_provider_plans_device_idx on public.device_provider_plans (device_id);
create index if not exists device_provider_plans_provider_plan_idx on public.device_provider_plans (provider_plan_id);

create unique index if not exists device_provider_plans_active_unique
on public.device_provider_plans (device_id)
where status = 'active';

drop trigger if exists set_device_provider_plans_updated_at on public.device_provider_plans;
create trigger set_device_provider_plans_updated_at
before update on public.device_provider_plans
for each row
execute function public.set_updated_at();

-- RLS for provider_plans
alter table public.provider_plans enable row level security;

drop policy if exists "Authenticated read provider_plans" on public.provider_plans;
create policy "Authenticated read provider_plans"
  on public.provider_plans for select
  to authenticated
  using (true);

drop policy if exists "Front desk manage provider_plans" on public.provider_plans;
create policy "Front desk manage provider_plans"
  on public.provider_plans for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

-- RLS for device_provider_plans
alter table public.device_provider_plans enable row level security;

drop policy if exists "Authenticated read device_provider_plans" on public.device_provider_plans;
create policy "Authenticated read device_provider_plans"
  on public.device_provider_plans for select
  to authenticated
  using (true);

drop policy if exists "Front desk manage device_provider_plans" on public.device_provider_plans;
create policy "Front desk manage device_provider_plans"
  on public.device_provider_plans for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());
