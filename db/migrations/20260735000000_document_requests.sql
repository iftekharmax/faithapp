-- Document Requests: Application team requests documents; Counselor uploads them.

do $$ begin
  create type public.doc_request_status as enum ('pending','uploaded','approved','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.application_document_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  document_name text not null,
  description text,
  deadline date,
  is_mandatory boolean not null default true,
  status public.doc_request_status not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_email text,
  fulfilled_document_id uuid references public.application_documents(id) on delete set null,
  fulfilled_by uuid references auth.users(id) on delete set null,
  fulfilled_at timestamptz,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_docreq_app on public.application_document_requests(application_id, created_at desc);
create index if not exists idx_docreq_status on public.application_document_requests(status);

grant select, insert, update, delete on public.application_document_requests to authenticated;
grant all on public.application_document_requests to service_role;

alter table public.application_document_requests enable row level security;

drop policy if exists "docreq_all_staff" on public.application_document_requests;
create policy "docreq_all_staff" on public.application_document_requests for all to authenticated
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

drop trigger if exists trg_docreq_updated_at on public.application_document_requests;
create trigger trg_docreq_updated_at before update on public.application_document_requests
  for each row execute function public.set_updated_at();

-- Timeline logging
create or replace function public.log_docreq_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, actor_email, metadata)
    values (new.application_id, 'doc_requested',
      'Document requested: ' || new.document_name,
      coalesce(new.description, '') ||
        case when new.deadline is not null then ' (due ' || new.deadline::text || ')' else '' end,
      new.requested_by, new.requested_by_email,
      jsonb_build_object('request_id', new.id, 'mandatory', new.is_mandatory));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.application_id,
      case new.status
        when 'uploaded' then 'doc_uploaded'
        when 'approved' then 'doc_approved'
        when 'rejected' then 'doc_rejected'
        else 'doc_status'
      end,
      'Document ' || new.status::text || ': ' || new.document_name,
      coalesce(new.review_notes, ''),
      auth.uid(),
      jsonb_build_object('request_id', new.id, 'from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

drop trigger if exists trg_docreq_history_ins on public.application_document_requests;
create trigger trg_docreq_history_ins after insert on public.application_document_requests
  for each row execute function public.log_docreq_change();

drop trigger if exists trg_docreq_history_upd on public.application_document_requests;
create trigger trg_docreq_history_upd after update on public.application_document_requests
  for each row execute function public.log_docreq_change();

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.application_document_requests;
exception when duplicate_object then null; when others then null; end $$;
