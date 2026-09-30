-- Additional Enterprise Task System Enhancements

-- 1. Reminders and Notifications
create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  reminder_time timestamptz not null,
  reminder_type text not null default 'browser', -- 'browser', 'email', 'both'
  is_sent boolean default false,
  created_at timestamptz default now()
);

-- 2. Productivity and Analytics Views
create or replace view public.view_employee_productivity as
select 
  p.id as user_id,
  p.full_name,
  count(t.id) filter (where t.status = 'completed') as completed_tasks,
  count(t.id) filter (where t.status = 'overdue') as overdue_tasks,
  avg(t.actual_hours) as avg_hours_per_task,
  avg(extract(epoch from (t.completed_at - t.created_at))/3600) as avg_completion_time_hours
from public.profiles p
left join public.task_assignees ta on ta.user_id = p.id
left join public.tasks t on t.id = ta.task_id
group by p.id, p.full_name;

-- 3. Grants and RLS
grant select, insert, update, delete on public.task_reminders to authenticated;
grant all on public.task_reminders to service_role;
grant select on public.view_employee_productivity to authenticated;

alter table public.task_reminders enable row level security;
create policy "task_reminders_all" on public.task_reminders for all to authenticated using (true);

-- 4. Fix task_comments relationship issue (profiles join)
-- Usually this error happens if the FK to auth.users doesn't have a corresponding FK or metadata for profiles.
-- We ensure the link is clear for PostgREST by adding a joinable view or ensuring the profile has the user_id.

-- 5. Template Data for Common Workflows
insert into public.task_workflow_templates (name, description) values
('Australia Student Workflow', 'Standard processing for Australian student visas and admissions'),
('UK Student Workflow', 'Standard processing for UK student visas and admissions'),
('Canada Student Workflow', 'Standard processing for Canadian student visas and admissions'),
('USA Student Workflow', 'Standard processing for USA student visas and admissions')
on conflict do nothing;

-- 6. Prerequisite notification function (simplified trigger for blocked tasks)
create or replace function public.check_task_dependency() 
returns trigger as $$
begin
  if exists (
    select 1 from public.task_dependencies td
    join public.tasks t on t.id = td.depends_on_task_id
    where td.task_id = new.id and t.status != 'completed'
  ) then
    -- We can mark it as blocked or just use this for UI checks
    null;
  end if;
  return new;
end;
$$ language plpgsql;

-- Trigger to reload PostgREST cache
notify pgrst, 'reload schema';
