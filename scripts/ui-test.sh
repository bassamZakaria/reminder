#!/usr/bin/env bash
# Runs the Maestro UI suite on a booted iOS simulator against the local Supabase stack.
# Prerequisites: `yarn supabase start`, Maestro (https://maestro.mobile.dev), app installed on the simulator.
set -euo pipefail
cd "$(dirname "$0")/.."
SB=./node_modules/.bin/supabase

EMAIL="${RECALL_TEST_EMAIL:-uitest@recall.local}"
PASSWORD="${RECALL_TEST_PASSWORD:-uitest-password-1}"

eval "$("$SB" status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"

if [ -z "${SKIP_DB_RESET:-}" ]; then
  echo "==> Resetting local database"
  "$SB" db reset >/dev/null
fi

echo "==> Creating test user $EMAIL"
curl -sS -o /dev/null -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}"

echo "==> Running Maestro flows"
"${MAESTRO:-maestro}" ${DEVICE:+--device "$DEVICE"} test -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" -e NEW_EMAIL="new-$EMAIL" -e SAVE_PASSWORD_SHEET="${SAVE_PASSWORD_SHEET:-false}" -e SYSTEM_ALERT_POINT="${SYSTEM_ALERT_POINT:-off}" --test-output-dir .maestro/output "$@" "${FLOWS:-.maestro}"
