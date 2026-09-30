# Plan: Execute Automated Migration Bootstrap

The user has provided the correct database password. I will now use this to bootstrap the database and run all pending migrations.

## Proposed Changes

### Database Bootstrap
- Update `scripts/bootstrap-db.ts` with the password `bxwhgrS6uoBsEEru`.
- Run the script to establish the `exec_sql` helper function.
- Verify connectivity and function creation.

### Migration Execution
- Run `npm run db:migrate` to apply all migrations in `db/migrations/`.
- Confirm that the `university_programs` table now has the `additional_others_fee` column.

### Cleanup
- Remove the plain-text password from `scripts/bootstrap-db.ts` after execution.
- Add the password to a safe environment variable if needed for future use (though `exec_sql` only needs to be created once).

## Technical Details
- Password: `bxwhgrS6uoBsEEru`
- Project ID: `qdveirhlzuzrxaqjevxr`
- Command: `bun run scripts/bootstrap-db.ts && bun run scripts/migrate.ts`
