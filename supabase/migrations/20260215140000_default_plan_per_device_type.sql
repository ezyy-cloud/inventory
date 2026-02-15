-- Default subscription plan per device type (used to pre-fill plan when assigning devices or creating subscriptions).

create table if not exists public.default_plan_per_device_type (
  device_type public.device_type primary key,
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_default_plan_per_device_type_updated_at on public.default_plan_per_device_type;
create trigger set_default_plan_per_device_type_updated_at
  before update on public.default_plan_per_device_type
  for each row
  execute function public.set_updated_at();

alter table public.default_plan_per_device_type enable row level security;

drop policy if exists "Front desk read default plans" on public.default_plan_per_device_type;
create policy "Front desk read default plans"
  on public.default_plan_per_device_type for select
  to authenticated
  using (public.is_front_desk());

drop policy if exists "Front desk manage default plans" on public.default_plan_per_device_type;
create policy "Front desk manage default plans"
  on public.default_plan_per_device_type for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());
