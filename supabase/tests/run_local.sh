#!/usr/bin/env bash
# Rebuilds a scratch database from all migrations and runs the security suite.
# Usage: PGURL=postgres://... supabase/tests/run_local.sh   (needs a Supabase-compatible database)
set -euo pipefail
cd "$(dirname "$0")/../.."
for f in supabase/migrations/*.sql; do psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
