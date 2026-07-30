-- Application notifications, email outbox, and status transition validation

-- ============================================================
-- 1. Email outbox (rows are picked up by an external worker / edge fn)
-- ============================================================
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  to_user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  body text not null,
  html text,
  category text,
  related_entity text,
  related_id uuid,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_outbox_pending on public.email_outbox(status, created_at) where status = 'pending';

grant select, insert, update, delete on public.email_outbox to authenticated;
grant all on public.email_outbox to service_role;
alter table public.email_outbox enable row level security;

drop policy if exists "email_outbox_admin" on public.email_outbox;
create policy "email_outbox_admin" on public.email_outbox for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. Helper: enqueue in-app notification + email for a user
-- ============================================================
create or replace function public.notify_user(
  _user_id uuid,
  _title text,
  _message text,
  _category text default null,
  _entity text default null,
  _entity_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  _email text;
begin
  if _user_id is null then return; end if;

  insert into public.notifications (user_id, title, message)
  values (_user_id, _title, _message);

  select email into _email from auth.users where id = _user_id;
  if _email is not null then
    insert into public.email_outbox (to_email, to_user_id, subject, body, category, related_entity, related_id)
    values (_email, _user_id, _title, coalesce(_message, _title), _category, _entity, _entity_id);
  end if;
end $$;

-- ============================================================
-- 3. Application status transition validation
-- ============================================================
create or replace function public.is_valid_application_transition(_from public.application_status, _to public.application_status)
returns boolean language sql immutable as $$
  select case
    when _from = _to then true
    when _from = 'draft' then _to in ('submitted','withdrawn')
    when _from = 'submitted' then _to in ('under_review','withdrawn','rejected')
    when _from = 'under_review' then _to in ('offer_received','conditional_offer','unconditional_offer','rejected','withdrawn')
    when _from = 'offer_received' then _to in ('conditional_offer','unconditional_offer','rejected','withdrawn')
    when _from = 'conditional_offer' then _to in ('unconditional_offer','deposit_paid','rejected','withdrawn')
    when _from = 'unconditional_offer' then _to in ('deposit_paid','rejected','withdrawn')
    when _from = 'deposit_paid' then _to in ('cas_issued','withdrawn')
    when _from = 'cas_issued' then _to in ('visa_applied','withdrawn')
    when _from = 'visa_applied' then _to in ('visa_granted','visa_refused','withdrawn')
    when _from = 'visa_refused' then _to in ('visa_applied','withdrawn')
    when _from = 'visa_granted' then _to in ('enrolled','withdrawn')
    when _from in ('enrolled','withdrawn','rejected') then false
    else false
  end
$$;

create or replace function public.validate_application_update()
returns trigger language plpgsql as $$
begin
  -- Required fields (defensive; DB already NOT NULL)
  if new.university is null or btrim(new.university) = '' then
    raise exception 'University is required' using errcode = '23514';
  end if;
  if new.program is null or btrim(new.program) = '' then
    raise exception 'Program is required' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Admin can override any transition
    if not public.has_role(auth.uid(), 'admin') then
      if not public.is_valid_application_transition(old.status, new.status) then
        raise exception 'Invalid status transition: % -> %', old.status, new.status
          using errcode = '22023';
      end if;
    end if;

    -- Required decision-context fields
    if new.status in ('visa_refused','rejected','withdrawn') then
      if new.notes is null or btrim(new.notes) = '' then
        raise exception 'Notes are required when marking application as %', new.status
          using errcode = '23514';
      end if;
    end if;

    if new.status in ('deposit_paid','cas_issued','visa_applied','visa_granted','enrolled') then
      if new.assigned_officer_id is null then
        raise exception 'Assigned Application Officer is required for status %', new.status
          using errcode = '23514';
      end if;
    end if;

    if new.status in ('submitted','under_review','offer_received','conditional_offer','unconditional_offer') then
      if new.assigned_counselor_id is null then
        raise exception 'Assigned Counselor is required for status %', new.status
          using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_applications_validate on public.applications;
create trigger trg_applications_validate before insert or update on public.applications
  for each row execute function public.validate_application_update();

-- ============================================================
-- 4. Notification triggers for applications (assignment / status change)
-- ============================================================
create or replace function public.notify_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _student_name text;
  _actor uuid := auth.uid();
begin
  select full_name into _student_name from public.students where id = new.student_id;

  if tg_op = 'INSERT' then
    if new.assigned_counselor_id is not null and new.assigned_counselor_id <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.notify_user(
        new.assigned_counselor_id,
        'Assigned as Counselor: ' || new.application_code,
        'You have been assigned as counselor for ' || coalesce(_student_name,'a student') || ' — ' || new.university,
        'application_assignment','application',new.id);
    end if;
    if new.assigned_officer_id is not null and new.assigned_officer_id <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.notify_user(
        new.assigned_officer_id,
        'Assigned as Application Officer: ' || new.application_code,
        'You have been assigned as application officer for ' || coalesce(_student_name,'a student') || ' — ' || new.university,
        'application_assignment','application',new.id);
    end if;
    return new;
  end if;

  -- Assignment changes
  if new.assigned_counselor_id is distinct from old.assigned_counselor_id and new.assigned_counselor_id is not null then
    perform public.notify_user(new.assigned_counselor_id,
      'Assigned as Counselor: ' || new.application_code,
      'You have been assigned as counselor for ' || coalesce(_student_name,'a student') || ' — ' || new.university,
      'application_assignment','application',new.id);
  end if;
  if new.assigned_officer_id is distinct from old.assigned_officer_id and new.assigned_officer_id is not null then
    perform public.notify_user(new.assigned_officer_id,
      'Assigned as Application Officer: ' || new.application_code,
      'You have been assigned as application officer for ' || coalesce(_student_name,'a student') || ' — ' || new.university,
      'application_assignment','application',new.id);
  end if;

  -- Status change: notify both assigned staff (except actor)
  if new.status is distinct from old.status then
    if new.assigned_counselor_id is not null and new.assigned_counselor_id <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.notify_user(new.assigned_counselor_id,
        'Status: ' || new.application_code || ' → ' || new.status::text,
        coalesce(_student_name,'A student') || ' — ' || new.university || ' status changed from ' || old.status::text || ' to ' || new.status::text,
        'application_status','application',new.id);
    end if;
    if new.assigned_officer_id is not null and new.assigned_officer_id <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid)
       and new.assigned_officer_id is distinct from new.assigned_counselor_id then
      perform public.notify_user(new.assigned_officer_id,
        'Status: ' || new.application_code || ' → ' || new.status::text,
        coalesce(_student_name,'A student') || ' — ' || new.university || ' status changed from ' || old.status::text || ' to ' || new.status::text,
        'application_status','application',new.id);
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_applications_notify_ins on public.applications;
create trigger trg_applications_notify_ins after insert on public.applications
  for each row execute function public.notify_application_change();

