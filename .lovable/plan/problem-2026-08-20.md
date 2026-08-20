---
title: Fix Schema Cache for assigned_team column
description: Ensure PostgREST recognizes the assigned_team relationship between applications and profiles.
---

## Problem
The user reports `Could not find the 'assigned_team' column of 'applications' in the schema cache`. Although a previous migration added the foreign key, the PostgREST cache might still be stale or there might be an issue with how the relationship is defined if it fails in certain contexts.

## Proposed Changes

### Database
- Re-apply a definitive migration to ensure the `applications_assigned_team_id_fkey` foreign key exists and correctly references `public.profiles(id)`.
- Force a schema reload using `NOTIFY pgrst, 'reload schema'`.

### Frontend
- No changes needed to the frontend code as it correctly uses the relationship alias `assigned_team:profiles(...)`.

### Literal Text
- Update the specific span element in the preview with the requested literal display text.

## Verification Plan
- Run a test script using the Supabase client to confirm that `supabase.from("applications").select("*, assigned_team:profiles(...)")` works without relationship errors.
