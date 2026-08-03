#!/usr/bin/env bash
# =============================================================================
# Database Migration Applier (Self-contained)
# =============================================================================
set -euo pipefail

# Find all migration files
MIGRATIONS_DIR="db/migrations"
FILES=("$MIGRATIONS_DIR"/*.sql)

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

# We need the DB URL. We'll check for it in various places.
DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  # Try to read from .env if present
  if [ -f .env ]; then
    DB_URL=$(grep "SUPABASE_DB_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set."
  echo "Please set it before running this script:"
  echo "export SUPABASE_DB_URL=\"postgresql://postgres:PASSWORD@db.qdveirhlzuzrxaqjevxr.supabase.co:5432/postgres\""
  echo "bash scripts/db-apply.sh"
  exit 1
fi

echo "Applying migrations to $DB_URL..."

# 1) Ensure tracking table exists
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS public._migrations (
  version    text PRIMARY KEY,
  name       text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# 2) Get list of already-applied versions
APPLIED=$(psql "$DB_URL" -tA -c "SELECT version FROM public._migrations ORDER BY version;")

# 3) Iterate migration files in order
PENDING=0
for FILE in "${FILES[@]}"; do
  BASENAME=$(basename "$FILE" .sql)
  VERSION="${BASENAME%%_*}"
  NAME="${BASENAME#*_}"

  if echo "$APPLIED" | grep -qx "$VERSION"; then
    echo "  ✓ $BASENAME (already applied)"
    continue
  fi

  echo "→ Applying $BASENAME ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f "$FILE" >/dev/null
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "INSERT INTO public._migrations (version, name) VALUES ('$VERSION', '$NAME');"
  echo "  ✓ $BASENAME applied"
  PENDING=$((PENDING + 1))
done

if [ $PENDING -eq 0 ]; then
  echo "All migrations already up to date."
else
  echo "Applied $PENDING new migration(s)."
fi
