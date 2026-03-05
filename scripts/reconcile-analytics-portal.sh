#!/usr/bin/env bash
set -euo pipefail

HOST="${APP_URL:-https://strktr.vercel.app}"
HOURS="${HOURS:-168}"
LIMIT="${LIMIT:-500}"
CRON_SECRET_VALUE="${CRON_SECRET:-}"

AUTH_ARGS=()
if [[ -n "$CRON_SECRET_VALUE" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${CRON_SECRET_VALUE}")
fi

if (( ${#AUTH_ARGS[@]} > 0 )); then
  curl -sS -X POST \
    "${HOST%/}/api/cron/analytics/reconcile?hours=${HOURS}&limit=${LIMIT}" \
    "${AUTH_ARGS[@]}" \
    -H "Content-Type: application/json" | jq
else
  curl -sS -X POST \
    "${HOST%/}/api/cron/analytics/reconcile?hours=${HOURS}&limit=${LIMIT}" \
    -H "Content-Type: application/json" | jq
fi
