-- Improve doc-request timeline logging + enforce valid status transitions.

-- 1) Better event_type mapping for status changes (including 'required'/'pending').
create or replace function public.log_docreq_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event_type text;
  v_title text;
begin
  if tg_op = 'INSERT' then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, actor_email, metadata)
    values (new.application_id, 'doc_requested',
      'Document requested: ' || new.document_name,
      coalesce(new.description, '') ||
        case when new.deadline is not null then ' (due ' || new.deadline::text || ')' else '' end,
      new.requested_by, new.requested_by_email,
      jsonb_build_object('request_id', new.id, 'mandatory', new.is_mandatory,
                        'to', new.status::text));
    return new;
  end if;

  if new.status is distinct from old.status then
    v_event_type := case new.status::text
      when 'pending'      then case when old.status::text = 'required' then 'doc_uploaded' else 'doc_status' end
      when 'under_review' then 'doc_status'
      when 'hold'         then 'doc_status'
      when 'approved'     then 'doc_approved'
      when 'rejected'     then 'doc_rejected'
      when 'uploaded'     then 'doc_uploaded'
      when 'required'     then 'doc_status'
      else 'doc_status'
    end;

    v_title := case
      when v_event_type = 'doc_uploaded' and old.status::text = 'required'
        then 'Document uploaded: ' || new.document_name
      else 'Document ' || new.status::text || ': ' || new.document_name
    end;

    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.application_id, v_event_type, v_title,
      coalesce(new.review_notes, ''),
      auth.uid(),
      jsonb_build_object('request_id', new.id, 'from', old.status::text, 'to', new.status::text));
  end if;
  return new;
end $$;

-- 2) Enforce valid transitions at the DB level.
--    Rules:
--      - 'approved' is terminal (no changes back except by admin path — allow app_team to move only via explicit re-request).
--      - Uploads (file_path change) may transition 'required' -> 'pending' only.
--      - Team-driven status changes are allowed between {required, pending, under_review, hold, rejected, approved}.
create or replace function public.validate_docreq_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    -- Block resurrecting an approved request via a status flip.
    if old.status::text = 'approved' and new.status::text <> 'approved' then
      raise exception 'Cannot change status of an approved document request';
    end if;

    -- If this update also fulfills a file (upload), the only valid status
    -- transition triggered by upload is required -> pending.
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
