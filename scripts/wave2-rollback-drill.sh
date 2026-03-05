#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/wave2-rollback-drill-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

HEALTH_PRE="$TMP_DIR/health-pre.json"
HEALTH_POST_OFF="$TMP_DIR/health-post-off.json"
HEALTH_POST_ON="$TMP_DIR/health-post-on.json"
HEALTH_ERR="$TMP_DIR/health.err"

fetch_health() {
  local output_file="$1"
  if /usr/bin/curl -sS --connect-timeout 5 -m 25 \
    "https://strktr.vercel.app/api/v1/health/ops" >"$output_file" 2>>"$HEALTH_ERR"; then
    return 0
  fi

  if command -v vercel >/dev/null 2>&1 && [[ -f "vercel_keys.env.codex.txt" ]]; then
    local vercel_token
    vercel_token="$(grep '^VERCEL_TOKEN=' vercel_keys.env.codex.txt | cut -d= -f2- || true)"
    if [[ -n "$vercel_token" ]]; then
      local raw_output="$TMP_DIR/health.raw"
      if vercel curl /api/v1/health/ops \
        --deployment https://strktr.vercel.app \
        --token "$vercel_token" >"$raw_output" 2>>"$HEALTH_ERR"; then
        /usr/bin/python3 - "$raw_output" "$output_file" <<'PY'
import sys
raw_path, output_path = sys.argv[1], sys.argv[2]
text = open(raw_path, "r", encoding="utf-8", errors="ignore").read()
start = text.find('{"data":')
if start < 0:
    raise SystemExit(1)
depth = 0
end = None
for idx in range(start, len(text)):
    ch = text[idx]
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            end = idx + 1
            break
if end is None:
    raise SystemExit(1)
open(output_path, "w", encoding="utf-8").write(text[start:end] + "\n")
PY
        return 0
      fi
    fi
  fi

  return 1
}

if ! fetch_health "$HEALTH_PRE"; then
  echo "Unable to read /api/v1/health/ops. See $HEALTH_ERR" >&2
  exit 1
fi

{
  echo "# Wave2 Rollback Drill"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- Operator: ${USER:-unknown}"
  echo "- DrillScope: NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1 + NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1"
  echo
  echo "## Step 0 — Baseline Snapshot"
  echo '```json'
  cat "$HEALTH_PRE"
  echo '```'
  echo
  echo "## Step 1 — Toggle OFF"
  echo '1. Set `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1=false`.'
  echo '2. Set `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1=false`.'
  echo "3. Redeploy production."
  echo '4. Run smoke for `/obras/:id` (location + weather + logistics + alerts).'
  echo
  echo "Paste health snapshot after OFF toggle below:"
  echo '```json'
  if fetch_health "$HEALTH_POST_OFF"; then
    cat "$HEALTH_POST_OFF"
  else
    echo "{}"
  fi
  echo '```'
  echo
  echo "## Step 2 — Toggle ON"
  echo '1. Set `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1=true`.'
  echo '2. Set `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1=true`.'
  echo "3. Redeploy production."
  echo "4. Re-run Wave2 smoke."
  echo
  echo "Paste health snapshot after ON restore below:"
  echo '```json'
  if fetch_health "$HEALTH_POST_ON"; then
    cat "$HEALTH_POST_ON"
  else
    echo "{}"
  fi
  echo '```'
  echo
  echo "## TTR Record"
  echo "- Toggle OFF start: [fill]"
  echo "- Toggle OFF healthy: [fill]"
  echo "- TTR OFF (seconds): [fill]"
  echo "- Toggle ON start: [fill]"
  echo "- Toggle ON healthy: [fill]"
  echo "- TTR ON (seconds): [fill]"
  echo
  echo "## Acceptance"
  echo '- [ ] `health/ops=ok` after OFF'
  echo '- [ ] `health/ops=ok` after ON'
  echo "- [ ] Wave2 smoke passed after OFF"
  echo "- [ ] Wave2 smoke passed after ON"
  echo "- [ ] No spike in 5xx or JS errors during drill"
} >"$REPORT"

echo "Wave2 rollback drill report generated: $REPORT"
