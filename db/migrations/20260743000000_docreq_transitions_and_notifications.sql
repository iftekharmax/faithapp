-- Document request: explicit allowed-transitions + in-app notifications
-- to application_team on upload (required → pending) and to counselors on
-- team status changes (under_review/hold/rejected/approved).

-- 1) Allowed transitions matrix.
create or replace function public.is_valid_docreq_transition(_from text, _to text)
returns boolean language sql immutable as $$
  select case
    when _from = _to then true
    when _from = 'required'     then _to in ('pending','hold','rejected')
    when _from = 'pending'      then _to in ('under_review','hold','rejected','approved','required')
    when _from = 'under_review' then _to in ('hold','rejected','approved','pending')
    when _from = 'hold'         then _to in ('pending','under_review','rejected','approved','required')
    when _from = 'rejected'     then _to in ('required','pending','under_review')
    when _from = 'approved'     then false
    when _from = 'uploaded'     then _to in ('under_review','hold','rejected','approved','pending')
    else false
  end
$$;

-- 2) Replace transition guard to use the matrix.
create or replace function public.validate_docreq_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not public.is_valid_docreq_transition(old.status::text, new.status::text) then
      raise exception 'Invalid status transition: % → %', old.status::text, new.status::text
        using errcode = '23514';
    end if;

    -- Require a note when moving to hold or rejected.
    if new.status::text in ('hold','rejected')
       and (new.review_notes is null or btrim(new.review_notes) = '') then
      raise exception 'A reason note is required when moving a document request to %', new.status::text
        using errcode = '23514';
    end if;

    -- If the update is a counselor upload (file_path changed to non-null),
    -- the only permitted status move is required -> pending.
    if new.file_path is distinct from old.file_path
       and new.file_path is not null
       and old.status::text = 'required'
       and new.status::text <> 'pending' then
      raise exception 'Counselor upload can only move status from required to pending';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_docreq_validate_transition on public.application_document_requests;
create trigger trg_docreq_validate_transition
  before update on public.application_document_requests
  for each row execute function public.validate_docreq_transition();

-- 3) Notification fan-out on doc request status change.
create or replace function public.notify_docreq_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _app_code text;
  _title text;
  _msg text;
  _rec record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select application_code into _app_code from public.applications where id = new.application_id;

  -- Counselor upload: notify application_team + admin.
  if old.status::text = 'required' and new.status::text = 'pending' then
    _title := 'Document uploaded: ' || new.document_name;
    _msg := coalesce(_app_code || ' · ', '')
      || 'Counselor uploaded a document. Please review.';
    for _rec in
      select user_id from public.user_roles
      where role in ('application_team','admin')
    loop
      perform public.notify_user(_rec.user_id, _title, _msg,
        'document_request', 'application_document_requests', new.id);
    end loop;
    return new;
  end if;

  -- Team-driven review actions: notify the counselor who owns the app +
  -- the specific user who requested the document (if a counselor).
  if new.status::text in ('under_review','hold','rejected','approved') then
    _title := 'Document ' || new.status::text || ': ' || new.document_name;
    _msg := coalesce(_app_code || ' · ', '')
      || case new.status::text
           when 'approved' then 'Your uploaded document was approved.'
           when 'rejected' then 'Your uploaded document was rejected.'
           when 'hold'     then 'Your uploaded document is on hold.'
           else 'Your uploaded document is now under review.'
         end
      || case
           when new.review_notes is not null and btrim(new.review_notes) <> ''
             then E'\nNote: ' || new.review_notes
           else ''
         end;

    -- Fan-out to all counselors (small team app).
    for _rec in
      select user_id from public.user_roles where role = 'counselor'
    loop
      perform public.notify_user(_rec.user_id, _title, _msg,
        'document_request', 'application_document_requests', new.id);
    end loop;
  end if;

  return new;
end $$;

drop trigger if exists trg_docreq_notify_status on public.application_document_requests;
create trigger trg_docreq_notify_status
  after update on public.application_document_requests
  for each row execute function public.notify_docreq_status_change();
