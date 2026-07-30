-- Remove Requirement Checklist module entirely.

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'application_checklists'
  ) then
    execute 'alter publication supabase_realtime drop table public.application_checklists';
  end if;
end $$;

drop trigger if exists trg_app_checklist_ready on public.application_checklists;
drop function if exists public.checklist_auto_ready() cascade;

drop table if exists public.application_checklists cascade;
