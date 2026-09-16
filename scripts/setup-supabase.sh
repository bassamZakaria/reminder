#!/usr/bin/env bash
# One-time provisioning: creates a free Supabase project, applies the schema,
# creates your login user, locks sign-ups, and writes app.config.json for the app.
# Prerequisite: SUPABASE_ACCESS_TOKEN exported (https://supabase.com/dashboard/account/tokens).
set -euo pipefail
cd "$(dirname "$0")/.."

SB="npx supabase"
PROJECT_NAME="${PROJECT_NAME:-recall}"
REGION="${REGION:-eu-central-1}"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Create one at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi
if [ -z "${USER_EMAIL:-}" ] || [ -z "${USER_PASSWORD:-}" ]; then
  echo "USER_EMAIL and USER_PASSWORD are required (sign-ups are disabled, this is the only account)." >&2
  exit 1
fi

json_field() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=eval(process.argv[1]);console.log(r??"")})' "$1"
}

echo "==> Checking Supabase access"
$SB projects list -o json >/dev/null

ORG_ID="${ORG_ID:-$($SB orgs list -o json | json_field 'JSON.parse(d)[0].id')}"
find_ref() {
  $SB projects list -o json | PROJECT_NAME="$PROJECT_NAME" json_field '(p=>p&&(p.ref||p.id))(JSON.parse(d).find(p=>p.name===process.env.PROJECT_NAME))'
}
REF="$(find_ref)"

DB_PASSWORD_FILE=".supabase-db-password"
if [ -z "$REF" ]; then
  DB_PASSWORD="$(head -c 48 /dev/urandom | base64 | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-32)"
  echo "$DB_PASSWORD" > "$DB_PASSWORD_FILE"
  echo "==> Creating project '$PROJECT_NAME' in org $ORG_ID ($REGION)"
  $SB projects create "$PROJECT_NAME" --org-id "$ORG_ID" --region "$REGION" --db-password "$DB_PASSWORD" -o json >/dev/null
  REF="$(find_ref)"
  echo "==> Waiting for project $REF to come online"
  for _ in $(seq 1 60); do
    STATUS="$($SB projects list -o json | REF="$REF" json_field '(p=>p&&p.status)(JSON.parse(d).find(p=>(p.ref||p.id)===process.env.REF))')"
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
KEYS_JSON="$($SB projects api-keys --project-ref "$REF" --reveal -o json)"
ANON_KEY="$(echo "$KEYS_JSON" | json_field '(k=>(k.find(x=>x.name==="anon")||k.find(x=>x.type==="publishable")).api_key)(JSON.parse(d))')"
SERVICE_KEY="$(echo "$KEYS_JSON" | json_field '(k=>(k.find(x=>x.name==="service_role")||k.find(x=>x.type==="secret")).api_key)(JSON.parse(d))')"
URL="https://$REF.supabase.co"

cat > app.config.json <<JSON
{ "supabaseUrl": "$URL", "supabaseAnonKey": "$ANON_KEY" }
JSON
echo "==> Wrote app.config.json"

create_user() {
  echo "==> Creating login user $1"
  BODY="$(EMAIL="$1" PASSWORD="$2" node -e 'console.log(JSON.stringify({email:process.env.EMAIL,password:process.env.PASSWORD,email_confirm:true}))')"
  CODE="$(curl -sS -o /tmp/recall-create-user.json -w '%{http_code}' -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" -d "$BODY")"
  if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
    echo "    created"
  elif grep -q "already" /tmp/recall-create-user.json; then
    echo "    already exists"
  else
    echo "    failed ($CODE): $(cat /tmp/recall-create-user.json)" >&2
    exit 1
  fi
  rm -f /tmp/recall-create-user.json
}
create_user "$USER_EMAIL" "$USER_PASSWORD"

echo "==> Disabling public sign-ups"
curl -sS -f -o /dev/null -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"disable_signup": true}'

if command -v gh >/dev/null && gh repo view >/dev/null 2>&1; then
  echo "==> Setting GitHub secrets for the keep-alive workflow"
  gh secret set SUPABASE_URL --body "$URL"
  gh secret set SUPABASE_ANON_KEY --body "$ANON_KEY"
else
  echo "==> No GitHub repo detected. Add SUPABASE_URL and SUPABASE_ANON_KEY as repo secrets once pushed."
fi

echo "==> Done. Project: $URL"
