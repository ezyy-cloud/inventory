-- Saved views (saved filters) per user and entity.

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  entity_type text not null check (entity_type in ('devices', 'clients', 'subscriptions', 'invoices')),
  params jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists saved_views_user_entity_idx on public.saved_views (user_id, entity_type);

alter table public.saved_views enable row level security;

-- User can CRUD own rows only.
drop policy if exists "Users manage own saved_views" on public.saved_views;
create policy "Users manage own saved_views"
  on public.saved_views for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_views to authenticated;
