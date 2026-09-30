-- =====================================================================
-- Extend profiles with rich fields + Tasks module
-- =====================================================================

-- 1. Profile extensions
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists notification_prefs jsonb not null default '{"email":true,"inApp":true,"sound":true}'::jsonb;

-- 2. Tasks
do $$ begin
  create type public.task_status as enum ('todo','in_progress','blocked','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  due_date date,
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_due_idx on public.tasks (due_date);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'counselor')
    or public.has_role(auth.uid(),'application_team')
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  );

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'counselor')
    or public.has_role(auth.uid(),'application_team')
  );

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'counselor')
    or public.has_role(auth.uid(),'application_team')
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  )
  with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'counselor')
    or public.has_role(auth.uid(),'application_team')
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  );

drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or created_by = auth.uid()
  );

-- Auto-update updated_at + completed_at
create or replace function public.tasks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_touch_trg on public.tasks;
create trigger tasks_touch_trg
  before update on public.tasks
  for each row execute function public.tasks_touch();
