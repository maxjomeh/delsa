#!/usr/bin/env bash
# Runs the builder SQL files and their SQL tests against a throw-away local Postgres (no Supabase needed).
#
#   supabase/tests/local-postgres/run.sh [test.sql|test.cjs ...]   # default: book-catalog.sql + the JS/SQL parity test
#
# Needs the Postgres server binaries (e.g. /usr/lib/postgresql/16/bin) and root or the `postgres`
# OS user (initdb refuses to run as root, so the cluster is created and run as `postgres`).
# The cluster lives in a temp directory and is deleted afterwards. Nothing touches a real project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_LOCAL:-55432}"
WORK="$(mktemp -d /var/lib/postgresql/delsa-sql-XXXXXX 2>/dev/null || mktemp -d)"
chmod 755 "$WORK"; chown postgres "$WORK" 2>/dev/null || true
as_pg() { if [ "$(id -u)" = 0 ]; then su -s /bin/bash postgres -c "$*"; else bash -c "$*"; fi; }
cleanup() { as_pg "$BIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null 2>&1 || true"; rm -rf "$WORK"; }
trap cleanup EXIT
as_pg "$BIN/initdb -D $WORK/data -A trust -E UTF8 --locale=C.UTF-8 >/dev/null"
as_pg "$BIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -w start >/dev/null"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -h $WORK -p $PORT -U postgres"
as_pg "$PSQL -c 'create database app' postgres"
APP="$PSQL -d app"
apply() { echo "• $1"; as_pg "$APP -f $ROOT/$1"; }
apply supabase/tests/local-postgres/shim.sql
# Base schema and the builder files the catalog depends on, in dependency order.
for f in supabase/schema.sql supabase/migrations/20260928_store_products.sql supabase/migrations/20260928_customer_details.sql \
         supabase/migrations/20260929144517_customer_dashboard_data.sql supabase/migrations/20260929151028_customer_dashboard_ownership.sql \
         supabase/apu-workspace.sql supabase/site-builder.sql supabase/builder-commerce.sql supabase/builder-admin-management.sql supabase/book-catalog.sql supabase/builder-instagram.sql; do apply "$f"; done
# Two ordinary accounts and one admin, as the SQL tests expect (they roll their own changes back).
as_pg "$APP" <<'SQL'
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','a@test.local'),('00000000-0000-0000-0000-0000000000b2','b@test.local'),('00000000-0000-0000-0000-0000000000c3','admin@test.local')
 on conflict do nothing;
insert into public.profiles(id,email,full_name,role) values
 ('00000000-0000-0000-0000-0000000000a1','a@test.local','مشتری الف','user'),('00000000-0000-0000-0000-0000000000b2','b@test.local','مشتری ب','user'),('00000000-0000-0000-0000-0000000000c3','admin@test.local','مدیر','admin')
 on conflict (id) do update set role=excluded.role;
SQL
TESTS=("$@"); [ ${#TESTS[@]} -gt 0 ] || TESTS=(supabase/tests/book-catalog.sql supabase/tests/book-catalog-parity.test.cjs supabase/tests/book-catalog-rollback.sql)
for t in "${TESTS[@]}"; do
  echo "▶ $t"
  case "$t" in
    # Node tests get the connection settings of the temporary cluster (psql must be on PATH).
    *.cjs|*.js) PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=app node "$ROOT/$t" ;;
    *) as_pg "$APP -f $ROOT/$t" ;;
  esac
done
echo "OK: all SQL tests passed"
