-- RPC: return count and total amount for invoices with status in ('overdue', 'sent')
-- Used for dashboard/overdue summary without loading all invoices.

create or replace function public.get_overdue_invoices_summary()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'count', (select count(*)::int from public.client_invoices where status in ('overdue', 'sent')),
    'total', (select coalesce(sum(amount), 0)::numeric from public.client_invoices where status in ('overdue', 'sent'))
  );
$$;
