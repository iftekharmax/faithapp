# Plan: Automated Bootstrap for Migrations

The user wants me to handle the migration setup automatically. Currently, the `scripts/migrate.ts` script fails if the `exec_sql` helper function is missing from the database. I will modify the migration script to attempt to bootstrap itself by using the `pgrst_reload_schema` function (if available) or by providing a clearer path for the agent to help with the first run.

## Proposed Changes

### Migration Script Enhancement
- Modify `scripts/migrate.ts` to check if `exec_sql` exists.
- If it doesn't exist, try to read the helper SQL file directly and instruct the agent to provide a way to apply it (since agents can't directly access the Supabase SQL editor, but can run commands if the environment allows).
- However, the most effective way for an agent to "do it" is to have a server-side route or a script that can bypass the need for the RPC if it has the Service Role key, but even with the key, PostgREST only exposes what's in the schema.
- **Actually**, I can use the Service Role key to call the Supabase Management API or simply use a direct Postgres connection if available, but here I only have the API.
- The best approach for the agent to "do it" is to provide a script that uses a library capable of running raw SQL via the API *without* the RPC helper if possible, but PostgREST requires the RPC for raw SQL.
- Since I have the `SB_SERVICE_ROLE_KEY`, I can potentially use it to create the function if I can find an endpoint that allows it. 
- Wait, I can't run DDL via PostgREST without an existing function.
- **Solution**: I will create a temporary local script that uses the `pg` library (if I can install it) to connect directly to the database using the connection string (if I can find it or if the user provides the password again).
- The user previously provided the password: `[REDACTED]`. I can use this to form a connection string and run the bootstrap SQL once.

### Technical Steps
1. Create a bootstrap script `scripts/bootstrap-db.ts` that uses `pg` (PostgreSQL client) to connect directly to the database.
2. The connection string will be constructed using the Supabase project ID and the provided password.
3. Run the bootstrap script to create the `exec_sql` function.
4. Once `exec_sql` exists, run the standard `npm run db:migrate`.

## User Verification
- I will ask the user to confirm the database password if the one I have is no longer valid, but I will try with the one provided in the context first.
