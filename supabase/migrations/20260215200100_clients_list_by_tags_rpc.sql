-- RPC for paginated clients list with optional tag filter and search.

create or replace function public.get_clients_list_filtered(
  p_page_size int default 25,
  p_offset int default 0,
  p_search text default null,
  p_sort_by text default 'name',
  p_sort_order text default 'desc',
  p_tag_ids uuid[] default null
)
returns table (
  rows jsonb,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_total bigint;
  v_rows jsonb;
  v_pattern text;
begin
  v_pattern := case when p_search is not null and trim(p_search) <> '' then '%' || replace(trim(p_search), '%', '\%') || '%' else null end;

  with filtered as (
    select c.id
    from public.clients c
    where (v_pattern is null or c.name ilike v_pattern or c.email ilike v_pattern or c.contact_name ilike v_pattern)
      and (p_tag_ids is null or array_length(p_tag_ids, 1) is null or exists (
        select 1 from public.client_tag_assignments cta
        where cta.client_id = c.id and cta.tag_id = any(p_tag_ids)
      ))
  ),
  counted as (select count(*) as cnt from filtered),
  ordered as (
    select c.*
    from public.clients c
    inner join filtered f on f.id = c.id
    order by
      case p_sort_by when 'created_at' then c.created_at::text when 'updated_at' then c.updated_at::text else c.name end asc nulls last
    limit p_page_size
    offset p_offset
  ),
  ordered_desc as (
    select c.*
    from public.clients c
    inner join filtered f on f.id = c.id
    order by
      case p_sort_by when 'created_at' then c.created_at::text when 'updated_at' then c.updated_at::text else c.name end desc nulls last
    limit p_page_size
    offset p_offset
  )
  select (select cnt from counted), coalesce(
    case when p_sort_order = 'asc' then (select jsonb_agg(row_to_json(o)::jsonb) from ordered o) else (select jsonb_agg(row_to_json(o)::jsonb) from ordered_desc o) end,
    '[]'::jsonb
  )
  into v_total, v_rows;

  return query select v_rows, v_total;
end;
$$;

grant execute on function public.get_clients_list_filtered(int, int, text, text, text, uuid[]) to authenticated;
