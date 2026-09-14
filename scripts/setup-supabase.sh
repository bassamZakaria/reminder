#!/usr/bin/env bash
# One-time provisioning: creates a free Supabase project, applies the schema,
# creates your login user, and writes app.config.json for the app.
# Prerequisite: `npx supabase login` (opens browser, once).
set -euo pipefail
cd "$(dirname "$0")/.."

SB="npx supabase"
PROJECT_NAME="${PROJECT_NAME:-recall}"
REGION="${REGION:-eu-central-1}"

echo "==> Checking Supabase login"
$SB projects list -o json >/dev/null

ORG_ID="${ORG_ID:-$($SB orgs list -o json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d)[0].id))')}"

REF="$($SB projects list -o json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).find(p=>p.name===process.argv[1]);console.log(p?p.id:"")})' "$PROJECT_NAME")"

DB_PASSWORD_FILE=".supabase-db-password"
if [ -z "$REF" ]; then
  DB_PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
  echo "$DB_PASSWORD" > "$DB_PASSWORD_FILE"
  echo "==> Creating project '$PROJECT_NAME' in org $ORG_ID ($REGION)"
  $SB projects create "$PROJECT_NAME" --org-id "$ORG_ID" --region "$REGION" --db-password "$DB_PASSWORD" --size micro -o json >/dev/null
  REF="$($SB projects list -o json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).find(p=>p.name===process.argv[1]);console.log(p.id)})' "$PROJECT_NAME")"
  echo "==> Waiting for project $REF to come online"
  for i in $(seq 1 60); do
    STATUS="$($SB projects list -o json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).find(p=>p.id===process.argv[1]);console.log(p.status)})' "$REF")"
    [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
    sleep 10
  done
else
  DB_PASSWORD="${DB_PASSWORD:-$(cat "$DB_PASSWORD_FILE" 2>/dev/null || true)}"
  if [ -z "$DB_PASSWORD" ]; then
    read -rsp "Existing project found. Enter its database password: " DB_PASSWORD; echo
  fi
fi

echo "==> Linking and pushing schema"
$SB link --project-ref "$REF" --password "$DB_PASSWORD" >/dev/null
$SB db push --password "$DB_PASSWORD"

echo "==> Reading API keys"
KEYS_JSON="$($SB projects api-keys --project-ref "$REF" -o json)"
ANON_KEY="$(node -e 'const k=JSON.parse(process.argv[1]);console.log((k.find(x=>x.name==="anon")||k.find(x=>x.type==="publishable")||k[0]).api_key)' "$KEYS_JSON")"
SERVICE_KEY="$(node -e 'const k=JSON.parse(process.argv[1]);const s=k.find(x=>x.name==="service_role")||k.find(x=>x.type==="secret");console.log(s?s.api_key:"")' "$KEYS_JSON")"
URL="https://$REF.supabase.co"

cat > app.config.json <<JSON
{ "supabaseUrl": "$URL", "supabaseAnonKey": "$ANON_KEY" }
JSON
echo "==> Wrote app.config.json"

if [ -n "${USER_EMAIL:-}" ] && [ -n "${USER_PASSWORD:-}" ] && [ -n "$SERVICE_KEY" ]; then
  echo "==> Creating login user $USER_EMAIL"
  curl -sS -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\",\"email_confirm\":true}" >/dev/null
fi
echo "==> Done. Project: $URL"
