-- Client mail log for tracking sent emails (single + broadcast) and
-- notification type extensions for mail-related notifications.

create table if not exists public.client_mail_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  sent_by uuid not null references public.profiles (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  template_id uuid references public.mail_templates (id) on delete set null,
  subject text not null,
  outcome text not null check (outcome in ('sent', 'failed')),
  recipient_email text,
  recipient_count int,
  sent_count int,
  failed_count int,
  active_only boolean
);

comment on table public.client_mail_log is 'Log of client emails sent from Mail feature (single and broadcast).';

create index if not exists client_mail_log_sent_at_idx on public.client_mail_log (sent_at desc);
create index if not exists client_mail_log_client_idx on public.client_mail_log (client_id, sent_at desc);

alter table public.client_mail_log enable row level security;

-- Front desk and above can see all mail logs.
create policy "Front desk read client_mail_log"
  on public.client_mail_log for select
  to authenticated
  using (public.is_front_desk());

-- Any authenticated user can insert their own mail log rows.
create policy "Users insert own client_mail_log"
  on public.client_mail_log for insert
  to authenticated
  with check (auth.uid() = sent_by);

-- Extend notifications.type for mail-related notifications and allow users to insert
-- notifications for themselves (e.g. mail sent, broadcasts completed).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'overdue_invoice',
  'overdue_subscription',
  'renewal_due',
  'subscription_ending_soon',
  'device_maintenance_long',
  'client_mail_sent',
  'client_mail_broadcast'
));

drop policy if exists "Users insert own notifications" on public.notifications;
create policy "Users insert own notifications"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id);
