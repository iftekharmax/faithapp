#!/usr/bin/env bash
# =============================================================================
# One-command migration applier (no Supabase CLI needed — psql only).
#
# Usage (either one):
#   SUPABASE_DB_URL="postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres" \
#     bash scripts/db-apply.sh
#
#   SUPABASE_DB_PASSWORD="<PASSWORD>" bash scripts/db-apply.sh
#     (uses SUPABASE_PROJECT_REF, defaults to qdveirhlzuzrxaqjevxr)
#
# Applies every pending file from db/migrations/ in timestamp order and
# records them in public._migrations, so re-running is safe (idempotent).
# =============================================================================
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-qdveirhlzuzrxaqjevxr}"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  if [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
    # URL-encode the password minimally (@ : / ? # spaces)
    ENC=$(printf '%s' "$SUPABASE_DB_PASSWORD" | python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read(),safe=""))' 2>/dev/null || printf '%s' "$SUPABASE_DB_PASSWORD")
    SUPABASE_DB_URL="postgresql://postgres:${ENC}@db.${PROJECT_REF}.supabase.co:5432/postgres"
  else
    echo "ERROR: set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD" >&2
    exit 1
  fi
fi
export SUPABASE_DB_URL

exec bash "$(cd "$(dirname "$0")" && pwd)/db-push.sh"
