-- Student Management module

-- Enums
do $$ begin
  create type public.student_status as enum ('prospect', 'active', 'inactive', 'archived', 'enrolled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_gender as enum ('male', 'female', 'other', 'prefer_not_to_say');
exception when duplicate_object then null; end $$;

-- Students table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text unique not null default ('STU-' || to_char(now(), 'YYMM') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  full_name text not null,
  passport_no text,
  passport_expiry date,
  date_of_birth date,
  gender public.student_gender,
  nationality text,
  phone text,
  email text,
  guardian_name text,
  guardian_phone text,
  guardian_relation text,
  emergency_contact_name text,
  emergency_contact_phone text,
  current_address text,
  permanent_address text,
  academic_history jsonb not null default '[]'::jsonb,
  english_test_type text,
  english_test_score text,
  english_test_date date,
  photo_url text,
  status public.student_status not null default 'prospect',
  notes text,
  assigned_counselor_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_status on public.students(status);
create index if not exists idx_students_full_name on public.students(full_name);
create index if not exists idx_students_email on public.students(email);
create index if not exists idx_students_nationality on public.students(nationality);
create index if not exists idx_students_assigned on public.students(assigned_counselor_id);

grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;

alter table public.students enable row level security;

drop policy if exists "students_select_staff" on public.students;
create policy "students_select_staff" on public.students for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "students_write_staff" on public.students;
create policy "students_write_staff" on public.students for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "students_update_staff" on public.students;
create policy "students_update_staff" on public.students for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "students_delete_admin" on public.students;
create policy "students_delete_admin" on public.students for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

-- Documents
create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  name text not null,
  category text,
  file_url text not null,
  file_path text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_student_documents_student on public.student_documents(student_id);

grant select, insert, update, delete on public.student_documents to authenticated;
grant all on public.student_documents to service_role;
alter table public.student_documents enable row level security;

drop policy if exists "student_docs_all_staff" on public.student_documents;
create policy "student_docs_all_staff" on public.student_documents for all to authenticated
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

-- Timeline
create table if not exists public.student_timeline (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null, -- 'note','status_change','document','profile_update','contact','custom'
  title text not null,
  description text,
  metadata jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_student_timeline_student on public.student_timeline(student_id, created_at desc);

grant select, insert, update, delete on public.student_timeline to authenticated;
grant all on public.student_timeline to service_role;
alter table public.student_timeline enable row level security;

drop policy if exists "student_timeline_all_staff" on public.student_timeline;
create policy "student_timeline_all_staff" on public.student_timeline for all to authenticated
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

-- Auto-timeline on student status changes
create or replace function public.log_student_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_timeline (student_id, event_type, title, description, actor_id)
    values (new.id, 'created', 'Student created', 'Profile created with status ' || new.status::text, new.created_by);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.student_timeline (student_id, event_type, title, description, actor_id)
    values (new.id, 'status_change', 'Status changed', old.status::text || ' → ' || new.status::text, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_students_timeline on public.students;
create trigger trg_students_timeline after insert or update on public.students
  for each row execute function public.log_student_status_change();

-- Storage buckets: student photos (public) and documents (private)
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do nothing;

drop policy if exists "student_photos_read" on storage.objects;
create policy "student_photos_read" on storage.objects for select
  using (bucket_id = 'student-photos');

drop policy if exists "student_photos_write" on storage.objects;
create policy "student_photos_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-photos');

drop policy if exists "student_photos_update" on storage.objects;
create policy "student_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'student-photos');

drop policy if exists "student_photos_delete" on storage.objects;
create policy "student_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos');

drop policy if exists "student_docs_read" on storage.objects;
create policy "student_docs_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'student-documents'
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'counselor')
      or public.has_role(auth.uid(), 'application_team')
    )
  );

drop policy if exists "student_docs_write" on storage.objects;
create policy "student_docs_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-documents'
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'counselor')
      or public.has_role(auth.uid(), 'application_team')
    )
  );

drop policy if exists "student_docs_delete" on storage.objects;
create policy "student_docs_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-documents'
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'counselor')
      or public.has_role(auth.uid(), 'application_team')
    )
  );
