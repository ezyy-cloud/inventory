-- Notifications table and get_unified_alerts RPC.

-- Notifications: one row per user per alert (dedupe by unread per entity+type).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'overdue_invoice',
    'overdue_subscription',
    'renewal_due',
    'subscription_ending_soon',
    'device_maintenance_long'
  )),
  title text not null,
  body text,
  entity_type text not null,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_read_idx on public.notifications (user_id, read_at);
create unique index notifications_unread_dedupe on public.notifications (user_id, type, entity_type, entity_id)
  where read_at is null;

comment on table public.notifications is 'User notifications for alerts; at most one unread per (user, type, entity_type, entity_id).';

alter table public.notifications enable row level security;

-- Users can only see and update their own notifications. Insert is via backend (cron/service role).
create policy "Users select own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, update on public.notifications to authenticated;

-- RPC: single round-trip unified alerts (same logic as frontend merge).
create or replace function public.get_unified_alerts(p_limit int default 50)
returns table (
  id text,
  alert_type text,
  severity text,
  date_val text,
  title text,
  subtitle text,
  link_path text,
  entity_type text,
  entity_id uuid
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_today date := current_date;
  v_in_14 date := current_date + 14;
  v_in_30 date := current_date + 30;
  v_cutoff timestamptz := now() - interval '7 days';
begin
  -- Overdue invoices (high)
  return query
  select
    ('inv-' || ci.id::text)::text,
    'overdue_invoice'::text,
    'high'::text,
    ci.due_at::text,
    ci.invoice_number::text,
    (coalesce(c.name, '—') || ' · USD ' || coalesce(ci.amount::text, '—'))::text,
    ('/invoices/' || ci.id::text)::text,
    'client_invoice'::text,
    ci.id
  from public.client_invoices ci
  left join public.clients c on c.id = ci.client_id
  where ci.status in ('sent', 'overdue') and ci.due_at < v_today
  order by ci.due_at asc
  limit p_limit;

  -- Overdue subscriptions (high)
  return query
  select
    ('sub-overdue-' || s.id::text)::text,
    'overdue_subscription'::text,
    'high'::text,
    s.next_invoice_date::text,
    s.plan_name::text,
    (coalesce(c.name, '—') || ' · USD ' || coalesce(s.amount::text, '—'))::text,
    '/subscriptions'::text,
    'subscription'::text,
    s.id
  from public.subscriptions s
  left join public.clients c on c.id = s.client_id
  where s.status = 'active' and s.next_invoice_date is not null and s.next_invoice_date < v_today
  order by s.next_invoice_date asc
  limit p_limit;

  -- Renewals due in 14 days (medium)
  return query
  select
    ('sub-renewal-' || s.id::text)::text,
    'renewal_due'::text,
    'medium'::text,
    s.next_invoice_date::text,
    s.plan_name::text,
    (coalesce(c.name, '—') || ' · USD ' || coalesce(s.amount::text, '—'))::text,
    '/subscriptions'::text,
    'subscription'::text,
    s.id
  from public.subscriptions s
  left join public.clients c on c.id = s.client_id
  where s.status = 'active'
    and s.next_invoice_date is not null
    and s.next_invoice_date >= v_today
    and s.next_invoice_date <= v_in_14
  order by s.next_invoice_date asc
  limit p_limit;

  -- Subscriptions ending in 30 days (medium)
  return query
  select
    ('sub-ending-' || s.id::text)::text,
    'subscription_ending_soon'::text,
    'medium'::text,
    s.end_date::text,
    s.plan_name::text,
    (coalesce(c.name, '—') || ' · End ' || coalesce(s.end_date::text, '—'))::text,
    '/subscriptions?end_within=30'::text,
    'subscription'::text,
    s.id
  from public.subscriptions s
  left join public.clients c on c.id = s.client_id
  where s.status = 'active'
    and s.end_date is not null
    and s.end_date >= v_today
    and s.end_date <= v_in_30
  order by s.end_date asc
  limit p_limit;

  -- Devices in maintenance > 7 days (low)
  return query
  select
    ('maint-' || d.id::text)::text,
    'device_maintenance_long'::text,
    'low'::text,
    d.updated_at::text,
    coalesce(d.name, d.identifier, d.id::text)::text,
    ('Since ' || to_char(d.updated_at, 'YYYY-MM-DD'))::text,
    ('/devices/' || d.id::text)::text,
    'device'::text,
    d.id
  from public.devices d
  where d.status = 'maintenance' and d.updated_at < v_cutoff
  order by d.updated_at asc
  limit p_limit;
end;
$$;

comment on function public.get_unified_alerts(int) is 'Returns all alert rows in one call; client should merge and sort by severity then date.';

grant execute on function public.get_unified_alerts(int) to authenticated;

-- Populate notifications for all users who can see alerts (front_desk, admin, super_admin, viewer).
-- Dedupe: only insert if no unread notification exists for (user_id, type, entity_type, entity_id).
-- Call from cron (e.g. daily) or Edge Function.
create or replace function public.sync_notifications_from_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_in_14 date := current_date + 14;
  v_in_30 date := current_date + 30;
  v_cutoff timestamptz := now() - interval '7 days';
  v_user_id uuid;
  v_inserted int := 0;
begin
  for v_user_id in
    select p.id from public.profiles p
    where p.role in ('super_admin', 'admin', 'front_desk', 'viewer')
  loop
    -- Overdue invoices
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    select v_user_id, 'overdue_invoice', ci.invoice_number,
      (coalesce(c.name, '—') || ' · USD ' || coalesce(ci.amount::text, '—')),
      'client_invoice', ci.id
    from public.client_invoices ci
    left join public.clients c on c.id = ci.client_id
    where ci.status in ('sent', 'overdue') and ci.due_at < v_today
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_user_id and n.type = 'overdue_invoice'
        and n.entity_type = 'client_invoice' and n.entity_id = ci.id and n.read_at is null
    );

    -- Overdue subscriptions
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    select v_user_id, 'overdue_subscription', s.plan_name,
      (coalesce(c.name, '—') || ' · USD ' || coalesce(s.amount::text, '—')),
      'subscription', s.id
    from public.subscriptions s
    left join public.clients c on c.id = s.client_id
    where s.status = 'active' and s.next_invoice_date is not null and s.next_invoice_date < v_today
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_user_id and n.type = 'overdue_subscription'
        and n.entity_type = 'subscription' and n.entity_id = s.id and n.read_at is null
    );

    -- Renewals due in 14 days
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    select v_user_id, 'renewal_due', s.plan_name,
      (coalesce(c.name, '—') || ' · USD ' || coalesce(s.amount::text, '—')),
      'subscription', s.id
    from public.subscriptions s
    left join public.clients c on c.id = s.client_id
    where s.status = 'active' and s.next_invoice_date is not null
      and s.next_invoice_date >= v_today and s.next_invoice_date <= v_in_14
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_user_id and n.type = 'renewal_due'
        and n.entity_type = 'subscription' and n.entity_id = s.id and n.read_at is null
    );

    -- Subscriptions ending in 30 days
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    select v_user_id, 'subscription_ending_soon', s.plan_name,
      (coalesce(c.name, '—') || ' · End ' || coalesce(s.end_date::text, '—')),
      'subscription', s.id
    from public.subscriptions s
    left join public.clients c on c.id = s.client_id
    where s.status = 'active' and s.end_date is not null
      and s.end_date >= v_today and s.end_date <= v_in_30
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_user_id and n.type = 'subscription_ending_soon'
        and n.entity_type = 'subscription' and n.entity_id = s.id and n.read_at is null
    );

    -- Devices in maintenance > 7 days
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    select v_user_id, 'device_maintenance_long', coalesce(d.name, d.identifier, d.id::text),
      'Since ' || to_char(d.updated_at, 'YYYY-MM-DD'), 'device', d.id
    from public.devices d
    where d.status = 'maintenance' and d.updated_at < v_cutoff
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_user_id and n.type = 'device_maintenance_long'
        and n.entity_type = 'device' and n.entity_id = d.id and n.read_at is null
    );
  end loop;
end;
$$;

comment on function public.sync_notifications_from_alerts() is 'Inserts missing notifications for all alert-eligible users; run daily via cron or Edge Function.';
-- Only service role or superuser should call this (no grant to authenticated).
