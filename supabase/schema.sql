-- Ezyy Inventory Suite schema
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

-- Enums
create type public.user_role as enum (
  'super_admin',
  'admin',
  'front_desk',
  'technician'
);

create type public.device_status as enum (
  'in_stock',
  'assigned',
  'maintenance',
  'retired',
  'lost'
);

create type public.device_type as enum (
  'car_tracker',
  'ip_camera',
  'starlink',
  'wifi_access_point',
  'tv',
  'drone',
  'printer',
  'websuite',
  'isp_link',
  'other'
);

create type public.subscription_status as enum (
  'active',
  'paused',
  'canceled',
  'expired'
);

create type public.billing_cycle as enum (
  'monthly',
  'quarterly',
  'yearly',
  'one_time'
);

create type public.invoice_status as enum (
  'draft',
  'sent',
  'paid',
  'overdue',
  'void'
);

create type public.provider_payment_status as enum (
  'scheduled',
  'pending',
  'paid',
  'overdue',
  'canceled'
);

create type public.assignment_status as enum (
  'active',
  'completed'
);

-- Helper for updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'front_desk',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Auto-provision profiles from auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  contact_name text,
  email text,
  phone text,
  address text,
  billing_address text,
  tax_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

-- Devices (base table)
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_type public.device_type not null,
  name text,
  status public.device_status not null default 'in_stock',
  serial_number text,
  identifier text,
  location text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  environment text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devices_device_type_idx on public.devices (device_type);
create index devices_status_idx on public.devices (status);

create trigger set_devices_updated_at
before update on public.devices
for each row
execute function public.set_updated_at();

-- Car trackers
create table public.car_trackers (
  device_id uuid primary key references public.devices (id) on delete cascade,
  brand text,
  model text,
  sim_number text,
  user_tel text,
  vehicle_model text,
  reg_number text,
  color text,
  server text,
  port text,
  imei text,
  pwd text,
  email text,
  install_date date,
  sms_notification boolean default false,
  remote_cut_off boolean default false,
  last_top_up date
);

-- IP Cameras
create table public.ip_cameras (
  device_id uuid primary key references public.devices (id) on delete cascade,
  camera_type text,
  range text
);

-- Starlinks
create table public.starlinks (
  device_id uuid primary key references public.devices (id) on delete cascade,
  account text,
  subscription text,
  amount numeric(12, 2),
  currency text default 'USD',
  renewal_date date,
  registration_date date,
  service_period text
);

-- WiFi Access Points
create table public.wifi_access_points (
  device_id uuid primary key references public.devices (id) on delete cascade,
  ap_type text,
  range text,
  console text
);

-- TVs
create table public.tvs (
  device_id uuid primary key references public.devices (id) on delete cascade,
  tv_type text,
  speakers text
);

-- Drones
create table public.drones (
  device_id uuid primary key references public.devices (id) on delete cascade,
  drone_type text,
  range text
);

-- Printers
create table public.printers (
  device_id uuid primary key references public.devices (id) on delete cascade,
  username text,
  password text,
  ip_address text
);

-- Websuites
create table public.websuites (
  device_id uuid primary key references public.devices (id) on delete cascade,
  package text,
  domain text
);

-- ISP Links
create table public.isp_links (
  device_id uuid primary key references public.devices (id) on delete cascade,
  link_type text,
  line_number text,
  wlan_pwd text,
  acc_pwd text,
  modem_user text,
  modem_pwd text,
  ip_address text,
  provider text
);

-- Assignments
create table public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  status public.assignment_status not null default 'active',
  notes text
);

create index device_assignments_device_idx on public.device_assignments (device_id);
create index device_assignments_client_idx on public.device_assignments (client_id);

create unique index device_assignments_active_unique
on public.device_assignments (device_id)
where unassigned_at is null;

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete cascade,
  plan_name text not null,
  billing_cycle public.billing_cycle not null default 'monthly',
  amount numeric(12, 2) not null,
  currency text default 'USD',
  start_date date not null,
  end_date date,
  next_invoice_date date,
  status public.subscription_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_client_idx on public.subscriptions (client_id);
