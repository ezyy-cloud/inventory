-- Lightweight RPC for sidebar/tab counts (single round trip).

create or replace function public.get_sidebar_counts()
returns json
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_devices bigint;
  v_clients bigint;
  v_overdue bigint;
  v_ending_soon bigint;
  v_today date := current_date;
  v_future date := current_date + 30;
begin
  select count(*) into v_devices from public.devices;
  select count(*) into v_clients from public.clients;
  select count(*) into v_overdue from public.client_invoices
    where status in ('sent', 'overdue') and due_at < v_today;
  select count(*) into v_ending_soon from public.subscriptions
    where end_date is not null and end_date >= v_today and end_date <= v_future and status = 'active';

  return json_build_object(
    'devices', v_devices,
    'clients', v_clients,
    'overdue_invoices', v_overdue,
    'subscriptions_ending_soon', v_ending_soon
  );
end;
$$;

grant execute on function public.get_sidebar_counts() to authenticated;
