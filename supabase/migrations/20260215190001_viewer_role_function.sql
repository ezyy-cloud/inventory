-- is_viewer() and viewer role notes. Run after 20260215190000 (enum value must be committed first).

create or replace function public.is_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'viewer';
$$;

-- Viewer can only SELECT; existing policies already grant SELECT to authenticated.
-- Write policies use is_front_desk() / is_technician() / is_super_admin(), so viewer has no write access.
