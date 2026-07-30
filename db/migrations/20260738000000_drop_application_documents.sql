-- Remove standalone application_documents module.
-- Document Requests tab now stores its own uploaded file metadata directly.
-- Storage bucket `application-documents` is retained (used by offers/acceptance files).

-- 1) Remove trigger installed by ats_system migration
drop trigger if exists trg_app_docs_log on public.application_documents;

-- 2) Detach from realtime (best-effort)
do $$ begin
  alter publication supabase_realtime drop table public.application_documents;
exception when undefined_object then null; when others then null; end $$;

-- 3) Extend document_requests to hold file metadata directly, then drop FK
alter table public.application_document_requests
  add column if not exists file_path text,
  add column if not exists file_url  text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

-- Migrate any existing linkage before dropping the FK
update public.application_document_requests r
set file_path = coalesce(r.file_path, d.file_path),
    file_url  = coalesce(r.file_url,  d.file_url),
    file_name = coalesce(r.file_name, d.name),
    file_size = coalesce(r.file_size, d.size_bytes),
    mime_type = coalesce(r.mime_type, d.mime_type)
from public.application_documents d
where r.fulfilled_document_id = d.id;

alter table public.application_document_requests
  drop column if exists fulfilled_document_id;

-- 4) Drop the table
drop table if exists public.application_documents cascade;

-- 5) Audit entry on every application timeline
insert into public.application_timeline (application_id, event_type, title, description, metadata)
select a.id, 'system',
  'Documents tab removed',
  'The standalone Documents tab was removed. All file exchanges now happen through the Document Requests tab, where the application team requests documents and the counselor uploads them for review.',
  jsonb_build_object(
    'removed_module', 'application_documents',
    'replacement',    'application_document_requests',
    'removed_at',     now()
  )
from public.applications a;
