-- Audit + cleanup after Requirement Checklist module removal.
-- Idempotent: safe to re-run.

-- Cleanup already handled by migration 20260736. This migration only records
-- the removal in each application's timeline.

-- 2. Insert a one-time audit entry into every application's timeline so users
--    can see when and why the checklist workflow disappeared.
insert into public.application_timeline
  (application_id, event_type, title, description, metadata)
select
  a.id,
  'system',
  'Requirement Checklist removed',
  'The Requirement Checklist tab and application_checklists table were removed. '
    || 'Historical checklist events remain in this timeline for reference. '
    || 'Document tracking now lives under the Document Requests tab.',
  jsonb_build_object(
    'removed_module', 'requirement_checklist',
    'removed_table', 'application_checklists',
    'replacement', 'document_requests',
    'migration', '20260737000000_checklist_removal_audit'
  )
from public.applications a
where not exists (
  select 1 from public.application_timeline t
  where t.application_id = a.id
    and t.event_type = 'system'
    and t.title = 'Requirement Checklist removed'
);
