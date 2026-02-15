-- RPC: search devices by any text field (base table + type-specific table).
-- Returns a page of device ids and total count for use with existing device fetch.

create or replace function public.get_devices_search(
  p_device_type text,
  p_search text default null,
  p_status text default null,
  p_sort_by text default 'name',
  p_sort_order text default 'desc',
  p_limit int default 25,
  p_offset int default 0
)
returns table (id uuid, total_count bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_pattern text;
  v_type_table text;
  v_type_cols text;
  v_type_ors text;
  v_device_ors text;
  v_sql text;
  v_order_col text;
begin
  v_device_ors := 'd.name ilike $3 or d.identifier ilike $3 or d.serial_number ilike $3 or d.location ilike $3 or d.environment ilike $3 or d.notes ilike $3';

  if p_search is not null and trim(p_search) <> '' then
    v_pattern := '%' || replace(trim(p_search), '%', '\%') || '%';
  else
    v_pattern := null;
  end if;

  v_type_table := case p_device_type
    when 'car_tracker' then 'car_trackers'
    when 'ip_camera' then 'ip_cameras'
    when 'starlink' then 'starlinks'
    when 'wifi_access_point' then 'wifi_access_points'
    when 'tv' then 'tvs'
    when 'drone' then 'drones'
    when 'printer' then 'printers'
    when 'websuite' then 'websuites'
    when 'isp_link' then 'isp_links'
    else null
  end;

  v_type_cols := case p_device_type
    when 'car_tracker' then 'brand,model,sim_number,user_tel,vehicle_model,reg_number,color,server,port,imei,pwd,email'
    when 'ip_camera' then 'camera_type,range'
    when 'starlink' then 'account,subscription,currency,service_period'
    when 'wifi_access_point' then 'ap_type,range,console'
    when 'tv' then 'tv_type,speakers'
    when 'drone' then 'drone_type,range'
    when 'printer' then 'username,password,ip_address'
    when 'websuite' then 'package,domain'
    when 'isp_link' then 'link_type,line_number,wlan_pwd,acc_pwd,modem_user,modem_pwd,ip_address,provider'
    else ''
  end;

  if v_type_table is not null and v_type_cols <> '' then
    select string_agg('t.' || quote_ident(trim(s)) || ' ilike $3', ' or ')
    into v_type_ors
    from unnest(string_to_array(v_type_cols, ',')) as s;
  else
    v_type_ors := 'false';
  end if;

  v_order_col := case p_sort_by
    when 'status' then 'd.status'
    when 'updated_at' then 'd.updated_at'
    else 'd.name'
  end;

  if v_type_table is not null then
    v_sql := format(
      $q$
      with filtered as (
        select d.id
        from public.devices d
        left join public.%s t on t.device_id = d.id
        where d.device_type = $1::public.device_type
          and ($2::text is null or d.status::text = $2)
          and ($3::text is null or %s or (%s))
      ),
      counted as (select count(*) as total_count from filtered),
      ordered as (
        select f.id, (select total_count from counted) as total_count
        from filtered f
        join public.devices d on d.id = f.id
        order by %s %s nulls last
        limit $4
        offset $5
      )
      select ordered.id, ordered.total_count from ordered
      $q$,
      v_type_table,
      v_device_ors,
      v_type_ors,
      v_order_col,
      case when p_sort_order = 'asc' then 'asc' else 'desc' end
    );
  else
    v_sql := format(
      $q$
      with filtered as (
        select d.id
        from public.devices d
        where d.device_type = $1::public.device_type
          and ($2::text is null or d.status::text = $2)
          and ($3::text is null or %s)
      ),
      counted as (select count(*) as total_count from filtered),
      ordered as (
        select f.id, (select total_count from counted) as total_count
        from filtered f
        join public.devices d on d.id = f.id
        order by %s %s nulls last
        limit $4
        offset $5
      )
      select ordered.id, ordered.total_count from ordered
      $q$,
      v_device_ors,
      v_order_col,
      case when p_sort_order = 'asc' then 'asc' else 'desc' end
    );
  end if;

  return query execute v_sql
    using p_device_type, p_status, v_pattern, p_limit, p_offset;
end;
$$;

grant execute on function public.get_devices_search(text, text, text, text, text, int, int) to authenticated;
