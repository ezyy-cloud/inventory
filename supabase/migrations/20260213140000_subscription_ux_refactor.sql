-- Subscription UX refactor: plan-backed subscriptions, invoice automation

-- 1. Create default subscription plans per device type (for backfill)
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'Car Tracker Default', 'Default car tracker plan', 'monthly'::public.billing_cycle, 0::numeric, array['car_tracker']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'Car Tracker Default');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'IP Camera Standard', 'Default IP camera plan', 'monthly'::public.billing_cycle, 0::numeric, array['ip_camera']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'IP Camera Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'Starlink Standard', 'Default Starlink plan', 'monthly'::public.billing_cycle, 0::numeric, array['starlink']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'Starlink Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'WiFi AP Standard', 'Default WiFi AP plan', 'monthly'::public.billing_cycle, 0::numeric, array['wifi_access_point']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'WiFi AP Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'TV Standard', 'Default TV plan', 'monthly'::public.billing_cycle, 0::numeric, array['tv']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'TV Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'Drone Standard', 'Default drone plan', 'monthly'::public.billing_cycle, 0::numeric, array['drone']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'Drone Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'Printer Standard', 'Default printer plan', 'monthly'::public.billing_cycle, 0::numeric, array['printer']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'Printer Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'Websuite Standard', 'Default websuite plan', 'monthly'::public.billing_cycle, 0::numeric, array['websuite']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'Websuite Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'ISP Link Standard', 'Default ISP link plan', 'monthly'::public.billing_cycle, 0::numeric, array['isp_link']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'ISP Link Standard');
insert into public.subscription_plans (name, description, billing_cycle, amount, applicable_device_types)
select 'Other Standard', 'Default other device plan', 'monthly'::public.billing_cycle, 0::numeric, array['other']::public.device_type[]
where not exists (select 1 from public.subscription_plans where name = 'Other Standard');

-- 2. Backfill plan_id for existing subscriptions (match by device type or use first plan)
update public.subscriptions s
set plan_id = (
  select sp.id from public.subscription_plans sp
  where (sp.applicable_device_types is null or sp.applicable_device_types = '{}'
         or (s.device_id is null)
         or exists (
           select 1 from public.devices d
           where d.id = s.device_id and d.device_type = any(sp.applicable_device_types)
         ))
  and sp.is_active = true
  limit 1
)
where s.plan_id is null;

-- For any still null, use first active plan
update public.subscriptions
set plan_id = (select id from public.subscription_plans where is_active = true limit 1)
where plan_id is null;

-- 3. Make plan_id required (skip if backfill left nulls - keep nullable for legacy)
-- ALTER TABLE public.subscriptions ALTER COLUMN plan_id SET NOT NULL;
-- We keep nullable to allow legacy data; app enforces for new subscriptions

-- 4. Trigger to populate plan_name, amount, billing_cycle from plan on insert/update
create or replace function public.sync_subscription_from_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_id is not null then
    select name, amount, billing_cycle, currency
    into new.plan_name, new.amount, new.billing_cycle, new.currency
    from public.subscription_plans
    where id = new.plan_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_subscription_from_plan_trigger on public.subscriptions;
create trigger sync_subscription_from_plan_trigger
before insert or update of plan_id on public.subscriptions
for each row
execute function public.sync_subscription_from_plan();

-- 5. Invoice number sequence
create sequence if not exists public.invoice_number_seq;

-- 6. Invoice generation function
create or replace function public.generate_period_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sub record;
  inv_id uuid;
  period_start date;
  period_end date;
  next_date date;
  inv_num text;
  gen_count integer := 0;
begin
  for sub in
    select s.id, s.client_id, s.amount, s.currency, s.billing_cycle, s.next_invoice_date
    from public.subscriptions s
    where s.status = 'active'
      and s.next_invoice_date is not null
      and s.next_invoice_date <= current_date
  loop
    period_start := sub.next_invoice_date;
    case sub.billing_cycle
      when 'monthly' then
        period_end := period_start + interval '1 month' - interval '1 day';
        next_date := period_start + interval '1 month';
      when 'quarterly' then
        period_end := period_start + interval '3 months' - interval '1 day';
        next_date := period_start + interval '3 months';
      when 'yearly' then
        period_end := period_start + interval '1 year' - interval '1 day';
        next_date := period_start + interval '1 year';
      else
        period_end := period_start;
        next_date := period_start + interval '1 month';
    end case;

    inv_num := 'INV-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');

    insert into public.client_invoices (client_id, subscription_id, invoice_number, period_start, period_end, amount, currency, status, issued_at, due_at)
    values (sub.client_id, sub.id, inv_num, period_start, period_end, sub.amount, coalesce(sub.currency, 'USD'), 'draft', current_date, period_end + interval '14 days')
    returning id into inv_id;

    insert into public.client_invoice_items (invoice_id, description, quantity, unit_price)
    values (inv_id, 'Subscription ' || period_start::text || ' - ' || period_end::text, 1, sub.amount);

    update public.subscriptions
    set next_invoice_date = next_date::date
    where id = sub.id;

    gen_count := gen_count + 1;
  end loop;

  return gen_count;
end;
$$;

-- 7. Schedule invoice generation (enable pg_cron in Supabase Dashboard > Database > Extensions first)
create extension if not exists pg_cron;

do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'generate-invoices';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
  perform cron.schedule('generate-invoices', '0 2 * * *', $cmd$SELECT public.generate_period_invoices()$cmd$);
end $$;
