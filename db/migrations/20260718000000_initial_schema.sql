-- =====================================================================
-- Education Consultancy - Application Management System (initial schema)
-- =====================================================================

-- 1. Roles enum
do $$ begin
  create type public.app_role as enum ('admin', 'counselor', 'application_team', 'student');
exception when duplicate_object then null; end $$;

-- 2. Profiles table (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

-- 3. User roles table (must exist before has_role function references it)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- 4. Security-definer role check (avoids recursive RLS) — defined BEFORE any policy uses it
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

-- 5. Profiles policies
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_self"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- 6. User_roles policies
drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- 7. Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own"
  on public.notifications for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. Activity feed
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null,
  entity text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.activities to authenticated;
grant all on public.activities to service_role;

alter table public.activities enable row level security;

drop policy if exists "activities_select_own_or_admin" on public.activities;
create policy "activities_select_own_or_admin"
  on public.activities for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "activities_insert_self" on public.activities;
create policy "activities_insert_self"
  on public.activities for insert to authenticated
  with check (auth.uid() = user_id);

-- 9. Auto-create profile + default 'student' role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 10. Updated-at trigger for profiles
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();
