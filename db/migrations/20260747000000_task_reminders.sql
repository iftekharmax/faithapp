-- =====================================================================
-- Task due-date reminders + quiet hours
-- =====================================================================

alter table public.tasks
  add column if not exists reminder_hours_before integer not null default 24,
  add column if not exists reminded_at timestamptz;

create index if not exists tasks_reminder_scan_idx
  on public.tasks (due_date) where reminded_at is null and status <> 'done';

-- Runs due-date reminder scan for the calling user (or every assignee if admin).
-- Respects notification_prefs.quietHours (JSON: { enabled, start:"HH:MM", end:"HH:MM" }).
-- Emits in-app notifications (via notify_user, which also writes to email_outbox
-- when the user's notification_prefs.email is true).
create or replace function public.run_task_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _row record;
  _fired int := 0;
  _prefs jsonb;
  _email_on boolean;
  _quiet jsonb;
  _now timestamptz := now();
  _local_time text;
  _q_start text;
  _q_end text;
  _in_quiet boolean;
begin
  for _row in
    select t.id, t.title, t.due_date, t.assignee_id, t.reminder_hours_before,
           t.application_id, t.student_id, p.notification_prefs, p.timezone
      from public.tasks t
      join public.profiles p on p.id = t.assignee_id
     where t.reminded_at is null
       and t.status <> 'done'
       and t.due_date is not null
       and t.assignee_id is not null
       and (t.due_date::timestamptz - _now) <= make_interval(hours => t.reminder_hours_before)
       and (t.due_date::timestamptz - _now) >= interval '-2 days'
  loop
    _prefs := coalesce(_row.notification_prefs, '{}'::jsonb);
    -- In-app must be on to receive reminder at all
    if coalesce((_prefs->>'inApp')::boolean, true) is false then
      -- Still stamp so we don't rescan constantly
      update public.tasks set reminded_at = _now where id = _row.id;
      continue;
    end if;

    _quiet := _prefs->'quietHours';
    _in_quiet := false;
    if coalesce((_quiet->>'enabled')::boolean, false) then
      _local_time := to_char((_now at time zone coalesce(_row.timezone,'UTC')), 'HH24:MI');
      _q_start := coalesce(_quiet->>'start','22:00');
      _q_end := coalesce(_quiet->>'end','07:00');
      if _q_start < _q_end then
        _in_quiet := _local_time >= _q_start and _local_time < _q_end;
      else
        _in_quiet := _local_time >= _q_start or _local_time < _q_end;
      end if;
    end if;

    if _in_quiet then
      -- Skip, retry next scan (do NOT stamp reminded_at)
      continue;
    end if;

    perform public.notify_user(
      _row.assignee_id,
      'Task due soon: ' || _row.title,
      'This task is due on ' || to_char(_row.due_date, 'YYYY-MM-DD') || '.',
      'task_reminder',
      'task',
      _row.id
    );

    -- If user's email pref is off, remove queued email
    _email_on := coalesce((_prefs->>'email')::boolean, true);
    if not _email_on then
      delete from public.email_outbox
       where related_entity = 'task' and related_id = _row.id and status = 'pending';
    end if;

    update public.tasks set reminded_at = _now where id = _row.id;
    _fired := _fired + 1;
  end loop;

  return _fired;
end $$;

grant execute on function public.run_task_reminders() to authenticated;
