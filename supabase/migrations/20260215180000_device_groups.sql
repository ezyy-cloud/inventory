-- Device groups (batches) and members.

create table if not exists public.device_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.device_group_members (
  device_id uuid not null references public.devices (id) on delete cascade,
  group_id uuid not null references public.device_groups (id) on delete cascade,
  primary key (device_id, group_id)
);

create index if not exists device_group_members_group_idx on public.device_group_members (group_id);

alter table public.device_groups enable row level security;
alter table public.device_group_members enable row level security;

drop policy if exists "Technician read device_groups" on public.device_groups;
create policy "Technician read device_groups"
  on public.device_groups for select to authenticated using (public.is_technician());
drop policy if exists "Technician manage device_groups" on public.device_groups;
create policy "Technician manage device_groups"
  on public.device_groups for all to authenticated
  using (public.is_technician()) with check (public.is_technician());

drop policy if exists "Technician read device_group_members" on public.device_group_members;
create policy "Technician read device_group_members"
  on public.device_group_members for select to authenticated using (public.is_technician());
drop policy if exists "Technician manage device_group_members" on public.device_group_members;
create policy "Technician manage device_group_members"
  on public.device_group_members for all to authenticated
  using (public.is_technician()) with check (public.is_technician());
