#!/usr/bin/env bash
# =============================================================================
# Database Migration Applier with PostgREST Reload
# =============================================================================
set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Find all migration files
MIGRATIONS_DIR="db/migrations"
FILES=("$MIGRATIONS_DIR"/*.sql)

if [ ${#FILES[@]} -eq 0 ]; then
  echo -e "${RED}No migration files found in $MIGRATIONS_DIR${NC}"
  exit 0
fi

# We need the DB URL
DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  if [ -f .env ]; then
    DB_URL=$(grep "SUPABASE_DB_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$DB_URL" ]; then
  echo -e "${RED}ERROR: SUPABASE_DB_URL is not set.${NC}"
  echo "Please set it before running this script:"
  echo "export SUPABASE_DB_URL=\"postgresql://postgres:PASSWORD@db.qdveirhlzuzrxaqjevxr.supabase.co:5432/postgres\""
  echo "npm run db:apply"
  exit 1
fi

echo -e "Applying migrations to ${GREEN}$DB_URL${NC}..."

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
    echo -e "  ✓ $BASENAME (${GREEN}already applied${NC})"
    continue
  fi

  echo -e "→ Applying $BASENAME ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f "$FILE" >/dev/null
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "INSERT INTO public._migrations (version, name) VALUES ('$VERSION', '$NAME');"
  echo -e "  ✓ $BASENAME ${GREEN}applied${NC}"
  PENDING=$((PENDING + 1))
done

if [ $PENDING -eq 0 ]; then
  echo -e "${GREEN}All migrations already up to date.${NC}"
else
  echo -e "${GREEN}Applied $PENDING new migration(s).${NC}"
fi

# 4) RELOAD POSTGREST CACHE
# This is critical for Supabase to see the new columns without a server restart
echo -e "→ Reloading PostgREST schema cache..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "NOTIFY pgrst, 'reload schema';"
echo -e "${GREEN}✓ Schema cache reload triggered${NC}"

# 5) VERIFICATION
echo -e "\n--- VERIFICATION ---"
CHECK_COLS=$(psql "$DB_URL" -tA -c "
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'university_programs' 
    AND column_name IN ('application_fee', 'registration_fee', 'emgs_fee', 'others_fee');
")

COUNT=$(echo "$CHECK_COLS" | grep -v '^$' | wc -l)
if [ "$COUNT" -eq 4 ]; then
  echo -e "${GREEN}✓ Verification Successful: All 4 fee columns exist in 'university_programs'.${NC}"
else
  echo -e "${RED}✗ Verification Warning: Only $COUNT of 4 fee columns found in 'university_programs'.${NC}"
  echo "Found: $CHECK_COLS"
fi

echo -e "--------------------"

