-- Client tags (segments) and many-to-many assignments.

create table if not exists public.client_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create unique index if not exists client_tags_slug_idx on public.client_tags (slug)
  where slug is not null;

create table if not exists public.client_tag_assignments (
  client_id uuid not null references public.clients (id) on delete cascade,
  tag_id uuid not null references public.client_tags (id) on delete cascade,
  primary key (client_id, tag_id)
);

create index if not exists client_tag_assignments_tag_idx on public.client_tag_assignments (tag_id);

alter table public.client_tags enable row level security;
alter table public.client_tag_assignments enable row level security;

drop policy if exists "Front desk read client_tags" on public.client_tags;
create policy "Front desk read client_tags"
  on public.client_tags for select to authenticated using (public.is_front_desk());
drop policy if exists "Front desk manage client_tags" on public.client_tags;
create policy "Front desk manage client_tags"
  on public.client_tags for all to authenticated
  using (public.is_front_desk()) with check (public.is_front_desk());

drop policy if exists "Front desk read client_tag_assignments" on public.client_tag_assignments;
create policy "Front desk read client_tag_assignments"
  on public.client_tag_assignments for select to authenticated using (public.is_front_desk());
drop policy if exists "Front desk manage client_tag_assignments" on public.client_tag_assignments;
create policy "Front desk manage client_tag_assignments"
  on public.client_tag_assignments for all to authenticated
  using (public.is_front_desk()) with check (public.is_front_desk());
