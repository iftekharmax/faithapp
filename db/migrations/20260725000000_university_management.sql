-- University Management module
-- Hierarchy: countries -> universities -> campuses -> faculties -> programs
-- Programs carry degree, intake, deadline, tuition, scholarship, status.
-- Applications gain optional FKs to link to structured university/program data.

do $$ begin
  create type public.uni_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;

-- ============ COUNTRIES ============
create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  flag_emoji text,
  status public.uni_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_countries_status on public.countries(status);

grant select, insert, update, delete on public.countries to authenticated;
grant all on public.countries to service_role;
alter table public.countries enable row level security;

drop policy if exists "countries_read_all" on public.countries;
create policy "countries_read_all" on public.countries for select to authenticated using (true);
drop policy if exists "countries_write_admin" on public.countries;
create policy "countries_write_admin" on public.countries for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop trigger if exists trg_countries_updated_at on public.countries;
create trigger trg_countries_updated_at before update on public.countries
  for each row execute function public.set_updated_at();

-- ============ UNIVERSITIES ============
create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references public.countries(id) on delete set null,
  name text not null,
  short_name text,
  website text,
  logo_url text,
  description text,
  city text,
  status public.uni_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, name)
);
create index if not exists idx_universities_country on public.universities(country_id);
create index if not exists idx_universities_status on public.universities(status);

grant select, insert, update, delete on public.universities to authenticated;
grant all on public.universities to service_role;
alter table public.universities enable row level security;

drop policy if exists "universities_read_all" on public.universities;
create policy "universities_read_all" on public.universities for select to authenticated using (true);
drop policy if exists "universities_write_staff" on public.universities;
create policy "universities_write_staff" on public.universities for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_universities_updated_at on public.universities;
create trigger trg_universities_updated_at before update on public.universities
  for each row execute function public.set_updated_at();

-- ============ CAMPUSES ============
create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  city text,
  address text,
  is_main boolean not null default false,
  status public.uni_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, name)
);
create index if not exists idx_campuses_university on public.campuses(university_id);

grant select, insert, update, delete on public.campuses to authenticated;
grant all on public.campuses to service_role;
alter table public.campuses enable row level security;
drop policy if exists "campuses_read_all" on public.campuses;
create policy "campuses_read_all" on public.campuses for select to authenticated using (true);
drop policy if exists "campuses_write_staff" on public.campuses;
create policy "campuses_write_staff" on public.campuses for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_campuses_updated_at on public.campuses;
create trigger trg_campuses_updated_at before update on public.campuses
  for each row execute function public.set_updated_at();

-- ============ FACULTIES ============
create table if not exists public.faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  status public.uni_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, name)
);
create index if not exists idx_faculties_university on public.faculties(university_id);

grant select, insert, update, delete on public.faculties to authenticated;
grant all on public.faculties to service_role;
alter table public.faculties enable row level security;
drop policy if exists "faculties_read_all" on public.faculties;
create policy "faculties_read_all" on public.faculties for select to authenticated using (true);
drop policy if exists "faculties_write_staff" on public.faculties;
create policy "faculties_write_staff" on public.faculties for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_faculties_updated_at on public.faculties;
create trigger trg_faculties_updated_at before update on public.faculties
  for each row execute function public.set_updated_at();

-- ============ PROGRAMS ============
create table if not exists public.university_programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  faculty_id uuid references public.faculties(id) on delete set null,
  name text not null,
  degree text,
  duration text,
  intake text,
  application_deadline date,
  tuition_fee numeric(12,2),
  currency text default 'USD',
  scholarship text,
  requirements text,
  description text,
  status public.uni_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_uprograms_university on public.university_programs(university_id);
create index if not exists idx_uprograms_campus on public.university_programs(campus_id);
create index if not exists idx_uprograms_faculty on public.university_programs(faculty_id);
create index if not exists idx_uprograms_status on public.university_programs(status);

grant select, insert, update, delete on public.university_programs to authenticated;
grant all on public.university_programs to service_role;
alter table public.university_programs enable row level security;
drop policy if exists "uprograms_read_all" on public.university_programs;
create policy "uprograms_read_all" on public.university_programs for select to authenticated using (true);
drop policy if exists "uprograms_write_staff" on public.university_programs;
create policy "uprograms_write_staff" on public.university_programs for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_uprograms_updated_at on public.university_programs;
create trigger trg_uprograms_updated_at before update on public.university_programs
  for each row execute function public.set_updated_at();

-- ============ APPLICATION RELATION ============
alter table public.applications
  add column if not exists country_id uuid references public.countries(id) on delete set null,
  add column if not exists university_id uuid references public.universities(id) on delete set null,
  add column if not exists campus_id uuid references public.campuses(id) on delete set null,
  add column if not exists faculty_id uuid references public.faculties(id) on delete set null,
  add column if not exists program_id uuid references public.university_programs(id) on delete set null;

create index if not exists idx_applications_university_id on public.applications(university_id);
create index if not exists idx_applications_program_id on public.applications(program_id);

-- Storage bucket for university logos (public)
insert into storage.buckets (id, name, public)
values ('university-logos','university-logos', true)
on conflict (id) do nothing;

drop policy if exists "uni_logos_read" on storage.objects;
create policy "uni_logos_read" on storage.objects for select to public
  using (bucket_id = 'university-logos');
drop policy if exists "uni_logos_write" on storage.objects;
create policy "uni_logos_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'university-logos' and (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team')
  ));
drop policy if exists "uni_logos_update" on storage.objects;
create policy "uni_logos_update" on storage.objects for update to authenticated
  using (bucket_id = 'university-logos' and (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team')
  ));
drop policy if exists "uni_logos_delete" on storage.objects;
create policy "uni_logos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'university-logos' and (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team')
  ));
