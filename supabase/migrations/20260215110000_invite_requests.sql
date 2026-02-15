-- Invite requests: store email + role so when user accepts invite we set their profile role

create table if not exists public.invite_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.user_role not null default 'front_desk',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists invite_requests_email_lower_idx
  on public.invite_requests (lower(trim(email)));

alter table public.invite_requests enable row level security;

-- Only super_admins can manage invite_requests (via service role in Edge Function; no direct client access needed)
drop policy if exists "No direct client access to invite_requests" on public.invite_requests;
create policy "No direct client access to invite_requests"
  on public.invite_requests for all
  to authenticated
  using (false)
  with check (false);

-- Allow service role (used by Edge Function) to insert/select/delete
-- RLS with (false) blocks anon/authenticated; service_role bypasses RLS by default in Supabase.

-- When a new user is created, apply role from invite_requests and remove the request
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_role public.user_role;
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  select ir.role into inv_role
  from public.invite_requests ir
  where lower(trim(ir.email)) = lower(trim(new.email))
  limit 1;

  if inv_role is not null then
    update public.profiles set role = inv_role where id = new.id;
    delete from public.invite_requests where lower(trim(email)) = lower(trim(new.email));
  end if;

  return new;
end;
$$;
