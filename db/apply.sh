#!/usr/bin/env bash
# Apply every migration in order into a fresh or existing database.
#   usage: db/apply.sh [--fresh]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] && set -a && . ./.env.local && set +a

: "${PGHOST:?}" ; : "${PGPORT:?}" ; : "${PGUSER:?}" ; : "${PGDATABASE:?}"
PSQL_BIN="${PSQL_BIN:-psql}"
Q="$PSQL_BIN -h $PGHOST -p $PGPORT -U $PGUSER -v ON_ERROR_STOP=1 -q"

if [ "${1:-}" = "--fresh" ]; then
  echo ">> dropping and recreating $PGDATABASE"
  $Q -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE WITH (FORCE);" \
                 -c "CREATE DATABASE $PGDATABASE;"
fi

$Q -d "$PGDATABASE" -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    sha256      text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  );"

applied=0; skipped=0
for f in db/migrations/*.sql; do
  base=$(basename "$f")
  sum=$(sha256sum "$f" | cut -d' ' -f1)
  prev=$($Q -d "$PGDATABASE" -tAc \
        "SELECT sha256 FROM schema_migrations WHERE filename='$base'")
  if [ -n "$prev" ]; then
    if [ "$prev" != "$sum" ]; then
      echo "!! $base changed after being applied."
      echo "   Migrations are immutable once applied - add a new one instead."
      exit 1
    fi
    skipped=$((skipped+1)); continue
  fi
  printf '   %-60s' "$base"
  $Q -d "$PGDATABASE" -1 -f "$f"
  $Q -d "$PGDATABASE" -c \
     "INSERT INTO schema_migrations(filename,sha256) VALUES ('$base','$sum');"
  echo "ok"
  applied=$((applied+1))
done
echo ">> applied $applied, already present $skipped"
