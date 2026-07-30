-- Remove Document Requirements module entirely.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'docreq_deadline_scan') then
      perform cron.unschedule('docreq_deadline_scan');
    end if;
  end if;
end $$;

drop function if exists public.check_docreq_deadlines(int);

drop table if exists public.docreq_deadline_notifications cascade;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'document_requirements'
  ) then
    execute 'alter publication supabase_realtime drop table public.document_requirements';
  end if;
end $$;

drop table if exists public.document_requirements cascade;

drop type if exists public.doc_req_priority;
drop type if exists public.doc_req_status;
