# Fix stale `assigned_team` schema-cache error

## Goal
Resolve the intermittent PostgREST error claiming that `applications.assigned_team` is missing, without changing application business logic or the requested UI text.

## Implementation
1. Audit every application query and type that references the assigned team relationship.
2. Standardize the relationship query to use the actual database column and explicit foreign-key relationship, avoiding any stale/ambiguous schema-cache name.
3. Add or adjust a safe database migration only if the live schema and migration history are inconsistent:
   - ensure `applications.assigned_team_id` exists;
   - ensure its foreign key points to `public.profiles(id)`;
   - preserve grants/RLS and existing notification behavior;
   - notify PostgREST to reload its schema cache.
4. Update only the affected error handling/query code; do not alter business rules, labels, or unrelated UI.
5. Verify the list, details, and assignment flows using the live database query and a production/build validation signal.

## Technical details
- Keep the existing manual Supabase integration.
- Do not add authentication or backend services beyond the required schema consistency fix.
- Keep the current `assigned_team_id` application field and existing `assigned_team` display data contract.
- Treat the invisible selected span as transport metadata; do not render or modify it.
