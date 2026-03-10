#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HEALTH_JSON="${CORE_CERT_HEALTH_JSON:-}"
CHECK_RUNS_JSON="${CORE_CERT_CHECK_RUNS_JSON:-}"
AUTH_STATUS="${CORE_CERT_AUTH_STRICT_STATUS:-}"

if [[ -z "$AUTH_STATUS" && -n "$CHECK_RUNS_JSON" && -f "$CHECK_RUNS_JSON" ]]; then
  AUTH_STATUS="$(jq -r '[.check_runs[] | select(.name == "quality")][0].conclusion // "unknown"' "$CHECK_RUNS_JSON")"
fi

if [[ -z "$AUTH_STATUS" && -n "$HEALTH_JSON" && -f "$HEALTH_JSON" ]]; then
  SHA="$(jq -r '.data.version // empty' "$HEALTH_JSON")"
  if [[ -n "$SHA" ]]; then
    if CHECKS_JSON="$(gh api "repos/teixr12/strktr/commits/${SHA}/check-runs" 2>/dev/null)"; then
      AUTH_STATUS="$(printf '%s' "$CHECKS_JSON" | jq -r '[.check_runs[] | select(.name == "quality")][0].conclusion // "unknown"')"
    fi
  fi
fi

export CORE_CERT_AUTH_STRICT_STATUS="${AUTH_STATUS:-unknown}"
exec node "$ROOT_DIR/scripts/validate-core-operational-certification.mjs"
