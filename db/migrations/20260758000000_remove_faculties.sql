-- Remove the Faculty entity completely: policies, triggers, indexes,
-- foreign key columns and the table itself. Safe to run multiple times.

-- 1. Drop RLS policies on faculties (no-ops if the table is already gone)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'faculties') then
    execute 'drop policy if exists "faculties_read_all" on public.faculties';
    execute 'drop policy if exists "faculties_write_staff" on public.faculties';
    execute 'drop trigger if exists trg_faculties_updated_at on public.faculties';
  end if;
end $$;

-- 2. Drop faculty foreign key columns (drops their FK constraints + indexes)
drop index if exists public.idx_uprograms_faculty;
alter table public.university_programs drop column if exists faculty_id;
alter table public.applications drop column if exists faculty_id;

-- 3. Drop supporting index and the table
drop index if exists public.idx_faculties_university;
drop table if exists public.faculties cascade;
