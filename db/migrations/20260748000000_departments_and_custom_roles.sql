-- Departments + custom role templates
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

grant select on public.departments to authenticated;
grant insert, update, delete on public.departments to authenticated;
grant all on public.departments to service_role;

alter table public.departments enable row level security;

drop policy if exists "departments_select_all" on public.departments;
create policy "departments_select_all" on public.departments for select to authenticated using (true);

drop policy if exists "departments_admin_write" on public.departments;
create policy "departments_admin_write" on public.departments for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Custom role templates (named permission bundles). Does not extend app_role enum.
create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

grant select on public.custom_roles to authenticated;
grant insert, update, delete on public.custom_roles to authenticated;
grant all on public.custom_roles to service_role;

alter table public.custom_roles enable row level security;

drop policy if exists "custom_roles_select_all" on public.custom_roles;
create policy "custom_roles_select_all" on public.custom_roles for select to authenticated using (true);

drop policy if exists "custom_roles_admin_write" on public.custom_roles;
create policy "custom_roles_admin_write" on public.custom_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
