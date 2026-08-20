---
title: Fix Relationship Between application_timeline and profiles
description: Resolve schema cache issue for application_timeline and profiles relationship and refine UI labels.
---

## Problem
1. **Schema Cache Error**: The app is reporting `Could not find a relationship between 'application_timeline' and 'profiles' in the schema cache`. This happens because PostgREST needs a clear foreign key relationship to perform joined queries (like `.select("*, actor_profile:profiles(...)")`).
2. **UI Labels**: The user wants to ensure all UI labels for "Created By" and "Assigned To" are shortened to "Created" and "Assigned".
3. **Separator Edit**: The user requested a literal text replacement for a separator element.

## Proposed Changes

### Database
- Apply a definitive migration to ensure the foreign key `application_timeline_actor_id_fkey` exists and points to `public.profiles(id)`.
- Use a `NOTIFY pgrst, 'reload schema'` or similar mechanism (or just the migration itself) to force a PostgREST cache reload.

### Frontend
- **src/routes/_authenticated.applications.index.tsx**: Verify and update any remaining table headers or filter labels to "Created" and "Assigned".
- **src/routes/_authenticated.students.index.tsx**: Verify and update "Created By" to "Created".
- **src/routes/_authenticated.applications.$applicationId.tsx**: Ensure the labels in the details view and edit form use the shortened versions.
- **src/components/applications/TimelineEventItem.tsx**: Ensure actor name resolution is robust.
- **Literal Text**: Update the specific span element in the preview with the requested literal display text.

### Verification Plan
- **Database**: Check `information_schema.table_constraints` to confirm the FK exists.
- **PostgREST**: Verify that the query `.from("application_timeline").select("*, actor_profile:profiles(id, full_name, email)")` no longer throws a relationship error.
- **UI**: Manually check the Applications list, Student list, and Application Details page for label consistency.
