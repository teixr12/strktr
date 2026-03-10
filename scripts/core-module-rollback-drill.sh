#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 6 ]]; then
  echo "Usage: $0 <module-slug> <module-title> <flag-env> <percent-env> <health-rollout-key> <validator-command>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODULE_SLUG="$1"
MODULE_TITLE="$2"
FLAG_ENV="$3"
PERCENT_ENV="$4"
HEALTH_ROLLOUT_KEY="$5"
VALIDATOR_COMMAND="$6"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/${MODULE_SLUG}-rollback-drill-${STAMP}.md"
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
  echo "# ${MODULE_TITLE} Rollback Drill"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- Operator: ${USER:-unknown}"
  echo "- ModuleSlug: ${MODULE_SLUG}"
  echo "- FlagEnv: \`${FLAG_ENV}\`"
  echo "- PercentEnv: \`${PERCENT_ENV}\`"
  echo "- HealthRolloutKey: \`${HEALTH_ROLLOUT_KEY}\`"
  echo "- Validator: \`${VALIDATOR_COMMAND}\`"
  echo
  echo "## Step 0 — Baseline Snapshot"
  echo '```json'
  cat "$HEALTH_PRE"
  echo '```'
  echo
  echo "## Step 1 — Toggle OFF"
  echo "1. Set \`${PERCENT_ENV}=0\`."
  echo "2. Optional hard kill-switch: set \`${FLAG_ENV}=false\`."
  echo "3. Redeploy production from the clean worktree only."
  echo "4. Run validator: \`${VALIDATOR_COMMAND}\`."
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
  echo "1. Restore \`${FLAG_ENV}=true\` if it was disabled."
  echo "2. Restore \`${PERCENT_ENV}=100\`."
  echo "3. Redeploy production from the clean worktree only."
  echo "4. Run validator: \`${VALIDATOR_COMMAND}\`."
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
  echo "- [ ] \`${VALIDATOR_COMMAND}\` passed before drill"
  echo "- [ ] \`health/ops=ok\` after OFF"
  echo "- [ ] \`${VALIDATOR_COMMAND}\` passed after OFF"
  echo "- [ ] \`health/ops=ok\` after ON"
  echo "- [ ] \`${VALIDATOR_COMMAND}\` passed after ON"
  echo "- [ ] No spike in 5xx during drill"
  echo "- [ ] No spike in JS errors during drill"
} >"$REPORT"

echo "${MODULE_TITLE} rollback drill report generated: $REPORT"