drop trigger if exists trg_applications_notify_upd on public.applications;
create trigger trg_applications_notify_upd after update on public.applications
  for each row execute function public.notify_application_change();

-- ============================================================
-- 5. Notification trigger for new timeline events
-- ============================================================
create or replace function public.notify_application_timeline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _app public.applications%rowtype;
  _student_name text;
  _actor uuid := coalesce(new.actor_id, auth.uid());
begin
  -- Skip auto-generated system events (they are covered by the app change trigger)
  if new.event_type in ('created','status_change','assignment','priority_change') then
    return new;
  end if;

  select * into _app from public.applications where id = new.application_id;
  if not found then return new; end if;
  select full_name into _student_name from public.students where id = _app.student_id;

  if _app.assigned_counselor_id is not null and _app.assigned_counselor_id <> coalesce(_actor,'00000000-0000-0000-0000-000000000000'::uuid) then
    perform public.notify_user(_app.assigned_counselor_id,
      'Update on ' || _app.application_code || ': ' || new.title,
      coalesce(new.description, '') || E'\n\nStudent: ' || coalesce(_student_name,'') || ' — ' || _app.university,
      'application_timeline','application', _app.id);
  end if;
  if _app.assigned_officer_id is not null and _app.assigned_officer_id <> coalesce(_actor,'00000000-0000-0000-0000-000000000000'::uuid)
     and _app.assigned_officer_id is distinct from _app.assigned_counselor_id then
    perform public.notify_user(_app.assigned_officer_id,
      'Update on ' || _app.application_code || ': ' || new.title,
      coalesce(new.description, '') || E'\n\nStudent: ' || coalesce(_student_name,'') || ' — ' || _app.university,
      'application_timeline','application', _app.id);
  end if;

  return new;
end $$;

drop trigger if exists trg_app_timeline_notify on public.application_timeline;
create trigger trg_app_timeline_notify after insert on public.application_timeline
  for each row execute function public.notify_application_timeline();