create index subscriptions_device_idx on public.subscriptions (device_id);

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

-- Client invoices
create table public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  invoice_number text not null,
  period_start date,
  period_end date,
  amount numeric(12, 2) not null,
  currency text default 'USD',
  status public.invoice_status not null default 'draft',
  issued_at date,
  due_at date,
  paid_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_invoices_client_idx on public.client_invoices (client_id);

create trigger set_client_invoices_updated_at
before update on public.client_invoices
for each row
execute function public.set_updated_at();

create table public.client_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.client_invoices (id) on delete cascade,
  description text,
  quantity integer default 1,
  unit_price numeric(12, 2) not null,
  total numeric(12, 2) generated always as (quantity * unit_price) stored
);

-- Providers
create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_type text,
  contact_name text,
  email text,
  phone text,
  account_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_providers_updated_at
before update on public.providers
for each row
execute function public.set_updated_at();

-- Provider payments
create table public.provider_payments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  description text,
  amount numeric(12, 2) not null,
  currency text default 'USD',
  status public.provider_payment_status not null default 'pending',
  due_at date,
  paid_at date,
  invoice_ref text,
  service_period_start date,
  service_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_payments_provider_idx on public.provider_payments (provider_id);
create index provider_payments_device_idx on public.provider_payments (device_id);

create trigger set_provider_payments_updated_at
before update on public.provider_payments
for each row
execute function public.set_updated_at();

-- Import jobs
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_file text,
  entity_type text,
  total_rows integer,
  success_rows integer,
  failed_rows integer,
  status text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Role helpers
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('super_admin', 'admin');
$$;

create or replace function public.is_front_desk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('super_admin', 'admin', 'front_desk');
$$;

create or replace function public.is_technician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('super_admin', 'admin', 'technician');
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.devices enable row level security;
alter table public.car_trackers enable row level security;
alter table public.ip_cameras enable row level security;
alter table public.starlinks enable row level security;
alter table public.wifi_access_points enable row level security;
alter table public.tvs enable row level security;
alter table public.drones enable row level security;
alter table public.printers enable row level security;
alter table public.websuites enable row level security;
alter table public.isp_links enable row level security;
alter table public.device_assignments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.client_invoices enable row level security;
alter table public.client_invoice_items enable row level security;
alter table public.providers enable row level security;
alter table public.provider_payments enable row level security;
alter table public.import_jobs enable row level security;

-- Profiles policies
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Generic read policies
create policy "Authenticated read access"
  on public.clients for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.devices for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.device_assignments for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.subscriptions for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.client_invoices for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.client_invoice_items for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.providers for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.provider_payments for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.import_jobs for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.car_trackers for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.ip_cameras for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.starlinks for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.wifi_access_points for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.tvs for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.drones for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.printers for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.websuites for select
  to authenticated
  using (true);

create policy "Authenticated read access"
  on public.isp_links for select
  to authenticated
  using (true);

-- Write policies by role
create policy "Admins manage clients"
  on public.clients for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

create policy "Admins manage devices"
  on public.devices for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage device assignments"
  on public.device_assignments for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage subscriptions"
  on public.subscriptions for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

create policy "Admins manage invoices"
  on public.client_invoices for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

create policy "Admins manage invoice items"
  on public.client_invoice_items for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

create policy "Admins manage providers"
  on public.providers for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

create policy "Admins manage provider payments"
  on public.provider_payments for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

create policy "Admins manage import jobs"
  on public.import_jobs for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());

-- Product-line table writes follow device permissions
create policy "Admins manage car trackers"
  on public.car_trackers for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage ip cameras"
  on public.ip_cameras for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage starlinks"
  on public.starlinks for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage wifi access points"
  on public.wifi_access_points for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage tvs"
  on public.tvs for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage drones"
  on public.drones for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage printers"
  on public.printers for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage websuites"
  on public.websuites for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());

create policy "Admins manage isp links"
  on public.isp_links for all
  to authenticated
  using (public.is_technician())
  with check (public.is_technician());
