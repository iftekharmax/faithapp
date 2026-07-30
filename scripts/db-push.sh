#!/usr/bin/env bash
# =============================================================================
# Migration runner — applies pending SQL files from supabase/migrations/
# Tracks applied migrations in public._migrations table (idempotent).
#
# Requires env var: SUPABASE_DB_URL
#   Format: postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres
#
# Usage:
#   SUPABASE_DB_URL="postgresql://..." bash scripts/db-push.sh
# =============================================================================
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL env var not set" >&2
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/db/migrations"

# 1) Ensure tracking table exists
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS public._migrations (
  version    text PRIMARY KEY,
  name       text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# 2) Get list of already-applied versions
APPLIED=$(psql "$SUPABASE_DB_URL" -tA -c "SELECT version FROM public._migrations ORDER BY version;")

# 3) Iterate migration files in order
shopt -s nullglob
FILES=("$MIGRATIONS_DIR"/*.sql)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

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
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f "$FILE" >/dev/null
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "INSERT INTO public._migrations (version, name) VALUES ('$VERSION', '$NAME');"
  echo "  ✓ $BASENAME applied"
  PENDING=$((PENDING + 1))
done

if [ $PENDING -eq 0 ]; then
  echo ""
  echo "All migrations already up to date."
else
  echo ""
  echo "Applied $PENDING new migration(s)."
fi
