#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/analytics-drift-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INTERNAL_OUT="$TMP_DIR/internal.json"
EXTERNAL_OUT="$TMP_DIR/external.json"
MERGED_OUT="$TMP_DIR/merged.json"

INTERNAL_STATUS="failed"
if ./scripts/supabase-query.sh supabase/sql/audit_analytics_internal_24h.sql > "$INTERNAL_OUT"; then
  INTERNAL_STATUS="ok"
else
  echo "Failed to query internal analytics (Supabase)." >&2
  exit 1
fi

POSTHOG_HOST="${POSTHOG_HOST:-https://app.posthog.com}"
POSTHOG_PROJECT_ID="${POSTHOG_PROJECT_ID:-}"
POSTHOG_API_KEY="${POSTHOG_API_KEY:-}"

if [[ -z "$POSTHOG_PROJECT_ID" || -z "$POSTHOG_API_KEY" ]] && [[ -f "posthog-credentials.txt" ]]; then
  POSTHOG_PROJECT_ID="${POSTHOG_PROJECT_ID:-$(grep '^POSTHOG_PROJECT_ID=' posthog-credentials.txt | cut -d= -f2-)}"
  POSTHOG_API_KEY="${POSTHOG_API_KEY:-$(grep '^POSTHOG_API_KEY=' posthog-credentials.txt | cut -d= -f2-)}"
fi

EXTERNAL_STATUS="skipped"
if [[ -n "$POSTHOG_PROJECT_ID" && -n "$POSTHOG_API_KEY" ]]; then
  cat > "$TMP_DIR/posthog_payload.json" <<'JSON'
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT event, count(*) AS total FROM events WHERE timestamp >= now() - INTERVAL 24 hour AND event IN ('PageViewed','core_create','core_move','portal_approval_decision','ChecklistItemToggled') GROUP BY event ORDER BY event"
  }
}
JSON

  if curl -sS -X POST "${POSTHOG_HOST%/}/api/projects/${POSTHOG_PROJECT_ID}/query/" \
    -H "Authorization: Bearer ${POSTHOG_API_KEY}" \
    -H "Content-Type: application/json" \
    --data @"$TMP_DIR/posthog_payload.json" \
    > "$TMP_DIR/posthog_raw.json"; then
    jq '[.results[]? | { event_type: .[0], external_total_24h: (.[1] | tonumber) }]' "$TMP_DIR/posthog_raw.json" > "$EXTERNAL_OUT"
    EXTERNAL_STATUS="ok"
  else
    EXTERNAL_STATUS="failed"
    echo '[]' > "$EXTERNAL_OUT"
  fi
else
  echo '[]' > "$EXTERNAL_OUT"
fi

jq -n \
  --argjson internal "$(cat "$INTERNAL_OUT")" \
  --argjson external "$(cat "$EXTERNAL_OUT")" '
    ($external | map({ key: .event_type, value: .external_total_24h }) | from_entries) as $ext_map
    | $internal
    | map(
        . as $i
        | ($ext_map[$i.event_type] // 0) as $ext
        | {
            event_type: $i.event_type,
            internal_total_24h: ($i.internal_total_24h | tonumber),
            external_total_24h: ($ext | tonumber),
            drift_pct: (
              if (($i.internal_total_24h | tonumber) == 0) then
                (if ($ext | tonumber) == 0 then 0 else null end)
              else
                (((($ext | tonumber) - ($i.internal_total_24h | tonumber)) / ($i.internal_total_24h | tonumber) * 10000) | round / 100)
              end
            )
          }
      )
  ' > "$MERGED_OUT"

MAX_ABS_DRIFT="$(jq '[.[] | .drift_pct | select(. != null) | if . < 0 then -. else . end] | if length == 0 then 0 else max end' "$MERGED_OUT")"
DRIFT_STATUS="pass"
if jq -e '.[] | select(.drift_pct == null)' "$MERGED_OUT" >/dev/null 2>&1; then
  DRIFT_STATUS="warn"
fi
if awk "BEGIN { exit !($MAX_ABS_DRIFT > 5.0) }"; then
  DRIFT_STATUS="warn"
fi

{
  echo "# Analytics Drift Report (24h)"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- InternalSource: ${INTERNAL_STATUS}"
  echo "- ExternalSource: ${EXTERNAL_STATUS}"
  echo "- MaxAbsDriftPct: ${MAX_ABS_DRIFT}"
  echo "- Status: ${DRIFT_STATUS}"
  echo
  echo "| Event | Internal (24h) | External (24h) | Drift % |"
  echo "|---|---:|---:|---:|"
  jq -r '.[] | "| \(.event_type) | \(.internal_total_24h) | \(.external_total_24h) | \((if .drift_pct == null then "n/a" else (.drift_pct|tostring) end)) |"' "$MERGED_OUT"
  echo
  echo "## Raw Internal JSON"
  echo '```json'
  cat "$INTERNAL_OUT"
  echo
  echo '```'
  echo
  echo "## Raw External JSON"
  echo '```json'
  cat "$EXTERNAL_OUT"
  echo
  echo '```'
} > "$REPORT"

echo "Analytics drift report generated: $REPORT"
