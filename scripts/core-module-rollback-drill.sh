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
DRILL_EXECUTE="${DRILL_EXECUTE:-0}"
DRILL_CONFIRM_MODULE="${DRILL_CONFIRM_MODULE:-}"
DRILL_DISABLE_FLAG="${DRILL_DISABLE_FLAG:-0}"
CORE_CERT_BASE_URL="${CORE_CERT_BASE_URL:-https://strktr.vercel.app}"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/${MODULE_SLUG}-rollback-drill-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PROJECT_META="$ROOT_DIR/.vercel/project.json"
HEALTH_PRE="$TMP_DIR/health-pre.json"
HEALTH_POST_OFF="$TMP_DIR/health-post-off.json"
HEALTH_POST_ON="$TMP_DIR/health-post-on.json"
HEALTH_ERR="$TMP_DIR/health.err"
VALIDATOR_PRE="$TMP_DIR/validator-pre.log"
VALIDATOR_OFF="$TMP_DIR/validator-off.log"
VALIDATOR_ON="$TMP_DIR/validator-on.log"
VERCEL_API_LOG="$TMP_DIR/vercel-api.log"

if [[ "$DRILL_EXECUTE" == "1" && "$DRILL_CONFIRM_MODULE" != "$MODULE_SLUG" ]]; then
  echo "Refusing to execute rollback drill without DRILL_CONFIRM_MODULE=${MODULE_SLUG}" >&2
  exit 1
fi

if [[ "$DRILL_EXECUTE" == "1" && ! -f "$PROJECT_META" ]]; then
  echo "Missing .vercel/project.json. This drill must run from a clean linked worktree." >&2
  exit 1
fi

PROJECT_ID=""
TEAM_ID=""
if [[ -f "$PROJECT_META" ]]; then
  PROJECT_ID="$(/usr/bin/python3 - "$PROJECT_META" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
print(data.get('projectId', ''))
PY
)"
  TEAM_ID="$(/usr/bin/python3 - "$PROJECT_META" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
print(data.get('orgId', ''))
PY
)"
fi

VERCEL_TOKEN="${VERCEL_TOKEN:-}"
if [[ -z "$VERCEL_TOKEN" && -f "$ROOT_DIR/vercel_keys.env.codex.txt" ]]; then
  VERCEL_TOKEN="$(grep '^VERCEL_TOKEN=' "$ROOT_DIR/vercel_keys.env.codex.txt" | cut -d= -f2- || true)"
fi

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

now_epoch() {
  /bin/date +%s
}

json_field() {
  local input_file="$1"
  local expression="$2"
  /usr/bin/python3 - "$input_file" "$expression" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
expr = sys.argv[2].split('.')
value = payload
for part in expr:
    if not part:
        continue
    if isinstance(value, dict):
        value = value.get(part)
    else:
        value = None
        break
print("" if value is None else value)
PY
}

