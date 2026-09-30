-- Upgrade Tasks into a complete Internal Operations Task Management System

-- 1. Enums and Types
do $$ begin
  create type public.task_category as enum (
    'student', 'application', 'document', 'visa', 'finance', 
    'compliance', 'follow_up', 'internal', 'team', 'reminder', 'custom'
  );
exception when duplicate_object then null; end $$;

-- Extend task_priority
alter type public.task_priority add value if not exists 'critical';

-- Extend task_status
alter type public.task_status add value if not exists 'draft';
alter type public.task_status add value if not exists 'assigned';
alter type public.task_status add value if not exists 'waiting_for_student';
alter type public.task_status add value if not exists 'waiting_for_documents';
alter type public.task_status add value if not exists 'waiting_for_institution';
alter type public.task_status add value if not exists 'waiting_for_payment';
alter type public.task_status add value if not exists 'waiting_for_visa';
alter type public.task_status add value if not exists 'under_review';
alter type public.task_status add value if not exists 'cancelled';
alter type public.task_status add value if not exists 'overdue';

-- 2. Main Tasks Table Extensions
alter table public.tasks 
  add column if not exists category public.task_category not null default 'internal',
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists start_date date,
  add column if not exists reminder_date date,
  add column if not exists reminder_time time,
  add column if not exists estimated_hours numeric(10,2),
  add column if not exists actual_hours numeric(10,2),
  add column if not exists completion_percentage integer default 0 check (completion_percentage >= 0 and completion_percentage <= 100),
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;

-- 3. Multi-assignees and Followers
create table if not exists public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists public.task_followers (
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);

-- 4. Checklists
create table if not exists public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  position integer default 0,
  created_at timestamptz default now()
);

-- 5. Comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  parent_id uuid references public.task_comments(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Attachments
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  comment_id uuid references public.task_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_size integer,
  file_type text,
  created_at timestamptz default now()
);

-- 7. Workflow Templates
create table if not exists public.task_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  country_id uuid references public.countries(id) on delete set null,
  degree_level text,
  created_at timestamptz default now()
);

create table if not exists public.task_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.task_workflow_templates(id) on delete cascade,
  title text not null,
  description text,
  category public.task_category not null default 'internal',
  priority public.task_priority not null default 'normal',
  days_to_due integer default 7,
  position integer default 0
);

-- 8. Dependencies
create table if not exists public.task_dependencies (
  task_id uuid references public.tasks(id) on delete cascade,
  depends_on_task_id uuid references public.tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id)
);

-- 9. Grants
grant select, insert, update, delete on public.task_assignees to authenticated;
grant select, insert, update, delete on public.task_followers to authenticated;
grant select, insert, update, delete on public.task_checklists to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert, update, delete on public.task_attachments to authenticated;
grant select, insert, update, delete on public.task_workflow_templates to authenticated;
grant select, insert, update, delete on public.task_workflow_steps to authenticated;
grant select, insert, update, delete on public.task_dependencies to authenticated;

grant all on public.task_assignees to service_role;
grant all on public.task_followers to service_role;
grant all on public.task_checklists to service_role;
grant all on public.task_comments to service_role;
grant all on public.task_attachments to service_role;
grant all on public.task_workflow_templates to service_role;
grant all on public.task_workflow_steps to service_role;
grant all on public.task_dependencies to service_role;

-- 10. RLS
alter table public.task_assignees enable row level security;
alter table public.task_followers enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_workflow_templates enable row level security;
alter table public.task_workflow_steps enable row level security;
alter table public.task_dependencies enable row level security;

-- Simple permissive RLS for internal system (matches existing tasks logic)
create policy "task_assignees_select" on public.task_assignees for select to authenticated using (true);
create policy "task_assignees_all" on public.task_assignees for all to authenticated using (true);

create policy "task_followers_select" on public.task_followers for select to authenticated using (true);
create policy "task_followers_all" on public.task_followers for all to authenticated using (true);

create policy "task_checklists_all" on public.task_checklists for all to authenticated using (true);
create policy "task_comments_all" on public.task_comments for all to authenticated using (true);
create policy "task_attachments_all" on public.task_attachments for all to authenticated using (true);
create policy "task_workflow_templates_all" on public.task_workflow_templates for all to authenticated using (true);
create policy "task_workflow_steps_all" on public.task_workflow_steps for all to authenticated using (true);
create policy "task_dependencies_all" on public.task_dependencies for all to authenticated using (true);
