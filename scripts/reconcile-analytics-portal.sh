#!/usr/bin/env bash
set -euo pipefail

HOST="${APP_URL:-https://strktr.vercel.app}"
HOURS="${HOURS:-168}"
LIMIT="${LIMIT:-500}"
CRON_SECRET_VALUE="${CRON_SECRET:-}"
FORCE_REPLAY="${FORCE_REPLAY:-0}"
EVENT_TYPE="${EVENT_TYPE:-}"

AUTH_ARGS=()
if [[ -n "$CRON_SECRET_VALUE" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${CRON_SECRET_VALUE}")
fi

QUERY="hours=${HOURS}&limit=${LIMIT}"
if [[ "$FORCE_REPLAY" == "1" || "$FORCE_REPLAY" == "true" ]]; then
  QUERY="${QUERY}&force=1"
fi
if [[ -n "$EVENT_TYPE" ]]; then
  QUERY="${QUERY}&eventType=${EVENT_TYPE}"
fi

if [[ ${#AUTH_ARGS[@]} -gt 0 ]]; then
  curl -sS -X POST \
    "${HOST%/}/api/cron/analytics/reconcile?${QUERY}" \
    "${AUTH_ARGS[@]}" \
    -H "Content-Type: application/json" | jq
else
  curl -sS -X POST \
    "${HOST%/}/api/cron/analytics/reconcile?${QUERY}" \
    -H "Content-Type: application/json" | jq
fi
