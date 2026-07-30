-- Remove Assigned Counselor / Assigned Officer from applications.
-- Rewrites all dependent functions to omit those columns, then drops the columns.

begin;

-- 1. History logger: drop assignment history branches
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

  if new.priority is distinct from old.priority then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.id, 'priority_change', 'Priority changed',
      old.priority::text || ' → ' || new.priority::text, auth.uid(),
      jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  return new;
end $$;

-- 2. Validation: drop assignee-required checks
create or replace function public.validate_application_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if not public.has_role(auth.uid(), 'admin') then
      if not public.is_valid_application_transition(old.status, new.status) then
        raise exception 'Invalid status transition: % -> %', old.status, new.status
          using errcode = '22023';
      end if;
    end if;

    if new.status in ('visa_refused','rejected','withdrawn') then
      if new.notes is null or btrim(new.notes) = '' then
        raise exception 'Notes are required when marking application as %', new.status
          using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

-- 3. Assignment/status notification trigger: only status-change notifications remain.
--    Without assignees there's no one specific to notify; keep the function as a no-op
--    so the trigger remains valid.
create or replace function public.notify_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  return new;
end $$;

-- 4. Timeline notification trigger: drop counselor/officer notify branches
create or replace function public.notify_application_timeline()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Assignees removed; timeline notifications now handled via other channels (chat).
  return new;
end $$;

-- 5. Chat: application conversation now only auto-adds creator + admins
create or replace function public.get_or_create_application_conversation(_app uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _me uuid := auth.uid();
  _cid uuid;
  _title text;
  _admin uuid;
begin
  if _me is null then raise exception 'unauthenticated'; end if;

  select id into _cid from public.conversations where application_id = _app limit 1;
  if _cid is not null then
    if not public.is_conversation_member(_cid, _me) then
      if public.has_role(_me, 'admin') then
        insert into public.conversation_members (conversation_id, user_id) values (_cid, _me)
          on conflict do nothing;
      end if;
    end if;
    return _cid;
  end if;

  select coalesce(a.application_code || ' — ' || a.university, 'Application')
    into _title
    from public.applications a where a.id = _app;

  if _title is null then raise exception 'application not found'; end if;

  insert into public.conversations (type, application_id, title, created_by)
  values ('application', _app, _title, _me) returning id into _cid;

  insert into public.conversation_members (conversation_id, user_id, role) values (_cid, _me, 'owner')
    on conflict do nothing;

  for _admin in select user_id from public.user_roles where role = 'admin' loop
    insert into public.conversation_members (conversation_id, user_id) values (_cid, _admin)
      on conflict do nothing;
  end loop;

  return _cid;
end $$;

-- 6. Drop indexes + columns
drop index if exists public.idx_applications_counselor;
drop index if exists public.idx_applications_officer;

alter table public.applications drop column if exists assigned_counselor_id;
alter table public.applications drop column if exists assigned_officer_id;

-- 7. Audit entry on every existing application
insert into public.application_timeline (application_id, event_type, title, description, metadata)
select id, 'system',
  'Assigned Counselor & Officer fields removed',
  'Per admin request, the Assigned Counselor and Assigned Application Officer fields have been removed from applications. Related status validation and assignment notifications no longer apply.',
  jsonb_build_object('change','drop_columns','columns', jsonb_build_array('assigned_counselor_id','assigned_officer_id'))
from public.applications;

commit;
