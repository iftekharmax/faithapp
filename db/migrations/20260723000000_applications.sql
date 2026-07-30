-- Application Management module

do $$ begin
  create type public.application_status as enum (
    'draft','submitted','under_review','offer_received','conditional_offer',
    'unconditional_offer','deposit_paid','cas_issued','visa_applied',
    'visa_granted','visa_refused','enrolled','withdrawn','rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  application_code text unique not null default ('APP-' || to_char(now(), 'YYMM') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  student_id uuid not null references public.students(id) on delete cascade,
  country text,
  university text not null,
  campus text,
  program text not null,
  degree text,
  intake text,
  scholarship text,
  application_fee numeric(12,2),
  priority public.application_priority not null default 'normal',
  status public.application_status not null default 'draft',
  assigned_counselor_id uuid references auth.users(id) on delete set null,
  assigned_officer_id uuid references auth.users(id) on delete set null,
  notes text,
  submitted_at timestamptz,
  decision_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applications_student on public.applications(student_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_priority on public.applications(priority);
create index if not exists idx_applications_counselor on public.applications(assigned_counselor_id);
create index if not exists idx_applications_officer on public.applications(assigned_officer_id);
create index if not exists idx_applications_country on public.applications(country);
create index if not exists idx_applications_university on public.applications(university);

grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;

alter table public.applications enable row level security;

drop policy if exists "applications_select_staff" on public.applications;
create policy "applications_select_staff" on public.applications for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "applications_insert_staff" on public.applications;
create policy "applications_insert_staff" on public.applications for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "applications_update_staff" on public.applications;
create policy "applications_update_staff" on public.applications for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "applications_delete_admin" on public.applications;
create policy "applications_delete_admin" on public.applications for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- Timeline / history
create table if not exists public.application_timeline (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_timeline_app on public.application_timeline(application_id, created_at desc);

grant select, insert, update, delete on public.application_timeline to authenticated;
grant all on public.application_timeline to service_role;
alter table public.application_timeline enable row level security;

drop policy if exists "app_timeline_all_staff" on public.application_timeline;
create policy "app_timeline_all_staff" on public.application_timeline for all to authenticated
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

-- Attachments
create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  name text not null,
  category text,
  file_url text not null,
  file_path text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_docs_app on public.application_documents(application_id);

grant select, insert, update, delete on public.application_documents to authenticated;
grant all on public.application_documents to service_role;
alter table public.application_documents enable row level security;

drop policy if exists "app_docs_all_staff" on public.application_documents;
create policy "app_docs_all_staff" on public.application_documents for all to authenticated
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

-- Storage bucket for application attachments (private)
insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do nothing;

drop policy if exists "app_docs_storage_read" on storage.objects;
create policy "app_docs_storage_read" on storage.objects for select to authenticated
  using (bucket_id = 'application-documents' and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  ));

drop policy if exists "app_docs_storage_write" on storage.objects;
create policy "app_docs_storage_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-documents' and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  ));

drop policy if exists "app_docs_storage_delete" on storage.objects;
create policy "app_docs_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'application-documents' and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  ));

-- Auto status tracking + create/assign events
create or replace function public.log_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id)
    values (new.id, 'created', 'Application created',
      new.university || coalesce(' — ' || new.program, '') || ' (' || new.status::text || ')',
      new.created_by);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.id, 'status_change', 'Status changed',
      old.status::text || ' → ' || new.status::text, auth.uid(),
      jsonb_build_object('from', old.status, 'to', new.status));

    -- Stamp submitted/decision timestamps automatically
    if new.status = 'submitted' and new.submitted_at is null then
      new.submitted_at := now();
    end if;
    if new.status in ('visa_granted','visa_refused','rejected','enrolled','withdrawn')
       and new.decision_at is null then
      new.decision_at := now();
    end if;
  end if;

  if new.assigned_counselor_id is distinct from old.assigned_counselor_id then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.id, 'assignment', 'Counselor reassigned',
      coalesce(old.assigned_counselor_id::text,'—') || ' → ' || coalesce(new.assigned_counselor_id::text,'—'),
      auth.uid(), jsonb_build_object('field','counselor','from',old.assigned_counselor_id,'to',new.assigned_counselor_id));
  end if;

  if new.assigned_officer_id is distinct from old.assigned_officer_id then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.id, 'assignment', 'Officer reassigned',
      coalesce(old.assigned_officer_id::text,'—') || ' → ' || coalesce(new.assigned_officer_id::text,'—'),
      auth.uid(), jsonb_build_object('field','officer','from',old.assigned_officer_id,'to',new.assigned_officer_id));
  end if;

  if new.priority is distinct from old.priority then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.id, 'priority_change', 'Priority changed',
      old.priority::text || ' → ' || new.priority::text, auth.uid(),
      jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  return new;
end $$;

drop trigger if exists trg_applications_history_ins on public.applications;
create trigger trg_applications_history_ins after insert on public.applications
  for each row execute function public.log_application_change();

drop trigger if exists trg_applications_history_upd on public.applications;
create trigger trg_applications_history_upd before update on public.applications
  for each row execute function public.log_application_change();
