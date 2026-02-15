-- Allow all authenticated users (including viewer) to read client_tags and client_tag_assignments.

drop policy if exists "Authenticated read access" on public.client_tags;
create policy "Authenticated read access"
  on public.client_tags for select
  to authenticated
  using (true);

drop policy if exists "Authenticated read access" on public.client_tag_assignments;
create policy "Authenticated read access"
  on public.client_tag_assignments for select
  to authenticated
  using (true);
