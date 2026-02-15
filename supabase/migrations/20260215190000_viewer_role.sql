-- Add viewer role to enum. Must be in its own migration so the new value is committed
-- before it can be used (e.g. in is_viewer()). See 20260215190001_viewer_role_function.sql.
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'user_role' and e.enumlabel = 'viewer') then
    alter type public.user_role add value 'viewer';
  end if;
end;
$$;
