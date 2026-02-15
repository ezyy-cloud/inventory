-- Ensure invoice_number is unique to catch any duplicate generation under concurrency.
-- nextval() is already safe; this is a safeguard.

create unique index if not exists client_invoices_invoice_number_key
  on public.client_invoices (invoice_number);
