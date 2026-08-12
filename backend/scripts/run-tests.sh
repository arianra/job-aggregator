#!/bin/bash
# Run backend test suite with DB env loaded (run from repo root)
set -u
cd "$(dirname "$0")/../.."
set -a
grep -E '^(DATABASE_URL|TEST_DATABASE_URL)=' .env > /tmp/dbenv.$$
. /tmp/dbenv.$$
rm -f /tmp/dbenv.$$
set +a
cd backend
exec node ../node_modules/vitest/vitest.mjs run "$@"
