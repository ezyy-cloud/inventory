-- Add pos_device to device_type enum. Must be committed before the value can be used.
-- See: https://www.postgresql.org/docs/current/sql-altertype.html (new enum values cannot be used in same transaction)

alter type public.device_type add value 'pos_device';
