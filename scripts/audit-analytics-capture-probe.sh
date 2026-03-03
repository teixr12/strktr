#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/analytics-capture-probe-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

POSTHOG_HOST="${POSTHOG_HOST:-https://app.posthog.com}"
POSTHOG_PROJECT_ID="${POSTHOG_PROJECT_ID:-}"
POSTHOG_API_KEY="${POSTHOG_API_KEY:-}"
POSTHOG_PROJECT_TOKEN="${POSTHOG_PROJECT_TOKEN:-}"
NEXT_PUBLIC_POSTHOG_KEY="${NEXT_PUBLIC_POSTHOG_KEY:-}"

if [[ -f "posthog-credentials.txt" ]]; then
  POSTHOG_PROJECT_ID="${POSTHOG_PROJECT_ID:-$(grep '^POSTHOG_PROJECT_ID=' posthog-credentials.txt | cut -d= -f2-)}"
  POSTHOG_API_KEY="${POSTHOG_API_KEY:-$(grep '^POSTHOG_API_KEY=' posthog-credentials.txt | cut -d= -f2-)}"
  POSTHOG_PROJECT_TOKEN="${POSTHOG_PROJECT_TOKEN:-$(grep '^POSTHOG_PROJECT_TOKEN=' posthog-credentials.txt | cut -d= -f2-)}"
fi

CAPTURE_KEY="${NEXT_PUBLIC_POSTHOG_KEY:-$POSTHOG_PROJECT_TOKEN}"

PROBE_STATUS="skip"
PROBE_COUNT="0"
PROBE_ID="ops-probe-$(date +%s)-$RANDOM"
PROBE_MESSAGE="capture probe não executado"

if [[ -n "$POSTHOG_PROJECT_ID" && -n "$POSTHOG_API_KEY" && -n "$CAPTURE_KEY" ]]; then
  CAPTURE_PAYLOAD="$(jq -n \
    --arg key "$CAPTURE_KEY" \
    --arg id "$PROBE_ID" \
    '{api_key:$key,event:"ops_capture_probe",distinct_id:$id,properties:{source:"ops",route:"/ops/probe",probe_id:$id}}')"

  curl -sS -X POST "${POSTHOG_HOST%/}/capture/" \
    -H "Content-Type: application/json" \
    --data "$CAPTURE_PAYLOAD" > "$TMP_DIR/capture.json"

  query_probe() {
    local attempt="$1"
    local query_payload
    query_payload="$(jq -n \
      --arg probe "$PROBE_ID" \
      --arg attempt "$attempt" \
      '{query:{kind:"HogQLQuery",query:("SELECT count(*) FROM events WHERE event = '\''ops_capture_probe'\'' AND distinct_id = '\''" + $probe + "'\'' AND timestamp >= now() - INTERVAL 30 minute /*attempt:" + $attempt + "*/")}}')"

    curl -sS -X POST "${POSTHOG_HOST%/}/api/projects/${POSTHOG_PROJECT_ID}/query/" \
      -H "Authorization: Bearer ${POSTHOG_API_KEY}" \
      -H "Content-Type: application/json" \
      --data "$query_payload" > "$TMP_DIR/query.json"

    jq -r '.results[0][0] // 0' "$TMP_DIR/query.json"
  }

  for attempt in 1 2 3 4 5 6 7 8; do
    PROBE_COUNT="$(query_probe "$attempt")"
    if [[ "$PROBE_COUNT" != "0" ]]; then
      break
    fi
    sleep 4
  done

  CAPTURE_STATUS="$(jq -r '.status // empty' "$TMP_DIR/capture.json")"

  if [[ "$CAPTURE_STATUS" == "Ok" && "$PROBE_COUNT" != "0" ]]; then
    PROBE_STATUS="pass"
    PROBE_MESSAGE="evento de probe capturado no PostHog"
  else
    PROBE_STATUS="warn"
    PROBE_MESSAGE="evento de probe não encontrado no PostHog"
  fi
else
  PROBE_STATUS="warn"
  PROBE_MESSAGE="credenciais insuficientes para probe (project_id, api_key de query e capture key)"
fi

{
  echo "# Analytics Capture Probe Report"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- Host: ${POSTHOG_HOST}"
  echo "- ProbeId: ${PROBE_ID}"
  echo "- ProbeCount(30m): ${PROBE_COUNT}"
  echo "- Status: ${PROBE_STATUS}"
  echo "- Message: ${PROBE_MESSAGE}"
  echo
  echo "## Raw Capture JSON"
  echo '```json'
  if [[ -f "$TMP_DIR/capture.json" ]]; then
    cat "$TMP_DIR/capture.json"
  else
    echo "{}"
  fi
  echo
  echo '```'
  echo
  echo "## Raw Query JSON"
  echo '```json'
  if [[ -f "$TMP_DIR/query.json" ]]; then
    cat "$TMP_DIR/query.json"
  else
    echo "{}"
  fi
  echo
  echo '```'
} > "$REPORT"

echo "Analytics capture probe generated: $REPORT"
echo "PROBE_STATUS=${PROBE_STATUS}"
echo "PROBE_COUNT=${PROBE_COUNT}"
echo "PROBE_ID=${PROBE_ID}"

if [[ "${PROBE_STRICT:-0}" == "1" && "$PROBE_STATUS" != "pass" ]]; then
  echo "Analytics capture probe failed in strict mode." >&2
  exit 1
fi