fetch_health() {
  local output_file="$1"
  if /usr/bin/curl -sS --connect-timeout 5 -m 25 \
    "${CORE_CERT_BASE_URL}/api/v1/health/ops" >"$output_file" 2>>"$HEALTH_ERR"; then
    return 0
  fi

  if command -v vercel >/dev/null 2>&1 && [[ -f "vercel_keys.env.codex.txt" ]]; then
    local vercel_token
    vercel_token="$(grep '^VERCEL_TOKEN=' vercel_keys.env.codex.txt | cut -d= -f2- || true)"
    if [[ -n "$vercel_token" ]]; then
      local raw_output="$TMP_DIR/health.raw"
      if vercel curl /api/v1/health/ops \
        --deployment "$CORE_CERT_BASE_URL" \
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

run_validator() {
  local log_file="$1"
  if bash -lc "$VALIDATOR_COMMAND" >"$log_file" 2>&1; then
    return 0
  fi

  return 1
}

require_vercel_api() {
  if [[ -z "$VERCEL_TOKEN" || -z "$PROJECT_ID" || -z "$TEAM_ID" ]]; then
    echo "Missing Vercel credentials or project metadata for executable drill." >&2
    echo "VERCEL_TOKEN present: $([[ -n "$VERCEL_TOKEN" ]] && echo yes || echo no)" >&2
    echo "PROJECT_ID: ${PROJECT_ID:-missing}" >&2
    echo "TEAM_ID: ${TEAM_ID:-missing}" >&2
    exit 1
  fi
}

upsert_vercel_env() {
  local key="$1"
  local value="$2"

  require_vercel_api

  local list_file="$TMP_DIR/env-list-${key}.json"
  /usr/bin/curl -sS "https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" >"$list_file" 2>>"$VERCEL_API_LOG"

  /usr/bin/python3 - "$list_file" "$key" <<'PY' >"$TMP_DIR/env-ids-${key}.txt"
import json, sys
data = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
needle = sys.argv[2]
for item in data.get('envs', []):
    if item.get('key') == needle and 'production' in (item.get('target') or []):
        print(item.get('id', ''))
PY

  if [[ -s "$TMP_DIR/env-ids-${key}.txt" ]]; then
    while IFS= read -r env_id; do
      [[ -z "$env_id" ]] && continue
      /usr/bin/curl -sS -X DELETE "https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${env_id}?teamId=${TEAM_ID}" \
        -H "Authorization: Bearer ${VERCEL_TOKEN}" >>"$VERCEL_API_LOG" 2>&1
    done <"$TMP_DIR/env-ids-${key}.txt"
  fi

  /usr/bin/python3 - "$key" "$value" <<'PY' >"$TMP_DIR/env-body-${key}.json"
import json, sys
key, value = sys.argv[1], sys.argv[2]
print(json.dumps({
    "key": key,
    "value": value,
    "type": "encrypted",
    "target": ["production"]
}))
PY

  /usr/bin/curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    --data @"$TMP_DIR/env-body-${key}.json" >>"$VERCEL_API_LOG" 2>&1
}

redeploy_live() {
  require_vercel_api

  local deployment_url
  deployment_url="$(json_field "$HEALTH_PRE" "data.deploymentUrl")"
  if [[ -z "$deployment_url" ]]; then
    deployment_url="$CORE_CERT_BASE_URL"
  fi

  vercel redeploy "$deployment_url" --token "$VERCEL_TOKEN" --scope "$TEAM_ID" --yes >/dev/null
}

wait_for_health_target() {
  local expected_percent="$1"
  local expected_flag="$2"
  local output_file="$3"

  local deadline=$(( $(now_epoch) + 600 ))
  while [[ $(now_epoch) -lt $deadline ]]; do
    if fetch_health "$output_file"; then
      local status rollout_percent feature_flag
      status="$(json_field "$output_file" "data.status")"
      rollout_percent="$(json_field "$output_file" "data.rollout.${HEALTH_ROLLOUT_KEY}.percent")"
      feature_flag="$(json_field "$output_file" "data.flags.${FLAG_ENV#NEXT_PUBLIC_FF_}")"
      if [[ "$status" == "ok" && "$rollout_percent" == "$expected_percent" ]]; then
        if [[ "$expected_flag" == "*" || "$feature_flag" == "$expected_flag" ]]; then
          return 0
        fi
      fi
    fi
    sleep 10
  done

  return 1
}

if ! fetch_health "$HEALTH_PRE"; then
  echo "Unable to read /api/v1/health/ops. See $HEALTH_ERR" >&2
  exit 1
fi

VALIDATOR_PRE_OK="false"
VALIDATOR_OFF_OK="false"
VALIDATOR_ON_OK="false"
HEALTH_OFF_OK="false"
HEALTH_ON_OK="false"
T_OFF_START=""
T_OFF_HEALTHY=""
T_ON_START=""
T_ON_HEALTHY=""
TTR_OFF="[fill]"
TTR_ON="[fill]"
EXECUTION_MODE="plan"

if run_validator "$VALIDATOR_PRE"; then
  VALIDATOR_PRE_OK="true"
fi

if [[ "$DRILL_EXECUTE" == "1" ]]; then
  EXECUTION_MODE="execute"
  T_OFF_START="$(timestamp)"
  local_off_start="$(now_epoch)"
  upsert_vercel_env "$PERCENT_ENV" "0"
  if [[ "$DRILL_DISABLE_FLAG" == "1" ]]; then
    upsert_vercel_env "$FLAG_ENV" "false"
  fi
  redeploy_live
  if wait_for_health_target "0" "$([[ "$DRILL_DISABLE_FLAG" == "1" ]] && echo "false" || echo "*")" "$HEALTH_POST_OFF"; then
    HEALTH_OFF_OK="true"
    T_OFF_HEALTHY="$(timestamp)"
    TTR_OFF="$(( $(now_epoch) - local_off_start ))"
  elif fetch_health "$HEALTH_POST_OFF"; then
    :
  fi
  if run_validator "$VALIDATOR_OFF"; then
    VALIDATOR_OFF_OK="true"
  fi

  T_ON_START="$(timestamp)"
  local_on_start="$(now_epoch)"
  upsert_vercel_env "$FLAG_ENV" "true"
  upsert_vercel_env "$PERCENT_ENV" "100"
  redeploy_live
  if wait_for_health_target "100" "true" "$HEALTH_POST_ON"; then
    HEALTH_ON_OK="true"
    T_ON_HEALTHY="$(timestamp)"
    TTR_ON="$(( $(now_epoch) - local_on_start ))"
  elif fetch_health "$HEALTH_POST_ON"; then
    :
  fi
  if run_validator "$VALIDATOR_ON"; then
    VALIDATOR_ON_OK="true"
  fi
else
  fetch_health "$HEALTH_POST_OFF" >/dev/null 2>&1 || true
  fetch_health "$HEALTH_POST_ON" >/dev/null 2>&1 || true
fi

{
  echo "# ${MODULE_TITLE} Rollback Drill"
  echo
  echo "- GeneratedAt: $(timestamp)"
  echo "- Operator: ${USER:-unknown}"
  echo "- ModuleSlug: ${MODULE_SLUG}"
  echo "- ExecutionMode: ${EXECUTION_MODE}"
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
  if [[ "$EXECUTION_MODE" == "execute" ]]; then
    echo "- Applied \`${PERCENT_ENV}=0\`."
    if [[ "$DRILL_DISABLE_FLAG" == "1" ]]; then
      echo "- Applied \`${FLAG_ENV}=false\`."
    else
      echo "- Feature flag left enabled; rollout percent only."
    fi
    echo "- Production redeployed from clean worktree."
  else
    echo "1. Set \`${PERCENT_ENV}=0\`."
    echo "2. Optional hard kill-switch: set \`${FLAG_ENV}=false\`."
    echo "3. Redeploy production from the clean worktree only."
    echo "4. Run validator: \`${VALIDATOR_COMMAND}\`."
  fi
  echo
  echo '```json'
  if [[ -s "$HEALTH_POST_OFF" ]]; then
    cat "$HEALTH_POST_OFF"
  else
    echo "{}"
  fi
  echo '```'
  echo
  echo "Validator output after OFF:"
  echo '```text'
  if [[ -s "$VALIDATOR_OFF" ]]; then
    cat "$VALIDATOR_OFF"
  else
    echo "[not executed]"
  fi
  echo '```'
  echo
  echo "## Step 2 — Toggle ON"
  if [[ "$EXECUTION_MODE" == "execute" ]]; then
    echo "- Restored \`${FLAG_ENV}=true\`."
    echo "- Restored \`${PERCENT_ENV}=100\`."
    echo "- Production redeployed from clean worktree."
  else
    echo "1. Restore \`${FLAG_ENV}=true\` if it was disabled."
    echo "2. Restore \`${PERCENT_ENV}=100\`."
    echo "3. Redeploy production from the clean worktree only."
    echo "4. Run validator: \`${VALIDATOR_COMMAND}\`."
  fi
  echo
  echo '```json'
  if [[ -s "$HEALTH_POST_ON" ]]; then
    cat "$HEALTH_POST_ON"
  else
    echo "{}"
  fi
  echo '```'
  echo
  echo "Validator output after ON:"
  echo '```text'
  if [[ -s "$VALIDATOR_ON" ]]; then
    cat "$VALIDATOR_ON"
  else
    echo "[not executed]"
  fi
  echo '```'
  echo
  echo "## Validator Output Before Drill"
  echo '```text'
  if [[ -s "$VALIDATOR_PRE" ]]; then
    cat "$VALIDATOR_PRE"
  else
    echo "[not executed]"
  fi
  echo '```'
  echo
  echo "## TTR Record"
  echo "- Toggle OFF start: ${T_OFF_START:-[fill]}"
  echo "- Toggle OFF healthy: ${T_OFF_HEALTHY:-[fill]}"
  echo "- TTR OFF (seconds): ${TTR_OFF}"
  echo "- Toggle ON start: ${T_ON_START:-[fill]}"
  echo "- Toggle ON healthy: ${T_ON_HEALTHY:-[fill]}"
  echo "- TTR ON (seconds): ${TTR_ON}"
  echo
  echo "## Acceptance"
  echo "- [$([[ "$VALIDATOR_PRE_OK" == "true" ]] && echo x || echo ' ')] \`${VALIDATOR_COMMAND}\` passed before drill"
  echo "- [$([[ "$HEALTH_OFF_OK" == "true" ]] && echo x || echo ' ')] \`health/ops=ok\` after OFF"
  echo "- [$([[ "$VALIDATOR_OFF_OK" == "true" ]] && echo x || echo ' ')] \`${VALIDATOR_COMMAND}\` passed after OFF"
  echo "- [$([[ "$HEALTH_ON_OK" == "true" ]] && echo x || echo ' ')] \`health/ops=ok\` after ON"
  echo "- [$([[ "$VALIDATOR_ON_OK" == "true" ]] && echo x || echo ' ')] \`${VALIDATOR_COMMAND}\` passed after ON"
  echo "- [ ] No spike in 5xx during drill"
  echo "- [ ] No spike in JS errors during drill"
  if [[ -s "$VERCEL_API_LOG" ]]; then
    echo
    echo "## Vercel API Log"
    echo '```text'
    cat "$VERCEL_API_LOG"
    echo '```'
  fi
} >"$REPORT"

echo "${MODULE_TITLE} rollback drill report generated: $REPORT"
