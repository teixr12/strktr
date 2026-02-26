#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <sql-file>" >&2
  exit 1
fi

SQL_FILE="$1"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

: "${SUPABASE_ACCESS_TOKEN:?Missing SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_PROJECT_REF:?Missing SUPABASE_PROJECT_REF}"

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

HTTP_STATUS=$(
  /usr/bin/curl -4 -sS -m 90 \
    -o "$TMP_BODY" \
    -w "%{http_code}" \
    -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -Rs '{query: .}' < "$SQL_FILE")"
)

if [[ "$HTTP_STATUS" -lt 200 || "$HTTP_STATUS" -ge 300 ]]; then
  echo "Supabase query failed for $SQL_FILE (HTTP $HTTP_STATUS)" >&2
  cat "$TMP_BODY" >&2
  exit 1
fi

if jq -e 'type == "object" and has("error")' "$TMP_BODY" >/dev/null 2>&1; then
  echo "Supabase query returned an error for $SQL_FILE" >&2
  cat "$TMP_BODY" >&2
  exit 1
fi

jq . "$TMP_BODY"
