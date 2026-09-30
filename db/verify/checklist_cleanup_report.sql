-- =============================================================================
-- Verification report: Requirement Checklist removal cleanup
-- Run with: psql "$SUPABASE_DB_URL" -f db/verify/checklist_cleanup_report.sql
--
-- Produces a single-row report per check. Any row with issue_count > 0 or
-- table_exists = true means cleanup is incomplete.
-- =============================================================================

-- 1. The dropped table must NOT exist anywhere in the public schema.
select
  'application_checklists table dropped' as check_name,
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'application_checklists'
  ) as ok,
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'application_checklists'
  ) as table_exists;

-- 2. The helper function must be gone.
select
  'checklist_auto_ready() function dropped' as check_name,
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'checklist_auto_ready'
  ) as ok;

-- 3. No foreign keys in other tables should reference application_checklists.
select
  'no orphan FKs referencing application_checklists' as check_name,
  count(*) as issue_count,
  coalesce(json_agg(json_build_object(
    'table', tc.table_name, 'constraint', tc.constraint_name
  )), '[]'::json) as offenders
from information_schema.table_constraints tc
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_name = 'application_checklists';

-- 4. No application_documents rows should carry a "checklist" category.
select
  'application_documents with checklist category' as check_name,
  count(*) as issue_count
from public.application_documents
where category ilike '%checklist%';

-- 5. Every application should have exactly one removal audit entry.
with counts as (
  select
    (select count(*) from public.applications) as apps,
    (select count(*) from public.application_timeline
       where event_type = 'system' and title = 'Requirement Checklist removed') as audits
)
select
  'removal audit entry present for every application' as check_name,
  apps, audits, (apps = audits) as ok
from counts;

-- 6. Historical (legacy) checklist timeline events left behind for reference.
select
  'legacy checklist timeline events retained (informational)' as check_name,
  count(*) as legacy_event_count
from public.application_timeline
where event_type = 'checklist'
   or (event_type <> 'system' and title ilike '%checklist%');
