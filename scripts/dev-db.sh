#!/usr/bin/env bash
# Local PostgreSQL 16 + PostGIS 3.5, no sudo, no Docker, nothing system-wide.
#   scripts/dev-db.sh start | stop | status | psql
set -euo pipefail
ENVD="$HOME/.local/opt/micromamba/envs/sylva-pg"
DATA="${SYLVA_PGDATA:-$HOME/.local/share/sylva/pgdata}"
PORT="${PGPORT:-5455}"
export LD_LIBRARY_PATH="$ENVD/lib:${LD_LIBRARY_PATH:-}"

[ -x "$ENVD/bin/postgres" ] || { echo "run scripts/install-dev-db.sh first"; exit 1; }

case "${1:-status}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$(dirname "$DATA")"
      "$ENVD/bin/initdb" -D "$DATA" -U postgres -A trust --encoding=UTF8 --locale=C >/dev/null
    fi
    "$ENVD/bin/pg_ctl" -D "$DATA" -l "$DATA/server.log" \
      -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -w start
    ;;
  stop)   "$ENVD/bin/pg_ctl" -D "$DATA" -m fast -w stop ;;
  status) "$ENVD/bin/pg_ctl" -D "$DATA" status ;;
  psql)   shift; "$ENVD/bin/psql" -h 127.0.0.1 -p "$PORT" -U postgres "$@" ;;
  *) echo "usage: $0 start|stop|status|psql"; exit 1 ;;
esac
