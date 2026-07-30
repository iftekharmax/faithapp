-- Remove Priority from applications.
-- Rewrites dependent functions, drops the index and column, then drops the enum type.

begin;

-- 1. History logger: drop priority-change branch
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

    if new.status = 'submitted' and new.submitted_at is null then
      new.submitted_at := now();
    end if;
    if new.status in ('visa_granted','visa_refused','rejected','enrolled','withdrawn')
       and new.decision_at is null then
      new.decision_at := now();
    end if;
  end if;

  return new;
end $$;

-- 2. Drop index + column
drop index if exists public.idx_applications_priority;
alter table public.applications drop column if exists priority;

-- 3. Drop the enum type (safe now that no columns reference it)
drop type if exists public.application_priority;

-- 4. Audit entry on every existing application
insert into public.application_timeline (application_id, event_type, title, description, metadata)
select id, 'system',
  'Priority field removed',
  'Per admin request, the Priority field has been removed from applications. Related history entries and filters no longer apply.',
  jsonb_build_object('change','drop_column','columns', jsonb_build_array('priority'))
from public.applications;

commit;
