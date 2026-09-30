-- =====================================================================
-- User Management module (extends initial schema)
-- =====================================================================

-- 1. Extend profiles with department, status, lock & last-login tracking
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists is_locked boolean not null default false;
alter table public.profiles add column if not exists last_login_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_status_chk
    check (status in ('active','inactive'));
exception when duplicate_object then null; end $$;

-- 2. Admin write access to profiles (view/list already covered by existing SELECT policy)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- 3. Admin management of user_roles
grant insert, update, delete on public.user_roles to authenticated;

drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_admin_update" on public.user_roles;
create policy "user_roles_admin_update" on public.user_roles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- 4. Permissions table (role -> permission key)
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission text not null,
  created_at timestamptz not null default now(),
  unique (role, permission)
);

grant select on public.role_permissions to authenticated;
grant insert, update, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select_all" on public.role_permissions;
create policy "role_permissions_select_all" on public.role_permissions for select to authenticated
  using (true);

drop policy if exists "role_permissions_admin_write" on public.role_permissions;
create policy "role_permissions_admin_write" on public.role_permissions for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed default permissions (idempotent)
insert into public.role_permissions (role, permission) values
  ('admin','users.manage'),
  ('admin','roles.manage'),
  ('admin','permissions.manage'),
  ('admin','applications.manage'),
  ('admin','students.manage'),
  ('admin','programs.manage'),
  ('admin','tasks.manage'),
  ('admin','reports.view'),
  ('counselor','students.view'),
  ('counselor','students.edit'),
  ('counselor','applications.view'),
  ('counselor','applications.edit'),
  ('counselor','tasks.manage'),
  ('counselor','programs.view'),
  ('application_team','applications.view'),
  ('application_team','applications.edit'),
  ('application_team','tasks.view'),
  ('student','applications.view.own'),
  ('student','programs.view'),
  ('student','profile.edit.own')
on conflict (role, permission) do nothing;

-- 5. Audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_user_id);

grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select" on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or actor_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists "audit_logs_insert_self" on public.audit_logs;
create policy "audit_logs_insert_self" on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());

-- 6. Admin-callable helper: record last login (invoked from client after signIn)
create or replace function public.record_login(_user_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.profiles set last_login_at = now() where id = _user_id;
$$;

grant execute on function public.record_login(uuid) to authenticated;

-- 7. Admin-only user list (joins profiles + roles into one view for the UI)
create or replace view public.admin_users_view as
select
  p.id,
  p.email,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.department,
  p.status,
  p.is_locked,
  p.last_login_at,
  p.created_at,
  coalesce(
    (select array_agg(ur.role::text order by ur.role::text)
       from public.user_roles ur where ur.user_id = p.id),
    array[]::text[]
  ) as roles
from public.profiles p;

grant select on public.admin_users_view to authenticated;

-- 8. Avatars storage bucket (public) — safe if it already exists
insert into storage.buckets (id, name, public)
values ('avatars','avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_write" on storage.objects;
create policy "avatars_auth_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');
