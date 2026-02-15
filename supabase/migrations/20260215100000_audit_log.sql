-- Audit log for key actions

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  constraint audit_log_action_check check (char_length(action) <= 100)
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Only admins and super_admins can read audit log
drop policy if exists "Admins read audit_log" on public.audit_log;
create policy "Admins read audit_log"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- Any authenticated user can insert (application records actions for current user)
drop policy if exists "Authenticated insert audit_log" on public.audit_log;
create policy "Authenticated insert audit_log"
  on public.audit_log for insert
  to authenticated
  with check (auth.uid() = user_id);
