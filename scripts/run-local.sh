#!/usr/bin/env bash
# Bring the whole platform up locally: database, schema, demo data, app.
#
#   scripts/run-local.sh            production build, http://localhost:3000
#   scripts/run-local.sh dev        dev server with hot reload
#   scripts/run-local.sh reset      rebuild the database from nothing, then run
#   scripts/run-local.sh stop       stop the app and the database
#   scripts/run-local.sh status     what is running
#
# Nothing here needs sudo, Docker or an internet connection after the first run.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
LOG=".local-run.log"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
app_pid() { ss -lptnH "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1; }

stop_app() {
  local pid; pid="$(app_pid)"
  if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; sleep 1; fi
}

case "${1:-start}" in

  stop)
    say "stopping the app"
    stop_app
    say "stopping the database"
    ./scripts/dev-db.sh stop >/dev/null 2>&1 || true
    echo "stopped."
    exit 0 ;;

  status)
    pid="$(app_pid)"
    if [ -n "$pid" ]; then
      echo "app       : running on http://localhost:$PORT (pid $pid)"
    else
      echo "app       : not running"
    fi
    if ./scripts/dev-db.sh status >/dev/null 2>&1; then
      echo "database  : running"
      echo -n "projects  : "
      ./scripts/dev-db.sh psql -d sylva_dev -tA -c \
        "SELECT count(*)||' published' FROM proj.project WHERE status='published';" 2>/dev/null || echo "?"
    else
      echo "database  : not running"
    fi
    exit 0 ;;

  dev|reset|start) MODE="$1" ;;
  *) echo "usage: $0 [start|dev|reset|stop|status]"; exit 1 ;;
esac

# ---------------------------------------------------------------- database
if ! ./scripts/dev-db.sh status >/dev/null 2>&1; then
  say "starting PostgreSQL + PostGIS"
  ./scripts/dev-db.sh start >/dev/null
else
  say "PostgreSQL already running"
fi

if [ "$MODE" = "reset" ]; then
  say "rebuilding the database from nothing"
  ./db/apply.sh --fresh
  # NOTE: `cmd && echo ok` is exempt from set -e, so a failing seed used to
  # print nothing and the run carried on with a half-built database. Check the
  # status explicitly.
  for f in db/seed/*.sql; do
    printf '   seeding %-42s' "$(basename "$f")"
    if ./scripts/dev-db.sh psql -d sylva_dev -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1; then
      echo "ok"
    else
      echo "FAILED"
      ./scripts/dev-db.sh psql -d sylva_dev -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -E "ERROR|DETAIL" | head -4
      exit 1
    fi
  done
else
  say "applying any new migrations"
  ./db/apply.sh | tail -1
fi

# The signing key is what makes every organisation-scoped query work. Without
# it the site looks like row-level security is broken. Cheap to check, so check.
if [ "$(./scripts/dev-db.sh psql -d sylva_dev -tA -c 'SELECT count(*) FROM sylva.context_key;' 2>/dev/null)" != "1" ]; then
  say "inserting the actor-context signing key"
  ./scripts/dev-db.sh psql -d sylva_dev -q -f db/seed/0000_bootstrap.sql
fi

# ---------------------------------------------------------------- the app
stop_app

if [ "$MODE" = "dev" ]; then
  say "starting the dev server"
  exec npx next dev -p "$PORT"
fi

say "building"
npx next build >/dev/null 2>&1 || { npx next build; exit 1; }

say "starting"
nohup npx next start -p "$PORT" > "$LOG" 2>&1 &

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 1
done

LAN="$(hostname -I 2>/dev/null | awk '{print $1}')"
cat <<TXT

  Sylva is running.

    http://localhost:$PORT${LAN:+
    http://$LAN:$PORT   (same network - phone, tablet)}

  Sign in with any of these, password: demo-password-not-for-production

    buyer.a@demo.sylva.example      a vetted buyer
    owner.a@demo.sylva.example      a project owner
    operator@demo.sylva.example     Sylva staff - vetting and publishing
    auditor@demo.sylva.example      read-only
    unvetted@demo.sylva.example     not yet approved - shows the blocked path

  Worth walking:  /  ->  /projects  ->  open a project  ->  Express interest
  Also:           /record   the public, append-only transaction record

  logs    tail -f $LOG
  stop    scripts/run-local.sh stop
  status  scripts/run-local.sh status

TXT
