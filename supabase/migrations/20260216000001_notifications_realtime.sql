-- Enable Realtime for notifications so the bell dropdown can show new items via postgres_changes.
alter publication supabase_realtime add table public.notifications;
