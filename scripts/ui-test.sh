#!/usr/bin/env bash
# Runs the Maestro UI suite on a booted iOS simulator against the local Supabase stack.
# Prerequisites: `npx supabase start`, Maestro (https://maestro.mobile.dev), app installed on the simulator.
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${RECALL_TEST_EMAIL:-uitest@recall.local}"
PASSWORD="${RECALL_TEST_PASSWORD:-uitest-password-1}"

eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"

echo "==> Resetting local database"
npx supabase db reset >/dev/null

echo "==> Creating test user $EMAIL"
curl -sS -o /dev/null -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}"

echo "==> Running Maestro flows"
"${MAESTRO:-maestro}" test -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" --test-output-dir .maestro/output "$@" .maestro
