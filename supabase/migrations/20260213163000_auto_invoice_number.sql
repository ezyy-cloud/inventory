-- Auto-generate invoice_number when null or empty on insert

create or replace function public.set_invoice_number_if_empty()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or trim(new.invoice_number) = '' then
    new.invoice_number := 'INV-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_number_trigger on public.client_invoices;
create trigger set_invoice_number_trigger
  before insert on public.client_invoices
  for each row
  execute function public.set_invoice_number_if_empty();

-- Allow omitting invoice_number (default empty → trigger fills it)
alter table public.client_invoices
  alter column invoice_number set default '';
