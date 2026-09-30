-- Document Requirement deadline notifications
-- Sends in-app + email (via notify_user + email_outbox) when a requirement
-- is nearing its deadline or becomes overdue. Idempotent per (requirement, user, kind).

create table if not exists public.docreq_deadline_notifications (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.document_requirements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('upcoming','overdue')),
  deadline date not null,
  notified_at timestamptz not null default now(),
  unique (requirement_id, user_id, kind, deadline)
);

grant select, insert on public.docreq_deadline_notifications to authenticated;
grant all on public.docreq_deadline_notifications to service_role;

alter table public.docreq_deadline_notifications enable row level security;

drop policy if exists "docreq_notif_own" on public.docreq_deadline_notifications;
create policy "docreq_notif_own" on public.docreq_deadline_notifications for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Scan active requirements with deadlines and notify counselors/app team/admins.
-- _days_ahead: how many days before the deadline counts as "upcoming".
create or replace function public.check_docreq_deadlines(_days_ahead int default 3)
returns table (upcoming_sent int, overdue_sent int)
language plpgsql security definer set search_path = public as $$
declare
  _req record;
  _uid uuid;
  _kind text;
  _title text;
  _msg text;
  _up int := 0;
  _ov int := 0;
begin
  for _req in
    select id, name, deadline, priority, mandatory
    from public.document_requirements
    where status = 'active' and deadline is not null
  loop
    if _req.deadline < current_date then
      _kind := 'overdue';
      _title := 'Document overdue: ' || _req.name;
      _msg := 'The document "' || _req.name || '" was due on '
        || to_char(_req.deadline,'YYYY-MM-DD') || '. Please follow up.';
    elsif _req.deadline <= current_date + make_interval(days => _days_ahead) then
      _kind := 'upcoming';
      _title := 'Document deadline approaching: ' || _req.name;
      _msg := 'The document "' || _req.name || '" is due on '
        || to_char(_req.deadline,'YYYY-MM-DD') || ' ('
        || (_req.deadline - current_date) || ' day(s) left).';
    else
      continue;
    end if;

    for _uid in
      select distinct ur.user_id
      from public.user_roles ur
      where ur.role in ('admin','counselor','application_team')
    loop
      begin
        insert into public.docreq_deadline_notifications (requirement_id, user_id, kind, deadline)
        values (_req.id, _uid, _kind, _req.deadline);
      exception when unique_violation then
        continue;
      end;

      perform public.notify_user(
        _uid, _title, _msg,
        'document_requirement_deadline',
        'document_requirement', _req.id
      );

      if _kind = 'upcoming' then _up := _up + 1; else _ov := _ov + 1; end if;
    end loop;
  end loop;

  return query select _up, _ov;
end $$;

grant execute on function public.check_docreq_deadlines(int) to authenticated;
