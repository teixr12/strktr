#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/analytics-drift-7d-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INTERNAL_OUT="$TMP_DIR/internal_7d.json"
EXTERNAL_OUT="$TMP_DIR/external_7d.json"
MERGED_OUT="$TMP_DIR/merged_7d.json"

if ./scripts/supabase-query.sh supabase/sql/audit_analytics_internal_7d_daily.sql > "$INTERNAL_OUT"; then
  INTERNAL_STATUS="ok"
else
  echo "Failed to query internal analytics daily counts (7d)." >&2
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
  QUERY_NONCE="$(date +%s)-$RANDOM"
  cat > "$TMP_DIR/posthog_payload.json" <<'JSON'
{
  "query": {
    "kind": "HogQLQuery",
    "query": "__POSTHOG_HOGQL_QUERY__"
  }
}
JSON

  HOGQL_QUERY="SELECT toDate(timestamp) AS day, event, count(DISTINCT if(event = 'portal_approval_decision', coalesce(nullIf(toString(properties['_event_id']), ''), toString(uuid)), toString(uuid))) AS total FROM events WHERE timestamp >= now() - INTERVAL 7 day AND ((event = 'PageViewed' AND properties['user_id'] IS NOT NULL) OR (event = 'ChecklistItemToggled' AND properties['source'] = 'server') OR (event = 'portal_approval_decision' AND properties['source'] = 'server') OR (event IN ('core_create','core_move'))) GROUP BY day, event ORDER BY day, event /* nonce:${QUERY_NONCE} */"

  jq --arg query "$HOGQL_QUERY" '.query.query = $query' "$TMP_DIR/posthog_payload.json" > "$TMP_DIR/posthog_payload.resolved.json"

  if curl -sS -X POST "${POSTHOG_HOST%/}/api/projects/${POSTHOG_PROJECT_ID}/query/" \
    -H "Authorization: Bearer ${POSTHOG_API_KEY}" \
    -H "Content-Type: application/json" \
    --data @"$TMP_DIR/posthog_payload.resolved.json" \
    > "$TMP_DIR/posthog_raw.json"; then
    if jq -e '
      type == "object"
      and (.results? | type == "array")
    ' "$TMP_DIR/posthog_raw.json" > /dev/null 2>&1; then
      jq '[
        .results[]?
        | select(type == "array" and length >= 3)
        | {
            day: (.[0] | tostring),
            event_type: (.[1] | tostring),
            external_total_day: ((.[2] | tonumber?) // 0)
          }
      ]' "$TMP_DIR/posthog_raw.json" > "$EXTERNAL_OUT"
      EXTERNAL_STATUS="ok"
    else
      echo "PostHog daily query returned an unexpected payload shape; treating external source as unavailable." >&2
      echo '[]' > "$EXTERNAL_OUT"
      EXTERNAL_STATUS="failed"
    fi
  else
    echo "PostHog daily query failed; treating external source as unavailable." >&2
    echo '[]' > "$EXTERNAL_OUT"
    EXTERNAL_STATUS="failed"
  fi
else
  echo '[]' > "$EXTERNAL_OUT"
fi

jq -n \
  --argjson internal "$(cat "$INTERNAL_OUT")" \
  --argjson external "$(cat "$EXTERNAL_OUT")" '
    (
      if ($external | type) == "array" then
        $external
        | map(
            select(
              type == "object"
              and (.day? | type == "string")
              and (.event_type? | type == "string")
            )
          )
        | map({ key: (.day + "|" + .event_type), value: (.external_total_day // 0) })
        | from_entries
      else
        {}
      end
    ) as $ext_map
    | $internal
    | map(
        . as $i
        | ($i.day + "|" + $i.event_type) as $key
        | ($ext_map[$key] // 0) as $ext
        | {
            day: $i.day,
            event_type: $i.event_type,
            internal_total_day: ($i.internal_total_day | tonumber),
            external_total_day: ($ext | tonumber),
            drift_pct: (
              if (($i.internal_total_day | tonumber) == 0) then
                (if ($ext | tonumber) == 0 then 0 else null end)
              else
                (((($ext | tonumber) - ($i.internal_total_day | tonumber)) / ($i.internal_total_day | tonumber) * 10000) | round / 100)
              end
            )
          }
      )
  ' > "$MERGED_OUT"

MAX_ABS_DRIFT="$(jq '[.[] | .drift_pct | select(. != null) | if . < 0 then -. else . end] | if length == 0 then 0 else max end' "$MERGED_OUT")"
WARN_COUNT="$(jq '[.[] | select(.drift_pct == null or ((.drift_pct | if . < 0 then -. else . end) > 5))] | length' "$MERGED_OUT")"

DRIFT_STATUS="pass"
if [[ "$EXTERNAL_STATUS" != "ok" ]]; then
  DRIFT_STATUS="warn"
fi
if [[ "$WARN_COUNT" -gt 0 ]]; then
  DRIFT_STATUS="warn"
fi

{
  echo "# Analytics Drift Report (7d Daily)"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- InternalSource: ${INTERNAL_STATUS}"
  echo "- ExternalSource: ${EXTERNAL_STATUS}"
  echo "- MaxAbsDriftPct: ${MAX_ABS_DRIFT}"
  echo "- OutOfPolicyRows: ${WARN_COUNT}"
  echo "- Status: ${DRIFT_STATUS}"
  echo
  echo "| Day (UTC) | Event | Internal | External | Drift % |"
  echo "|---|---|---:|---:|---:|"
  jq -r '.[] | "| \(.day) | \(.event_type) | \(.internal_total_day) | \(.external_total_day) | \((if .drift_pct == null then "n/a" else (.drift_pct|tostring) end)) |"' "$MERGED_OUT"
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

echo "Analytics 7d drift report generated: $REPORT"
if [[ "${DRIFT_7D_STRICT:-0}" == "1" && "$DRIFT_STATUS" != "pass" ]]; then
  echo "Analytics 7d drift strict mode failed (status=${DRIFT_STATUS}, max_abs_drift=${MAX_ABS_DRIFT}, out_of_policy=${WARN_COUNT})." >&2
  exit 2
fi
