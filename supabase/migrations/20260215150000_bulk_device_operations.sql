-- Bulk unassign devices: complete assignment and set device to in_stock for each device_id.
create or replace function public.bulk_unassign_devices(device_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid;
  aid uuid;
  cnt integer := 0;
begin
  foreach did in array device_ids
  loop
    select id into aid
    from public.device_assignments
    where device_id = did and unassigned_at is null and status = 'active'
    limit 1;
    if aid is not null then
      update public.device_assignments
      set unassigned_at = now(), status = 'completed'
      where id = aid;
      update public.subscriptions
      set status = 'canceled', end_date = current_date
      where device_id = did and status = 'active';
      update public.devices set status = 'in_stock' where id = did;
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;

-- Bulk update device status (e.g. to retired).
create or replace function public.bulk_update_device_status(device_ids uuid[], new_status public.device_status)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  update public.devices
  set status = new_status
  where id = any(device_ids);
  get diagnostics cnt = row_count;
  return cnt;
end;
$$;
