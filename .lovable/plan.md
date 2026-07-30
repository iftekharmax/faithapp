# ApplyBoard-Style Application Management System

This is a large scope (12 sections, ~9 new tables, 8-tab detail page). I'll extend your existing modules (applications, programs, universities, students) rather than rebuild. Before I start, please confirm the plan or trim scope.

## What already exists (will be extended, not replaced)
- `/applications` list + `/applications/new` + `/applications/:id`
- `/programs`, `/universities`, `/countries`, `/students`
- `applications`, `programs`, `institutions`, `campuses`, `countries`, `intakes` tables
- Auth, RBAC (admin/counselor/processor/student), sidebar, chat, notifications

## New database migration (`20260734000000_ats_system.sql`)
Adds tables + RLS + realtime + grants:
- `application_status_history` — status changes with actor + timestamp
- `application_documents` — file metadata (storage bucket `application-docs`), type enum, expiry, version
- `application_checklists` — per-application checklist items + completion %
- `application_reviews` — Processor → Sr Processor → Manager → Submit stages
- `application_offers` — conditional/unconditional/reject, deposit, acceptance
- `application_activities` — unified activity log (auto-populated by triggers)
- New enum `application_status_v2` with all 15 statuses (adds columns to `applications` if missing: `priority`, `deadline`, `assigned_processor`, `application_date`)
- Storage bucket `application-docs` (private) + RLS policies
- Trigger: auto-log to `application_activities` on status/document/checklist/review/offer changes
- Trigger: when all required checklist items checked → status = `ready_for_review`
- RLS: admin all; counselor/processor see assigned only; student sees own

## New/extended routes
1. **`/programs`** (extend existing) — advanced filters (country, institution, campus, intake, fee range, scholarship, duration), multi-select compare modal
2. **`/applications/new`** (extend) — priority, deadline, processor, auto-generated App ID
3. **`/applications/:id`** (extend) — sticky header + horizontal status stepper + tabbed layout:
   - Overview
   - Documents (drag-drop upload, preview, replace, expiry, progress)
   - Checklist (auto-status trigger)
   - Review (4-stage workflow, lock next until prev approved)
   - Offers (upload letter, accept/reject, expiry warning)
   - Timeline (activity feed)
4. **`/dashboard`** (extend, non-destructive) — add ATS widget row + 3 charts (by country / intake / monthly trend) using existing recharts

## New reusable components
- `components/applications/StatusStepper.tsx`
- `components/applications/DocumentUploader.tsx` (drag-drop, progress)
- `components/applications/ChecklistPanel.tsx`
- `components/applications/ReviewWorkflow.tsx`
- `components/applications/OfferPanel.tsx`
- `components/applications/ActivityTimeline.tsx`
- `components/programs/ProgramCompareModal.tsx`

## Realtime
Subscribe on `/applications/:id` to `application_status_history`, `application_activities`, `application_documents` — Supabase channel filtered by application_id.

## Security
- RLS on every new table, keyed by `assigned_counselor` / `assigned_processor` / `has_role('admin')`
- Storage RLS: only assigned staff + admin can download; owner student can read own
- File validation client + server (mime, size ≤ 10MB)

## What I will NOT touch
Auth, existing sidebar entries, existing route files' unrelated logic, chat, students module, universities module internals, theme, layouts.

## Seed data
Migration inserts sample checklist templates and 2-3 demo activity rows for the admin's existing applications so the UI is populated on first load.

## Delivery order (single turn)
1. Write + apply migration
2. Storage bucket + policies
3. Components
4. Route extensions
5. Dashboard widgets
6. Verify with `tsgo`

## Please confirm
- OK to add the 6 tabs on `/applications/:id` (Overview stays, others are new)?
- OK that the new status enum has 15 values and I'll migrate existing `applications.status` values into it?
- Any status names you want renamed?

Reply "go" to proceed, or edit the scope.
