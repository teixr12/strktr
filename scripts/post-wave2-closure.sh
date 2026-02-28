#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WITH_READINESS=0
if [[ "${1:-}" == "--with-readiness" ]]; then
  WITH_READINESS=1
fi

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/post-wave2-closure-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

HEALTH_OUT="$TMP_DIR/health.json"
HEALTH_ERR="$TMP_DIR/health.err"
HEALTH_RAW="$TMP_DIR/health.raw"
READINESS_OUT="$TMP_DIR/readiness.log"

BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
HEAD_SUBJECT="$(git log -1 --pretty=%s 2>/dev/null || echo unknown)"

HEALTH_STATUS="failed"
HEALTH_SOURCE="curl"

for _attempt in 1 2 3; do
  if /usr/bin/curl -sS --connect-timeout 5 -m 25 \
    "https://strktr.vercel.app/api/v1/health/ops" >"$HEALTH_OUT" 2>"$HEALTH_ERR"; then
    HEALTH_STATUS="ok"
    break
  fi
  sleep 1
done

if [[ "$HEALTH_STATUS" != "ok" ]]; then
  if command -v vercel >/dev/null 2>&1 && [[ -f "vercel_keys.env.codex.txt" ]]; then
    VERCEL_TOKEN="$(grep '^VERCEL_TOKEN=' vercel_keys.env.codex.txt | cut -d= -f2- || true)"
    if [[ -n "$VERCEL_TOKEN" ]]; then
      if vercel curl /api/v1/health/ops \
        --deployment https://strktr.vercel.app \
        --token "$VERCEL_TOKEN" >"$HEALTH_RAW" 2>&1; then
        JSON_LINE="$(/usr/bin/python3 - "$HEALTH_RAW" <<'PY'
import sys
path = sys.argv[1]
text = open(path, "r", encoding="utf-8", errors="ignore").read()
start = text.find('{"data":')
if start < 0:
    print("")
    raise SystemExit(0)
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
    print("")
else:
    print(text[start:end])
PY
)"
        if [[ -n "$JSON_LINE" ]]; then
          printf '%s\n' "$JSON_LINE" >"$HEALTH_OUT"
          HEALTH_STATUS="ok"
          HEALTH_SOURCE="vercel curl"
        else
          cat "$HEALTH_RAW" >>"$HEALTH_ERR"
        fi
      fi
    fi
  fi
fi

FLAGS_JSON="{}"
APP_VERSION="unknown"
HEALTH_API_STATUS="unknown"
if [[ "$HEALTH_STATUS" == "ok" ]]; then
  if command -v jq >/dev/null 2>&1; then
    FLAGS_JSON="$(jq -c '.data.flags // .data.featureFlags // {}' "$HEALTH_OUT" 2>/dev/null || echo '{}')"
    APP_VERSION="$(jq -r '.data.version // "unknown"' "$HEALTH_OUT" 2>/dev/null || echo unknown)"
    HEALTH_API_STATUS="$(jq -r '.data.status // "unknown"' "$HEALTH_OUT" 2>/dev/null || echo unknown)"
  fi
fi

READINESS_STATUS="skipped"
if [[ "$WITH_READINESS" == "1" ]]; then
  set +e
  ALLOW_BIND_RESTRICTED_E2E_SKIP=1 npm run release:readiness >"$READINESS_OUT" 2>&1
  READY_EXIT=$?
  set -e
  if [[ $READY_EXIT -eq 0 ]]; then
    READINESS_STATUS="ok"
  else
    READINESS_STATUS="failed"
  fi
fi

{
  echo "# STRKTR Post-Wave 2 Closure Report"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- Branch: ${BRANCH}"
  echo "- Head: ${HEAD_SHA}"
  echo "- HeadSubject: ${HEAD_SUBJECT}"
  echo "- HealthCheck: ${HEALTH_STATUS} (source: ${HEALTH_SOURCE})"
  echo "- HealthStatusField: ${HEALTH_API_STATUS}"
  echo "- AppVersion: ${APP_VERSION}"
  echo "- ReleaseReadiness: ${READINESS_STATUS}"
  echo
  echo "## Feature Flags (health snapshot)"
  echo '```json'
  echo "${FLAGS_JSON}"
  echo '```'
  echo
  echo "## Health Response"
  echo '```json'
  cat "$HEALTH_OUT" 2>/dev/null || true
  echo
  echo '```'
  echo
  if [[ "$HEALTH_STATUS" != "ok" ]]; then
    echo "## Health Errors"
    echo '```'
    cat "$HEALTH_ERR" 2>/dev/null || true
    echo
    echo '```'
    echo
  fi
  if [[ "$WITH_READINESS" == "1" ]]; then
    echo "## Release Readiness Output"
    echo '```'
    cat "$READINESS_OUT" 2>/dev/null || true
    echo '```'
    echo
  fi
  echo "## Manual Functional Acceptance Matrix"
  echo "- [ ] Login and session persistence"
  echo "- [ ] Dashboard (light/dark, desktop/mobile)"
  echo "- [ ] Obras (list + detail + tabs)"
  echo "- [ ] Leads (kanban + interaction history)"
  echo "- [ ] Financeiro"
  echo "- [ ] Compras"
  echo "- [ ] Projetos"
  echo "- [ ] Orçamentos"
  echo "- [ ] Equipe"
  echo "- [ ] Agenda"
  echo "- [ ] Knowledge Base"
  echo "- [ ] Configurações"
  echo "- [ ] Perfil"
  echo
  echo "## Monitoring Window (2-4h)"
  echo '- [ ] `/api/v1/health/ops` stable'
  echo "- [ ] JS/Sentry error rate stable"
  echo '- [ ] `/api/v1/*` 5xx stable'
  echo "- [ ] p95 stable for core pages"
  echo
  echo "## Rollback Drill Evidence"
  echo '1. Disable module flag `NEXT_PUBLIC_FF_UI_V2_* = false`.'
  echo "2. Redeploy and validate fallback."
  echo "3. Re-enable module flag and validate."
  echo '4. If needed, disable `NEXT_PUBLIC_FF_UI_TAILADMIN_V1=false`.'
  echo
  echo "## Credential Rotation Checklist (D1)"
  echo '- [ ] `VERCEL_TOKEN`'
  echo '- [ ] `SUPABASE_ACCESS_TOKEN`'
  echo '- [ ] `SUPABASE_SERVICE_ROLE_KEY`'
  echo '- [ ] `SUPABASE_DB_PASSWORD`'
} >"$REPORT"

echo "Post-Wave 2 closure report generated: $REPORT"
