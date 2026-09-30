# Plan: Automated Migration Command

Create an automated database migration system that allows for seamless schema updates via a dedicated command.

## Proposed Changes

### Configuration
- **package.json**: Add a `db:migrate` script that runs the migration runner using `bun run scripts/migrate.ts`.

### Scripts
- **scripts/migrate.ts**: Refine the existing migration script to:
  - Check for `SB_SERVICE_ROLE_KEY` in environment variables.
  - Automatically track applied migrations in a `public._migrations` table.
  - Apply pending `.sql` files from `db/migrations/` in chronological order.
  - Trigger a PostgREST schema reload (`NOTIFY pgrst, 'reload schema';`) so changes reflect immediately in the API.

### Database
- **db/migrations/20260812000000_exec_sql_helper.sql**: Ensure the `exec_sql` helper function exists in the database. This function is required by the migration script to execute raw SQL.

## Technical Details
- The migration runner uses `@supabase/supabase-js` with the service role key to bypass RLS and perform administrative tasks.
- It leverages the `exec_sql` RPC for flexible schema management.
- Integration with `package.json` allows the agent to run `npm run db:migrate` after generating a new migration file.

## Verification Plan
- Run `npm run db:migrate` and verify the `_migrations` table is created and populated.
- Test with a simple migration (e.g., adding a comment to a table) and ensure it applies correctly and is tracked.
