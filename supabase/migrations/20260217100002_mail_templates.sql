-- Mail templates for client email (custom/template messages and broadcast)
create table if not exists public.mail_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mail_templates is 'Templates for client emails; body_html may contain {{client_name}}, {{client_email}} placeholders.';

drop trigger if exists set_mail_templates_updated_at on public.mail_templates;
create trigger set_mail_templates_updated_at
before update on public.mail_templates
for each row
execute function public.set_updated_at();

-- RLS
alter table public.mail_templates enable row level security;

drop policy if exists "Authenticated read mail_templates" on public.mail_templates;
create policy "Authenticated read mail_templates"
  on public.mail_templates for select
  to authenticated
  using (true);

drop policy if exists "Front desk manage mail_templates" on public.mail_templates;
create policy "Front desk manage mail_templates"
  on public.mail_templates for all
  to authenticated
  using (public.is_front_desk())
  with check (public.is_front_desk());
