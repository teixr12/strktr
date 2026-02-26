#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <sql-file> [env-file]" >&2
  exit 1
fi

SQL_FILE="$1"
ENV_FILE="${2:-supabase_keys.env.codex.txt}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
PROJECT_REF=$(grep '^SUPABASE_PROJECT_REF=' "$ENV_FILE" | cut -d= -f2-)

if [[ -z "$ACCESS_TOKEN" || -z "$PROJECT_REF" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in $ENV_FILE" >&2
  exit 1
fi

/usr/bin/curl -4 -sS -m 60 -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' < "$SQL_FILE")"
