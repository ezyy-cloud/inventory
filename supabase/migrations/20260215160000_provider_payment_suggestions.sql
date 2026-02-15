-- Create draft provider_payments for active device_provider_plans in the given period.
-- Used after period invoice generation to suggest what we owe providers.
create or replace function public.create_provider_payment_suggestions_for_period(
  period_start date,
  period_end date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  cnt integer := 0;
  due date;
begin
  due := period_end + interval '14 days';
  for r in
    select
      dpp.id as dpp_id,
      dpp.device_id,
      dpp.provider_plan_id,
      pp.provider_id,
      pp.amount,
      pp.currency
    from public.device_provider_plans dpp
    join public.provider_plans pp on pp.id = dpp.provider_plan_id
    where dpp.status = 'active'
      and (dpp.end_date is null or dpp.end_date >= period_start)
      and dpp.start_date <= period_end
  loop
    insert into public.provider_payments (
      provider_id,
      device_id,
      provider_plan_id,
      amount,
      currency,
      status,
      service_period_start,
      service_period_end,
      due_at
    )
    values (
      r.provider_id,
      r.device_id,
      r.provider_plan_id,
      r.amount,
      coalesce(r.currency, 'USD'),
      'pending',
      period_start,
      period_end,
      due
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
