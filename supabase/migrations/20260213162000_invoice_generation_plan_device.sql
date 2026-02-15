-- Update generate_period_invoices to set plan_id and device_id from subscription

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
    select s.id, s.client_id, s.plan_id, s.device_id, s.amount, s.currency, s.billing_cycle, s.next_invoice_date
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

    insert into public.client_invoices (client_id, subscription_id, plan_id, device_id, invoice_number, period_start, period_end, amount, currency, status, issued_at, due_at)
    values (sub.client_id, sub.id, sub.plan_id, sub.device_id, inv_num, period_start, period_end, sub.amount, coalesce(sub.currency, 'USD'), 'draft', current_date, period_end + interval '14 days')
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
