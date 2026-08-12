# Plan: Automated Migration Command

Implement an automated database migration system that allows me to apply schema changes directly to Supabase using a service role key.

## User Review Required

> [!IMPORTANT]
> To use this system, you MUST add your Supabase Service Role Key as a secret named `SB_SERVICE_ROLE_KEY` in the project settings.

## Proposed Changes

### Database & Scripts

- **`scripts/migrate.ts`**: Create a robust TypeScript migration runner that:
  - Connects to Supabase using the Service Role Key.
  - Tracks applied migrations in a `public._migrations` table.
  - Applies pending `.sql` files from `db/migrations/` in chronological order.
  - Triggers a PostgREST schema reload after completion.
- **`package.json`**: Add `npm run db:migrate` to execute the migration runner using `tsx`.
- **`db/migrations/20260754000000_pgrst_reload_rpc.sql`**: Ensure the `exec_sql` RPC exists in the database to allow raw SQL execution via the migration script.

## Technical Details

- Uses `@supabase/supabase-js` for database interaction.
- The `exec_sql` function will be defined as `SECURITY DEFINER` to allow administrative tasks.
- The script will read `SB_SERVICE_ROLE_KEY` from the environment/secrets at runtime.

## Verification Plan

1. **Dry Run**: Check if the script correctly identifies pending vs. applied migrations.
2. **Execution**: Run a test migration (e.g., adding a metadata column) and verify it reflects in the Supabase schema.
3. **Logs**: Check console output for success/failure states.
