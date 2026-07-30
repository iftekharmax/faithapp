-- Document Requirements module
-- A catalog of documents the Application Team requires for applications.
-- Counselors see it live as a checklist.

do $$ begin
  create type public.doc_req_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.doc_req_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;

create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  instruction text,
  deadline date,
  mandatory boolean not null default true,
  priority public.doc_req_priority not null default 'normal',
  accepted_file_types text[] not null default '{}'::text[],
  max_size_mb integer not null default 10 check (max_size_mb > 0 and max_size_mb <= 500),
  version integer not null default 1,
  status public.doc_req_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_docreq_status on public.document_requirements(status);
create index if not exists idx_docreq_priority on public.document_requirements(priority);
create index if not exists idx_docreq_deadline on public.document_requirements(deadline);

grant select, insert, update, delete on public.document_requirements to authenticated;
grant all on public.document_requirements to service_role;

alter table public.document_requirements enable row level security;

drop policy if exists "docreq_read_staff" on public.document_requirements;
create policy "docreq_read_staff" on public.document_requirements for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'counselor')
    or public.has_role(auth.uid(),'application_team')
  );

drop policy if exists "docreq_write_app_team" on public.document_requirements;
create policy "docreq_write_app_team" on public.document_requirements for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_docreq_updated_at on public.document_requirements;
create trigger trg_docreq_updated_at before update on public.document_requirements
  for each row execute function public.set_updated_at();

-- Auto-bump version on meaningful changes
create or replace function public.bump_docreq_version()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and (
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.instruction is distinct from old.instruction
    or new.deadline is distinct from old.deadline
    or new.mandatory is distinct from old.mandatory
    or new.priority is distinct from old.priority
    or new.accepted_file_types is distinct from old.accepted_file_types
    or new.max_size_mb is distinct from old.max_size_mb
  ) then
    new.version := coalesce(old.version, 1) + 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_docreq_version on public.document_requirements;
create trigger trg_docreq_version before update on public.document_requirements
  for each row execute function public.bump_docreq_version();

-- Enable realtime
alter publication supabase_realtime add table public.document_requirements;
