#!/usr/bin/env bash
# Runs the database tests against a local Postgres (not a real Supabase project).
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=intro_test
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
for f in tests/local_stub.sql migrations/0001_init.sql seed.sql; do
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -v -e wal_level -e 'HINT:' || true
done
psql -d "$DB" -v ON_ERROR_STOP=1 -q -o /dev/null -f tests/run_tests.sql 2>&1 | sed 's/^psql:[^ ]* //'
