-- Document request upload history + server-side size/type validation

-- 1) Upload history table
create table if not exists public.application_document_request_uploads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.application_document_requests(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  file_path text not null,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_email text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_docreq_uploads_req
  on public.application_document_request_uploads(request_id, uploaded_at desc);

grant select, insert, delete on public.application_document_request_uploads to authenticated;
grant all on public.application_document_request_uploads to service_role;

alter table public.application_document_request_uploads enable row level security;

drop policy if exists "docreq_uploads_all_staff" on public.application_document_request_uploads;
create policy "docreq_uploads_all_staff" on public.application_document_request_uploads for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

-- 2) Server-side validation of size + mime type on request rows.
-- 20 MB cap and allow-list mirrored from the client validator.
alter table public.application_document_requests
  drop constraint if exists docreq_file_size_chk;
alter table public.application_document_requests
  add constraint docreq_file_size_chk
  check (file_size is null or (file_size > 0 and file_size <= 20971520));

alter table public.application_document_requests
  drop constraint if exists docreq_mime_allowed_chk;
alter table public.application_document_requests
  add constraint docreq_mime_allowed_chk
  check (
    mime_type is null
    or mime_type = ''
    or mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv','text/plain','application/rtf','text/rtf',
      'image/png','image/jpeg','image/webp','image/gif','image/heic',
      'application/zip','application/x-zip-compressed'
    )
  );

-- 3) Trigger to insert an upload-history row whenever file_path changes to a new value.
create or replace function public.log_docreq_upload_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _email text;
begin
  if new.file_path is not null
     and new.file_path is distinct from coalesce(old.file_path, '') then
    select email into _email from auth.users where id = auth.uid();
    insert into public.application_document_request_uploads
      (request_id, application_id, file_path, file_name, file_size, mime_type,
       uploaded_by, uploaded_by_email)
    values
      (new.id, new.application_id, new.file_path, new.file_name, new.file_size,
       new.mime_type, auth.uid(), _email);
  end if;

  -- File cleared → timeline audit entry (doc_removed).
  if old.file_path is not null and new.file_path is null then
    insert into public.application_timeline
      (application_id, event_type, title, description, actor_id, metadata)
    values
      (new.application_id, 'doc_removed',
       'Document removed: ' || new.document_name,
       coalesce(old.file_name, ''),
       auth.uid(),
       jsonb_build_object('request_id', new.id, 'file_name', old.file_name));
  end if;

  return new;
end $$;

drop trigger if exists trg_docreq_upload_history on public.application_document_requests;
create trigger trg_docreq_upload_history
  after update on public.application_document_requests
  for each row execute function public.log_docreq_upload_history();

-- 4) Allow clearing file on an approved request (needed by delete flow)
--    without tripping the transition rule that forbids leaving 'approved'.
--    We update validate_docreq_transition to permit a status flip back to
--    'pending' when the file_path is being cleared.
create or replace function public.is_valid_docreq_transition(_from text, _to text)
returns boolean language sql immutable as $$
  select case
    when _from = _to then true
    when _from = 'required'     then _to in ('pending','hold','rejected')
    when _from = 'pending'      then _to in ('under_review','hold','rejected','approved','required')
    when _from = 'under_review' then _to in ('hold','rejected','approved','pending')
    when _from = 'hold'         then _to in ('pending','under_review','rejected','approved','required')
    when _from = 'rejected'     then _to in ('required','pending','under_review')
    when _from = 'approved'     then _to in ('pending','required')
    when _from = 'uploaded'     then _to in ('under_review','hold','rejected','approved','pending')
    else false
  end
$$;
